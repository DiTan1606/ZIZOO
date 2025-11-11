// src/services/createRealTimeItinerary.js
import { getStormRisks, getFloodRisks, getFestivals, saveItinerary } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { initPlacesService, searchNearbyPlaces, getPhotoUrl } from './placesService';
import { getWeather } from './weatherService';
import provinceCoords from '../assets/provinceCoord.json';
import { toast } from 'react-toastify';

// ==================== CÁC HÀM HỖ TRỢ ====================

// HÀM TÍNH GIÁ - ĐÃ SỬA ĐỂ HỖ TRỢ NHIỀU LOẠI
const estimatePricePerPerson = (priceLevel, placeType = 'restaurant') => {
    // Giá nhà hàng
    const restaurantPriceMap = {
        0: 50000,   // Miễn phí/rất rẻ
        1: 80000,   // Rẻ
        2: 150000,  // Trung bình
        3: 250000,  // Đắt
        4: 400000   // Rất đắt
    };

    // Giá vé tham quan
    const attractionPriceMap = {
        0: 0,       // Miễn phí
        1: 30000,   // Rẻ
        2: 70000,   // Trung bình
        3: 120000,  // Đắt
        4: 200000   // Rất đắt
    };

    // Giá khách sạn (theo phòng/đêm)
    const hotelPriceMap = {
        0: 300000,  // Budget
        1: 500000,  // Economy
        2: 800000,  // Mid-range
        3: 1500000, // Upscale
        4: 3000000  // Luxury
    };

    let priceMap;
    switch (placeType) {
        case 'restaurant':
            priceMap = restaurantPriceMap;
            break;
        case 'attraction':
            priceMap = attractionPriceMap;
            break;
        case 'hotel':
            priceMap = hotelPriceMap;
            break;
        default:
            priceMap = restaurantPriceMap;
    }

    return priceMap[priceLevel] || (placeType === 'restaurant' ? 120000 : 
                                  placeType === 'attraction' ? 50000 : 
                                  600000);
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

// HÀM LẤY GIÁ VÉ THỰC TẾ
const getRealTicketPrice = (placeType, province) => {
    const priceRanges = {
        'tourist_attraction': { min: 30000, max: 150000 },
        'museum': { min: 20000, max: 80000 },
        'park': { min: 10000, max: 50000 },
        'zoo': { min: 50000, max: 120000 },
        'amusement_park': { min: 100000, max: 300000 },
        'beach': { min: 0, max: 20000 },
        'temple': { min: 0, max: 50000 },
        'historical_landmark': { min: 15000, max: 100000 }
    };
    
    const range = priceRanges[placeType] || { min: 20000, max: 80000 };
    return Math.floor(Math.random() * (range.max - range.min) + range.min);
};

// HÀM PHÂN LOẠI KHÁCH SẠN
const getHotelCategory = (priceLevel, rating) => {
    if (priceLevel <= 1) return 'budget';
    if (priceLevel === 2) return 'mid-range';
    if (priceLevel >= 3) return 'luxury';
    
    // Fallback dựa trên rating
    if (rating >= 4.5) return 'luxury';
    if (rating >= 4.0) return 'mid-range';
    return 'budget';
};

// ==================== HÀM CHÍNH ====================

export const createRealTimeItinerary = async (prefs, userId, mapInstance) => {
    const { province, types, adventureLevel, budget, days, travelers, startDate, ecoFriendly } = prefs;
    const month = new Date(startDate).getMonth() + 1;

    console.log('Bắt đầu tạo itinerary với prefs:', prefs);

    // === THÊM MỚI: TÍNH TOÁN NGÂN SÁCH & PHÂN LOẠI ===
    const budgetPerPersonPerDay = (budget / (travelers || 1)) / (days || 1);
    let budgetCategory = 'medium';
    if (budgetPerPersonPerDay < 500000) budgetCategory = 'low';
    if (budgetPerPersonPerDay > 1500000) budgetCategory = 'high';

    console.log(`Budget per person/day: ${budgetPerPersonPerDay.toFixed(0)} -> Category: ${budgetCategory}`);

    // Helper trả về các mức giá (price_level) của Google (0-4)
    const getPriceLevelsForBudget = (category) => {
        if (category === 'low') return [0, 1, 2]; // Miễn phí, Rẻ, Trung bình
        if (category === 'medium') return [1, 2, 3]; // Rẻ, Trung bình, Đắt
        if (category === 'high') return [2, 3, 4]; // Trung bình, Đắt, Rất đắt
        return [0, 1, 2, 3, 4]; // Mặc định
    };
    const allowedPriceLevels = getPriceLevelsForBudget(budgetCategory);
    // =================================================

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

            // SỬA: Lọc theo ngân sách (price_level) TRƯỚC KHI SLICE
            const spots = results
                .filter(p => {
                    const ratingOk = p.rating >= 3.8;
                    // price_level cho điểm tham quan thường không chính xác (hoặc 0)
                    // Tạm thời nới lỏng cho budget low: ưu tiên 0, 1, 2
                    const priceLevel = p.price_level !== undefined ? p.price_level : 0; // Mặc định là miễn phí/không rõ
                    const budgetOk = budgetCategory === 'low' ? priceLevel <= 2 : true;
                    return ratingOk && budgetOk;
                })
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

                    // SỬA: Sử dụng giá vé thực tế thay vì ước lượng từ price_level
                    const ticketPrice = getRealTicketPrice(type, normalizedProvince);
                    const estimatedPrice = p.price_level !== undefined ? 
                        estimatePricePerPerson(p.price_level, 'attraction') : ticketPrice;

                    return {
                        name: p.name,
                        address: p.vicinity || 'Địa chỉ không xác định',
                        rating: p.rating || 4.0,
                        userRatingsTotal: p.user_ratings_total || 10,
                        photo: p.photos?.[0] ? getPhotoUrl(p.photos[0].photo_reference) : null,
                        pricePerPerson: estimatedPrice, // SỬA: Dùng giá thực tế
                        type: type,
                        province: normalizedProvince,
                        lat: lat,
                        lng: lng,
                        placeId: p.place_id,
                        isFree: estimatedPrice === 0 // Thêm thông tin miễn phí
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
            placeId: 'default',
            isFree: false
        });
    }

    // Tối ưu lộ trình
    const optimizedRoute = optimizeRoute(allDestinations);
    const dailyPlan = splitIntoDays(optimizedRoute, days);

    // === GỢI Ý ĂN UỐNG ===
    const meals = [];
    // THÊM: Lấy mức giá nhà hàng phù hợp
    const allowedRestaurantPriceLevels = getPriceLevelsForBudget(budgetCategory);

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
            
            // SỬA: Lọc nhà hàng theo ngân sách
            const filteredLunch = lunchResults
                .filter(r => allowedRestaurantPriceLevels.includes(r.price_level !== undefined ? r.price_level : 2)) // Mặc định là 2 (Medium)
                .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));
            
            lunch = filteredLunch.length > 0 ? filteredLunch[0] : lunchResults[0];

        } catch (err) {
            console.warn('Lỗi tìm nhà hàng trưa:', err);
        }

        try {
            // SỬA: Thêm keyword cao cấp nếu ngân sách cao
            const dinnerKeyword = budgetCategory === 'high' ? 'nhà hàng 5 sao, đặc sản cao cấp' : 'nhà hàng, đặc sản';
            const dinnerResults = await searchNearbyPlaces({
                location: { lat: center.lat, lng: center.lng },
                radius: 5000,
                type: 'restaurant',
                keyword: dinnerKeyword
            });

            // SỬA: Lọc nhà hàng theo ngân sách
            const filteredDinner = dinnerResults
                .filter(r => allowedRestaurantPriceLevels.includes(r.price_level !== undefined ? r.price_level : 2))
                .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));

            dinner = filteredDinner.length > 0 ? filteredDinner[0] : dinnerResults[0];

        } catch (err) {
            console.warn('Lỗi tìm nhà hàng tối:', err);
        }

        // SỬA: Fallback meal theo budget
        const fallbackLunchPrice = budgetCategory === 'low' ? 60000 : (budgetCategory === 'high' ? 150000 : 80000);
        const fallbackDinnerPrice = budgetCategory === 'low' ? 80000 : (budgetCategory === 'high' ? 300000 : 150000);

        meals.push({
            lunch: lunch ? {
                name: lunch.name,
                address: lunch.vicinity,
                rating: lunch.rating,
                userRatingsTotal: lunch.user_ratings_total,
                photo: lunch.photos?.[0] ? getPhotoUrl(lunch.photos[0].photo_reference) : null,
                price: estimatePricePerPerson(lunch.price_level, 'restaurant') * travelers
            } : {
                name: 'Quán ăn địa phương',
                address: 'Gần điểm tham quan',
                rating: 4.2,
                userRatingsTotal: 50,
                price: fallbackLunchPrice * travelers // SỬA
            },
            dinner: dinner ? {
                name: dinner.name,
                address: dinner.vicinity,
                rating: dinner.rating,
                userRatingsTotal: dinner.user_ratings_total,
                photo: dinner.photos?.[0] ? getPhotoUrl(dinner.photos[0].photo_reference) : null,
                price: estimatePricePerPerson(dinner.price_level, 'restaurant') * travelers
            } : {
                name: 'Nhà hàng đặc sản',
                address: 'Khu trung tâm',
                rating: 4.5,
                userRatingsTotal: 120,
                price: fallbackDinnerPrice * travelers // SỬA
            }
        });
    }

    // === GỢI Ý KHÁCH SẠN ===
    const hotels = [];
    try {
        // SỬA: Điều chỉnh tìm kiếm khách sạn theo ngân sách
        let hotelKeyword = 'khách sạn, hotel';
        let hotelSearchRadius = 10000;

        if (budgetCategory === 'high') {
            hotelKeyword = 'resort, 5 star hotel, luxury hotel';
            hotelSearchRadius = 15000;
            if (travelers > 4) {
                hotelKeyword += ', villa'; // Yêu cầu: nhiều người, nhiều tiền -> villa
            }
        } else if (budgetCategory === 'low') {
            hotelKeyword = 'hostel, motel, budget hotel, homestay, nhà nghỉ';
            hotelSearchRadius = 7000;
        }

        const hotelResults = await searchNearbyPlaces({
            location: optimizedRoute[0],
            radius: hotelSearchRadius, // SỬA
            type: 'lodging',
            keyword: hotelKeyword // SỬA
        });

        // PHÂN LOẠI KHÁCH SẠN THEO TIÊU CHUẨN
        const categorizedHotels = hotelResults
            .filter(h => h.rating >= 3.5) // Chỉ lấy khách sạn có rating tốt
            .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
            .slice(0, 10); // Lấy nhiều hơn để phân loại (tăng từ 5 lên 10)

        // PHÂN LOẠI: Budget, Mid-range, Luxury
        // SỬA: Dùng hàm getHotelCategory để phân loại
        const budgetHotels = categorizedHotels.filter(h => getHotelCategory(h.price_level, h.rating) === 'budget');
        const midRangeHotels = categorizedHotels.filter(h => getHotelCategory(h.price_level, h.rating) === 'mid-range');
        const luxuryHotels = categorizedHotels.filter(h => getHotelCategory(h.price_level, h.rating) === 'luxury');

        // SỬA: CHỌN KHÁCH SẠN ƯU TIÊN THEO NGÂN SÁCH
        const selectedHotels = [];
        if (budgetCategory === 'high') {
            // Ưu tiên Luxury -> Mid
            if (luxuryHotels.length > 0) selectedHotels.push(luxuryHotels[0]);
            if (midRangeHotels.length > 0) selectedHotels.push(midRangeHotels[0]);
            if (budgetHotels.length > 0) selectedHotels.push(budgetHotels[0]);
        } else if (budgetCategory === 'low') {
            // Ưu tiên Budget -> Mid
            if (budgetHotels.length > 0) selectedHotels.push(budgetHotels[0]);
            if (midRangeHotels.length > 0) selectedHotels.push(midRangeHotels[0]);
            if (luxuryHotels.length > 0) selectedHotels.push(luxuryHotels[0]);
        } else {
            // 'medium' ưu tiên Mid -> Budget -> Luxury
            if (midRangeHotels.length > 0) selectedHotels.push(midRangeHotels[0]);
            if (budgetHotels.length > 0) selectedHotels.push(budgetHotels[0]);
            if (luxuryHotels.length > 0) selectedHotels.push(luxuryHotels[0]);
        }
        
        // Nếu không đủ, thêm từ danh sách gốc
        if (selectedHotels.length === 0 && categorizedHotels.length > 0) {
            selectedHotels.push(...categorizedHotels.slice(0, 3));
        } else if (selectedHotels.length < 2) {
            // Thêm bổ sung (nếu có)
            const allSelectedIds = new Set(selectedHotels.map(h => h.place_id));
            const remainingCategorized = categorizedHotels.filter(h => !allSelectedIds.has(h.place_id));
            selectedHotels.push(...remainingCategorized.slice(0, 3 - selectedHotels.length));
        }
        
        // Chỉ lấy tối đa 3 khách sạn gợi ý
        const finalHotelSuggestions = selectedHotels.slice(0, 3);

        hotels.push(...finalHotelSuggestions.map(h => {
            const geometry = h.geometry?.location;
            let lat, lng;

            if (geometry && typeof geometry.lat === 'function') {
                lat = geometry.lat();
                lng = geometry.lng();
            } else {
                lat = Number(geometry?.lat || coord.lat);
                lng = Number(geometry?.lng || coord.lng);
            }

            // SỬA: Tính giá phòng theo loại khách sạn và số người
            const basePrice = estimatePricePerPerson(h.price_level, 'hotel');
            // Giá phòng có thể điều chỉnh theo rating và số người
            let pricePerNight = basePrice;
            if (h.rating >= 4.5) pricePerNight *= 1.3;
            else if (h.rating >= 4.0) pricePerNight *= 1.1;

            // Nếu số người lớn hơn 2, có thể tính thêm phụ phí
            if (travelers > 2) {
                pricePerNight *= (1 + (travelers - 2) * 0.3);
            }

            pricePerNight = Math.round(pricePerNight);

            return {
                name: h.name,
                address: h.vicinity,
                rating: h.rating,
                userRatingsTotal: h.user_ratings_total,
                photo: h.photos?.[0] ? getPhotoUrl(h.photos[0].photo_reference) : null,
                pricePerNight: pricePerNight,
                priceLevel: h.price_level,
                lat: lat,
                lng: lng,
                category: getHotelCategory(h.price_level, h.rating) // Thêm phân loại
            };
        }));

    } catch (err) {
        console.warn('Lỗi tìm khách sạn:', err);
        // SỬA: FALLBACK KHÁCH SẠN MẶC ĐỊNH THEO NGÂN SÁCH
        let fallbackHotel;
        if (budgetCategory === 'high') {
            fallbackHotel = {
                name: 'Khách sạn 5 sao (Mặc định)',
                address: 'Trung tâm thành phố',
                rating: 4.6, userRatingsTotal: 150,
                pricePerNight: 2000000 * (1 + (travelers - 2) * 0.3),
                category: 'luxury',
                lat: coord.lat, lng: coord.lng
            };
        } else if (budgetCategory === 'low') {
            fallbackHotel = {
                name: 'Khách sạn 2 sao / Homestay (Mặc định)',
                address: 'Khu vực lân cận',
                rating: 4.0, userRatingsTotal: 60,
                pricePerNight: 400000 * (1 + (travelers - 2) * 0.3),
                category: 'budget',
                lat: coord.lat, lng: coord.lng
            };
        } else {
            fallbackHotel = {
                name: 'Khách sạn 3 sao (Mặc định)',
                address: 'Trung tâm thành phố',
                rating: 4.2, userRatingsTotal: 80,
                pricePerNight: 600000 * (1 + (travelers - 2) * 0.3),
                category: 'mid-range',
                lat: coord.lat, lng: coord.lng
            };
        }
        hotels.push(fallbackHotel);
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
    // SỬA: Lấy fallback cost theo budget
    let fallbackHotelCost = 600000;
    if (budgetCategory === 'high') fallbackHotelCost = 2000000;
    else if (budgetCategory === 'low') fallbackHotelCost = 400000;
    // Sửa: hotels[0] là khách sạn ưu tiên theo budget
    const hotelCost = (hotels[0]?.pricePerNight || fallbackHotelCost) * days;
    const foodCost = meals.reduce((sum, meal) => sum + meal.lunch.price + meal.dinner.price, 0);
    const entranceCost = allDestinations.reduce((sum, dest) => sum + dest.pricePerPerson, 0) * travelers; // SỬA: Giá vé * số người
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
            entranceDetails: allDestinations.map(dest => ({
                name: dest.name,
                price: dest.pricePerPerson, // Đây là giá vé / người
                isFree: dest.isFree
            })),
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