// src/services/personalItineraryService.js
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { initPlacesService, searchPlacesByText, getPhotoUrl } from './placesService';
import provinceCoords from '../assets/provinceCoord.json';

// Constants for photography optimization
const PHOTOGRAPHY_KEYWORDS = {
    vietnamese: [
        'cảnh đẹp', 'view đẹp', 'chụp ảnh', 'sống ảo', 'checkin', 'landmark',
        'hoàng hôn', 'bình minh', 'view thành phố', 'panorama', 'vista',
        'thác nước', 'hồ', 'núi', 'biển', 'đồi', 'cánh đồng', 'ruộng bậc thang',
        'kiến trúc', 'cổ kính', 'truyền thống', 'di sản', 'di tích',
        'cầu', 'chùa', 'nhà thờ', 'đền', 'miếu', 'lăng',
        'phố cổ', 'con đường', 'ngõ hẹp', 'bức tường', 'graffiti',
        'vườn hoa', 'công viên', 'khu bảo tồn', 'thiên nhiên'
    ],
    english: [
        'viewpoint', 'scenic', 'landscape', 'photography', 'photo spot', 'instagram',
        'sunset', 'sunrise', 'city view', 'panoramic', 'vista point',
        'waterfall', 'lake', 'mountain', 'beach', 'hill', 'rice terrace',
        'architecture', 'ancient', 'traditional', 'heritage', 'historical',
        'bridge', 'temple', 'pagoda', 'church', 'cathedral', 'shrine',
        'old quarter', 'alley', 'street art', 'mural', 'graffiti',
        'garden', 'park', 'nature reserve', 'natural'
    ]
};

// Hàm normalize location name - CẢI THIỆN
const normalizeVietnamLocation = (inputName) => {
    const aliases = {
        'lam dong': 'Lâm Đồng',
        'ho chi minh': 'Hồ Chí Minh',
        'hanoi': 'Hà Nội',
        'danang': 'Đà Nẵng',
        'da lat': 'Lâm Đồng',
        'phu quoc': 'Kiên Giang',
        'ho chi minh city': 'Hồ Chí Minh',
        'tphcm': 'Hồ Chí Minh',
        'vung tau': 'Bà Rịa - Vũng Tàu',

        'nha trang': 'Khánh Hòa',
        'da nang': 'Đà Nẵng',
        'hue': 'Thừa Thiên Huế',
        'hoi an': 'Quảng Nam',
        'sapa': 'Lào Cai',
        'halong': 'Quảng Ninh',
        'ha long': 'Quảng Ninh',
        'quang ninh': 'Quảng Ninh',
        'can tho': 'Cần Thơ',
        'cantho': 'Cần Thơ',
        'buon ma thuot': 'Đắk Lắk',
        'buôn ma thuột': 'Đắk Lắk',
        'vinh': 'Nghệ An',
        'thanh hoa': 'Thanh Hóa',
        'quang binh': 'Quảng Bình',
        'quang tri': 'Quảng Trị',
        'thua thien hue': 'Thừa Thiên Huế'
    };

    if (!inputName) return null;

    // Chuẩn hóa input: bỏ dấu, chuyển lowercase, trim
    const normalizedInput = inputName
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Bỏ dấu

    return aliases[normalizedInput] || inputName;
};

// Thêm fallback cho provinceCoords
const getProvinceCoordinates = (provinceName) => {
    const coord = provinceCoords[provinceName];
    if (coord) return coord;

    // Fallback coordinates cho các tỉnh phổ biến
    const fallbackCoords = {
        'Bà Rịa - Vũng Tàu': { lat: 10.346, lng: 107.084 },
        'Vũng Tàu': { lat: 10.346, lng: 107.084 },
        'Hồ Chí Minh': { lat: 10.823, lng: 106.629 },
        'Hà Nội': { lat: 21.028, lng: 105.854 },
        'Đà Nẵng': { lat: 16.047, lng: 108.220 },
        'Đà Lạt': { lat: 11.940, lng: 108.437 },
        'Nha Trang': { lat: 12.238, lng: 109.196 },
        'Phú Quốc': { lat: 10.227, lng: 103.967 },
        'Hội An': { lat: 15.880, lng: 108.338 },
        'Huế': { lat: 16.464, lng: 107.586 },
        'Quảng Ninh': { lat: 20.958, lng: 107.002 },
        'Cần Thơ': { lat: 10.045, lng: 105.746 },
        'Lào Cai': { lat: 22.486, lng: 103.955 },
        'Khánh Hòa': { lat: 12.238, lng: 109.196 },
        'Kiên Giang': { lat: 10.227, lng: 103.967 },
        'Quảng Nam': { lat: 15.880, lng: 108.338 },
        'Thừa Thiên Huế': { lat: 16.464, lng: 107.586 }
    };

    return fallbackCoords[provinceName] || { lat: 10.823, lng: 106.629 }; // Mặc định là SG
};

// HÀM CHÍNH - TẠO LỊCH TRÌNH TẬP TRUNG VÀO ĐỊA ĐIỂM
export const createPersonalItinerary = async (prefs, userId, mapInstance) => {
    const {
        destination,
        duration,
        travelers,
        budget,
        travelStyle,
        interests = []
    } = prefs;

    console.log('📍 Bắt đầu tạo lịch trình tập trung địa điểm...');

    // === KHỞI TẠO PLACES SERVICE ===
    await initPlacesService(mapInstance);

    // === CHUẨN HÓA VÀ LẤY TỌA ĐỘ ===
    const normalizedDestination = normalizeVietnamLocation(destination);
    const coord = getProvinceCoordinates(normalizedDestination);

    if (!coord) {
        throw new Error(`Không tìm thấy tọa độ cho ${destination}`);
    }

    console.log(`📍 Điểm đến: ${normalizedDestination}, Tọa độ:`, coord);

    // === TÌM CÁC LOẠI ĐỊA ĐIỂM PHÙ HỢP ===
    const placeCategories = determinePlaceCategories(interests, travelStyle);

    // Tìm địa điểm cho mỗi danh mục
    const allPlaces = await findAllPlacesByCategories(normalizedDestination, coord, placeCategories, duration);

    // === TỐI ƯU LỘ TRÌNH THEO VỊ TRÍ ĐỊA LÝ ===
    const optimizedRoute = optimizeGeographicRoute(allPlaces);

    // === PHÂN BỔ THEO NGÀY HỢP LÝ ===
    const dailyPlans = distributePlacesToDays(optimizedRoute, duration);

    // === THÊM TRẢI NGHIỆM ẨM THỰC ===
    const plansWithFood = await addFoodExperiences(dailyPlans, normalizedDestination, coord);

    // === LẤY ĐẶC SẢN ĐỊA PHƯƠNG ===
    const specialties = await getSpecialtiesFromFirebase(normalizedDestination);

    // === TÍNH TOÁN CHI PHÍ TẬP TRUNG VÀO TRẢI NGHIỆM ===
    const costBreakdown = calculateExperienceCosts(plansWithFood, travelers, budget, travelStyle);

    // === TẠO ITINERARY HOÀN CHỈNH ===
    const itinerary = {
        // 1. THÔNG TIN CƠ BẢN
        summary: {
            destination: normalizedDestination,
            duration: duration,
            travelers: travelers,
            budget: budget,
            style: travelStyle,
            totalPlaces: allPlaces.length,
            experienceTypes: placeCategories,
            specialtiesCount: specialties.length
        },

        // 2. LỊCH TRÌNH CHI TIẾT THEO NGÀY
        dailyPlan: plansWithFood.map((dayPlan, index) => ({
            day: index + 1,
            date: calculateDate(new Date(), index),
            theme: generateDayTheme(dayPlan.places, interests),
            places: dayPlan.places,
            foodExperiences: dayPlan.foodExperiences,
            photographySpots: dayPlan.places.filter(p => p.isPhotographySpot),
            estimatedTime: calculateDayTime(dayPlan.places),
            notes: generateDayNotes(dayPlan.places, interests)
        })),

        // 3. DANH SÁCH CHI PHÍ TẬP TRUNG TRẢI NGHIỆM
        costBreakdown: {
            experiences: costBreakdown.experiences,
            food: costBreakdown.food,
            accommodations: estimateAccommodationCost(duration, travelers, travelStyle),
            transport: costBreakdown.transport,
            total: costBreakdown.total,
            budgetPerPerson: Math.round(costBreakdown.total / travelers),
            withinBudget: costBreakdown.withinBudget
        },

        // 4. ĐỊA ĐIỂM NỔI BẬT
        highlights: {
            mustVisit: allPlaces.filter(p => p.rating >= 4.5).slice(0, 5),
            photographyHotspots: allPlaces.filter(p => p.isPhotographySpot && p.photographyScore >= 15),
            culturalSpots: allPlaces.filter(p => p.types.some(t =>
                ['museum', 'temple', 'historical_landmark'].includes(t)
            )),
            natureSpots: allPlaces.filter(p => p.types.some(t =>
                ['park', 'natural_feature', 'zoo'].includes(t)
            ))
        },

        // 5. ĐẶC SẢN & ẨM THỰC
        specialties: specialties,

        // 6. MẸO VÀ LƯU Ý
        tips: {
            photography: generatePhotographyTips(allPlaces),
            bestTimes: generateBestVisitingTimes(allPlaces),
            localInsights: generateLocalInsights(normalizedDestination),
            packingSuggestions: generatePackingSuggestions(interests, normalizedDestination)
        },

        // 7. THÔNG TIN BỔ SUNG
        metadata: {
            createdAt: new Date(),
            source: 'AI-Powered Place Optimization',
            placeCategories: placeCategories,
            optimizedFor: interests.length > 0 ? interests : ['general_tourism']
        }
    };

    console.log('✅ Lịch trình tập trung địa điểm đã sẵn sàng!');
    return itinerary;
};

// ==================== CÁC HÀM HỖ TRỢ CHUYÊN SÂU ====================

// Xác định danh mục địa điểm dựa trên interests
const determinePlaceCategories = (interests, travelStyle) => {
    const categories = new Set();

    // Map interests sang danh mục địa điểm cụ thể
    if (interests.includes('photography')) {
        categories.add('scenic_viewpoints');
        categories.add('iconic_landmarks');
        categories.add('cultural_architecture');
    }

    if (interests.includes('food')) {
        categories.add('local_restaurants');
        categories.add('street_food');
        categories.add('food_markets');
    }

    if (interests.includes('nature')) {
        categories.add('parks_gardens');
        categories.add('natural_landscapes');
        categories.add('water_features');
    }

    if (interests.includes('culture')) {
        categories.add('museums_galleries');
        categories.add('historical_sites');
        categories.add('religious_sites');
    }

    if (interests.includes('adventure')) {
        categories.add('outdoor_activities');
        categories.add('adventure_sports');
        categories.add('hiking_trails');
    }

    // Điều chỉnh theo phong cách du lịch
    if (travelStyle === 'luxury') {
        categories.add('premium_attractions');
        categories.add('fine_dining');
    }

    if (travelStyle === 'budget') {
        categories.add('free_attractions');
        categories.add('local_markets');
    }

    // Mặc định nếu không có interests cụ thể
    if (categories.size === 0) {
        categories.add('top_attractions');
        categories.add('cultural_heritage');
        categories.add('local_experiences');
    }

    return Array.from(categories);
};

// Tìm tất cả địa điểm theo danh mục
const findAllPlacesByCategories = async (destination, coord, categories, duration) => {
    let allPlaces = [];

    // Giới hạn số danh mục và số request
    const limitedCategories = categories.slice(0, 4); // Giảm từ 6 xuống 4

    for (const category of limitedCategories) {
        try {
            const places = await findPlacesByCategory(destination, coord, category);
            allPlaces = [...allPlaces, ...places];

            // Nếu đã có đủ địa điểm, break sớm
            if (allPlaces.length >= duration * 4) break;

        } catch (error) {
            console.warn(`Lỗi với danh mục ${category}:`, error);
            continue;
        }
    }

    // Loại bỏ trùng lặp và sắp xếp theo chất lượng
    const uniquePlaces = Array.from(new Map(allPlaces.map(p => [p.placeId, p])).values())
        .sort((a, b) => {
            const scoreA = (a.rating * 20) + (a.userRatingsTotal / 1000) + (a.photographyScore || 0);
            const scoreB = (b.rating * 20) + (b.userRatingsTotal / 1000) + (b.photographyScore || 0);
            return scoreB - scoreA;
        })
        .slice(0, duration * 4);

    console.log(`✅ Đã tìm thấy ${uniquePlaces.length} địa điểm cho ${destination}`);
    return uniquePlaces;
};

// Tìm địa điểm theo danh mục cụ thể
const findPlacesByCategory = async (destination, coord, category) => {
    const categoryQueries = {
        scenic_viewpoints: ['viewpoint', 'scenic', 'panoramic', 'vista point'],
        iconic_landmarks: ['landmark', 'iconic', 'famous', 'must-see'],
        cultural_architecture: ['temple', 'pagoda', 'church', 'historical building'],
        local_restaurants: ['local restaurant', 'authentic food', 'traditional cuisine'],
        street_food: ['street food', 'food stall', 'local market food'],
        food_markets: ['market', 'food market', 'local market'],
        parks_gardens: ['park', 'garden', 'botanical garden'],
        natural_landscapes: ['natural feature', 'landscape', 'nature reserve'],
        water_features: ['waterfall', 'lake', 'river', 'beach'],
        museums_galleries: ['museum', 'art gallery', 'exhibition'],
        historical_sites: ['historical site', 'ancient', 'heritage site'],
        religious_sites: ['temple', 'church', 'mosque', 'shrine'],
        outdoor_activities: ['hiking', 'outdoor', 'adventure'],
        adventure_sports: ['adventure sports', 'extreme sports'],
        hiking_trails: ['hiking trail', 'trekking', 'mountain trail'],
        premium_attractions: ['luxury', 'premium', 'exclusive'],
        fine_dining: ['fine dining', 'gourmet', 'award-winning restaurant'],
        free_attractions: ['free', 'public space', 'no entrance fee'],
        local_markets: ['local market', 'street market', 'bazaar'],
        top_attractions: ['tourist attraction', 'popular', 'top rated'],
        cultural_heritage: ['cultural heritage', 'traditional', 'folk'],
        local_experiences: ['local experience', 'authentic', 'community']
    };

    const queries = categoryQueries[category] || ['tourist attraction'];
    let places = [];

    for (const query of queries) {
        try {
            const results = await searchPlacesByText(
                `${query} in ${destination}`,
                coord,
                30000 // 30km radius
            );

            const filteredPlaces = results
                .filter(p => p.rating >= (category.includes('premium') ? 4.0 : 3.5))
                .map(p => enhancePlaceData(p, category));

            places = [...places, ...filteredPlaces];

            // Nếu đã có đủ địa điểm, break sớm
            if (places.length >= 8) break;

        } catch (error) {
            console.warn(`Lỗi tìm ${category} ở ${destination}:`, error);
            // Tiếp tục với query tiếp theo thay vì dừng
            continue;
        }
    }

    return places.slice(0, 8);
};

// Tăng cường dữ liệu địa điểm
const enhancePlaceData = (place, category) => {
    const photoAnalysis = detectPhotographySpot(place);

    return {
        ...place,
        name: place.name,
        address: place.vicinity,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        photo: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
        types: place.types || [],
        category: category,
        photographyScore: photoAnalysis.score,
        photographyReasons: photoAnalysis.reasons,
        isPhotographySpot: photoAnalysis.isGoodForPhotos,
        bestVisitTime: calculateBestVisitTime(place, category),
        estimatedTime: estimateVisitTime(place, category),
        priceLevel: place.price_level,
        pricePerPerson: estimatePricePerPerson(place.price_level, 'attraction'),
        photographyInfo: {
            bestTime: generateBestPhotoTime(place, category),
            photoTips: generatePhotoTipsForPlace(place, category),
            recommendedShots: generateRecommendedShots(place, category)
        }
    };
};

// Hàm detect địa điểm tốt cho chụp ảnh
const detectPhotographySpot = (place) => {
    const name = place.name?.toLowerCase() || '';
    const types = place.types || [];
    const address = place.vicinity?.toLowerCase() || '';

    let photographyScore = 0;
    let reasons = [];

    // 1. Check name contains photography keywords
    const allKeywords = [...PHOTOGRAPHY_KEYWORDS.vietnamese, ...PHOTOGRAPHY_KEYWORDS.english];
    const keywordMatches = allKeywords.filter(keyword =>
        name.includes(keyword.toLowerCase()) || address.includes(keyword.toLowerCase())
    );

    if (keywordMatches.length > 0) {
        photographyScore += keywordMatches.length * 2;
        reasons.push(`Từ khóa: ${keywordMatches.join(', ')}`);
    }

    // 2. Check Google types that indicate good photography spots
    const photoFriendlyTypes = [
        'tourist_attraction', 'natural_feature', 'park', 'amusement_park',
        'art_gallery', 'museum', 'church', 'hindu_temple', 'mosque',
        'city_hall', 'library', 'university', 'stadium'
    ];

    const typeMatches = types.filter(type => photoFriendlyTypes.includes(type));
    if (typeMatches.length > 0) {
        photographyScore += typeMatches.length * 3;
        reasons.push(`Loại địa điểm: ${typeMatches.join(', ')}`);
    }

    // 3. High rating = likely good for photos
    if (place.rating >= 4.0) {
        photographyScore += 3;
        reasons.push('Rating cao (>4.0)');
    }
    if (place.rating >= 4.5) {
        photographyScore += 2;
        reasons.push('Rating rất cao (>4.5)');
    }

    // 4. Many reviews = popular spot
    if (place.user_ratings_total > 100) {
        photographyScore += 2;
        reasons.push('Nhiều đánh giá');
    }
    if (place.user_ratings_total > 500) {
        photographyScore += 3;
        reasons.push('Rất nhiều đánh giá');
    }

    // 5. Has photos = definitely good for photography
    if (place.photos && place.photos.length > 0) {
        photographyScore += 5;
        reasons.push('Có ảnh trên Google');
    }

    return {
        score: photographyScore,
        isGoodForPhotos: photographyScore >= 8,
        reasons: reasons
    };
};

// Hàm tính khoảng cách
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

// Nhóm địa điểm theo khoảng cách gần
const clusterPlacesByProximity = (places, maxDistance = 5) => {
    const clusters = [];
    const visited = new Set();

    places.forEach((place, index) => {
        if (visited.has(index)) return;

        const cluster = [place];
        visited.add(index);

        places.forEach((otherPlace, otherIndex) => {
            if (visited.has(otherIndex)) return;

            const distance = calculateDistance(
                { lat: place.lat, lng: place.lng },
                { lat: otherPlace.lat, lng: otherPlace.lng }
            );

            if (distance <= maxDistance) {
                cluster.push(otherPlace);
                visited.add(otherIndex);
            }
        });

        clusters.push(cluster);
    });

    return clusters;
};

// Sắp xếp cụm theo khoảng cách
const sortClustersByDistance = (clusters) => {
    if (clusters.length <= 1) return clusters.flat();

    const sortedClusters = [...clusters];
    const result = [];

    // Bắt đầu với cụm đầu tiên
    result.push(...sortedClusters[0]);
    sortedClusters.splice(0, 1);

    while (sortedClusters.length > 0) {
        let nearestClusterIndex = 0;
        let minDistance = Infinity;

        const lastPlace = result[result.length - 1];

        sortedClusters.forEach((cluster, clusterIndex) => {
            const firstPlaceInCluster = cluster[0];
            const distance = calculateDistance(
                { lat: lastPlace.lat, lng: lastPlace.lng },
                { lat: firstPlaceInCluster.lat, lng: firstPlaceInCluster.lng }
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestClusterIndex = clusterIndex;
            }
        });

        result.push(...sortedClusters[nearestClusterIndex]);
        sortedClusters.splice(nearestClusterIndex, 1);
    }

    return result;
};

// Tối ưu lộ trình địa lý
const optimizeGeographicRoute = (places) => {
    if (places.length <= 1) return places;

    // Nhóm địa điểm theo khu vực
    const clusteredPlaces = clusterPlacesByProximity(places);

    // Sắp xếp các cụm theo khoảng cách
    return sortClustersByDistance(clusteredPlaces);
};

// Phân bổ địa điểm theo ngày
const distributePlacesToDays = (places, duration) => {
    const dailyPlans = [];
    const placesPerDay = Math.max(2, Math.ceil(places.length / duration));

    for (let day = 0; day < duration; day++) {
        const startIdx = day * placesPerDay;
        const endIdx = Math.min(startIdx + placesPerDay, places.length);

        if (startIdx >= places.length) break;

        dailyPlans.push({
            day: day + 1,
            places: places.slice(startIdx, endIdx)
        });
    }

    return dailyPlans;
};

// Thêm trải nghiệm ẩm thực - SỬA LỖI
const addFoodExperiences = async (dailyPlans, destination, coord) => {
    for (const dayPlan of dailyPlans) {
        // SỬA: Kiểm tra nếu không có places hoặc centerPlace bị undefined
        let searchCoord = coord; // Mặc định dùng coord của tỉnh

        if (dayPlan.places && dayPlan.places.length > 0) {
            const centerPlace = dayPlan.places[Math.floor(dayPlan.places.length / 2)];
            if (centerPlace && centerPlace.lat && centerPlace.lng) {
                searchCoord = { lat: centerPlace.lat, lng: centerPlace.lng };
            }
        }

        try {
            const foodResults = await searchPlacesByText(
                `local food restaurant in ${destination}`,
                searchCoord, // SỬA: Dùng searchCoord thay vì centerPlace
                2000 // 2km radius
            );

            const foodPlaces = foodResults
                .filter(f => f.rating >= 4.0)
                .slice(0, 3)
                .map(f => ({
                    name: f.name,
                    type: 'restaurant',
                    specialty: generateLocalSpecialty(destination),
                    priceLevel: f.price_level,
                    rating: f.rating,
                    pricePerPerson: estimatePricePerPerson(f.price_level, 'restaurant')
                }));

            dayPlan.foodExperiences = foodPlaces;
        } catch (error) {
            console.warn('Lỗi tìm nhà hàng:', error);
            dayPlan.foodExperiences = [{
                name: `Nhà hàng địa phương ${destination}`,
                type: 'restaurant',
                specialty: 'Đặc sản địa phương',
                priceLevel: 2,
                rating: 4.0,
                pricePerPerson: 120000
            }];
        }
    }

    return dailyPlans;
};

// Tính chi phí tập trung vào trải nghiệm
const calculateExperienceCosts = (dailyPlans, travelers, budget, travelStyle) => {
    let experienceCost = 0;
    let foodCost = 0;

    dailyPlans.forEach(dayPlan => {
        // Chi phí tham quan
        dayPlan.places.forEach(place => {
            const placeCost = estimatePlaceCost(place, travelStyle);
            experienceCost += placeCost * travelers;
        });

        // Chi phí ăn uống
        const dailyFoodCost = calculateDailyFoodCost(travelStyle, travelers);
        foodCost += dailyFoodCost;
    });

    const accommodations = estimateAccommodationCost(dailyPlans.length, travelers, travelStyle);
    const transportCost = calculateTransportCost(dailyPlans.length, travelers);
    const total = experienceCost + foodCost + accommodations + transportCost;

    return {
        experiences: experienceCost,
        food: foodCost,
        accommodations: accommodations,
        transport: transportCost,
        total: total,
        withinBudget: total <= budget
    };
};

// ==================== CÁC HÀM HỖ TRỢ CHI TIẾT ====================

// Ước tính thời gian tham quan
const estimateVisitTime = (place, category) => {
    const baseTimes = {
        museum: 120, // 2 hours
        temple: 60,  // 1 hour
        park: 90,    // 1.5 hours
        restaurant: 60,
        market: 90,
        viewpoint: 45,
        historical_site: 75,
        natural_feature: 120
    };

    return baseTimes[category] || 60; // Mặc định 1 hour
};

// Tính thời gian tốt nhất để tham quan
const calculateBestVisitTime = (place, category) => {
    if (category.includes('restaurant')) {
        return '11:30-13:30 (trưa) hoặc 18:00-20:00 (tối)';
    }
    if (category.includes('market')) {
        return 'Sáng sớm 6:00-9:00';
    }
    if (place.types.includes('park') || place.types.includes('natural_feature')) {
        return 'Sáng sớm 6:00-8:00 hoặc chiều muộn 16:00-18:00';
    }
    return '8:00-11:00 hoặc 14:00-17:00';
};

// Tạo chủ đề cho từng ngày
const generateDayTheme = (places, interests) => {
    const placeTypes = places.flatMap(p => p.types);

    if (placeTypes.some(t => t.includes('historical') || t.includes('museum'))) {
        return 'Khám phá Văn hoá & Lịch sử';
    }
    if (placeTypes.some(t => t.includes('natural') || t.includes('park'))) {
        return 'Trải nghiệm Thiên nhiên';
    }
    if (placeTypes.some(t => t.includes('beach') || t.includes('water'))) {
        return 'Thư giãn & Biển cả';
    }
    if (interests.includes('food')) {
        return 'Hành trình Ẩm thực';
    }

    return 'Khám phá Địa điểm Nổi bật';
};

// Tính thời gian cho một ngày
const calculateDayTime = (places) => {
    const totalTime = places.reduce((sum, place) => sum + (place.estimatedTime || 60), 0);
    const travelTime = Math.max(30, places.length * 15); // Ước tính thời gian di chuyển
    return totalTime + travelTime;
};

// Tạo ghi chú cho ngày
const generateDayNotes = (places, interests) => {
    const notes = [];

    if (places.some(p => p.isPhotographySpot)) {
        notes.push('Nhiều điểm chụp ảnh đẹp - nhớ mang theo máy ảnh');
    }

    if (interests.includes('food')) {
        notes.push('Đừng bỏ lỡ cơ hội thử ẩm thực địa phương');
    }

    return notes.length > 0 ? notes : ['Tận hưởng chuyến khám phá của bạn'];
};

// Ước tính chi phí địa điểm
const estimatePlaceCost = (place, travelStyle) => {
    const baseCost = place.pricePerPerson || 50000;
    const multipliers = {
        budget: 0.8,
        standard: 1,
        comfort: 1.3,
        luxury: 2
    };

    return baseCost * (multipliers[travelStyle] || 1);
};

// Tính chi phí ăn uống hàng ngày
const calculateDailyFoodCost = (travelStyle, travelers) => {
    const dailyCostPerPerson = {
        budget: 150000,
        standard: 250000,
        comfort: 400000,
        luxury: 700000
    };

    return (dailyCostPerPerson[travelStyle] || 250000) * travelers;
};

// Ước tính chi phí chỗ ở
const estimateAccommodationCost = (duration, travelers, travelStyle) => {
    const nightlyRate = {
        budget: 300000,
        standard: 600000,
        comfort: 1200000,
        luxury: 2500000
    };

    return (nightlyRate[travelStyle] || 600000) * duration * Math.ceil(travelers / 2);
};

// Tính chi phí vận chuyển
const calculateTransportCost = (duration, travelers) => {
    const dailyTransportCost = 100000;
    return dailyTransportCost * duration * travelers;
};

// Hàm ước tính giá
const estimatePricePerPerson = (priceLevel, placeType = 'restaurant') => {
    const restaurantPriceMap = {
        0: 50000,   // Miễn phí/rất rẻ
        1: 80000,   // Rẻ
        2: 150000,  // Trung bình
        3: 250000,  // Đắt
        4: 400000   // Rất đắt
    };

    const attractionPriceMap = {
        0: 0,       // Miễn phí
        1: 30000,   // Rẻ
        2: 70000,   // Trung bình
        3: 120000,  // Đắt
        4: 200000   // Rất đắt
    };

    let priceMap;
    switch (placeType) {
        case 'restaurant':
            priceMap = restaurantPriceMap;
            break;
        case 'attraction':
            priceMap = attractionPriceMap;
            break;
        default:
            priceMap = restaurantPriceMap;
    }

    return priceMap[priceLevel] || (placeType === 'restaurant' ? 120000 : 50000);
};

// Hàm tính ngày
const calculateDate = (startDate, dayOffset) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString('vi-VN');
};

// Tạo món đặc sản địa phương
const generateLocalSpecialty = (destination) => {
    const specialties = {
        'Hà Nội': 'Phở Hà Nội',
        'Hải Phòng': 'Bánh đa cua',
        'Quảng Ninh': 'Chả mực Hạ Long',
        'Đà Nẵng': 'Mì Quảng',
        'Huế': 'Bún bò Huế',
        'Hồ Chí Minh': 'Cơm tấm Sài Gòn',
        'Cần Thơ': 'Lẩu mắm',
        'Nha Trang': 'Bún sứa',
        'Đà Lạt': 'Bánh ướt lòng gà',
        'Phú Quốc': 'Gỏi cá trích',
        'Bà Rịa - Vũng Tàu': 'Hải sản tươi sống',
        'Lâm Đồng': 'Rau củ Đà Lạt',
        'Khánh Hòa': 'Yến sào',
        'Kiên Giang': 'Nước mắm Phú Quốc'
    };

    return specialties[destination] || 'Đặc sản địa phương';
};

// Đề xuất thời gian chụp ảnh tốt nhất
const generateBestPhotoTime = (place, category) => {
    const types = place.types || [];

    if (types.some(t => t.includes('park') || t.includes('garden'))) {
        return 'Sáng sớm (6h-8h) hoặc chiều muộn (16h-18h)';
    }

    if (types.some(t => t.includes('beach') || t.includes('marina'))) {
        return 'Hoàng hôn (17h-19h) hoặc bình minh (5h-6h)';
    }

    if (types.some(t => t.includes('museum') || t.includes('art_gallery'))) {
        return 'Giữa trưa (11h-14h) - ít đông đúc';
    }

    return 'Sáng (8h-11h) hoặc chiều (15h-17h)';
};

// Tạo tips chụp ảnh cho từng địa điểm
const generatePhotoTipsForPlace = (place, category) => {
    const tips = [];
    const types = place.types || [];

    if (types.some(t => t.includes('natural_feature'))) {
        tips.push('Sử dụng tripod để chụp phơi sáng');
        tips.push('Mang ống kính góc rộng để capture toàn cảnh');
    }

    if (types.some(t => t.includes('historical'))) {
        tips.push('Chụp từ góc thấp để tạo cảm giác hùng vĩ');
        tips.push('Sử dụng filter phân cực để giảm chói');
    }

    if (types.some(t => t.includes('beach'))) {
        tips.push('Chụp hoàng hôn với silhouette');
        tips.push('Sử dụng ND filter để làm mềm nước biển');
    }

    return tips.slice(0, 3);
};

// Tạo đề xuất shot chụp
const generateRecommendedShots = (place, category) => {
    const shots = [];

    if (category.includes('viewpoint')) {
        shots.push('Panorama toàn cảnh');
        shots.push('Wide angle landscape');
    }

    if (category.includes('architecture')) {
        shots.push('Architectural details');
        shots.push('Symmetry shots');
    }

    return shots.length > 0 ? shots : ['General travel photography'];
};

// Tạo tips chụp ảnh tổng quan
const generatePhotographyTips = (places) => {
    const tips = [];

    if (places.some(p => p.isPhotographySpot)) {
        tips.push('🎯 Ưu tiên địa điểm có đánh dấu 📸');
        tips.push('⏰ Chú ý thời gian chụp ảnh tốt nhất được gợi ý');
        tips.push('📱 Sử dụng điện thoại: bật grid lines, HDR mode');
    }

    return tips.length > 0 ? tips : ['Mang theo máy ảnh để ghi lại khoảnh khắc đẹp'];
};

// Tạo thời gian tham quan tốt nhất
const generateBestVisitingTimes = (places) => {
    const times = new Set();

    places.forEach(place => {
        if (place.bestVisitTime) {
            times.add(place.bestVisitTime);
        }
    });

    return Array.from(times).slice(0, 3);
};

// Tạo insights địa phương
const generateLocalInsights = (destination) => {
    const insights = {
        'Hà Nội': ['Thử phở vào buổi sáng', 'Dạo quanh Hồ Gươm lúc chiều tà'],
        'Đà Nẵng': ['Tắm biển Mỹ Khê sáng sớm', 'Ăn hải sản ở chợ đêm'],
        'Hồ Chí Minh': ['Khám phá ẩm thực đường phố', 'Tham quan kiến trúc Pháp'],
        'Đà Lạt': ['Mang áo ấm về đêm', 'Thử cà phê local'],
        'Bà Rịa - Vũng Tàu': ['Tắm biển Bãi Sau', 'Thưởng thức hải sản tươi'],
        'Nha Trang': ['Lặn ngắm san hô', 'Thử bánh căn đặc sản'],
        'Phú Quốc': ['Tham quan làng chài', 'Mua nước mắm đặc sản']
    };

    return insights[destination] || ['Khám phá ẩm thực và văn hóa địa phương'];
};

// Tạo đề xuất đồ đạc
const generatePackingSuggestions = (interests, destination) => {
    const suggestions = ['Giấy tờ tùy thân', 'Thuốc men cá nhân'];

    if (interests.includes('photography')) {
        suggestions.push('Máy ảnh, pin dự phòng, thẻ nhớ');
    }

    if (interests.includes('adventure')) {
        suggestions.push('Giày thể thao, balo nhỏ');
    }

    if (destination.includes('Đà Lạt') || destination.includes('Sapa')) {
        suggestions.push('Áo ấm, ô/dù');
    }

    if (destination.includes('Vũng Tàu') || destination.includes('Nha Trang')) {
        suggestions.push('Đồ bơi, kem chống nắng');
    }

    return suggestions;
};

// HÀM LẤY ĐẶC SẢN TỪ FIREBASE
const getSpecialtiesFromFirebase = async (province) => {
    try {
        console.log(`🍜 Đang lấy đặc sản cho ${province} từ Firebase...`);

        const specialtiesRef = collection(db, 'specialties');
        const q = query(specialtiesRef, where('TinhThanh', '==', province));
        const querySnapshot = await getDocs(q);

        const specialties = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.DacSanNoiTieng || 'Đặc sản địa phương',
                description: data.MoTaDonGian || data.MoTaGia || 'Đặc sản nổi tiếng của địa phương',
                category: 'ẩm thực',
                price: data.GiaThamKhaoVND || 0,
                bestSeason: data.MuaNgonNhat || 'Cả năm',
                province: data.TinhThanh || province,
                originalData: data
            };
        });

        console.log(`✅ Tìm thấy ${specialties.length} đặc sản cho ${province}`);
        return specialties;

    } catch (error) {
        console.error(`❌ Lỗi lấy đặc sản từ Firebase cho ${province}:`, error);
        return getFallbackSpecialties(province);
    }
};

// FALLBACK DATA - chỉ dùng khi không kết nối được Firebase
const getFallbackSpecialties = (province) => {
    const fallbackData = {
        'Hà Nội': [
            {
                id: 'fallback-1',
                name: 'Phở Hà Nội',
                description: 'Sợi phở mềm, nước dùng xương bò, thịt bò tái/nạm; món quốc hồn.',
                category: 'ẩm thực',
                price: 50000,
                bestSeason: 'Cả năm',
                province: 'Hà Nội'
            },
            {
                id: 'fallback-2',
                name: 'Bún chả',
                description: 'Chả heo nướng than, ăn với bún, nước mắm chua ngọt.',
                category: 'ẩm thực',
                price: 40000,
                bestSeason: 'Cả năm',
                province: 'Hà Nội'
            }
        ],
        'Hải Phòng': [
            {
                id: 'fallback-3',
                name: 'Bánh đa cua',
                description: 'Bánh đa đỏ, nước cua đồng, chả cá, gạch cua.',
                category: 'ẩm thực',
                price: 40000,
                bestSeason: 'Cả năm',
                province: 'Hải Phòng'
            }
        ],
        'Quảng Ninh': [
            {
                id: 'fallback-4',
                name: 'Chả mực Hạ Long',
                description: 'Mực tươi giã tay, chiên giòn, thơm.',
                category: 'hải sản',
                price: 400000,
                bestSeason: 'Cả năm',
                province: 'Quảng Ninh'
            }
        ],
        'Đà Nẵng': [
            {
                id: 'fallback-5',
                name: 'Mì Quảng',
                description: 'Sợi mì vàng, nước lèo đậm đà, nhiều topping.',
                category: 'ẩm thực',
                price: 35000,
                bestSeason: 'Cả năm',
                province: 'Đà Nẵng'
            }
        ],
        'Hồ Chí Minh': [
            {
                id: 'fallback-6',
                name: 'Cơm tấm Sài Gòn',
                description: 'Cơm gạo tấm, sườn nướng, bì, chả trứng.',
                category: 'ẩm thực',
                price: 45000,
                bestSeason: 'Cả năm',
                province: 'Hồ Chí Minh'
            }
        ],
        'Bà Rịa - Vũng Tàu': [
            {
                id: 'fallback-7',
                name: 'Hải sản tươi sống',
                description: 'Các loại hải sản tươi ngon từ biển Vũng Tàu.',
                category: 'hải sản',
                price: 200000,
                bestSeason: 'Cả năm',
                province: 'Bà Rịa - Vũng Tàu'
            }
        ],
        'Lâm Đồng': [
            {
                id: 'fallback-8',
                name: 'Rau củ Đà Lạt',
                description: 'Các loại rau củ tươi ngon, đặc sản vùng cao.',
                category: 'nông sản',
                price: 50000,
                bestSeason: 'Cả năm',
                province: 'Lâm Đồng'
            }
        ]
    };

    const specialties = fallbackData[province] || [
        {
            id: 'fallback-default',
            name: 'Đặc sản địa phương',
            description: 'Khám phá ẩm thực đặc trưng của địa phương',
            category: 'ẩm thực',
            price: 0,
            bestSeason: 'Cả năm',
            province: province
        }
    ];

    console.log(`🔄 Dùng fallback data: ${specialties.length} đặc sản cho ${province}`);
    return specialties;
};

export default createPersonalItinerary;