// src/services/personalItineraryService.js
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getSmartCachedDestinations } from './cacheDestinations';

// Constants for photography optimization
const PHOTOGRAPHY_KEYWORDS = {
    vietnamese: [
        'cảnh đẹp', 'view đẹp', 'chụp ảnh', 'sống ảo', 'checkin', 'landmark',
        'hoàng hôn', 'bình minh', 'view thành phố', 'panorama', 'vista',
        'thác nước', 'hồ', 'núi', 'biển', 'đồi', 'cánh đồng', 'ruộng bậc thang',
        'kiến trúc', 'cổ kính', 'truyền thống', 'di sản', 'di tích',
        'cầu', 'chùa', 'nhà thờ', 'đền', 'miếu', 'lăng',
        'phố cổ', 'con đường', 'ngõ hẻm', 'bức tường', 'graffiti',
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

// Hàm tạo lịch trình cá nhân - CHỈ SỬ DỤNG CACHE
export const createPersonalItinerary = async (userPreferences, userId, mapInstance) => {
    const {
        departureDate,
        duration,
        departureLocation,
        destination,
        travelers,
        budget,
        travelStyle,
        travelGroup,
        ageGroup,
        preferredActivities,
        specialRequirements,
        travelPace,
        accommodationType,
        transportation,
        interests
    } = userPreferences;

    console.log('🔄 Bắt đầu tạo lịch trình cá nhân từ cache:', { destination, duration, travelers });

    // Lấy tọa độ địa điểm
    const departureCoord = await getLocationCoordinates(departureLocation);
    const destinationCoord = await getLocationCoordinates(destination);

    if (!departureCoord || !destinationCoord) {
        throw new Error('❌ Không thể xác định tọa độ địa điểm');
    }

    // Tìm địa điểm phù hợp CHỈ TỪ CACHE
    const [places, restaurants, hotels, specialties] = await Promise.all([
        findPersonalizedPlaces(destination, destinationCoord, userPreferences),
        findPersonalizedRestaurants(destination, destinationCoord, userPreferences),
        findPersonalizedHotels(destination, destinationCoord, userPreferences),
        getSpecialtiesFromFirebase(destination)
    ]);

    console.log(`✅ Tìm thấy từ cache: ${places.length} địa điểm, ${restaurants.length} nhà hàng, ${hotels.length} khách sạn`);

    // Nếu không có địa điểm nào, thông báo cho user
    if (places.length === 0) {
        console.warn(`⚠️ No cached data available for ${destination}`);
    }

    // Tạo lộ trình hàng ngày
    const dailyPlan = createDailyItinerary(places, duration, userPreferences);

    // Tính toán chi phí
    const costBreakdown = calculatePersonalCosts(places, restaurants, hotels, duration, travelers, travelStyle);

    // Tạo itinerary
    const itinerary = {
        userId,
        preferences: userPreferences,
        summary: {
            departure: departureLocation,
            destination: destination,
            duration: duration,
            totalDays: duration,
            travelers: travelers,
            budget: budget,
            style: travelStyle,
            photographySpots: places.filter(p => p.isPhotographySpot).length,
            source: 'cache'
        },
        dailyPlan: dailyPlan,
        accommodations: hotels.slice(0, 3),
        restaurants: restaurants.slice(0, 6),
        specialties: specialties.slice(0, 5),
        costBreakdown: costBreakdown,
        transportation: await getTransportationSuggestions(departureLocation, destination, transportation),
        recommendations: generatePersonalRecommendations(userPreferences),
        photographyTips: generateGeneralPhotographyTips(userPreferences),
        createdAt: new Date(),
        status: 'completed'
    };

    return itinerary;
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

// Hàm tìm địa điểm cá nhân hóa - CHỈ SỬ DỤNG CACHE
const findPersonalizedPlaces = async (destination, coord, preferences) => {
    const { interests } = preferences;

    console.log(`🔍 Finding personalized places for ${destination} from cache...`);

    try {
        // CHỈ sử dụng cache service - không gọi API
        const cachedPlaces = await getSmartCachedDestinations(destination, [], 'user');

        console.log(`📊 Retrieved ${cachedPlaces.length} cached places for ${destination}`);

        if (cachedPlaces.length === 0) {
            console.log(`❌ No cached data found for ${destination}`);
            return [];
        }

        // Filter và score places dựa trên preferences
        const scoredPlaces = cachedPlaces.map(place => {
            const photoAnalysis = detectPhotographySpot(place);
            return {
                ...place,
                photographyScore: photoAnalysis.score,
                photographyReasons: photoAnalysis.reasons,
                isPhotographySpot: photoAnalysis.isGoodForPhotos
            };
        });

        // Ưu tiên địa điểm chụp ảnh nếu có interest
        if (interests?.includes('photography')) {
            const photographyPlaces = scoredPlaces.filter(place => place.isPhotographySpot);
            console.log(`📸 Found ${photographyPlaces.length} photography spots`);
            return photographyPlaces.sort((a, b) => b.photographyScore - a.photographyScore);
        }

        return scoredPlaces
            .filter(place => place.photographyScore >= 3)
            .sort((a, b) => b.photographyScore - a.photographyScore)
            .slice(0, 25);

    } catch (error) {
        console.error(`❌ Error finding cached places for ${destination}:`, error);
        return [];
    }
};

// Hàm tìm nhà hàng - CHỈ SỬ DỤNG CACHE
const findPersonalizedRestaurants = async (destination, coord, preferences) => {
    const { dietPreference } = preferences;

    console.log(`🍽️ Finding restaurants for ${destination} from cache...`);

    try {
        // Lấy tất cả địa điểm từ cache
        const cachedPlaces = await getSmartCachedDestinations(destination, [], 'user');

        // Lọc ra nhà hàng
        const restaurants = cachedPlaces.filter(place =>
            place.types?.some(type =>
                type.includes('restaurant') ||
                type.includes('food') ||
                type.includes('cafe') ||
                type.includes('bakery') ||
                type.includes('meal_takeaway')
            ) &&
            place.rating >= 3.8 &&
            isRestaurantSuitable(place, preferences)
        );

        console.log(`🍴 Found ${restaurants.length} restaurants from cache`);
        return restaurants
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 10);
    } catch (error) {
        console.warn(`Error finding cached restaurants:`, error);
        return [];
    }
};

// Hàm tìm khách sạn - CHỈ SỬ DỤNG CACHE
const findPersonalizedHotels = async (destination, coord, preferences) => {
    const { accommodationType, travelStyle, travelers } = preferences;

    console.log(`🏨 Finding hotels for ${destination} from cache...`);

    try {
        // Lấy tất cả địa điểm từ cache
        const cachedPlaces = await getSmartCachedDestinations(destination, [], 'user');

        // Lọc ra khách sạn và chỗ ở
        const hotels = cachedPlaces.filter(place =>
            place.types?.some(type =>
                type.includes('lodging') ||
                type.includes('hotel') ||
                type.includes('resort') ||
                type.includes('spa')
            ) &&
            place.rating >= 3.5
        );

        console.log(`🏩 Found ${hotels.length} hotels from cache`);

        return hotels
            .sort((a, b) => (b.userRatingsTotal || 0) - (a.userRatingsTotal || 0))
            .slice(0, 8)
            .map(hotel => ({
                ...hotel,
                pricePerNight: estimateHotelPrice(hotel.priceLevel, travelStyle, travelers)
            }));
    } catch (error) {
        console.warn('Error finding cached hotels:', error);
        return [];
    }
};

// Hàm kiểm tra nhà hàng phù hợp
const isRestaurantSuitable = (place, preferences) => {
    const { dietPreference, travelStyle } = preferences;

    if (dietPreference === 'vegetarian') {
        const hasVegetarian = place.types?.some(type =>
            type.includes('vegetarian') || type.includes('vegan')
        );
        if (!hasVegetarian) return false;
    }

    if (travelStyle === 'luxury' && place.priceLevel < 3) return false;
    if (travelStyle === 'budget' && place.priceLevel > 2) return false;

    return true;
};

// Hàm tối ưu số lượng địa điểm mỗi ngày
const optimizeDailyPlaces = (travelPace, dayType = 'normal') => {
    const baseConfig = {
        relaxed: { maxPlaces: 2, travelTime: 4, breakTime: 2 },
        balanced: { maxPlaces: 3, travelTime: 5, breakTime: 1.5 },
        active: { maxPlaces: 4, travelTime: 6, breakTime: 1 },
        adventure: { maxPlaces: 5, travelTime: 7, breakTime: 0.5 }
    };

    return baseConfig[travelPace] || baseConfig.balanced;
};

// Hàm phân nhóm địa điểm theo loại
const groupPlacesByType = (places) => {
    const groups = {
        historical: [],
        nature: [],
        cultural: [],
        entertainment: [],
        food: [],
        shopping: [],
        relaxation: []
    };

    places.forEach(place => {
        const types = place.types || [];

        if (types.some(t => t.includes('museum') || t.includes('church') || t.includes('temple'))) {
            groups.historical.push(place);
        }
        if (types.some(t => t.includes('park') || t.includes('garden') || t.includes('natural'))) {
            groups.nature.push(place);
        }
        if (types.some(t => t.includes('art_gallery') || t.includes('cultural'))) {
            groups.cultural.push(place);
        }
        if (types.some(t => t.includes('amusement_park') || t.includes('entertainment'))) {
            groups.entertainment.push(place);
        }
        if (types.some(t => t.includes('restaurant') || t.includes('cafe') || t.includes('food'))) {
            groups.food.push(place);
        }
        if (types.some(t => t.includes('shopping_mall') || t.includes('store'))) {
            groups.shopping.push(place);
        }
        if (types.some(t => t.includes('spa') || t.includes('beauty_salon'))) {
            groups.relaxation.push(place);
        }

        if (Object.values(groups).every(group => !group.includes(place))) {
            groups.nature.push(place);
        }
    });

    return groups;
};

// Hàm chọn địa điểm cho mỗi ngày
// Hàm chọn địa điểm cho mỗi ngày - SỬA LẠI ĐỂ TRÁNH TRÙNG LẶP
// Hàm chọn địa điểm cho mỗi ngày - SỬA LẠI HOÀN TOÀN
const selectPlacesForDay = (groupedPlaces, placesPerDay, preferences, usedPlaceIds) => {
    const { interests, travelGroup } = preferences;
    const selectedPlaces = [];

    console.log(`🎯 Chọn địa điểm cho ngày: ${placesPerDay} địa điểm, interests:`, interests);

    // Tỷ lệ phân bổ địa điểm theo loại hình
    const getPlaceDistribution = () => {
        const baseDistribution = {
            historical: 0.2,
            nature: 0.3,
            cultural: 0.2,
            entertainment: 0.1,
            food: 0.1,
            shopping: 0.05,
            relaxation: 0.05
        };

        // Điều chỉnh theo interests
        if (interests?.includes('history')) baseDistribution.historical += 0.2;
        if (interests?.includes('nature')) baseDistribution.nature += 0.2;
        if (interests?.includes('culture')) baseDistribution.cultural += 0.2;
        if (interests?.includes('food')) baseDistribution.food += 0.15;
        if (interests?.includes('shopping')) baseDistribution.shopping += 0.1;

        // Chuẩn hóa tỷ lệ
        const total = Object.values(baseDistribution).reduce((sum, val) => sum + val, 0);
        Object.keys(baseDistribution).forEach(key => {
            baseDistribution[key] = baseDistribution[key] / total;
        });

        return baseDistribution;
    };

    const distribution = getPlaceDistribution();
    console.log('📊 Phân bổ địa điểm:', distribution);

    // Chọn địa điểm từ mỗi nhóm theo tỷ lệ
    Object.keys(distribution).forEach(groupKey => {
        const group = groupedPlaces[groupKey];
        const countForGroup = Math.round(distribution[groupKey] * placesPerDay);

        if (group && group.length > 0 && countForGroup > 0) {
            const availablePlaces = group.filter(place =>
                !usedPlaceIds.has(place.id || place.place_id)
            );

            // Sắp xếp theo rating và chọn
            const sortedPlaces = availablePlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            const selectedFromGroup = sortedPlaces.slice(0, countForGroup);

            selectedPlaces.push(...selectedFromGroup);
            console.log(`📍 Chọn ${selectedFromGroup.length} địa điểm từ nhóm ${groupKey}`);
        }
    });

    // Nếu chưa đủ, chọn thêm từ các nhóm có địa điểm tốt nhất
    if (selectedPlaces.length < placesPerDay) {
        const allAvailablePlaces = Object.values(groupedPlaces)
            .flat()
            .filter(place => !usedPlaceIds.has(place.id || place.place_id))
            .filter(place => !selectedPlaces.includes(place))
            .sort((a, b) => (b.rating || 0) - (a.rating || 0));

        const needed = placesPerDay - selectedPlaces.length;
        const additionalPlaces = allAvailablePlaces.slice(0, needed);
        selectedPlaces.push(...additionalPlaces);

        console.log(`➕ Chọn thêm ${additionalPlaces.length} địa điểm từ tất cả nhóm`);
    }

    // Đảm bảo không vượt quá số lượng
    return selectedPlaces.slice(0, placesPerDay);
};

// Hàm tạo lộ trình hàng ngày - SỬA LẠI
const createDailyItinerary = (places, duration, preferences) => {
    const dailyPlan = [];
    const dailyConfig = optimizeDailyPlaces(preferences.travelPace);
    const maxPlacesPerDay = dailyConfig.maxPlaces;

    console.log(`📅 Tạo lịch trình ${duration} ngày, tối đa ${maxPlacesPerDay} địa điểm/ngày`);

    // Phân nhóm địa điểm theo loại
    const groupedPlaces = groupPlacesByType(places);

    // Log số lượng địa điểm theo nhóm
    Object.keys(groupedPlaces).forEach(key => {
        console.log(`📁 ${key}: ${groupedPlaces[key].length} địa điểm`);
    });

    // Theo dõi tất cả địa điểm đã được sử dụng
    const allUsedPlaceIds = new Set();

    for (let day = 1; day <= duration; day++) {
        console.log(`\n🗓️ Đang tạo lịch trình cho ngày ${day}`);

        // Chọn địa điểm cho ngày này
        const dayPlaces = selectPlacesForDay(groupedPlaces, maxPlacesPerDay, preferences, allUsedPlaceIds);

        // Đánh dấu các địa điểm đã được sử dụng
        dayPlaces.forEach(place => {
            allUsedPlaceIds.add(place.id || place.place_id);
        });

        console.log(`📍 Ngày ${day}: Chọn ${dayPlaces.length} địa điểm duy nhất`);

        // Thêm photography info vào mỗi địa điểm
        const enhancedPlaces = dayPlaces.map(place => ({
            ...place,
            photographyInfo: {
                score: place.photographyScore || 0,
                reasons: place.photographyReasons || [],
                bestTime: generateBestPhotoTime(place, preferences),
                photoTips: generatePhotoTipsForPlace(place, preferences)
            }
        }));

        dailyPlan.push({
            day: day,
            date: calculateDate(preferences.departureDate, day - 1),
            destinations: enhancedPlaces,
            photographySpots: enhancedPlaces.filter(p => p.isPhotographySpot),
            maxPlaces: maxPlacesPerDay,
            travelTime: dailyConfig.travelTime,
            breakTime: dailyConfig.breakTime,
            meals: generateMealSuggestions(preferences),
            activities: generateDailyActivities(preferences, day, enhancedPlaces), // Truyền places vào
            photographyTips: generatePhotographyTips(preferences, day),
            notes: generateDailyNotes(day, duration, preferences)
        });
    }

    console.log(`\n✅ Đã tạo lịch trình ${duration} ngày với ${allUsedPlaceIds.size} địa điểm duy nhất`);
    return dailyPlan;
};

// Hàm tạo hoạt động hàng ngày - CẢI THIỆN
const generateDailyActivities = (preferences, day, dayPlaces) => {
    const activities = [];
    const { interests, travelGroup } = preferences;

    // Thêm hoạt động dựa trên địa điểm thực tế
    const placeTypes = dayPlaces.flatMap(place => place.types || []);

    if (placeTypes.some(type => type.includes('museum') || type.includes('historical'))) {
        activities.push('Tham quan di tích lịch sử');
    }

    if (placeTypes.some(type => type.includes('park') || type.includes('natural'))) {
        activities.push('Khám phá thiên nhiên');
    }

    if (placeTypes.some(type => type.includes('shopping_mall') || type.includes('store'))) {
        activities.push('Mua sắm quà lưu niệm');
    }

    if (placeTypes.some(type => type.includes('restaurant') || type.includes('food'))) {
        activities.push('Thưởng thức ẩm thực địa phương');
    }

    // Thêm hoạt động dựa trên interests
    if (interests?.includes('photography')) {
        activities.push('Chụp ảnh lưu niệm tại các điểm đẹp');
    }

    if (travelGroup === 'family') {
        activities.push('Thời gian vui chơi gia đình');
    }

    if (travelGroup === 'couple') {
        activities.push('Thời gian lãng mạn');
    }

    // Đảm bảo luôn có ít nhất 2 hoạt động
    if (activities.length < 2) {
        activities.push('Khám phá văn hóa địa phương');
        activities.push('Nghỉ ngơi và thư giãn');
    }

    return activities.slice(0, 4); // Giới hạn 4 hoạt động
};

// Hàm tìm nhà hàng - ĐẢM BẢO CÓ ĐỦ
// Hàm đề xuất thời gian chụp ảnh tốt nhất
const generateBestPhotoTime = (place, preferences) => {
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

    if (types.some(t => t.includes('temple') || t.includes('church'))) {
        return 'Sáng sớm (7h-9h) - ánh sáng dịu nhẹ';
    }

    return 'Sáng (8h-11h) hoặc chiều (15h-17h)';
};

// Hàm tạo tips chụp ảnh cho từng địa điểm
const generatePhotoTipsForPlace = (place, preferences) => {
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

    if (preferences.interests?.includes('photography')) {
        tips.push('Thử nghiệm với các góc độ sáng tạo');
        tips.push('Quay video timelapse nếu có thời gian');
    }

    return tips.slice(0, 3);
};

// Hàm tạo tips chụp ảnh theo ngày
const generatePhotographyTips = (preferences, day) => {
    const tips = [];
    const { interests, travelGroup } = preferences;

    if (interests?.includes('photography')) {
        tips.push('📸 Mang theo pin dự phòng và thẻ nhớ');
        tips.push('🌅 Dậy sớm để chụp bình minh');
        tips.push('🎨 Thử nghiệm với composition rules (rule of thirds)');

        if (travelGroup === 'couple') {
            tips.push('💑 Chụp ảnh cặp đôi với background đẹp');
        }

        if (day === 1) {
            tips.push('⭐ Ngày đầu - tập trung vào landmark chính');
        }
    }

    return tips;
};

// Hàm tạo tips chụp ảnh tổng quan
const generateGeneralPhotographyTips = (preferences) => {
    const { interests } = preferences;

    if (!interests?.includes('photography')) {
        return [];
    }

    return [
        '🎯 Ưu tiên địa điểm có đánh dấu 📸 trong lịch trình',
        '⏰ Chú ý thời gian chụp ảnh tốt nhất được đề xuất',
        '📱 Sử dụng điện thoại: bật grid lines, HDR mode',
        '🌤️ Kiểm tra weather forecast trước khi đi',
        '🎒 Mang tripod nhỏ gọn nếu có'
    ];
};

// Hàm tính ngày
const calculateDate = (startDate, dayOffset) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString('vi-VN');
};

// Hàm đề xuất bữa ăn
const generateMealSuggestions = (preferences) => {
    const { dietPreference } = preferences;
    const suggestions = {
        breakfast: 'Bữa sáng tại khách sạn',
        lunch: 'Bữa trưa tại nhà hàng địa phương',
        dinner: 'Bữa tối thưởng thức ẩm thực'
    };

    if (dietPreference === 'vegetarian') {
        suggestions.lunch = 'Bữa trưa chay tại nhà hàng chay';
        suggestions.dinner = 'Bữa tối với món chay đặc sản';
    }

    if (dietPreference === 'seafood') {
        suggestions.lunch = 'Bữa trưa hải sản tươi sống';
        suggestions.dinner = 'Bữa tối thưởng thức hải sản địa phương';
    }

    return suggestions;
};

// Hàm tạo hoạt động hàng ngày
const generateDailyNotes = (day, totalDays, preferences) => {
    const { travelGroup, ageGroup, interests } = preferences;

    if (day === 1) {
        return 'Ngày đầu tiên - Làm quen với địa điểm và nghỉ ngơi sau chuyến đi';
    }

    if (day === totalDays) {
        return 'Ngày cuối - Hoàn tất chuyến đi và chuẩn bị về';
    }

    if (interests?.includes('photography')) {
        return 'Dành thời gian cho chụp ảnh tại các điểm đẹp';
    }

    if (travelGroup === 'family') {
        return 'Dành thời gian cho các hoạt động gia đình và nghỉ ngơi hợp lý';
    }

    if (ageGroup === 'senior') {
        return 'Lịch trình nhẹ nhàng, nhiều thời gian nghỉ ngơi';
    }

    return 'Tận hưởng trọn vẹn trải nghiệm du lịch';
};

// Hàm tính toán chi phí
const calculatePersonalCosts = (places, restaurants, hotels, duration, travelers, travelStyle) => {
    const hotelCost = (hotels[0]?.pricePerNight || getDefaultHotelPrice(travelStyle)) * duration * travelers;
    const foodCost = calculateFoodCost(restaurants, duration, travelers, travelStyle);
    const activitiesCost = calculateActivitiesCost(places, travelers);
    const transportCost = calculateTransportCost(duration, travelers);

    const totalCost = hotelCost + foodCost + activitiesCost + transportCost;

    return {
        accommodations: hotelCost,
        food: foodCost,
        activities: activitiesCost,
        transport: transportCost,
        total: totalCost,
        perPerson: Math.round(totalCost / travelers),
        perDay: Math.round(totalCost / duration)
    };
};

// Hàm tính chi phí thức ăn
const calculateFoodCost = (restaurants, duration, travelers, travelStyle) => {
    const styleMultipliers = {
        'budget': 150000,
        'standard': 250000,
        'comfort': 400000,
        'luxury': 700000
    };

    const dailyCostPerPerson = styleMultipliers[travelStyle] || 250000;
    return dailyCostPerPerson * duration * travelers;
};

// Hàm tính chi phí hoạt động
const calculateActivitiesCost = (places, travelers) => {
    const avgCostPerPlace = 50000;
    return places.length * avgCostPerPlace * travelers;
};

// Hàm tính chi phí vận chuyển
const calculateTransportCost = (duration, travelers) => {
    const dailyTransportCost = 100000;
    return dailyTransportCost * duration * travelers;
};

// Hàm ước tính giá khách sạn
const estimateHotelPrice = (priceLevel, travelStyle, travelers) => {
    const basePrices = {
        'budget': 300000,
        'standard': 600000,
        'comfort': 1200000,
        'luxury': 2500000
    };

    return (basePrices[travelStyle] || 600000) * travelers;
};

// Hàm lấy giá khách sạn mặc định
const getDefaultHotelPrice = (travelStyle) => {
    return estimateHotelPrice(null, travelStyle, 2);
};

// Hàm đề xuất vận chuyển
const getTransportationSuggestions = async (departure, destination, transportation) => {
    return {
        type: transportation,
        suggestion: `Sử dụng ${getTransportationLabel(transportation)} để di chuyển`,
        estimatedCost: 'Liên hệ trực tiếp để biết giá chi tiết'
    };
};

// Hàm lấy label phương tiện
const getTransportationLabel = (transportation) => {
    const options = {
        'motorbike': 'xe máy',
        'car': 'ô tô',
        'taxi': 'taxi/Grab',
        'bus': 'xe bus',
        'bicycle': 'xe đạp',
        'walking': 'đi bộ'
    };
    return options[transportation] || 'phương tiện đã chọn';
};

// Hàm tạo đề xuất cá nhân
const generatePersonalRecommendations = (preferences) => {
    const recommendations = [];
    const { interests, travelGroup, ageGroup } = preferences;

    if (interests?.includes('food')) {
        recommendations.push('Tham gia tour ẩm thực đường phố');
    }
    if (interests?.includes('adventure')) {
        recommendations.push('Trải nghiệm hoạt động ngoài trời');
    }
    if (travelGroup === 'family') {
        recommendations.push('Lựa chọn địa điểm thân thiện với trẻ em');
    }
    if (ageGroup === 'senior') {
        recommendations.push('Ưu tiên địa điểm ít di chuyển, nhiều chỗ nghỉ');
    }
    if (interests?.includes('photography')) {
        recommendations.push('Dành thời gian cho chụp ảnh tại các điểm đẹp');
        recommendations.push('Mang theo pin dự phòng và thẻ nhớ');
    }

    return recommendations.length > 0 ? recommendations : ['Khám phá văn hóa và ẩm thực địa phương'];
};

// Các hàm hỗ trợ
const getLocationCoordinates = async (locationName) => {
    const coordinates = {
        "Hà Nội": { "lat": 21.0285, "lng": 105.8500 },
        "TP. Hồ Chí Minh": { "lat": 10.7769, "lng": 106.7009 },
        "Đà Nẵng": { "lat": 16.0471, "lng": 108.2258 },
        "Hải Phòng": { "lat": 20.8449, "lng": 106.6881 },
        "Cần Thơ": { "lat": 10.0452, "lng": 105.7469 },
        "Nha Trang": { "lat": 12.2388, "lng": 109.1967 },
        "Đà Lạt": { "lat": 11.9404, "lng": 108.4583 },
        "Sapa": { "lat": 22.3364, "lng": 103.8444 },
        "Phú Quốc": { "lat": 10.2895, "lng": 103.9840 },
        "Hội An": { "lat": 15.8801, "lng": 108.3380 },
        "Huế": { "lat": 16.4637, "lng": 107.5909 },
        "Hạ Long": { "lat": 20.9101, "lng": 107.1839 },
        "Vũng Tàu": { "lat": 10.3460, "lng": 107.0843 },
        "Quy Nhơn": { "lat": 13.7824, "lng": 109.2197 }
    };

    return coordinates[locationName] || { lat: 16.0471, lng: 108.2258 };
};

const getSpecialtiesFromFirebase = async (province) => {
    return [];
};

export default createPersonalItinerary;