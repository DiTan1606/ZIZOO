// src/services/createRealTimeItinerary.js
import { getStormRisks, getFloodRisks, getFestivals } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { searchNearbyPlaces, initPlacesService } from './placesService';
import { getWeather } from './weatherService';
import provinceCoords from '../assets/provinceCoord.json';
import { saveItinerary } from './firestoreService'; // THÊM DÒNG NÀY
import { toast } from 'react-toastify';

const typeToPlaces = {
    'Nghỉ dưỡng': ['tourist_attraction', 'beach', 'spa', 'resort'],
    'Mạo hiểm': ['park', 'hiking_area', 'amusement_park', 'campground'],
    'Văn hóa': ['museum', 'historical_landmark', 'temple', 'art_gallery'],
    'Ẩm thực': ['restaurant', 'food', 'meal_takeaway', 'cafe'],
    'Gia đình': ['amusement_park', 'zoo', 'aquarium', 'bowling_alley'],
    'Một mình': ['cafe', 'library', 'book_store', 'movie_theater']
};

const distance = (p1, p2) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon/2) ** 2;
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
            if (d < minDist) { minDist = d; nearest = unvisited[i]; }
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

const fetchRealDestinations = async (province, types, ecoFriendly, adventureLevel, mapInstance) => {
    const coord = provinceCoords[province];
    if (!coord) throw new Error(`Không có tọa độ cho ${province}`);

    // INIT PLACES SERVICE
    await initPlacesService(mapInstance);

    const placeTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
    if (ecoFriendly) placeTypes.push('park');
    if (adventureLevel > 3) placeTypes.push('hiking_area');

    const destinations = [];
    for (const type of placeTypes.slice(0, 3)) {
        try {
            const results = await searchNearbyPlaces({
                location: coord,
                radius: 50000,
                type,
                keyword: province,
                minRating: 4.0
            });

            const top = results.slice(0, 2).map(p => ({
                name: p.name,
                address: p.vicinity,
                lat: p.geometry.location.lat,
                lng: p.geometry.location.lng,
                rating: p.rating,
                priceLevel: p.price_level,
                estimatedCost: budget / safeProvinces.length
            }));

            destinations = [...destinations, ...top];
        } catch (err) {
            console.warn(`Places fail ${type} ở ${province}:`, err);
        }
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
            maxPriceLevel: priceLevel
        });
        return hotels.slice(0, 3).map(h => ({
            name: h.name,
            address: h.vicinity,
            rating: h.rating || 0,
            priceLevel: h.price_level || 2,
            estimatedCost: travelers * 600000 * (h.price_level || 2),
            photo: h.photos?.[0]?.getUrl?.() || null
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
                minRating: 4.0
            });
            meals.push({
                lunch: lunch[0]?.name || 'Quán ăn địa phương',
                dinner: lunch[1]?.name || 'Nhà hàng đặc sản',
                estimatedCost: travelers * 250000
            });
        } catch {
            meals.push({
                lunch: 'Quán ăn địa phương',
                dinner: 'Nhà hàng đặc sản',
                estimatedCost: travelers * 250000
            });
        }
    }
    return meals;
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
            if (riskScore <= 0.7) safeProvinces.push(p);
            else alerts.push(`${p}: Rủi ro cao`);
        } catch {
            safeProvinces.push(p);
        }
    }
    if (safeProvinces.length === 0) throw new Error('Tất cả tỉnh đều có rủi ro cao');

    let allDestinations = [];
    for (const province of safeProvinces) {
        const dests = await fetchRealDestinations(province, types, ecoFriendly, adventureLevel, mapInstance);
        allDestinations.push(...dests);
    }
    if (allDestinations.length === 0) throw new Error('Không tìm thấy điểm đến');

    allDestinations = allDestinations.map(d => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) })); // Đảm bảo lat/lng là number

    const optimized = optimizeRoute(allDestinations);
    const dailyPlan = splitIntoDays(optimized, days);

    const center = optimized[0];
    const hotels = await fetchRealHotels(center, budget, travelers, mapInstance);
    const meals = await fetchRealMeals(dailyPlan.map(d => d[0]), travelers, mapInstance);

    const weather = await getWeather(center.province);
    const festival = (await getFestivals(month)).find(f => safeProvinces.includes(f.Province))?.FestivalCount || null;

    const cost = {
        hotel: hotels.reduce((s, h) => s + h.estimatedCost, 0),
        food: meals.reduce((s, m) => s + m.estimatedCost, 0),
        entrance: allDestinations.length * 150000,
        transport: 500000,
        total: 0
    };
    cost.total = Math.min(cost.hotel + cost.food + cost.entrance + cost.transport, budget);
    cost.remaining = budget - cost.total;

    const formattedDays = dailyPlan.map((day, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        return { day: i + 1, date: date.toLocaleDateString('vi-VN'), destinations: day, meal: meals[i], note: i === 0 ? 'Check-in' : i === days - 1 ? 'Check-out' : '' };
    });

    const itinerary = {
        userId, prefs, dailyPlan: formattedDays, hotels, weather: weather ? `${weather.temp}°C, ${weather.description}` : 'Không có dữ liệu',
        festival: festival ? `Có ${festival} lễ hội` : null, alerts: alerts.length > 0 ? alerts.join(' | ') : null, cost, source: 'Google Maps + Cache', createdAt: new Date()
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