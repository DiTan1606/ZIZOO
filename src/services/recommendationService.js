// src/services/recommendationService.js
import { getStormRisks, getFloodRisks, getFestivals } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { searchNearbyPlaces } from './placesService';
import provinceCoords from '../assets/provinceCoord.json';

const typeToPlaces = {
    'Nghỉ dưỡng': ['tourist_attraction', 'beach', 'spa'],
    'Mạo hiểm': ['park', 'hiking_area'],
    'Văn hóa': ['museum', 'historical_landmark'],
    'Ẩm thực': ['restaurant'],
    'Gia đình': ['amusement_park', 'zoo'],
    'Một mình': ['cafe', 'library']
};

export const generateItinerary = async (prefs, userId) => {
    const { month, provinces = [], types = [], budget = 5000000, adventureLevel = 3, ecoFriendly = false } = prefs;

    // === FIX: Đảm bảo month hợp lệ ===
    const validMonth = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
    if (!provinces.length) throw new Error('Vui lòng chọn ít nhất 1 tỉnh!');

    let alerts = [];
    const risky = [];

    // === KIỂM TRA RỦI RO ===
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

    // === GOOGLE PLACES API ===
    for (const province of safeProvinces) {
        const coord = provinceCoords[province];
        if (!coord) {
            console.warn(`Không có tọa độ cho ${province}`);
            continue;
        }

        const placesTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
        if (ecoFriendly) placesTypes.push('park');
        if (adventureLevel > 3) placesTypes.push('hiking_area');

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
                    estimatedCost: budget / safeProvinces.length
                }));

            destinations = [...destinations, ...topSpots];
        } catch (err) {
            console.warn(`Places fail ${province}:`, err);
            destinations.push({
                MainDestination: `${province} (Gợi ý)`,
                Province: province,
                lat: coord.lat,
                lng: coord.lng,
                rating: 4.0
            });
        }
    }

    // === LỄ HỘI ===
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
            lat: 16.0471,
            lng: 108.2062
        }],
        alerts: alerts.length > 0 ? alerts.join(' | ') : null
    };
};