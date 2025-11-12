// src/services/cacheDestinations.js
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc, setDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { searchNearbyPlaces } from './placesService';

const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const TOURISM_TYPES = [
    'tourist_attraction', 'museum', 'park', 'zoo', 'amusement_park',
    'art_gallery', 'church', 'temple', 'spa', 'beach', 'resort', 'restaurant',
    'hiking_area', 'historical_landmark', 'cafe', 'lodging', 'hotel',
    'garden', 'cultural_center', 'viewpoint', 'waterfall'
];

const SENSITIVE_TYPES = [
    'local_government_office', 'political', 'military', 'police',
    'embassy', 'courthouse', 'prison', 'fire_station'
];

const isHighRiskMonth = (province, month) => {
    const highRiskMonths = {
        'Quảng Ninh': [7, 8, 9],
        'Hải Phòng': [7, 8, 9],
        'Thái Bình': [7, 8, 9],
        'Thừa Thiên Huế': [9, 10, 11],
        'Quảng Nam': [9, 10, 11],
        'Quảng Ngãi': [9, 10, 11],
        'Khánh Hòa': [10, 11, 12],
        'Lâm Đồng': [6, 7, 8, 9],
        'Đắk Lắk': [6, 7, 8, 9],
        'Hồ Chí Minh': [],
        'Bình Dương': [],
        'Đồng Nai': [],
        'Bà Rịa - Vũng Tàu': []
    };
    return highRiskMonths[province]?.includes(month) || false;
};

const isCacheExpired = (cachedAt, province) => {
    if (!cachedAt) return true;
    const now = new Date();
    const cacheDate = cachedAt.toDate();
    const daysDiff = (now - cacheDate) / (1000 * 60 * 60 * 24);
    const isHighRisk = isHighRiskMonth(province, now.getMonth() + 1);
    const threshold = isHighRisk ? 7 : 30;
    return daysDiff >= threshold;
};

const isSafePlace = (place) => {
    if (!place || !place.types) return false;
    const hasSensitiveType = place.types.some(type => SENSITIVE_TYPES.includes(type));
    const sensitiveKeywords = ['công an', 'quân đội', 'đồn biên phòng', 'trại giam', 'tòa án'];
    const hasSensitiveName = sensitiveKeywords.some(keyword =>
        place.name?.toLowerCase().includes(keyword)
    );
    return !hasSensitiveType && !hasSensitiveName;
};

// === CẢI TIẾN ALGORITHM: SMART CACHE UPDATE ===
const shouldUpdateCache = async (province, center) => {
    try {
        const cacheRef = collection(db, 'cachedDestinations');
        const q = query(cacheRef, where('province', '==', province));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return true;

        const cachedData = snapshot.docs.map(d => d.data());
        const latestCache = cachedData.reduce((latest, item) => {
            if (!item.cachedAt) return latest;
            const cacheTime = item.cachedAt.toDate();
            return cacheTime > latest ? cacheTime : latest;
        }, new Date(0));

        return isCacheExpired(latestCache, province);
    } catch (error) {
        console.error('Lỗi kiểm tra cache:', error);
        return true;
    }
};

// === CẢI TIẾN ALGORITHM: PRIORITIZED CACHE UPDATE ===
const backgroundCacheUpdate = async (province, center) => {
    try {
        console.log(`[BACKGROUND] Bắt đầu cập nhật cache thông minh cho ${province}`);
        const cacheRef = collection(db, 'cachedDestinations');
        const q = query(cacheRef, where('province', '==', province));
        const existing = await getDocs(q);
        const existingIds = new Set(existing.docs.map(d => d.data().placeId));

        let totalNewDestinations = 0;
        let totalUpdatedDestinations = 0;

        const priorityTypes = ['tourist_attraction', 'restaurant', 'lodging', 'museum', 'park'];
        const secondaryTypes = TOURISM_TYPES.filter(type => !priorityTypes.includes(type));

        for (const type of priorityTypes) {
            try {
                const results = await searchNearbyPlaces({
                    location: new window.google.maps.LatLng(center.lat, center.lng),
                    radius: 30000,
                    type
                });

                const batch = writeBatch(db);
                let batchCount = 0;

                for (const place of results) {
                    if (isSafePlace(place) && place.rating >= 3.5 && place.user_ratings_total >= 10) {
                        if (existingIds.has(place.place_id)) {
                            const existingDoc = existing.docs.find(d => d.data().placeId === place.place_id);
                            if (existingDoc) {
                                batch.update(existingDoc.ref, {
                                    rating: place.rating,
                                    userRatingsTotal: place.user_ratings_total,
                                    priceLevel: place.price_level,
                                    cachedAt: serverTimestamp(),
                                });
                                batchCount++;
                                totalUpdatedDestinations++;
                            }
                        } else {
                            const docRef = doc(cacheRef);
                            batch.set(docRef, {
                                placeId: place.place_id,
                                name: place.name,
                                address: place.vicinity || '',
                                rating: place.rating || 3.5,
                                userRatingsTotal: place.user_ratings_total || 10,
                                lat: place.geometry?.location?.lat() || center.lat,
                                lng: place.geometry?.location?.lng() || center.lng,
                                types: place.types || [type],
                                province,
                                photoRef: place.photos?.[0]?.getUrl?.({ maxWidth: 400 }) || null,
                                priceLevel: place.price_level || null,
                                cachedAt: serverTimestamp(),
                            });
                            batchCount++;
                            totalNewDestinations++;
                            existingIds.add(place.place_id);
                        }
                    }
                }

                if (batchCount > 0) {
                    await batch.commit();
                    console.log(`[BACKGROUND] Đã xử lý ${batchCount} ${type} (${totalNewDestinations} mới, ${totalUpdatedDestinations} cập nhật)`);
                }

            } catch (err) {
                console.warn(`[BACKGROUND] Lỗi quét ${type}:`, err.message);
            }
            await new Promise(r => setTimeout(r, 800));
        }

        if (totalNewDestinations < 10) {
            for (const type of secondaryTypes.slice(0, 3)) {
                try {
                    const results = await searchNearbyPlaces({
                        location: new window.google.maps.LatLng(center.lat, center.lng),
                        radius: 30000,
                        type
                    });

                    const batch = writeBatch(db);
                    let batchCount = 0;

                    for (const place of results) {
                        if (isSafePlace(place) && place.rating >= 3.8 && place.user_ratings_total >= 20 && !existingIds.has(place.place_id)) {
                            const docRef = doc(cacheRef);
                            batch.set(docRef, {
                                placeId: place.place_id,
                                name: place.name,
                                address: place.vicinity || '',
                                rating: place.rating || 3.5,
                                userRatingsTotal: place.user_ratings_total || 10,
                                lat: place.geometry?.location?.lat() || center.lat,
                                lng: place.geometry?.location?.lng() || center.lng,
                                types: place.types || [type],
                                province,
                                photoRef: place.photos?.[0]?.getUrl?.({ maxWidth: 400 }) || null,
                                priceLevel: place.price_level || null,
                                cachedAt: serverTimestamp(),
                            });
                            batchCount++;
                            totalNewDestinations++;
                            existingIds.add(place.place_id);
                        }
                    }

                    if (batchCount > 0) {
                        await batch.commit();
                        console.log(`[BACKGROUND] Đã thêm ${batchCount} ${type} phụ`);
                    }

                } catch (err) {
                    console.warn(`[BACKGROUND] Lỗi quét ${type} phụ:`, err.message);
                }
                await new Promise(r => setTimeout(r, 600));
            }
        }

        console.log(`[BACKGROUND] Hoàn thành: ${totalNewDestinations} điểm mới, ${totalUpdatedDestinations} điểm cập nhật`);
    } catch (error) {
        console.error(`[BACKGROUND] Lỗi:`, error);
    }
};

// === CẢI TIẾN ALGORITHM: INTELLIGENT FULL CACHE ===
const cacheDestinationsForProvince = async (province, center) => {
    try {
        console.log(`[FULL CACHE] Bắt đầu cache thông minh cho ${province}`);
        const cacheRef = collection(db, 'cachedDestinations');
        const q = query(cacheRef, where('province', '==', province));
        const existing = await getDocs(q);
        const existingIds = new Set(existing.docs.map(d => d.data().placeId));

        let totalNewDestinations = 0;

        const highPriorityTypes = ['tourist_attraction', 'restaurant', 'lodging'];
        const mediumPriorityTypes = ['museum', 'park', 'beach', 'historical_landmark'];

        for (const type of highPriorityTypes) {
            try {
                console.log(`[FULL CACHE] Fetching ${type} (ưu tiên cao)...`);
                const results = await searchNearbyPlaces({
                    location: new window.google.maps.LatLng(center.lat, center.lng),
                    radius: 40000,
                    type
                });

                const batch = writeBatch(db);
                let batchCount = 0;

                const highQualityResults = results
                    .filter(place =>
                        isSafePlace(place) &&
                        place.rating >= 3.8 &&
                        place.user_ratings_total >= 15 &&
                        !existingIds.has(place.place_id)
                    )
                    .sort((a, b) => (b.rating * b.user_ratings_total) - (a.rating * a.user_ratings_total))
                    .slice(0, 8);

                for (const place of highQualityResults) {
                    const docRef = doc(cacheRef);
                    batch.set(docRef, {
                        placeId: place.place_id,
                        name: place.name,
                        address: place.vicinity || '',
                        rating: place.rating || 3.5,
                        userRatingsTotal: place.user_ratings_total || 10,
                        lat: place.geometry?.location?.lat() || center.lat,
                        lng: place.geometry?.location?.lng() || center.lng,
                        types: place.types || [type],
                        province,
                        photoRef: place.photos?.[0]?.getUrl?.({ maxWidth: 400 }) || null,
                        priceLevel: place.price_level || null,
                        cachedAt: serverTimestamp(),
                    });
                    batchCount++;
                    totalNewDestinations++;
                    existingIds.add(place.place_id);
                }

                if (batchCount > 0) {
                    await batch.commit();
                    console.log(`[FULL CACHE] Đã thêm ${batchCount} ${type} chất lượng cao`);
                }

            } catch (err) {
                console.warn(`[FULL CACHE] Lỗi quét ${type}:`, err.message);
            }
            await new Promise(r => setTimeout(r, 1200));
        }

        if (totalNewDestinations < 15) {
            for (const type of mediumPriorityTypes.slice(0, 3)) {
                try {
                    console.log(`[FULL CACHE] Fetching ${type} (ưu tiên trung)...`);
                    const results = await searchNearbyPlaces({
                        location: new window.google.maps.LatLng(center.lat, center.lng),
                        radius: 35000,
                        type
                    });

                    const batch = writeBatch(db);
                    let batchCount = 0;

                    const mediumQualityResults = results
                        .filter(place =>
                            isSafePlace(place) &&
                            place.rating >= 3.6 &&
                            place.user_ratings_total >= 10 &&
                            !existingIds.has(place.place_id)
                        )
                        .slice(0, 5);

                    for (const place of mediumQualityResults) {
                        const docRef = doc(cacheRef);
                        batch.set(docRef, {
                            placeId: place.place_id,
                            name: place.name,
                            address: place.vicinity || '',
                            rating: place.rating || 3.5,
                            userRatingsTotal: place.user_ratings_total || 10,
                            lat: place.geometry?.location?.lat() || center.lat,
                            lng: place.geometry?.location?.lng() || center.lng,
                            types: place.types || [type],
                            province,
                            photoRef: place.photos?.[0]?.getUrl?.({ maxWidth: 400 }) || null,
                            priceLevel: place.price_level || null,
                            cachedAt: serverTimestamp(),
                        });
                        batchCount++;
                        totalNewDestinations++;
                        existingIds.add(place.place_id);
                    }

                    if (batchCount > 0) {
                        await batch.commit();
                        console.log(`[FULL CACHE] Đã thêm ${batchCount} ${type} trung bình`);
                    }

                } catch (err) {
                    console.warn(`[FULL CACHE] Lỗi quét ${type}:`, err.message);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        console.log(`[FULL CACHE] Tổng cộng: ${totalNewDestinations} điểm mới chất lượng cao`);
        return totalNewDestinations;
    } catch (error) {
        console.error(`[FULL CACHE] Lỗi cache:`, error);
        return 0;
    }
};

// === CẢI TIẾN ALGORITHM: SMART FILTERING ===
// HÀM CHÍNH ĐÃ ĐƯỢC EXPORT ĐÚNG CÁCH
export const getCachedDestinationsByProvince = async (province, filters = {}, center = null) => {
    const cacheRef = collection(db, 'cachedDestinations');
    let q = query(cacheRef, where('province', '==', province));

    if (filters.types?.length > 0) {
        q = query(q, where('types', 'array-contains-any', filters.types));
    }

    const snapshot = await getDocs(q);
    let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    data = data.filter(d => d.rating >= (filters.minRating || 3.5));

    data.sort((a, b) => {
        const scoreA = (a.rating * 0.7) + (Math.min(a.userRatingsTotal / 100, 1) * 0.3);
        const scoreB = (b.rating * 0.7) + (Math.min(b.userRatingsTotal / 100, 1) * 0.3);
        return scoreB - scoreA;
    });

    if (center && data.length > 0) {
        const needsUpdate = await shouldUpdateCache(province, center);
        if (needsUpdate) {
            console.log(`Cache ${province} cần cập nhật, chạy cập nhật nền...`);
            backgroundCacheUpdate(province, center);
        }
    }

    return data;
};

// === CÁC HÀM KHÁC ===

export const smartSearchDestinations = async (province, types = [], minRating = 3.5, center = null) => {
    try {
        console.log(`Tìm kiếm thông minh cho ${province} với types:`, types);
        const filters = {
            minRating: Math.max(minRating, 3.5),
            types: types.length > 0 ? types : ['tourist_attraction']
        };

        const cachedDestinations = await getCachedDestinationsByProvince(province, filters, center);

        if (cachedDestinations.length === 0) {
            console.log(`Không có dữ liệu cache cho ${province}`);
            return [];
        }

        const highQuality = cachedDestinations.filter(d => d.rating >= 4.0 && d.userRatingsTotal >= 50);
        const mediumQuality = cachedDestinations.filter(d => d.rating >= 3.8 && d.userRatingsTotal >= 20);
        const allQuality = cachedDestinations.filter(d => d.rating >= minRating);

        let finalResults = [];
        if (highQuality.length >= 4) {
            finalResults = highQuality.slice(0, 8);
        } else if (mediumQuality.length >= 6) {
            finalResults = [...highQuality, ...mediumQuality.slice(0, 8 - highQuality.length)];
        } else {
            finalResults = allQuality.slice(0, 8);
        }

        console.log(`Sử dụng ${finalResults.length} điểm chất lượng từ cache`);
        return finalResults;
    } catch (error) {
        console.error('Lỗi tìm kiếm thông minh:', error);
        return [];
    }
};

export const getCachedRestaurants = async (province, budget = 'medium', center = null) => {
    try {
        const cacheRef = collection(db, 'cachedDestinations');
        let q = query(
            cacheRef,
            where('province', '==', province),
            where('types', 'array-contains-any', ['restaurant', 'cafe', 'food'])
        );

        const snapshot = await getDocs(q);
        let restaurants = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fromCache: true
        }));

        if (budget === 'low') {
            restaurants = restaurants.filter(r => (r.priceLevel || 2) <= 2);
        } else if (budget === 'high') {
            restaurants = restaurants.filter(r => (r.priceLevel || 2) >= 3);
        }

        restaurants.sort((a, b) => {
            const scoreA = (a.rating * 0.6) + (Math.min(a.userRatingsTotal / 200, 1) * 0.4);
            const scoreB = (b.rating * 0.6) + (Math.min(b.userRatingsTotal / 200, 1) * 0.4);
            return scoreB - scoreA;
        });

        if (center && restaurants.length > 0) {
            const needsUpdate = await shouldUpdateCache(province, center);
            if (needsUpdate) backgroundCacheUpdate(province, center);
        }

        return restaurants.filter(r => r.rating >= 3.8).slice(0, 6);
    } catch (error) {
        console.error('Lỗi lấy nhà hàng từ cache:', error);
        return [];
    }
};

export const getCachedHotels = async (province, budget = 'medium', center = null) => {
    try {
        const cacheRef = collection(db, 'cachedDestinations');
        let q = query(
            cacheRef,
            where('province', '==', province),
            where('types', 'array-contains-any', ['lodging', 'hotel'])
        );

        const snapshot = await getDocs(q);
        let hotels = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fromCache: true
        }));

        if (budget === 'low') {
            hotels = hotels.filter(h => (h.priceLevel || 2) <= 1);
        } else if (budget === 'high') {
            hotels = hotels.filter(h => (h.priceLevel || 2) >= 3);
        } else {
            hotels = hotels.filter(h => (h.priceLevel || 2) === 2);
        }

        hotels.sort((a, b) => {
            const scoreA = (a.rating * 0.5) + (Math.min(a.userRatingsTotal / 100, 1) * 0.3) + ((a.priceLevel || 2) * 0.2);
            const scoreB = (b.rating * 0.5) + (Math.min(b.userRatingsTotal / 100, 1) * 0.3) + ((b.priceLevel || 2) * 0.2);
            return scoreB - scoreA;
        });

        if (center && hotels.length > 0) {
            const needsUpdate = await shouldUpdateCache(province, center);
            if (needsUpdate) backgroundCacheUpdate(province, center);
        }

        return hotels.filter(h => h.rating >= 3.6).slice(0, 5);
    } catch (error) {
        console.error('Lỗi lấy khách sạn từ cache:', error);
        return [];
    }
};

// === CÁC HÀM HỖ TRỢ ===
export const cacheDestinations = async (province, center) => {
    console.log(`Lưu destinations vào cache cho ${province}`);
    return await cacheDestinationsForProvince(province, center);
};

export const checkAndUpdateCache = async (province, center) => {
    try {
        console.log(`Kiểm tra cache cho ${province}`);
        const needsUpdate = await shouldUpdateCache(province, center);
        if (needsUpdate) {
            console.log(`Cache ${province} cần cập nhật`);
            await cacheDestinationsForProvince(province, center);
        } else {
            console.log(`Cache ${province} vẫn còn hiệu lực`);
        }
        return true;
    } catch (error) {
        console.error(`Lỗi kiểm tra cache cho ${province}:`, error);
        return false;
    }
};

// Alias
export const getCachedDestinations = getCachedDestinationsByProvince;

// Hàm placeholder
export const cacheRestaurants = async (restaurants, province, specialty) => {
    console.log(`Lưu ${restaurants?.length || 0} restaurants vào cache cho ${province}`);
};

export const cacheHotels = async (hotels, province, budgetCategory) => {
    console.log(`Lưu ${hotels?.length || 0} hotels vào cache cho ${province}`);
};

export const startPeriodicCacheUpdates = () => {
    console.log('Bắt đầu cập nhật cache định kỳ thông minh...');
};