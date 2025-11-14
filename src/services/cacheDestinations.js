// src/services/cacheDestinations.js
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc, setDoc, updateDoc,
    getDoc, writeBatch, limit, orderBy
} from 'firebase/firestore';

// Import province coordinates từ file JSON
import provinceCoords from '../assets/provinceCoord.json';

const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Danh sách types tập trung vào du lịch (bỏ embassy, post_office, police)
const TOURISM_TYPES = [
    'tourist_attraction', 'museum', 'park', 'zoo', 'amusement_park',
    'art_gallery', 'church', 'hindu_temple', 'mosque', 'spa',
    'beach', 'resort', 'restaurant', 'cafe', 'shopping_mall',
    'hiking_area', 'natural_feature', 'campground', 'point_of_interest',
    'landmark', 'aquarium', 'movie_theater', 'night_club', 'bar',
    'bakery', 'food', 'meal_takeaway'
];
const getProvinceCoordinates = (provinceName) => {
    return provinceCoords[provinceName] || null;
};
// Thời gian cache
const CACHE_DURATION = 30; // 30 ngày
// Trong cacheDestinations.js, sửa hàm checkAndUpdateCache
export const checkAndUpdateCache = async (province, userId) => {
    const provincesRef = collection(db, 'provinces');
    const id = province.replace(/ /g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const docRef = doc(provincesRef, id);
    const snap = await getDoc(docRef);

    const now = new Date();
    const center = getProvinceCoordinates(province);

    if (!center) {
        console.error(`❌ No coordinates found for province: ${province}`);
        return { status: 'error', data: [] };
    }

    if (snap.exists()) {
        const data = snap.data();
        const last = data.lastUpdate?.toDate ? data.lastUpdate.toDate() : new Date(data.lastUpdate);
        const daysSince = last ? (now - last) / (86400000) : Infinity;

        console.log(`📅 ${province} - Cache status: ${data.cacheStatus}, Places: ${data.totalCachedPlaces || 0}, Days since update: ${daysSince.toFixed(1)}`);

        // Nếu cache đã tồn tại và còn hiệu lực (dưới 60 ngày)
        if (daysSince < 60) {
            console.log(`✅ Using existing cache for ${province}`);
            return { status: 'valid', data: await getCachedData(province) };
        } else {
            // Cache cũ quá 60 ngày, có thể update trong background
            console.log(`🔄 Cache outdated for ${province}, but using existing data`);
            return { status: 'outdated', data: await getCachedData(province) };
        }
    } else {
        // Không có cache, tạo mới
        console.log(`🆕 No cache found for ${province}, creating...`);
        await setDoc(docRef, {
            name: province,
            center,
            lastUpdate: new Date(),
            cacheStatus: 'updating',
            totalCachedPlaces: 0
        });

        // Return empty data trước, cache chạy ở background
        setTimeout(() => {
            cacheDestinationsForProvince(province, center).catch(console.error);
        }, 1000);

        return { status: 'first_time', data: [] };
    }
};


// Trong cacheDestinations.js
export const getOverallCacheStatus = async () => {
    try {
        const provincesRef = collection(db, 'provinces');
        const snap = await getDocs(provincesRef);

        const status = {
            totalProvinces: snap.size,
            provinces: {},
            summary: {
                updated: 0,
                outdated: 0,
                error: 0,
                updating: 0
            }
        };

        snap.forEach(doc => {
            const data = doc.data();
            status.provinces[doc.id] = data;

            const lastUpdate = data.lastUpdate?.toDate ? data.lastUpdate.toDate() : new Date(data.lastUpdate);
            const daysSince = (new Date() - lastUpdate) / (86400000);

            if (daysSince < 30) status.summary.updated++;
            else if (daysSince < 60) status.summary.outdated++;
            else if (data.cacheStatus === 'error') status.summary.error++;
            else if (data.cacheStatus === 'updating') status.summary.updating++;
        });

        console.log('📊 Cache Status Summary:', status.summary);
        return status;
    } catch (error) {
        console.error('Error getting cache status:', error);
        return null;
    }
};
// Hàm cache sử dụng Google Maps JavaScript API thay vì fetch
export const cacheDestinationsForProvince = async (province, center) => {
    const cacheRef = collection(db, 'cachedDestinations');
    const provincesRef = collection(db, 'provinces');
    const provinceId = province.replace(/ /g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    try {
        console.log(`🔄 Starting cache for ${province} at ${center.lat},${center.lng}`);

        let totalAdded = 0;
        const batch = writeBatch(db);
        const seenPlaceIds = new Set();

        // Sử dụng Google Maps JavaScript API thay vì REST API
        for (const type of TOURISM_TYPES) {
            try {
                console.log(`🔍 Caching ${type} for ${province}...`);

                // Sử dụng Google Maps Places Service
                const places = await searchPlacesWithMapsAPI(center, type, province);

                for (const place of places) {
                    if (seenPlaceIds.has(place.place_id)) continue;

                    // Điều kiện lọc linh hoạt
                    const isGoodPlace = (
                        (place.rating >= 3.0 && place.user_ratings_total >= 5) ||
                        (place.rating >= 4.0) ||
                        (place.user_ratings_total >= 10) ||
                        (place.types?.includes('tourist_attraction')) ||
                        (place.types?.includes('point_of_interest'))
                    );

                    if (isGoodPlace && totalAdded < 150) {
                        const docId = `${provinceId}_${place.place_id}`;
                        const docRef = doc(cacheRef, docId);

                        batch.set(docRef, {
                            placeId: place.place_id,
                            name: place.name,
                            address: place.vicinity || '',
                            rating: place.rating || 3.5,
                            userRatingsTotal: place.user_ratings_total || 0,
                            lat: place.geometry?.location?.lat() || center.lat,
                            lng: place.geometry?.location?.lng() || center.lng,
                            types: place.types || [type],
                            province: province,
                            photoRef: place.photos?.[0]?.getUrl() ? place.photos[0].getUrl({ maxWidth: 400 }) : null,
                            priceLevel: place.price_level || 2,
                            cachedAt: new Date(),
                        });

                        seenPlaceIds.add(place.place_id);
                        totalAdded++;
                    }
                }

                // Nghỉ giữa các type để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`❌ Error caching ${type} for ${province}:`, error);
                continue;
            }
        }

        // Commit batch
        if (totalAdded > 0) {
            await batch.commit();
            console.log(`✅ Committed ${totalAdded} places for ${province}`);
        }

        // Cập nhật trạng thái
        await updateDoc(doc(provincesRef, provinceId), {
            cacheStatus: 'updated',
            lastUpdate: new Date(),
            totalCachedPlaces: totalAdded
        });

        console.log(`🎉 Successfully cached ${totalAdded} places for ${province}`);

    } catch (error) {
        console.error(`💥 Cache failed for ${province}:`, error);
        await updateDoc(doc(provincesRef, provinceId), {
            cacheStatus: 'error',
            lastUpdate: new Date(),
            error: error.message
        });
    }
};

// Hàm sử dụng Google Maps JavaScript API để tìm places
const searchPlacesWithMapsAPI = (center, type, province) => {
    return new Promise((resolve, reject) => {
        if (!window.google?.maps?.places) {
            reject(new Error('Google Maps Places API not available'));
            return;
        }

        try {
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));

            const request = {
                location: new window.google.maps.LatLng(center.lat, center.lng),
                radius: 50000, // 50km
                type: type
            };

            service.nearbySearch(request, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    console.log(`📍 Found ${results.length} ${type} places in ${province}`);
                    resolve(results || []);
                } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.log(`ℹ️ No ${type} places found in ${province}`);
                    resolve([]);
                } else {
                    console.warn(`⚠️ ${type} search in ${province} failed: ${status}`);
                    resolve([]);
                }
            });
        } catch (error) {
            console.error(`💥 Maps API error for ${type} in ${province}:`, error);
            resolve([]);
        }
    });
};

// Lấy dữ liệu đã cache - Sửa query để tránh cần index
const getCachedData = async (province) => {
    try {
        const cacheRef = collection(db, 'cachedDestinations');
        const q = query(
            cacheRef,
            where('province', '==', province),
            limit(100) // Chỉ dùng limit, không orderBy để tránh cần index
        );

        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            rating: d.data().rating || 3.5,
            userRatingsTotal: d.data().userRatingsTotal || 0,
            photoUrl: d.data().photoRef || null
        }));

        // Sort manually trên client
        results.sort((a, b) => {
            const scoreA = (a.rating || 3.5) * 1000 + (a.userRatingsTotal || 0);
            const scoreB = (b.rating || 3.5) * 1000 + (b.userRatingsTotal || 0);
            return scoreB - scoreA;
        });

        console.log(`📊 Retrieved ${results.length} cached places for ${province}`);
        return results;
    } catch (error) {
        console.error(`Error getting cached data for ${province}:`, error);
        return [];
    }
};

// Hàm get photo URL
const getPhotoUrl = (photoRef, maxWidth = 400) => {
    if (!photoRef || !GOOGLE_API_KEY) return null;

    // Nếu photoRef đã là URL đầy đủ (từ Maps API)
    if (photoRef.startsWith('https://')) {
        return photoRef;
    }

    // Nếu là photo_reference, tạo URL
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;
};

// Lấy điểm thông minh với cache
export const getSmartCachedDestinations = async (province, types = [], userId) => {
    try {
        const cacheResult = await checkAndUpdateCache(province, userId);
        let destinations = cacheResult.data || [];

        console.log(`🎯 Getting destinations for ${province}, found ${destinations.length} total`);

        // Lọc theo types nếu có
        if (types.length > 0) {
            destinations = destinations.filter(d =>
                d.types?.some(type => types.includes(type))
            );
            console.log(`🎯 Filtered to ${destinations.length} places with types: ${types.join(', ')}`);
        }

        return destinations.slice(0, 50);
    } catch (error) {
        console.error(`Error getting smart destinations for ${province}:`, error);
        return [];
    }
};

// Hàm pre-cache tất cả các tỉnh thành
export const preCacheAllDestinations = async () => {
    console.log('🚀 Starting pre-cache for all destinations...');

    const provinces = Object.keys(provinceCoords);

    for (const province of provinces.slice(58, 73)) { // Giới hạn 10 tỉnh đầu tiên
        try {
            await checkAndUpdateCache(province, 'system');
            console.log(`✅ Pre-cache completed for ${province}`);
            // Nghỉ giữa các tỉnh để tránh rate limit
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
            console.error(`❌ Pre-cache failed for ${province}:`, error);
        }
    }

    console.log('🎉 Pre-cache completed for initial destinations');
};

// Hàm kiểm tra cache status
export const getCacheStatus = async () => {
    const provincesRef = collection(db, 'provinces');
    const snap = await getDocs(provincesRef);

    const status = {};
    snap.forEach(doc => {
        status[doc.id] = doc.data();
    });

    return status;
};