// src/services/createRealTimeItinerary.js
import { getStormRisks, getFloodRisks, getFestivals, saveItinerary } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { initPlacesService, searchNearbyPlaces, getPhotoUrl } from './placesService';
import { getWeather } from './weatherService';
import provinceCoords from '../assets/provinceCoord.json';
import { toast } from 'react-toastify';

// ==================== CÁC HÀM HỖ TRỢ ====================

// HÀM TÍNH GIÁ
const estimatePricePerPerson = (priceLevel) => {
    const priceMap = {
        0: 50000,   // Miễn phí/rất rẻ
        1: 100000,  // Rẻ
        2: 200000,  // Trung bình
        3: 350000,  // Đắt
        4: 500000   // Rất đắt
    };
    return priceMap[priceLevel] || 150000;
};

// HÀM TÍNH KHOẢNG CÁCH
const calculateDistance = (p1, p2) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
        Math.cos(p1.lat * Math.PI / 180) *
        Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// TỐI ƯU LỘ TRÌNH
const optimizeRoute = (points) => {
    if (points.length <= 1) return points;

    const route = [points[0]];
    const unvisited = points.slice(1);

    while (unvisited.length > 0) {
        const last = route[route.length - 1];
        let nearestIndex = 0;
        let minDist = calculateDistance(last, unvisited[0]);

        for (let i = 1; i < unvisited.length; i++) {
            const dist = calculateDistance(last, unvisited[i]);
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }

        route.push(unvisited[nearestIndex]);
        unvisited.splice(nearestIndex, 1);
    }

    return route;
};

// CHIA THEO NGÀY
const splitIntoDays = (route, days) => {
    const perDay = Math.max(1, Math.ceil(route.length / days));
    const result = [];

    for (let i = 0; i < days; i++) {
        const startIdx = i * perDay;
        const endIdx = Math.min(startIdx + perDay, route.length);
        if (startIdx < route.length) {
            result.push(route.slice(startIdx, endIdx));
        }
    }

    return result;
};

// MAP LOẠI HÌNH DU LỊCH SANG PLACE TYPES
const typeToPlaces = {
    'Nghỉ dưỡng biển': ['tourist_attraction', 'beach', 'spa', 'resort'],
    'Khám phá văn hóa': ['museum', 'temple', 'historical_landmark', 'church'],
    'Du lịch ẩm thực': ['restaurant', 'cafe', 'food'],
    'Phiêu lưu mạo hiểm': ['hiking_area', 'amusement_park', 'campground'],
    'Thiền và yoga': ['spa', 'yoga', 'park'],
    'Du lịch gia đình': ['zoo', 'aquarium', 'amusement_park', 'park'],
    'Chụp ảnh sống ảo': ['tourist_attraction', 'park', 'museum'],
    'Trải nghiệm bản địa': ['local_government_office', 'market', 'tourist_attraction']
};

// Hàm normalize province name
const normalizeVietnamLocation = (inputName) => {
    const aliases = {
        'lam dong': 'Lâm Đồng',
        'ho chi minh': 'Hồ Chí Minh',
        'hanoi': 'Hà Nội',
        'danang': 'Đà Nẵng',
        'hue': 'Thừa Thiên Huế',
        'nha trang': 'Khánh Hòa',
        'da lat': 'Lâm Đồng',
        'phu quoc': 'Kiên Giang',
        'hoi an': 'Quảng Nam',
        'sapa': 'Lào Cai',
        'ho chi minh city': 'Hồ Chí Minh',
        'hồ chí minh': 'Hồ Chí Minh',
        'sài gòn': 'Hồ Chí Minh',
        'tphcm': 'Hồ Chí Minh'
    };

    if (!inputName) return null;
    const lowerInput = inputName.toLowerCase().trim();
    return aliases[lowerInput] || inputName;
};

// ==================== HÀM CHÍNH ====================

export const createRealTimeItinerary = async (prefs, userId, mapInstance) => {
    const { province, types, adventureLevel, budget, days, travelers, startDate, ecoFriendly } = prefs;
    const month = new Date(startDate).getMonth() + 1;

    console.log('Bắt đầu tạo itinerary với prefs:', prefs);

    let alerts = [];
    const risky = [];

    // === KIỂM TRA RỦI RO ===
    try {
        const storms = await getStormRisks(province, month);
        const floods = await getFloodRisks(province, month);
        const riskScore = predictRiskScore(month, province, storms, floods);

        if (riskScore > 0.7) {
            risky.push(province);
            alerts.push(`${province}: Rủi ro cao (bão/lũ) - Điểm rủi ro: ${(riskScore * 100).toFixed(1)}%`);
        }
    } catch (err) {
        console.warn(`Lỗi kiểm tra rủi ro ${province}:`, err);
    }

    if (risky.length > 0) {
        throw new Error(`Khu vực ${province} có rủi ro thiên tai cao. Vui lòng chọn địa điểm khác.`);
    }

    // === KHỞI TẠO PLACES SERVICE ===
    await initPlacesService(mapInstance);

    // === TÌM ĐIỂM ĐẾN ===
    let allDestinations = [];
    const normalizedProvince = normalizeVietnamLocation(province);
    const coord = provinceCoords[normalizedProvince];

    if (!coord) {
        throw new Error(`Không tìm thấy tọa độ cho ${province}`);
    }

    const placeTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
    if (ecoFriendly) placeTypes.push('park');
    if (adventureLevel > 3) placeTypes.push('hiking_area');

    // Lấy điểm đến cho mỗi loại
    for (const type of [...new Set(placeTypes)].slice(0, 4)) {
        try {
            const results = await searchNearbyPlaces({
                location: coord,
                radius: 50000,
                type: type,
                keyword: province
            });

            console.log(`Tìm thấy ${results.length} kết quả cho ${type} ở ${province}`);

            const spots = results
                .filter(p => p.rating >= 3.8)
                .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
                .slice(0, 3)
                .map(p => {
                    // Đảm bảo tọa độ là số
                    const geometry = p.geometry?.location;
                    let lat, lng;

                    if (geometry && typeof geometry.lat === 'function') {
                        // Nếu là LatLng object
                        lat = geometry.lat();
                        lng = geometry.lng();
                    } else {
                        // Nếu là object thường
                        lat = Number(geometry?.lat || coord.lat);
                        lng = Number(geometry?.lng || coord.lng);
                    }

                    return {
                        name: p.name,
                        address: p.vicinity || 'Địa chỉ không xác định',
                        rating: p.rating || 4.0,
                        userRatingsTotal: p.user_ratings_total || 10,
                        photo: p.photos?.[0] ? getPhotoUrl(p.photos[0].photo_reference) : null,
                        pricePerPerson: estimatePricePerPerson(p.price_level),
                        type: type,
                        province: normalizedProvince, // Sử dụng normalizedProvince đã được định nghĩa
                        lat: lat,
                        lng: lng,
                        placeId: p.place_id
                    };
                });

            allDestinations = [...allDestinations, ...spots];
        } catch (err) {
            console.warn(`Lỗi tìm ${type} ở ${province}:`, err);
        }
    }

    // Nếu không tìm thấy đủ điểm, thêm điểm mặc định
    if (allDestinations.length === 0) {
        allDestinations.push({
            name: `Điểm tham quan tại ${normalizedProvince}`,
            address: 'Khu vực trung tâm',
            rating: 4.0,
            userRatingsTotal: 50,
            photo: null,
            pricePerPerson: 100000,
            type: 'tourist_attraction',
            province: normalizedProvince,
            lat: coord.lat,
            lng: coord.lng,
            placeId: 'default'
        });
    }

    // Tối ưu lộ trình
    const optimizedRoute = optimizeRoute(allDestinations);
    const dailyPlan = splitIntoDays(optimizedRoute, days);

    // === GỢI Ý ĂN UỐNG ===
    const meals = [];
    for (const day of dailyPlan) {
        if (day.length === 0) continue;

        const center = day[Math.floor(day.length / 2)];
        let lunch = null, dinner = null;

        try {
            const lunchResults = await searchNearbyPlaces({
                location: { lat: center.lat, lng: center.lng },
                radius: 5000,
                type: 'restaurant',
                keyword: 'cơm, phở, bún'
            });
            lunch = lunchResults[0];
        } catch (err) {
            console.warn('Lỗi tìm nhà hàng trưa:', err);
        }

        try {
            const dinnerResults = await searchNearbyPlaces({
                location: { lat: center.lat, lng: center.lng },
                radius: 5000,
                type: 'restaurant',
                keyword: 'nhà hàng, đặc sản'
            });
            dinner = dinnerResults[0];
        } catch (err) {
            console.warn('Lỗi tìm nhà hàng tối:', err);
        }

        meals.push({
            lunch: lunch ? {
                name: lunch.name,
                address: lunch.vicinity,
                rating: lunch.rating,
                userRatingsTotal: lunch.user_ratings_total,
                photo: lunch.photos?.[0] ? getPhotoUrl(lunch.photos[0].photo_reference) : null,
                price: estimatePricePerPerson(lunch.price_level) * travelers
            } : {
                name: 'Quán ăn địa phương',
                address: 'Gần điểm tham quan',
                rating: 4.2,
                userRatingsTotal: 50,
                price: 80000 * travelers
            },
            dinner: dinner ? {
                name: dinner.name,
                address: dinner.vicinity,
                rating: dinner.rating,
                userRatingsTotal: dinner.user_ratings_total,
                photo: dinner.photos?.[0] ? getPhotoUrl(dinner.photos[0].photo_reference) : null,
                price: estimatePricePerPerson(dinner.price_level) * travelers
            } : {
                name: 'Nhà hàng đặc sản',
                address: 'Khu trung tâm',
                rating: 4.5,
                userRatingsTotal: 120,
                price: 150000 * travelers
            }
        });
    }

    // === GỢI Ý KHÁCH SẠN ===
    const hotels = [];
    try {
        const hotelResults = await searchNearbyPlaces({
            location: optimizedRoute[0],
            radius: 10000,
            type: 'lodging'
        });

        hotels.push(...hotelResults.slice(0, 3).map(h => {
            // Đảm bảo tọa độ là số
            const geometry = h.geometry?.location;
            let lat, lng;

            if (geometry && typeof geometry.lat === 'function') {
                lat = geometry.lat();
                lng = geometry.lng();
            } else {
                lat = Number(geometry?.lat || coord.lat);
                lng = Number(geometry?.lng || coord.lng);
            }

            return {
                name: h.name,
                address: h.vicinity,
                rating: h.rating,
                userRatingsTotal: h.user_ratings_total,
                photo: h.photos?.[0] ? getPhotoUrl(h.photos[0].photo_reference) : null,
                pricePerNight: estimatePricePerPerson(h.price_level) * 2 * travelers,
                priceLevel: h.price_level,
                lat: lat,
                lng: lng
            };
        }));
    } catch (err) {
        console.warn('Lỗi tìm khách sạn:', err);
        hotels.push({
            name: 'Khách sạn 3 sao',
            address: 'Trung tâm thành phố',
            rating: 4.2,
            userRatingsTotal: 80,
            pricePerNight: 600000,
            lat: coord.lat,
            lng: coord.lng
        });
    }

    // === THỜI TIẾT & LỄ HỘI ===
    let weatherInfo = 'Không có dữ liệu';
    try {
        const weather = await getWeather(normalizedProvince);
        weatherInfo = weather ? `${weather.temp}°C, ${weather.description}` : 'Không có dữ liệu';
    } catch (err) {
        console.warn('Lỗi lấy thời tiết:', err);
    }

    let festivalInfo = null;
    try {
        const festivalData = await getFestivals(month);
        const festival = festivalData.find(f => f.Province === normalizedProvince);
        festivalInfo = festival ? `Có ${festival.FestivalCount} lễ hội` : null;
    } catch (err) {
        console.warn('Lỗi lấy lễ hội:', err);
    }

    // === TÍNH TOÁN CHI PHÍ ===
    const hotelCost = hotels[0]?.pricePerNight * days || 500000 * days;
    const foodCost = meals.reduce((sum, meal) => sum + meal.lunch.price + meal.dinner.price, 0);
    const entranceCost = allDestinations.length * 50000;
    const transportCost = 200000 * days;

    const totalCost = hotelCost + foodCost + entranceCost + transportCost;
    const remainingBudget = budget - totalCost;

    // === ĐỊNH DẠNG KẾT QUẢ ===
    const formattedDays = dailyPlan.map((day, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        let note = '';
        if (i === 0) note = 'Check-in khách sạn và bắt đầu hành trình';
        else if (i === days - 1) note = 'Check-out và kết thúc chuyến đi';

        return {
            day: i + 1,
            date: date.toLocaleDateString('vi-VN'),
            destinations: day,
            meal: meals[i] || meals[0] || { lunch: {}, dinner: {} },
            note: note
        };
    });

    const itinerary = {
        userId,
        prefs: {
            ...prefs,
            province: normalizedProvince,
            landmarks: prefs.landmarks || [normalizedProvince]
        },
        dailyPlan: formattedDays,
        hotels,
        weather: weatherInfo,
        festival: festivalInfo,
        alerts: alerts.length > 0 ? alerts.join(' | ') : null,
        cost: {
            hotel: hotelCost,
            food: foodCost,
            entrance: entranceCost,
            transport: transportCost,
            total: totalCost,
            remaining: remainingBudget
        },
        source: 'Google Places API + Risk Analysis',
        createdAt: new Date(),
        status: 'completed'
    };

    // === LƯU ITINERARY ===
    try {
        const docRef = await saveItinerary(userId, itinerary);
        itinerary.id = docRef.id;
        console.log('Itinerary saved with ID:', docRef.id);
        toast.success('Lịch trình đã được tạo và lưu thành công!');
    } catch (err) {
        console.error('Lỗi lưu itinerary:', err);
        toast.warn('Tạo thành công nhưng chưa lưu được vào database');
    }

    console.log('Itinerary created successfully:', itinerary);
    return itinerary;
};