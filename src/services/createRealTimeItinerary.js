// src/services/createRealTimeItinerary.js
import { getStormRisks, getFloodRisks, getFestivals } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { searchNearbyPlaces, initPlacesService } from './placesService';
import { getWeather, get7DayWeatherForecast } from './weatherService'; // Thêm import hàm mới
import provinceCoords from '../assets/provinceCoord.json';
import { saveItinerary } from './firestoreService';
import { toast } from 'react-toastify';

const typeToPlaces = {
    'Nghỉ dưỡng': ['point_of_interest', 'beach', 'spa', 'resort'], // Thay tourist_attraction bằng point_of_interest cho VietMap
    'Mạo hiểm': ['park', 'hiking_area', 'amusement_park', 'campground'],
    'Văn hóa': ['museum', 'historical_landmark', 'temple', 'art_gallery'],
    'Ẩm thực': ['restaurant', 'food', 'meal_takeaway', 'cafe'],
    'Gia đình': ['amusement_park', 'zoo', 'aquarium', 'bowling_alley'],
    'Một mình': ['cafe', 'library', 'book_store', 'movie_theater'],
};

const distance = (p1, p2) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p2.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const optimizeRoute = (points) => {
    if (points.length <= 1) return points;
    const route = [points[0]];
    const unvisited = points.slice(1);
    while (unvisited.length > 0) {
        const last = route[route.length - 1];
        let nearest = unvisited[0];
        let minDist = distance(last, nearest);
        for (let i = 1; i < unvisited.length; i++) {
            const d = distance(last, unvisited[i]);
            if (d < minDist) {
                minDist = d;
                nearest = unvisited[i];
            }
        }
        route.push(nearest);
        unvisited.splice(unvisited.indexOf(nearest), 1);
    }
    return route;
};

const splitIntoDays = (route, days) => {
    const perDay = Math.max(1, Math.ceil(route.length / days));
    return Array.from({ length: days }, (_, i) => route.slice(i * perDay, (i + 1) * perDay));
};

const fetchRealDestinations = async (province, types, ecoFriendly, adventureLevel, mapInstance, budget, safeProvinces) => {
    const coord = provinceCoords[province];
    if (!coord) {
        console.warn(`Không có tọa độ cho ${province}, bỏ qua.`);
        return [];
    }

    await initPlacesService(mapInstance);

    const placeTypes = types.flatMap((t) => typeToPlaces[t] || ['point_of_interest']);
    if (ecoFriendly) placeTypes.push('park');
    if (adventureLevel > 3) placeTypes.push('hiking_area');

    let destinations = [];
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts && destinations.length < 2; attempt++) {
        for (const type of placeTypes.slice(0, 3)) {
            try {
                const results = await searchNearbyPlaces({
                    location: coord,
                    radius: 100000, // Tăng radius để tìm được địa điểm ở tỉnh nhỏ
                    type,
                    keyword: province,
                    // Bỏ minRating vì VietMap không có rating
                });

                const top = results.slice(0, 2).map((p) => ({
                    name: p.name,
                    address: p.vicinity,
                    lat: p.lat,
                    lng: p.lng,
                    rating: p.rating || 3.5,
                    priceLevel: p.price_level || 2,
                    estimatedCost: budget / safeProvinces.length,
                    type, // Lưu type để dùng cho gợi ý
                }));

                destinations = [...destinations, ...top];
                console.log(`Tìm thấy ${top.length} địa điểm loại ${type} ở ${province}`);
            } catch (err) {
                console.warn(`Lỗi tìm kiếm ${type} ở ${province}:`, err);
            }
        }
    }

    if (destinations.length === 0) {
        console.warn(`Không tìm thấy địa điểm nào ở ${province} sau ${maxAttempts} lần thử.`);
    }

    return destinations;
};

const fetchRealHotels = async (center, budget, travelers, mapInstance) => {
    const priceLevel = budget > 10000000 ? 4 : budget > 5000000 ? 3 : 2;
    try {
        await initPlacesService(mapInstance);
        const hotels = await searchNearbyPlaces({
            location: center,
            radius: 15000,
            type: 'lodging',
            maxPriceLevel: priceLevel,
            // Bỏ minRating
        });
        return hotels.slice(0, 3).map((h) => ({
            name: h.name,
            address: h.vicinity,
            rating: h.rating || 3.5,
            priceLevel: h.price_level || 2,
            estimatedCost: travelers * 600000 * (h.price_level || 2),
            photo: h.photos?.[0]?.getUrl?.() || null,
        }));
    } catch (err) {
        console.warn('Lỗi khách sạn:', err);
        return [];
    }
};

const fetchRealMeals = async (dayPoints, travelers, mapInstance) => {
    const meals = [];
    for (const point of dayPoints) {
        try {
            await initPlacesService(mapInstance);
            const lunch = await searchNearbyPlaces({
                location: point,
                radius: 3000,
                type: 'restaurant',
                // Bỏ minRating
            });
            meals.push({
                lunch: lunch[0]?.name || 'Quán ăn địa phương',
                dinner: lunch[1]?.name || 'Nhà hàng đặc sản',
                estimatedCost: travelers * 250000,
            });
        } catch {
            meals.push({
                lunch: 'Quán ăn địa phương',
                dinner: 'Nhà hàng đặc sản',
                estimatedCost: travelers * 250000,
            });
        }
    }
    return meals;
};

// Hàm gợi ý mới
const generateSuggestions = (destinations, prefs, weather, festival, forecast7Days) => {
    const suggestions = [];
    const { types, startDate, budget, province } = prefs;
    const tripStart = new Date(startDate);

    // Gợi ý dựa trên thời tiết 7 ngày
    forecast7Days.forEach((day, index) => {
        const dayDate = new Date(tripStart);
        dayDate.setDate(tripStart.getDate() + index);
        if (dayDate.getTime() <= new Date().getTime() + 7 * 24 * 60 * 60 * 1000) {
            let weatherTip = '';
            if (day.rainChance > 50) {
                weatherTip = 'Trời mưa, nên chọn địa điểm trong nhà.';
                suggestions.push({
                    name: 'Bảo tàng hoặc quán cà phê',
                    reason: `${weatherTip} Ngày ${day.date} (${day.description}, ${day.temp}°C) ở ${province}, phù hợp cho mọi loại hình.`,
                    address: 'Gần trung tâm',
                    estimatedCost: budget * 0.05,
                    day: index + 1,
                });
            } else if (day.temp > 30 && types.includes('Nghỉ dưỡng')) {
                weatherTip = 'Nóng bức, thích hợp thư giãn gần nước.';
                suggestions.push({
                    name: 'Bãi biển hoặc resort',
                    reason: `${weatherTip} Ngày ${day.date} (${day.temp}°C, ${day.description}) ở ${province}, lý tưởng cho nghỉ dưỡng.`,
                    address: 'Khu vực ven biển',
                    estimatedCost: budget * 0.15,
                    day: index + 1,
                });
            } else if (day.temp >= 20 && day.temp <= 30) {
                weatherTip = 'Thời tiết dễ chịu, phù hợp khám phá ngoài trời.';
                if (types.includes('Văn hóa') || types.includes('Mạo hiểm')) {
                    suggestions.push({
                        name: 'Công viên hoặc di tích',
                        reason: `${weatherTip} Ngày ${day.date} (${day.temp}°C, ${day.description}) ở ${province}, tốt cho văn hóa hoặc mạo hiểm.`,
                        address: 'Khu vực trung tâm hoặc ngoại ô',
                        estimatedCost: budget * 0.1,
                        day: index + 1,
                    });
                }
            }
        }
    });

    // Gợi ý dựa trên loại hình
    types.forEach((type) => {
        const relatedTypes = {
            'Nghỉ dưỡng': ['Bãi biển thư giãn', 'Spa cao cấp'],
            'Mạo hiểm': ['Leo núi', 'Chèo thuyền kayak'],
            'Văn hóa': ['Làng nghề truyền thống', 'Chợ địa phương'],
            'Ẩm thực': ['Nhà hàng đặc sản', 'Quán ăn đường phố'],
            'Gia đình': ['Công viên vui chơi', 'Thủy cung'],
            'Một mình': ['Quán cà phê yên tĩnh', 'Thư viện'],
        }[type] || ['Địa điểm tham quan'];

        destinations.forEach((dest) => {
            if (dest.type === typeToPlaces[type]?.[0]) {
                suggestions.push({
                    name: dest.name,
                    reason: `Phù hợp với ${type.toLowerCase()}: ${relatedTypes[0]}`,
                    address: dest.vicinity,
                    estimatedCost: dest.estimatedCost,
                    day: 1,
                });
            }
        });
    });

    // Gợi ý dựa trên lễ hội
    if (festival) {
        suggestions.push({
            name: `Lễ hội tại ${province}`,
            reason: `Tham gia lễ hội địa phương để trải nghiệm văn hóa độc đáo`,
            address: 'Trung tâm thành phố',
            estimatedCost: budget * 0.15,
            day: 1,
        });
    }

    // Gợi ý dựa trên ngân sách
    if (budget < 5000000) {
        suggestions.push({
            name: 'Địa điểm miễn phí',
            reason: `Tiết kiệm chi phí với các điểm tham quan miễn phí ở ${province}`,
            address: 'Công viên hoặc di tích công cộng',
            estimatedCost: 0,
            day: 1,
        });
    }

    return suggestions.slice(0, 5); // Giới hạn 5 gợi ý
};

export const createRealTimeItinerary = async (prefs, userId, mapInstance) => {
    const { provinces, days = 3, startDate, budget, types, adventureLevel, ecoFriendly, travelers = 1 } = prefs;
    const month = new Date(startDate).getMonth() + 1;
    const alerts = [];

    const safeProvinces = [];
    for (const p of provinces) {
        try {
            const storms = await getStormRisks(p, month);
            const floods = await getFloodRisks(p, month);
            const riskScore = predictRiskScore(month, p, storms, floods);
            if (riskScore <= 0.7) {
                safeProvinces.push(p);
            } else {
                alerts.push(`${p}: Rủi ro cao (score: ${riskScore.toFixed(2)})`);
            }
        } catch (err) {
            console.warn(`Không thể lấy rủi ro cho ${p}:`, err.message);
            alerts.push(`${p}: Không thể xác minh rủi ro`);
            safeProvinces.push(p);
        }
    }

    if (safeProvinces.length === 0) {
        console.warn('Không có tỉnh an toàn, sử dụng tất cả tỉnh đã chọn.');
        safeProvinces.push(...provinces);
    }

    let allDestinations = [];
    for (const province of safeProvinces) {
        const dests = await fetchRealDestinations(province, types, ecoFriendly, adventureLevel, mapInstance, budget, safeProvinces);
        allDestinations.push(...dests);
    }

    if (allDestinations.length === 0) {
        throw new Error('Không tìm thấy điểm đến phù hợp. Vui lòng thử lại với các tùy chọn khác.');
    }

    allDestinations = allDestinations.map((d) => ({
        ...d,
        lat: Number(d.lat) || d.lat,
        lng: Number(d.lng) || d.lng,
    }));

    const optimized = optimizeRoute(allDestinations);
    const dailyPlan = splitIntoDays(optimized, days);

    const center = optimized[0] || { province: safeProvinces[0], lat: provinceCoords[safeProvinces[0]]?.lat, lng: provinceCoords[safeProvinces[0]]?.lng };
    const hotels = await fetchRealHotels(center, budget, travelers, mapInstance);
    const meals = await fetchRealMeals(dailyPlan.map((d) => d[0] || center), travelers, mapInstance);

    const weather = await getWeather(center.province);
    const forecast7Days = await get7DayWeatherForecast(center.province || safeProvinces[0]); // Thêm dự báo 7 ngày
    const festival = (await getFestivals(month)).find((f) => safeProvinces.includes(f.Province))?.FestivalCount || null;

    const suggestions = generateSuggestions(allDestinations, prefs, weather, festival, forecast7Days); // Truyền forecast7Days

    const cost = {
        hotel: hotels.reduce((s, h) => s + h.estimatedCost, 0),
        food: meals.reduce((s, m) => s + m.estimatedCost, 0),
        entrance: allDestinations.length * 150000,
        transport: 500000,
        total: 0,
    };
    cost.total = Math.min(cost.hotel + cost.food + cost.entrance + cost.transport, budget);
    cost.remaining = budget - cost.total;

    const formattedDays = dailyPlan.map((day, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        return {
            day: i + 1,
            date: date.toLocaleDateString('vi-VN'),
            destinations: day,
            meal: meals[i],
            note: i === 0 ? 'Check-in' : i === days - 1 ? 'Check-out' : '',
        };
    });

    const itinerary = {
        userId,
        prefs,
        dailyPlan: formattedDays,
        hotels,
        weather: weather ? `${weather.temp}°C, ${weather.description}` : 'Không có dữ liệu',
        forecast7Days, // Thêm để UI hiển thị
        festival: festival ? `Có ${festival} lễ hội` : null,
        alerts: alerts.length > 0 ? alerts.join(' | ') : 'Đánh giá sao không khả dụng với VietMap',
        suggestions, // Thêm gợi ý
        cost,
        source: 'VietMap + Cache (no ratings)', // Cập nhật source
        createdAt: new Date(),
    };

    try {
        const docRef = await saveItinerary(userId, itinerary);
        itinerary.id = docRef.id;
        toast.success('Lịch trình đã được lưu!');
    } catch (err) {
        toast.warn('Tạo thành công nhưng chưa lưu');
    }

    return itinerary;
};