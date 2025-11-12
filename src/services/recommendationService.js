// src/services/recommendationService.js
import { getStormRisks, getFloodRisks, getFestivals } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { searchNearbyPlaces } from './placesService';
import { getCachedDestinationsByProvince } from './cacheDestinations'; // THÊM DÒNG NÀY
import provinceCoords from '../assets/provinceCoord.json';

const typeToPlaces = {
    'Nghỉ dưỡng': ['tourist_attraction', 'beach', 'spa', 'resort'],
    'Mạo hiểm': ['park', 'hiking_area', 'amusement_park'],
    'Văn hóa': ['museum', 'historical_landmark', 'art_gallery', 'church', 'temple'],
    'Ẩm thực': ['restaurant', 'cafe'],
    'Gia đình': ['amusement_park', 'zoo', 'park'],
    'Một mình': ['cafe', 'library', 'museum', 'park']
};

export const generateItinerary = async (prefs, userId) => {
    const { month, provinces = [], types = [], budget = 5000000, adventureLevel = 3, ecoFriendly = false } = prefs;

    // Validate input
    const validMonth = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
    if (!provinces.length) throw new Error('Vui lòng chọn ít nhất 1 tỉnh!');

    let alerts = [];
    const risky = [];

    // KIỂM TRA RỦI RO
    for (const province of provinces) {
        try {
            const storms = await getStormRisks(province, validMonth);
            const floods = await getFloodRisks(province, validMonth);
            const riskScore = predictRiskScore(validMonth, province, storms, floods);

            if (riskScore > 0.7) {
                risky.push(province);
                alerts.push(`${province}: Rủi ro cao (bão/lũ)`);
            }
        } catch (err) {
            console.warn(`Lỗi kiểm tra rủi ro ${province}:`, err);
        }
    }

    const safeProvinces = provinces.filter(p => !risky.includes(p));
    let destinations = [];

    // ƯU TIÊN SỬ DỤNG CACHE TRƯỚC
    for (const province of safeProvinces) {
        try {
            // Thử lấy từ cache trước
            const filters = {
                minRating: 4.0,
                types: types.flatMap(t => typeToPlaces[t] || ['tourist_attraction'])
            };

            const cachedDestinations = await getCachedDestinationsByProvince(province, filters);

            if (cachedDestinations.length > 0) {
                console.log(`✅ Sử dụng ${cachedDestinations.length} điểm từ cache cho ${province}`);
                const topSpots = cachedDestinations
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 3)
                    .map(item => ({
                        MainDestination: item.name,
                        Province: province,
                        lat: item.lat,
                        lng: item.lng,
                        rating: item.rating,
                        priceLevel: item.priceLevel,
                        estimatedCost: budget / safeProvinces.length,
                        types: item.types,
                        photoRef: item.photoRef,
                        fromCache: true // Đánh dấu từ cache
                    }));

                destinations = [...destinations, ...topSpots];
                continue; // Đã có dữ liệu từ cache, bỏ qua API call
            }
        } catch (cacheErr) {
            console.warn(`Lỗi cache ${province}:`, cacheErr);
        }

        // FALLBACK: DÙNG GOOGLE PLACES API
        const coord = provinceCoords[province];
        if (!coord) {
            console.warn(`Không có tọa độ cho ${province}`);
            continue;
        }

        const placesTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
        if (ecoFriendly) placesTypes.push('park', 'hiking_area');
        if (adventureLevel > 3) placesTypes.push('hiking_area', 'amusement_park');

        try {
            const results = await searchNearbyPlaces({
                location: { lat: coord.lat, lng: coord.lng },
                radius: 50000,
                type: placesTypes[0] || 'tourist_attraction',
                keyword: province
            });

            const topSpots = results
                .filter(p => p.rating >= 4.0)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 3)
                .map(p => ({
                    MainDestination: p.name,
                    Province: province,
                    lat: p.geometry.location.lat,
                    lng: p.geometry.location.lng,
                    rating: p.rating,
                    priceLevel: p.price_level,
                    estimatedCost: budget / safeProvinces.length,
                    fromCache: false // Đánh dấu từ API
                }));

            destinations = [...destinations, ...topSpots];
        } catch (err) {
            console.warn(`Places API fail ${province}:`, err);
            // Fallback cơ bản
            destinations.push({
                MainDestination: `${province} (Điểm tham quan)`,
                Province: province,
                lat: coord.lat,
                lng: coord.lng,
                rating: 4.0,
                estimatedCost: budget / safeProvinces.length,
                fromCache: false
            });
        }
    }

    // THÊM THÔNG TIN LỄ HỘI
    try {
        const festivals = await getFestivals(validMonth);
        destinations = destinations.map(d => ({
            ...d,
            festival: festivals.find(f => f.Province === d.Province)?.FestivalCount || null
        }));
    } catch (err) {
        console.warn('Lỗi lấy lễ hội:', err);
    }

    return {
        destinations: destinations.length > 0 ? destinations : [{
            MainDestination: 'Không tìm thấy điểm đến phù hợp',
            Province: safeProvinces[0] || 'Việt Nam',
            lat: 16.0471,
            lng: 108.2062,
            rating: 0,
            fromCache: false
        }],
        alerts: alerts.length > 0 ? alerts.join(' | ') : null,
        usingCache: destinations.some(d => d.fromCache)
    };
};