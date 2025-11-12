// src/services/createRealTimeItinerary.js

import { getPlaceDetailsNew } from './placesService';
import { getStormRisks, getFloodRisks, saveItinerary } from './firestoreService';
import { predictRiskScore } from '../ml/riskModel';
import { initPlacesService, searchNearbyPlaces, getPhotoUrl, searchPlacesByText } from './placesService';
import { getWeather, get7DayWeatherForecast } from './weatherService';
import provinceCoords from '../assets/provinceCoord.json';
import { toast } from 'react-toastify';
import {
    getFestivalsByMonth,
    getRegionalActivities,
    typeToPlaces,
    normalizeVietnamLocation,
    getVietnamRegion,
    getProvinceFromLocation,
    isLocationInVietnam
} from './locationService';
import {
    smartSearchDestinations,
    getCachedRestaurants,
    getCachedHotels,
    cacheDestinations,
    cacheRestaurants,
    cacheHotels,
    getCachedDestinations, getCachedDestinationsByProvince
} from './cacheDestinations';

// ==================== CÁC HÀM HỖ TRỢ ====================


// HÀM LẤY GIÁ THỰC TẾ TỪ GOOGLE PLACES
const getRealPriceFromGoogle = async (placeId, placeType, province) => {
    try {
        if (!placeId) {
            return getRealTicketPrice(placeType, province);
        }

        const details = await getPlaceDetailsNew(placeId);

        // Ưu tiên lấy price_level từ Google
        if (details.price_level !== undefined && details.price_level !== null) {
            return estimatePricePerPerson(details.price_level, getPlaceCategory(placeType));
        }

        // Fallback nếu không có price_level
        return getRealTicketPrice(placeType, province);
    } catch (error) {
        console.warn(`Không lấy được giá từ Google cho ${placeId}:`, error);
        return getRealTicketPrice(placeType, province);
    }
};

// HÀM PHÂN LOẠI ĐỊA ĐIỂM
const getPlaceCategory = (placeType) => {
    if (['restaurant', 'cafe', 'food', 'bar'].includes(placeType)) {
        return 'restaurant';
    } else if (['lodging', 'hotel', 'resort'].includes(placeType)) {
        return 'hotel';
    } else {
        return 'attraction';
    }
};

// HÀM TÍNH GIÁ DỰA TRÊN price_level CỦA GOOGLE
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

    const hotelPriceMap = {
        0: 300000,  // Budget
        1: 500000,  // Economy
        2: 800000,  // Mid-range
        3: 1500000, // Upscale
        4: 3000000  // Luxury
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

// HÀM LẤY GIÁ VÉ THỰC TẾ (FALLBACK)
const getRealTicketPrice = (placeType, province) => {
    const priceRanges = {
        'tourist_attraction': { min: 30000, max: 150000 },
        'museum': { min: 20000, max: 80000 },
        'park': { min: 10000, max: 50000 },
        'zoo': { min: 50000, max: 120000 },
        'amusement_park': { min: 100000, max: 300000 },
        'beach': { min: 0, max: 20000 },
        'temple': { min: 0, max: 50000 },
        'historical_landmark': { min: 15000, max: 100000 },
        'floating_market': { min: 50000, max: 150000 },
        'fruit_garden': { min: 20000, max: 80000 },
        'bird_sanctuary': { min: 30000, max: 100000 },
        'farm': { min: 30000, max: 100000 },
        'winery': { min: 50000, max: 200000 },
        'cultural_center': { min: 20000, max: 80000 },
        'cave': { min: 50000, max: 150000 },
        'waterfall': { min: 20000, max: 80000 },
        'island': { min: 100000, max: 300000 }
    };

    const range = priceRanges[placeType] || { min: 20000, max: 80000 };
    return Math.floor(Math.random() * (range.max - range.min) + range.min);
};

// HÀM PHÂN LOẠI KHÁCH SẠN
const getHotelCategory = (priceLevel, rating) => {
    if (priceLevel <= 1) return 'budget';
    if (priceLevel === 2) return 'mid-range';
    if (priceLevel >= 3) return 'luxury';

    if (rating >= 4.5) return 'luxury';
    if (rating >= 4.0) return 'mid-range';
    return 'budget';
};

// ==================== HÀM PHÂN BỔ NGÀY MỚI ====================
const distributeDaysToLocations = (selectedLocations, totalDays, allDestinations) => {
    const result = [];
    let currentDay = 1;

    // Sắp xếp locations theo priority
    const sortedLocations = [...selectedLocations].sort((a, b) => a.priority - b.priority);

    // Tạo map để theo dõi địa điểm đã visited và số ngày đã dùng cho mỗi location
    const visitedDestinations = new Set();
    const locationDayUsage = {};

    // Khởi tạo usage counter
    sortedLocations.forEach(loc => {
        locationDayUsage[loc.name] = 0;
    });

    while (currentDay <= totalDays) {
        for (const loc of sortedLocations) {
            if (currentDay > totalDays) break;

            // Kiểm tra nếu location này đã dùng đủ số ngày được phân bổ
            if (locationDayUsage[loc.name] >= loc.days) {
                continue;
            }

            // Lấy destinations cho location này, loại bỏ đã visited
            const availableDestinations = allDestinations
                .filter(dest =>
                    dest.province === loc.province &&
                    !visitedDestinations.has(dest.placeId || dest.name)
                )
                .slice(0, 3); // Lấy tối đa 3 địa điểm mỗi ngày

            if (availableDestinations.length > 0) {
                // Thêm destinations vào visited
                availableDestinations.forEach(dest => {
                    visitedDestinations.add(dest.placeId || dest.name);
                });

                result.push({
                    day: currentDay,
                    date: new Date(), // Sẽ được cập nhật sau
                    location: loc.name,
                    province: loc.province,
                    destinations: availableDestinations,
                    note: `Ngày thứ ${locationDayUsage[loc.name] + 1} tại ${loc.name}`
                });

                // Tăng counter
                locationDayUsage[loc.name]++;
                currentDay++;
            }
        }

        // Safety check để tránh infinite loop
        const allLocationsUsed = Object.keys(locationDayUsage).every(locationName => {
            const targetLocation = sortedLocations.find(l => l.name === locationName);
            return locationDayUsage[locationName] >= (targetLocation?.days || 0);
        });

        if (allLocationsUsed) {
            break;
        }
    }

    return result;
};

// HÀM TÌM ĐỊA ĐIỂM CỤ THỂ VỚI GIÁ THỰC TẾ
const findSpecificAttraction = async (locationName, province, center) => {
    try {
        console.log(`Tìm kiếm địa điểm cụ thể: ${locationName} ở ${province}`);
        const results = await searchPlacesByText(`${locationName} ${province} Việt Nam`, center, 50000);
        if (results.length > 0) {
            const place = results[0];
            try {
                const details = await getPlaceDetailsNew(place.place_id);

                // Lấy giá thực tế từ Google
                const realPrice = await getRealPriceFromGoogle(
                    place.place_id,
                    details.types?.[0] || 'tourist_attraction',
                    province
                );

                return {
                    ...details,
                    pricePerPerson: realPrice,
                    isSpecificAttraction: true,
                    rating: details.rating || place.rating,
                    userRatingsTotal: details.user_ratings_total || place.user_ratings_total
                };
            } catch (err) {
                console.warn('Không lấy được chi tiết mới, dùng fallback');
                const fallbackPrice = getRealTicketPrice(
                    place.types?.[0] || 'tourist_attraction',
                    province
                );

                return {
                    place_id: place.place_id,
                    name: place.name,
                    address: place.vicinity,
                    rating: place.rating,
                    user_ratings_total: place.user_ratings_total,
                    photos: place.photos,
                    types: place.types,
                    geometry: place.geometry,
                    pricePerPerson: fallbackPrice,
                    isSpecificAttraction: true
                };
            }
        }
        return null;
    } catch (err) {
        console.warn('Lỗi tìm địa điểm cụ thể:', err);
        return null;
    }
};

// HÀM LẤY DỮ LIỆU VÙNG MIỀN AN TOÀN (có fallback)
const getSafeRegionalData = (province) => {
    const regionalData = getRegionalActivities(province);

    // Fallback data nếu không có dữ liệu
    if (!regionalData) {
        console.warn(`⚠️ Không có dữ liệu vùng miền cho ${province}, sử dụng dữ liệu mặc định`);
        return {
            placeTypes: ['tourist_attraction', 'park', 'museum'],
            activities: ['khám phá', 'thăm quan'],
            keywords: ['du lịch', 'điểm đến']
        };
    }

    return regionalData;
};

// HÀM TÌM ĐỊA ĐIỂM VỚI CACHE THÔNG MINH VÀ GIÁ THỰC TẾ
const findRegionalAttractions = async (province, center, budgetCategory, specificLocation = null) => {
    const allAttractions = [];

    // Nếu có địa điểm cụ thể, ưu tiên tìm trước
    if (specificLocation) {
        const specificAttraction = await findSpecificAttraction(specificLocation, province, center);
        if (specificAttraction) {
            allAttractions.push(specificAttraction);
        }
    }

    // THÊM: Thử lấy từ cache trước
    const cachedAttractions = await getCachedDestinations(province);
    if (cachedAttractions.length > 0) {
        console.log(`✅ Sử dụng ${cachedAttractions.length} attractions từ cache cho ${province}`);

        // Cập nhật giá thực tế cho các địa điểm từ cache
        const updatedCachedAttractions = await Promise.all(
            cachedAttractions.map(async (attraction) => {
                try {
                    const realPrice = await getRealPriceFromGoogle(
                        attraction.placeId,
                        attraction.type || 'tourist_attraction',
                        province
                    );
                    return {
                        ...attraction,
                        pricePerPerson: realPrice,
                        fromCache: true
                    };
                } catch (error) {
                    console.warn(`Không cập nhật được giá cho ${attraction.name}:`, error);
                    return attraction;
                }
            })
        );

        return [...allAttractions, ...updatedCachedAttractions];
    }

    console.log(`🔄 Không có cache cho ${province}, đang lấy dữ liệu từ API...`);

    // Nếu cache không có, call API và lưu vào cache
    const regionalData = getSafeRegionalData(province);

    for (const placeType of regionalData.placeTypes.slice(0, 3)) {
        try {
            const results = await searchNearbyPlaces({
                location: center,
                radius: 50000,
                type: placeType,
                keyword: `${province} ${regionalData.keywords[0]}`
            });

            const filtered = await Promise.all(
                results
                    .filter(p => p.rating >= 3.8)
                    .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
                    .slice(0, 2)
                    .map(async (p) => {
                        const geometry = p.geometry?.location;
                        let lat, lng;

                        if (geometry && typeof geometry.lat === 'function') {
                            lat = geometry.lat();
                            lng = geometry.lng();
                        } else {
                            lat = Number(geometry?.lat || center.lat);
                            lng = Number(geometry?.lng || center.lng);
                        }

                        // KIỂM TRA ĐỊA ĐIỂM CÓ Ở VIỆT NAM KHÔNG
                        if (!isLocationInVietnam(lat, lng)) {
                            console.warn(`⚠️ Bỏ qua địa điểm không nằm trong Việt Nam: ${p.name}`);
                            return null;
                        }

                        // Lấy giá thực tế từ Google
                        const realPrice = await getRealPriceFromGoogle(
                            p.place_id,
                            placeType,
                            province
                        );

                        return {
                            name: p.name,
                            address: p.vicinity || 'Địa chỉ không xác định',
                            rating: p.rating || 4.0,
                            userRatingsTotal: p.user_ratings_total || 10,
                            photo: p.photos?.[0] ? getPhotoUrl(p.photos[0].photo_reference) : null,
                            pricePerPerson: realPrice,
                            type: placeType,
                            province: province,
                            lat: lat,
                            lng: lng,
                            placeId: p.place_id,
                            isFree: realPrice === 0,
                            regionalActivity: regionalData.activities[0],
                            fromAPI: true
                        };
                    })
            );

            allAttractions.push(...filtered.filter(Boolean));
        } catch (err) {
            console.warn(`Lỗi tìm ${placeType} ở ${province}:`, err);
        }
    }

    // THÊM: Lưu vào cache sau khi call API
    if (allAttractions.length > 0) {
        console.log(`💾 Lưu ${allAttractions.length} attractions vào cache cho ${province}`);
        await cacheDestinations(province, center);
    }

    return allAttractions;
};

// HÀM CHỌN ĐỊA ĐIỂM ĐA DẠNG - TRÁNH TRÙNG LẶP
const selectDiverseDestinations = (allDestinations, maxPerType = 2) => {
    const selected = [];
    const typeCount = {};
    const usedNames = new Set();
    const usedPlaceIds = new Set();

    // Ưu tiên địa điểm cụ thể trước
    const specificAttractions = allDestinations.filter(dest => dest.isSpecificAttraction);
    specificAttractions.forEach(dest => {
        if (!usedPlaceIds.has(dest.placeId) && !usedNames.has(dest.name)) {
            selected.push(dest);
            usedNames.add(dest.name);
            usedPlaceIds.add(dest.placeId);
        }
    });

    // Sắp xếp theo rating và độ phổ biến
    const sorted = allDestinations
        .filter(dest => !dest.isSpecificAttraction)
        .sort((a, b) => {
            const scoreA = (a.rating * 0.6) + (Math.min(a.userRatingsTotal / 1000, 1) * 0.4);
            const scoreB = (b.rating * 0.6) + (Math.min(b.userRatingsTotal / 1000, 1) * 0.4);
            return scoreB - scoreA;
        });

    for (const dest of sorted) {
        const type = dest.type;
        typeCount[type] = (typeCount[type] || 0) + 1;

        if (!usedNames.has(dest.name) && !usedPlaceIds.has(dest.placeId) && typeCount[type] <= maxPerType) {
            selected.push(dest);
            usedNames.add(dest.name);
            usedPlaceIds.add(dest.placeId);
        }

        if (selected.length >= 20) break; // Tăng giới hạn để có đủ cho nhiều ngày
    }

    return selected;
};

// HÀM TÌM NHÀ HÀNG VỚI CACHE VÀ GIÁ THỰC TẾ
const findSpecialtyRestaurants = async (province, center, mealType, budgetCategory) => {
    const regionalData = getSafeRegionalData(province);
    const specialty = regionalData.activities[0] || 'đặc sản';

    // THÊM: Thử lấy từ cache trước
    const cachedRestaurants = await getCachedRestaurants(province, specialty);
    if (cachedRestaurants.length > 0) {
        console.log(`✅ Sử dụng ${cachedRestaurants.length} restaurants từ cache cho ${province}`);

        // Cập nhật giá thực tế cho restaurant từ cache
        const restaurant = cachedRestaurants[0];
        try {
            const realPrice = await getRealPriceFromGoogle(
                restaurant.placeId,
                'restaurant',
                province
            );

            return {
                ...restaurant,
                price_level: Math.floor(realPrice / 80000), // Convert back to price_level
                fromCache: true
            };
        } catch (error) {
            console.warn(`Không cập nhật được giá cho ${restaurant.name}:`, error);
            return restaurant;
        }
    }

    console.log(`🔄 Không có cache restaurants cho ${province}, đang lấy từ API...`);

    let keyword;
    if (mealType === 'lunch') {
        keyword = `quán ăn ${specialty} ${province}`;
    } else {
        keyword = budgetCategory === 'high'
            ? `nhà hàng ${specialty} cao cấp ${province}`
            : `nhà hàng ${specialty} ${province}`;
    }

    try {
        const results = await searchPlacesByText(keyword, center, 5000);

        const filtered = results
            .filter(r => {
                const priceOk = budgetCategory === 'low' ? (r.price_level || 0) <= 2 :
                    budgetCategory === 'medium' ? (r.price_level || 0) <= 3 : true;
                return r.rating >= 4.0 && priceOk;
            })
            .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));

        const bestRestaurant = filtered.length > 0 ? filtered[0] : null;

        // THÊM: Lưu vào cache nếu tìm thấy
        if (bestRestaurant) {
            console.log(`💾 Lưu restaurant vào cache cho ${province}`);
            await cacheRestaurants([bestRestaurant], province, specialty);
        }

        return bestRestaurant;
    } catch (error) {
        console.warn(`Lỗi tìm nhà hàng ${province}:`, error);
        return null;
    }
};

// HÀM TÌM KHÁCH SẠN VỚI CACHE VÀ GIÁ THỰC TẾ
const findHotelsWithCache = async (province, center, budgetCategory, travelers) => {
    // THÊM: Thử lấy từ cache trước
    const cachedHotels = await getCachedHotels(province, budgetCategory);
    if (cachedHotels.length > 0) {
        console.log(`✅ Sử dụng ${cachedHotels.length} hotels từ cache cho ${province}`);

        // Cập nhật giá thực tế cho hotels từ cache
        const updatedHotels = await Promise.all(
            cachedHotels.map(async (hotel) => {
                try {
                    const realPrice = await getRealPriceFromGoogle(
                        hotel.placeId,
                        'hotel',
                        province
                    );

                    let pricePerNight = realPrice;
                    if (travelers > 2) {
                        pricePerNight *= (1 + (travelers - 2) * 0.3);
                    }

                    return {
                        ...hotel,
                        pricePerNight: Math.round(pricePerNight),
                        fromCache: true
                    };
                } catch (error) {
                    console.warn(`Không cập nhật được giá cho ${hotel.name}:`, error);
                    return hotel;
                }
            })
        );

        return updatedHotels;
    }

    console.log(`🔄 Không có cache hotels cho ${province}, đang lấy từ API...`);

    let hotelKeyword = 'khách sạn, hotel';
    let hotelSearchRadius = 10000;

    if (budgetCategory === 'high') {
        hotelKeyword = 'resort, 5 star hotel, luxury hotel';
        hotelSearchRadius = 15000;
        if (travelers > 4) {
            hotelKeyword += ', villa';
        }
    } else if (budgetCategory === 'low') {
        hotelKeyword = 'hostel, motel, budget hotel, homestay, nhà nghỉ';
        hotelSearchRadius = 7000;
    }

    try {
        const hotelResults = await searchNearbyPlaces({
            location: center,
            radius: hotelSearchRadius,
            type: 'lodging',
            keyword: hotelKeyword
        });

        const categorizedHotels = hotelResults
            .filter(h => h.rating >= 3.5)
            .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
            .slice(0, 10);

        const budgetHotels = categorizedHotels.filter(h => getHotelCategory(h.price_level, h.rating) === 'budget');
        const midRangeHotels = categorizedHotels.filter(h => getHotelCategory(h.price_level, h.rating) === 'mid-range');
        const luxuryHotels = categorizedHotels.filter(h => getHotelCategory(h.price_level, h.rating) === 'luxury');

        const selectedHotels = [];
        if (budgetCategory === 'high') {
            if (luxuryHotels.length > 0) selectedHotels.push(luxuryHotels[0]);
            if (midRangeHotels.length > 0) selectedHotels.push(midRangeHotels[0]);
            if (budgetHotels.length > 0) selectedHotels.push(budgetHotels[0]);
        } else if (budgetCategory === 'low') {
            if (budgetHotels.length > 0) selectedHotels.push(budgetHotels[0]);
            if (midRangeHotels.length > 0) selectedHotels.push(midRangeHotels[0]);
            if (luxuryHotels.length > 0) selectedHotels.push(luxuryHotels[0]);
        } else {
            if (midRangeHotels.length > 0) selectedHotels.push(midRangeHotels[0]);
            if (budgetHotels.length > 0) selectedHotels.push(budgetHotels[0]);
            if (luxuryHotels.length > 0) selectedHotels.push(luxuryHotels[0]);
        }

        const finalHotelSuggestions = await Promise.all(
            selectedHotels.slice(0, 3).map(async (h) => {
                const geometry = h.geometry?.location;
                let lat, lng;

                if (geometry && typeof geometry.lat === 'function') {
                    lat = geometry.lat();
                    lng = geometry.lng();
                } else {
                    lat = Number(geometry?.lat || center.lat);
                    lng = Number(geometry?.lng || center.lng);
                }

                // KIỂM TRA KHÁCH SẠN CÓ Ở VIỆT NAM KHÔNG
                if (!isLocationInVietnam(lat, lng)) {
                    console.warn(`⚠️ Bỏ qua khách sạn không nằm trong Việt Nam: ${h.name}`);
                    return null;
                }

                // Lấy giá thực tế từ Google
                const realPrice = await getRealPriceFromGoogle(
                    h.place_id,
                    'hotel',
                    province
                );

                let pricePerNight = realPrice;
                if (h.rating >= 4.5) pricePerNight *= 1.3;
                else if (h.rating >= 4.0) pricePerNight *= 1.1;

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
                    category: getHotelCategory(h.price_level, h.rating),
                    placeId: h.place_id,
                    fromAPI: true
                };
            })
        );

        // THÊM: Lưu hotels vào cache
        const validHotels = finalHotelSuggestions.filter(Boolean);
        if (validHotels.length > 0) {
            console.log(`💾 Lưu ${validHotels.length} hotels vào cache cho ${province}`);
            await cacheHotels(validHotels, province, budgetCategory);
        }

        return validHotels;
    } catch (err) {
        console.warn('Lỗi tìm khách sạn:', err);

        // Fallback hotel với giá ước tính
        let fallbackHotel;
        const fallbackPrice = estimatePricePerPerson(
            budgetCategory === 'high' ? 4 : budgetCategory === 'low' ? 1 : 2,
            'hotel'
        );

        if (budgetCategory === 'high') {
            fallbackHotel = {
                name: 'Khách sạn 5 sao (Mặc định)',
                address: 'Trung tâm thành phố',
                rating: 4.6,
                userRatingsTotal: 150,
                pricePerNight: fallbackPrice * (1 + (travelers - 2) * 0.3),
                category: 'luxury',
                lat: center.lat,
                lng: center.lng
            };
        } else if (budgetCategory === 'low') {
            fallbackHotel = {
                name: 'Khách sạn 2 sao / Homestay (Mặc định)',
                address: 'Khu vực lân cận',
                rating: 4.0,
                userRatingsTotal: 60,
                pricePerNight: fallbackPrice * (1 + (travelers - 2) * 0.3),
                category: 'budget',
                lat: center.lat,
                lng: center.lng
            };
        } else {
            fallbackHotel = {
                name: 'Khách sạn 3 sao (Mặc định)',
                address: 'Trung tâm thành phố',
                rating: 4.2,
                userRatingsTotal: 80,
                pricePerNight: fallbackPrice * (1 + (travelers - 2) * 0.3),
                category: 'mid-range',
                lat: center.lat,
                lng: center.lng
            };
        }
        return [fallbackHotel];
    }
};

// HÀM KIỂM TRA RỦI RO (CHỈ CẢNH BÁO, KHÔNG CHẶN)
const checkRiskWarnings = async (locations, month) => {
    const warnings = [];

    for (const loc of locations) {
        try {
            const province = getProvinceFromLocation(loc.name) || loc.province;
            const storms = await getStormRisks(province, month);
            const floods = await getFloodRisks(province, month);
            const riskScore = predictRiskScore(month, province, storms, floods);

            if (riskScore > 0.7) {
                warnings.push({
                    location: loc.name,
                    province: province,
                    riskScore: Math.round(riskScore * 100),
                    type: 'cao',
                    message: `⚠️ ${loc.name} (${province}) có rủi ro thiên tai cao: ${Math.round(riskScore * 100)}% - Tháng ${month} thường có ${storms > floods ? 'bão' : 'lũ lụt'}`
                });
            } else if (riskScore > 0.4) {
                warnings.push({
                    location: loc.name,
                    province: province,
                    riskScore: Math.round(riskScore * 100),
                    type: 'trung bình',
                    message: `📢 ${loc.name} (${province}) có rủi ro trung bình: ${Math.round(riskScore * 100)}% - Cần theo dõi thời tiết`
                });
            }
        } catch (err) {
            console.warn(`Lỗi kiểm tra rủi ro ${loc.name}:`, err);
        }
    }

    return warnings;
};

// ==================== HÀM CHÍNH ====================

export const createRealTimeItinerary = async (prefs, userId, mapInstance) => {
    const {
        locations,
        types,
        adventureLevel,
        budget,
        days,
        travelers,
        startDate,
        ecoFriendly
    } = prefs;

    const month = new Date(startDate).getMonth() + 1;

    console.log('🚀 Bắt đầu tạo itinerary với hệ thống cache thông minh và giá thực tế');

    // KIỂM TRA TẤT CẢ ĐỊA ĐIỂM CÓ Ở VIỆT NAM KHÔNG
    for (const loc of locations) {
        if (!isLocationInVietnam(loc.center.lat, loc.center.lng)) {
            throw new Error(`Địa điểm ${loc.name} không nằm trong lãnh thổ Việt Nam`);
        }
    }

    // === TÍNH TOÁN NGÂN SÁCH ===
    const budgetPerPersonPerDay = (budget / (travelers || 1)) / (days || 1);
    let budgetCategory = 'medium';
    if (budgetPerPersonPerDay < 500000) budgetCategory = 'low';
    if (budgetPerPersonPerDay > 1500000) budgetCategory = 'high';

    console.log(`💰 Ngân sách: ${budgetPerPersonPerDay.toFixed(0)} VND/người/ngày -> ${budgetCategory}`);

    // === KIỂM TRA RỦI RO (CHỈ CẢNH BÁO) ===
    const riskWarnings = await checkRiskWarnings(locations, month);

    // Hiển thị cảnh báo nhưng KHÔNG chặn
    if (riskWarnings.length > 0) {
        riskWarnings.forEach(warning => {
            console.warn(warning.message);
        });
    }

    // === KHỞI TẠO PLACES SERVICE ===
    await initPlacesService(mapInstance);

    // === TÌM ĐIỂM ĐẾN VỚI CACHE THÔNG MINH VÀ GIÁ THỰC TẾ ===
    let allDestinations = [];
    let cacheStats = {fromCache: 0, fromAPI: 0, specificAttractions: 0};

    for (const loc of locations) {
        // Xác định tỉnh từ địa điểm cụ thể
        const normalizedProvince = getProvinceFromLocation(loc.name) || normalizeVietnamLocation(loc.province);
        const coord = provinceCoords[normalizedProvince] || loc.center;

        if (!coord) {
            console.warn(`Không tìm thấy tọa độ cho ${loc.name}`);
            continue;
        }

        console.log(`📍 Xử lý địa điểm: ${loc.name} (${normalizedProvince}) - ${loc.days} ngày - Ưu tiên: ${loc.priority}`);

        // Tìm địa điểm cụ thể nếu có (biển Lagi, đảo Bình Ba, etc.)
        if (loc.name !== normalizedProvince) {
            const specificAttraction = await findSpecificAttraction(loc.name, normalizedProvince, coord);
            if (specificAttraction) {
                allDestinations.push(specificAttraction);
                cacheStats.specificAttractions++;
                console.log(`✅ Đã tìm thấy địa điểm cụ thể: ${specificAttraction.name}`);
            }
        }

        // Lấy địa điểm đặc trưng vùng miền VỚI CACHE THÔNG MINH
        const regionalAttractions = await findRegionalAttractions(
            normalizedProvince,
            coord,
            budgetCategory,
            loc.name !== normalizedProvince ? loc.name : null
        );

        // Phân loại từ cache hay API
        const fromCache = regionalAttractions.some(attraction => attraction.fromCache);
        if (fromCache) {
            cacheStats.fromCache += regionalAttractions.filter(attraction => attraction.fromCache).length;
            cacheStats.fromAPI += regionalAttractions.filter(attraction => !attraction.fromCache).length;
        } else {
            cacheStats.fromAPI += regionalAttractions.length;
        }

        allDestinations = [...allDestinations, ...regionalAttractions];

        // Lấy địa điểm theo loại hình du lịch user chọn VỚI CACHE
        const userPlaceTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
        if (ecoFriendly) userPlaceTypes.push('park', 'garden');
        if (adventureLevel > 3) userPlaceTypes.push('hiking_area', 'adventure_sports');

        const uniqueTypes = [...new Set(userPlaceTypes)].slice(0, 4);

        for (const type of uniqueTypes) {
            const smartResults = await smartSearchDestinations(
                normalizedProvince,
                [type],
                3.5,
                coord
            );

            if (smartResults.length > 0) {
                // Cập nhật giá thực tế cho smart search results
                const updatedSmartResults = await Promise.all(
                    smartResults.map(async (result) => {
                        try {
                            const realPrice = await getRealPriceFromGoogle(
                                result.placeId,
                                result.type || 'tourist_attraction',
                                normalizedProvince
                            );
                            return {
                                ...result,
                                pricePerPerson: realPrice
                            };
                        } catch (error) {
                            console.warn(`Không cập nhật được giá cho ${result.name}:`, error);
                            return result;
                        }
                    })
                );

                if (smartResults[0].fromCache) {
                    cacheStats.fromCache += smartResults.length;
                } else {
                    cacheStats.fromAPI += smartResults.length;
                }
                allDestinations = [...allDestinations, ...updatedSmartResults];
            }
        }
    }

    console.log(`📊 Thống kê Cache: ${cacheStats.fromCache} từ cache, ${cacheStats.fromAPI} từ API, ${cacheStats.specificAttractions} địa điểm cụ thể`);

    // === CHỌN LỌC ĐA DẠNG - TRÁNH TRÙNG LẶP ===
    const diverseDestinations = selectDiverseDestinations(allDestinations, 2);

    if (diverseDestinations.length < days * 3) {
        const needed = days * 3 - diverseDestinations.length;
        const defaultSpots = allDestinations
            .filter(d => !diverseDestinations.includes(d))
            .slice(0, needed);
        diverseDestinations.push(...defaultSpots);
    }

    console.log(`🎯 Đã chọn ${diverseDestinations.length} điểm đến đa dạng (không trùng lặp)`);

    // === PHÂN BỔ NGÀY THEO LOCATIONS VÀ PRIORITY ===
    const dailyPlan = distributeDaysToLocations(locations, days, diverseDestinations);

    // Cập nhật ngày thực tế
    dailyPlan.forEach((day, index) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + index);
        day.date = date.toLocaleDateString('vi-VN');
    });

    console.log(`📅 Đã phân bổ ${dailyPlan.length} ngày theo ${locations.length} địa điểm`);

    // === GỢI Ý ĂN UỐNG ĐẶC SẢN VỚI CACHE VÀ GIÁ THỰC TẾ ===
    const meals = [];

    for (const day of dailyPlan) {
        if (!day.destinations || day.destinations.length === 0) continue;

        const currentProvince = day.province;
        const center = day.destinations[Math.floor(day.destinations.length / 2)];
        let lunch = null, dinner = null;

        // SỬ DỤNG CACHE CHO RESTAURANTS
        lunch = await findSpecialtyRestaurants(currentProvince, center, 'lunch', budgetCategory);
        dinner = await findSpecialtyRestaurants(currentProvince, center, 'dinner', budgetCategory);

        const regionalData = getSafeRegionalData(currentProvince);

        // Tính giá thực tế cho bữa ăn
        const lunchPrice = lunch ?
            estimatePricePerPerson(lunch.price_level || 2, 'restaurant') * travelers :
            estimatePricePerPerson(1, 'restaurant') * travelers;

        const dinnerPrice = dinner ?
            estimatePricePerPerson(dinner.price_level || 2, 'restaurant') * travelers :
            estimatePricePerPerson(2, 'restaurant') * travelers;

        const fallbackLunch = {
            name: `Quán ${regionalData.activities[0]} ${currentProvince}`,
            address: 'Gần điểm tham quan',
            rating: 4.2,
            userRatingsTotal: 50,
            price: lunchPrice,
            specialty: regionalData.activities[0]
        };

        const fallbackDinner = {
            name: `Nhà Hàng ${regionalData.activities[1] || regionalData.activities[0]} ${currentProvince}`,
            address: 'Khu trung tâm',
            rating: 4.5,
            userRatingsTotal: 120,
            price: dinnerPrice,
            specialty: regionalData.activities[1] || regionalData.activities[0]
        };

        meals.push({
            lunch: lunch ? {
                name: lunch.name,
                address: lunch.vicinity || lunch.address,
                rating: lunch.rating,
                userRatingsTotal: lunch.user_ratings_total || lunch.userRatingsTotal,
                photo: lunch.photos?.[0] ? getPhotoUrl(lunch.photos[0].photo_reference) : lunch.photo,
                price: lunchPrice,
                specialty: regionalData.activities[0]
            } : fallbackLunch,
            dinner: dinner ? {
                name: dinner.name,
                address: dinner.vicinity || dinner.address,
                rating: dinner.rating,
                userRatingsTotal: dinner.user_ratings_total || dinner.userRatingsTotal,
                photo: dinner.photos?.[0] ? getPhotoUrl(dinner.photos[0].photo_reference) : dinner.photo,
                price: dinnerPrice,
                specialty: regionalData.activities[1] || regionalData.activities[0]
            } : fallbackDinner
        });
    }

    // === GỢI Ý KHÁCH SẠN VỚI CACHE VÀ GIÁ THỰC TẾ ===
    const mainProvince = getProvinceFromLocation(locations[0].name) || locations[0].province;
    const hotels = await findHotelsWithCache(mainProvince, locations[0].center, budgetCategory, travelers);

    // === THÔNG TIN THỜI TIẾT ===
    let weatherInfo = 'Không có dữ liệu';
    let weatherForecast = [];
    try {
        const weather = await getWeather(mainProvince);
        weatherInfo = weather ? `${weather.temp}°C, ${weather.description}` : 'Không có dữ liệu';

        // Lấy dự báo 7 ngày
        weatherForecast = await get7DayWeatherForecast(mainProvince, new Date(startDate));
    } catch (err) {
        console.warn('Lỗi lấy thời tiết:', err);
    }

    // === THÔNG TIN LỄ HỘI ===
    const festivalInfo = [];
    for (const loc of locations) {
        const province = getProvinceFromLocation(loc.name) || loc.province;
        const monthFestivals = getFestivalsByMonth(month);
        if (monthFestivals.includes(province)) {
            festivalInfo.push(`${loc.name} (${province}) có lễ hội vào tháng ${month}`);
        }
    }

    // === TÍNH TOÁN CHI PHÍ VỚI GIÁ THỰC TẾ ===
    const hotelCost = (hotels[0]?.pricePerNight || 600000) * days;
    const foodCost = meals.reduce((sum, meal) => sum + meal.lunch.price + meal.dinner.price, 0);
    const entranceCost = dailyPlan.reduce((sum, day) =>
        sum + day.destinations.reduce((daySum, dest) => daySum + dest.pricePerPerson, 0), 0) * travelers;
    const transportCost = 200000 * days;

    const totalCost = hotelCost + foodCost + entranceCost + transportCost;
    const remainingBudget = budget - totalCost;

    // === ĐỊNH DẠNG KẾT QUẢ ===
    const formattedDays = dailyPlan.map((day, i) => {
        const currentProvince = day.province;
        const regionalData = getSafeRegionalData(currentProvince);

        return {
            day: day.day,
            date: day.date,
            location: day.location,
            province: currentProvince,
            destinations: day.destinations,
            meal: meals[i] || meals[0] || {lunch: {}, dinner: {}},
            note: day.note,
            regionalActivities: regionalData.activities,
            weather: weatherForecast[i] || null
        };
    });

    // Tạo thông báo cảnh báo từ risk warnings
    const riskAlerts = riskWarnings.map(w => w.message).join(' | ');

    const itinerary = {
        userId,
        prefs: {
            ...prefs,
            locations: locations.map(loc => ({
                ...loc,
                province: getProvinceFromLocation(loc.name) || normalizeVietnamLocation(loc.province),
                region: getVietnamRegion(getProvinceFromLocation(loc.name) || normalizeVietnamLocation(loc.province))
            }))
        },
        dailyPlan: formattedDays,
        hotels,
        weather: weatherInfo,
        weatherForecast,
        festival: festivalInfo.length > 0 ? festivalInfo.join(' | ') : null,
        alerts: riskAlerts || 'Không có cảnh báo đặc biệt',
        riskWarnings: riskWarnings,
        cacheStats,
        cost: {
            hotel: hotelCost,
            food: foodCost,
            entrance: entranceCost,
            transport: transportCost,
            total: totalCost,
            remaining: remainingBudget,
            budgetPerPersonPerDay: Math.round(budgetPerPersonPerDay)
        },
        source: 'Google Places API + Cache System + Specific Attractions + Real Prices',
        createdAt: new Date(),
        status: 'completed'
    };

    try {
        // Chuẩn bị dữ liệu để lưu - loại bỏ các giá trị undefined
        const itineraryToSave = {
            userId,
            prefs: {
                ...prefs,
                locations: prefs.locations.map(loc => ({
                    name: loc.name || '',
                    province: loc.province || '',
                    center: {
                        lat: loc.center?.lat || 0,
                        lng: loc.center?.lng || 0
                    },
                    days: loc.days || 1,
                    priority: loc.priority || 1
                }))
            },
            dailyPlan: formattedDays.map(day => ({
                day: day.day || 1,
                date: day.date || '',
                location: day.location || '',
                province: day.province || '',
                destinations: (day.destinations || []).map(dest => ({
                    name: dest.name || '',
                    address: dest.address || '',
                    rating: dest.rating || 0,
                    userRatingsTotal: dest.userRatingsTotal || 0,
                    photo: dest.photo || null,
                    pricePerPerson: dest.pricePerPerson || 0,
                    type: dest.type || '',
                    province: dest.province || '',
                    lat: dest.lat || 0,
                    lng: dest.lng || 0,
                    placeId: dest.placeId || '',
                    isFree: dest.isFree || false,
                    regionalActivity: dest.regionalActivity || '',
                    fromAPI: dest.fromAPI || false,
                    isSpecificAttraction: dest.isSpecificAttraction || false
                })),
                meal: {
                    lunch: {
                        name: day.meal?.lunch?.name || '',
                        address: day.meal?.lunch?.address || '',
                        rating: day.meal?.lunch?.rating || 0,
                        userRatingsTotal: day.meal?.lunch?.userRatingsTotal || 0,
                        photo: day.meal?.lunch?.photo || null,
                        price: day.meal?.lunch?.price || 0,
                        specialty: day.meal?.lunch?.specialty || ''
                    },
                    dinner: {
                        name: day.meal?.dinner?.name || '',
                        address: day.meal?.dinner?.address || '',
                        rating: day.meal?.dinner?.rating || 0,
                        userRatingsTotal: day.meal?.dinner?.userRatingsTotal || 0,
                        photo: day.meal?.dinner?.photo || null,
                        price: day.meal?.dinner?.price || 0,
                        specialty: day.meal?.dinner?.specialty || ''
                    }
                },
                note: day.note || '',
                regionalActivities: day.regionalActivities || [],
                weather: day.weather || null
            })),
            hotels: (hotels || []).map(hotel => ({
                name: hotel.name || '',
                address: hotel.address || '',
                rating: hotel.rating || 0,
                userRatingsTotal: hotel.userRatingsTotal || 0,
                photo: hotel.photo || null,
                pricePerNight: hotel.pricePerNight || 0,
                priceLevel: hotel.priceLevel || null,
                lat: hotel.lat || 0,
                lng: hotel.lng || 0,
                category: hotel.category || '',
                placeId: hotel.placeId || '',
                fromAPI: hotel.fromAPI || false
            })),
            weather: weatherInfo || 'Không có dữ liệu',
            weatherForecast: (weatherForecast || []).map(forecast => ({
                date: forecast.date || '',
                temp: forecast.temp || 0,
                description: forecast.description || '',
                icon: forecast.icon || ''
            })),
            festival: festivalInfo.length > 0 ? festivalInfo.join(' | ') : null,
            alerts: riskAlerts || 'Không có cảnh báo đặc biệt',
            riskWarnings: (riskWarnings || []).map(warning => ({
                location: warning.location || '',
                province: warning.province || '',
                riskScore: warning.riskScore || 0,
                type: warning.type || '',
                message: warning.message || ''
            })),
            cacheStats: {
                fromCache: cacheStats.fromCache || 0,
                fromAPI: cacheStats.fromAPI || 0,
                specificAttractions: cacheStats.specificAttractions || 0
            },
            cost: {
                hotel: hotelCost || 0,
                food: foodCost || 0,
                entrance: entranceCost || 0,
                transport: transportCost || 0,
                total: totalCost || 0,
                remaining: remainingBudget || 0,
                budgetPerPersonPerDay: Math.round(budgetPerPersonPerDay) || 0
            },
            source: 'Google Places API + Cache System + Specific Attractions + Real Prices',
            createdAt: new Date(),
            status: 'completed'
        };

        // Debug: kiểm tra dữ liệu trước khi lưu
        console.log('📝 Dữ liệu chuẩn bị lưu:', JSON.stringify(itineraryToSave, null, 2));

        const docRef = await saveItinerary(userId, itineraryToSave);
        itinerary.id = docRef.id;

        const cacheMessage = cacheStats.fromCache > 0 ?
            ` (${cacheStats.fromCache} điểm từ cache, ${cacheStats.fromAPI} từ API, ${cacheStats.specificAttractions} địa điểm cụ thể)` :
            ' (tất cả từ API - đã lưu vào cache)';

        console.log('✅ Itinerary saved with ID:', docRef.id, cacheMessage);

        // Hiển thị cảnh báo nếu có nhưng vẫn thông báo thành công
        if (riskWarnings.length > 0) {
            toast.warning(`⚠️ Lịch trình đã tạo thành công nhưng có ${riskWarnings.length} cảnh báo rủi ro!`);
        } else {
            toast.success(`🎉 Lịch trình đã được tạo thành công với giá thực tế từ Google!${cacheMessage}`);
        }

        // Trả về itinerary với ID
        return {
            ...itinerary,
            id: docRef.id
        };

    } catch (err) {
        console.error('❌ Lỗi lưu itinerary:', err);
        console.error('❌ Chi tiết lỗi:', err.message);
        console.error('❌ Stack:', err.stack);

        // Thử lưu với dữ liệu đơn giản hóa
        try {
            console.log('🔄 Thử lưu với dữ liệu đơn giản...');
            const simpleItinerary = {
                userId,
                prefs: {
                    locations: prefs.locations.map(loc => ({
                        name: loc.name || '',
                        province: loc.province || '',
                        days: loc.days || 1
                    })),
                    budget: prefs.budget,
                    days: prefs.days,
                    startDate: prefs.startDate,
                    types: prefs.types
                },
                dailyPlan: formattedDays.map(day => ({
                    day: day.day,
                    date: day.date,
                    location: day.location,
                    destinations: (day.destinations || []).map(dest => ({
                        name: dest.name,
                        address: dest.address,
                        rating: dest.rating,
                        pricePerPerson: dest.pricePerPerson
                    }))
                })),
                cost: {
                    total: totalCost,
                    remaining: remainingBudget
                },
                createdAt: new Date(),
                status: 'completed'
            };

            const docRef = await saveItinerary(userId, simpleItinerary);
            console.log('✅ Lưu đơn giản thành công với ID:', docRef.id);

            toast.success(`🎉 Lịch trình đã được tạo thành công! (Lưu đơn giản)`);

            return {
                ...itinerary,
                id: docRef.id
            };
        } catch (simpleError) {
            console.error('❌ Lỗi lưu đơn giản:', simpleError);
            toast.error('❌ Lỗi lưu lịch trình vào database!');

            // Vẫn trả về itinerary nhưng không có ID
            return itinerary;
        }
    }
};

// Hàm tạo itinerary nhanh với cache
// ==================== HÀM TẠO LỊCH TRÌNH THÔNG MINH V2 - CHO USER CHỌN ĐỊA ĐIỂM ====================

export const createSmartItineraryWithSelection = async (prefs, userId, mapInstance, userSelectedDestinations = []) => {
    const {
        locations,
        types,
        adventureLevel,
        budget,
        days,
        travelers,
        startDate,
        ecoFriendly
    } = prefs;

    console.log('🚀 Bắt đầu tạo itinerary thông minh với địa điểm user chọn');

    // === HÀM KIỂM TRA ĐỊA ĐIỂM AN TOÀN ===
    const isSafePlace = (place) => {
        if (!place || !place.types) return false;
        const SENSITIVE_TYPES = [
            'local_government_office', 'political', 'military', 'police',
            'embassy', 'courthouse', 'prison', 'fire_station'
        ];
        const hasSensitiveType = place.types.some(type => SENSITIVE_TYPES.includes(type));
        const sensitiveKeywords = ['công an', 'quân đội', 'đồn biên phòng', 'trại giam', 'tòa án'];
        const hasSensitiveName = sensitiveKeywords.some(keyword =>
            place.name?.toLowerCase().includes(keyword)
        );
        return !hasSensitiveType && !hasSensitiveName;
    };

    // === PHÂN LOẠI HOẠT ĐỘNG THEO THỜI GIAN ===
    const getTimeBasedActivities = (timeOfDay, province, weather) => {
        const morningActivities = {
            'Nghỉ dưỡng biển': ['Bãi biển', 'Tắm biển buổi sáng', 'Yoga trên bãi biển'],
            'Khám phá văn hóa': ['Tham quan chùa chiền', 'Bảo tàng', 'Di tích lịch sử'],
            'Du lịch ẩm thực': ['Ăn sáng đặc sản', 'Chợ địa phương', 'Quán cà phê view đẹp'],
            'Phiêu lưu mạo hiểm': ['Leo núi buổi sáng', 'Đạp xe khám phá', 'Zipline'],
            'Thiền và yoga': ['Thiền buổi sáng', 'Yoga ngoài trời', 'Tản bộ trong rừng'],
            'Du lịch gia đình': ['Công viên buổi sáng', 'Vườn thú', 'Khu vui chơi'],
            'Chụp ảnh sống ảo': ['Viewpoint bình minh', 'Cánh đồng hoa', 'Phố cổ'],
            'Trải nghiệm bản địa': ['Làng nghề truyền thống', 'Nông trại', 'Chợ nổi']
        };

        const afternoonActivities = {
            'Nghỉ dưỡng biển': ['Nghỉ ngơi tại resort', 'Massage spa', 'Bể bơi'],
            'Khám phá văn hóa': ['Làng văn hóa', 'Nhà hát', 'Triển lãm'],
            'Du lịch ẩm thực': ['Ăn trưa đặc sản', 'Lớp học nấu ăn', 'Thưởng thức cà phê'],
            'Phiêu lưu mạo hiểm': ['Chèo thuyền kayak', 'Lặn biển', 'Đua xe địa hình'],
            'Thiền và yoga': ['Thiền định', 'Yoga trị liệu', 'Tắm rừng'],
            'Du lịch gia đình': ['Công viên nước', 'Khu vui chơi trong nhà', 'Xem biểu diễn'],
            'Chụp ảnh sống ảo': ['Phố đi bộ', 'Bảo tàng nghệ thuật', 'Quán cà phê đẹp'],
            'Trải nghiệm bản địa': ['Học làm gốm', 'Tham quan làng chài', 'Thu hoạch nông sản']
        };

        const eveningActivities = {
            'Nghỉ dưỡng biển': ['Ngắm hoàng hôn', 'Ăn tối hải sản', 'Dạo biển đêm'],
            'Khám phá văn hóa': ['Phố cổ về đêm', 'Xem biểu diễn văn nghệ', 'Lễ hội'],
            'Du lịch ẩm thực': ['Ăn tối đặc sản', 'Food tour', 'Chợ đêm ẩm thực'],
            'Phiêu lưu mạo hiểm': ['Leo núi đêm', 'Cắm trại', 'Ngắm sao'],
            'Thiền và yoga': ['Thiền buổi tối', 'Yoga dưới trăng', 'Tản bộ đêm'],
            'Du lịch gia đình': ['Công viên ánh sáng', 'Xem phim', 'Khu vui chơi đêm'],
            'Chụp ảnh sống ảo': ['Thành phố về đêm', 'Cầu ánh sáng', 'Phố đi bộ'],
            'Trải nghiệm bản địa': ['Chợ đêm', 'Lễ hội dân gian', 'Biểu diễn nghệ thuật']
        };

        const activityMap = {
            'morning': morningActivities,
            'afternoon': afternoonActivities,
            'evening': eveningActivities
        };

        const activities = [];
        types.forEach(type => {
            const typeActivities = activityMap[timeOfDay]?.[type] || [];
            activities.push(...typeActivities.slice(0, 2));
        });

        return [...new Set(activities)]; // Loại bỏ trùng lặp
    };

    // === TÌM ĐỊA ĐIỂM ĐA DẠNG KHÔNG TRÙNG LẶP ===
    const findDiverseDestinations = async (province, center, budgetCategory, maxDestinations = 20) => {
        const allDestinations = [];
        const usedPlaceIds = new Set();
        const usedNames = new Set();

        // Các loại địa điểm cần tìm
        const destinationTypes = [
            { type: 'tourist_attraction', priority: 1, max: 4 },
            { type: 'restaurant', priority: 1, max: 3 },
            { type: 'cafe', priority: 2, max: 2 },
            { type: 'park', priority: 2, max: 2 },
            { type: 'museum', priority: 2, max: 2 },
            { type: 'temple', priority: 3, max: 2 },
            { type: 'beach', priority: 3, max: 2 },
            { type: 'shopping_mall', priority: 3, max: 1 },
            { type: 'spa', priority: 4, max: 1 },
            { type: 'amusement_park', priority: 4, max: 1 }
        ];

        // Sắp xếp theo priority
        destinationTypes.sort((a, b) => a.priority - b.priority);

        for (const { type, max } of destinationTypes) {
            if (allDestinations.length >= maxDestinations) break;

            try {
                const results = await searchNearbyPlaces({
                    location: center,
                    radius: 20000,
                    type
                });

                const filtered = results
                    .filter(place =>
                        isSafePlace(place) &&
                        place.rating >= 3.8 &&
                        place.user_ratings_total >= 10 &&
                        !usedPlaceIds.has(place.place_id) &&
                        !usedNames.has(place.name.toLowerCase())
                    )
                    .sort((a, b) => (b.rating * b.user_ratings_total) - (a.rating * a.user_ratings_total))
                    .slice(0, max);

                for (const place of filtered) {
                    const realPrice = await getRealPriceFromGoogle(place.place_id, type, province);

                    allDestinations.push({
                        name: place.name,
                        address: place.vicinity || 'Địa chỉ không xác định',
                        rating: place.rating || 4.0,
                        userRatingsTotal: place.user_ratings_total || 10,
                        photo: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
                        pricePerPerson: realPrice,
                        type: type,
                        province: province,
                        lat: place.geometry?.location?.lat() || center.lat,
                        lng: place.geometry?.location?.lng() || center.lng,
                        placeId: place.place_id,
                        category: getPlaceCategory(type)
                    });

                    usedPlaceIds.add(place.place_id);
                    usedNames.add(place.name.toLowerCase());
                }

                await new Promise(r => setTimeout(r, 500)); // Giảm rate limiting

            } catch (err) {
                console.warn(`Lỗi tìm ${type}:`, err);
            }
        }

        return allDestinations;
    };

    // === TÌM NHÀ HÀNG ĐẶC SẢN KHÔNG TRÙNG ===
    const findSpecialtyRestaurants = async (province, center, mealType, budgetCategory) => {
        const regionalData = getSafeRegionalData(province);
        const specialties = regionalData.activities || ['hải sản', 'đặc sản địa phương'];

        const restaurants = [];
        const usedNames = new Set();

        for (const specialty of specialties.slice(0, 3)) {
            try {
                const keyword = mealType === 'lunch' ?
                    `quán ăn ${specialty} ${province}` :
                    `nhà hàng ${specialty} ${province}`;

                const results = await searchPlacesByText(keyword, center, 10000);

                const filtered = results
                    .filter(r => {
                        const priceOk = budgetCategory === 'low' ? (r.price_level || 0) <= 2 :
                            budgetCategory === 'medium' ? (r.price_level || 0) <= 3 : true;
                        return r.rating >= 4.0 && priceOk && !usedNames.has(r.name.toLowerCase());
                    })
                    .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
                    .slice(0, 2);

                for (const rest of filtered) {
                    const realPrice = await getRealPriceFromGoogle(rest.place_id, 'restaurant', province);

                    restaurants.push({
                        name: rest.name,
                        address: rest.vicinity,
                        rating: rest.rating,
                        userRatingsTotal: rest.user_ratings_total,
                        photo: rest.photos?.[0] ? getPhotoUrl(rest.photos[0].photo_reference) : null,
                        price: estimatePricePerPerson(rest.price_level || 2, 'restaurant') * travelers,
                        specialty: specialty,
                        placeId: rest.place_id
                    });

                    usedNames.add(rest.name.toLowerCase());
                }

            } catch (error) {
                console.warn(`Lỗi tìm nhà hàng ${specialty}:`, error);
            }
        }

        return restaurants.length > 0 ? restaurants[0] : null;
    };

    // === TẠO LỊCH TRÌNH CHI TIẾT ===
    const createDetailedItinerary = (selectedDestinations, days, province) => {
        const dailyPlans = [];

        // Phân loại địa điểm
        const attractions = selectedDestinations.filter(d => d.category === 'attraction');
        const restaurants = selectedDestinations.filter(d => d.category === 'restaurant');
        const cafes = selectedDestinations.filter(d => d.category === 'cafe');
        const activities = selectedDestinations.filter(d =>
            ['park', 'beach', 'spa', 'amusement_park'].includes(d.type)
        );

        for (let day = 1; day <= days; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + (day - 1));

            const dayPlan = {
                day: day,
                date: currentDate.toLocaleDateString('vi-VN'),
                location: locations[0]?.name || province,
                timeSlots: {
                    morning: {
                        activities: getTimeBasedActivities('morning', province),
                        destinations: [],
                        note: 'Khởi đầu ngày mới đầy năng lượng'
                    },
                    afternoon: {
                        activities: getTimeBasedActivities('afternoon', province),
                        destinations: [],
                        note: 'Khám phá và trải nghiệm'
                    },
                    evening: {
                        activities: getTimeBasedActivities('evening', province),
                        destinations: [],
                        note: 'Thư giãn và thưởng thức ẩm thực'
                    }
                },
                meals: {
                    breakfast: null,
                    lunch: null,
                    dinner: null
                }
            };

            // Phân bổ địa điểm cho các khung giờ
            // Sáng: Địa điểm văn hóa, thiên nhiên
            dayPlan.timeSlots.morning.destinations = attractions
                .filter(a => a.type !== 'restaurant' && a.type !== 'cafe')
                .slice((day-1)*2, day*2);

            // Chiều: Hoạt động, giải trí
            dayPlan.timeSlots.afternoon.destinations = activities
                .slice((day-1)*2, day*2);

            // Tối: Ẩm thực, thư giãn
            dayPlan.timeSlots.evening.destinations = [...restaurants, ...cafes]
                .slice((day-1)*2, day*2);

            // Phân bổ bữa ăn
            if (restaurants.length >= day) {
                dayPlan.meals.lunch = {
                    ...restaurants[day-1],
                    type: 'lunch',
                    price: estimatePricePerPerson(restaurants[day-1].priceLevel || 2, 'restaurant') * travelers
                };
            }

            if (restaurants.length >= day + 1) {
                dayPlan.meals.dinner = {
                    ...restaurants[day],
                    type: 'dinner',
                    price: estimatePricePerPerson(restaurants[day].priceLevel || 2, 'restaurant') * travelers
                };
            }

            dailyPlans.push(dayPlan);
        }

        return dailyPlans;
    };

    // === HÀM TÍNH CHI PHÍ THỰC TẾ ===
    const calculateRealisticCosts = (dailyPlan, hotels, travelers, days) => {
        let totalAttractionCost = 0;
        let totalFoodCost = 0;

        dailyPlan.forEach(day => {
            // Chi phí tham quan
            Object.values(day.timeSlots).forEach(slot => {
                slot.destinations.forEach(dest => {
                    totalAttractionCost += dest.pricePerPerson * travelers;
                });
            });

            // Chi phí ăn uống
            if (day.meals.lunch) totalFoodCost += day.meals.lunch.price;
            if (day.meals.dinner) totalFoodCost += day.meals.dinner.price;
        });

        const hotelCost = (hotels[0]?.pricePerNight || 500000) * days;
        const transportCost = 150000 * days * travelers;
        const totalCost = hotelCost + totalFoodCost + totalAttractionCost + transportCost;

        return {
            hotel: hotelCost,
            food: totalFoodCost,
            entrance: totalAttractionCost,
            transport: transportCost,
            total: totalCost,
            perPerson: Math.round(totalCost / travelers)
        };
    };

    // === THUẬT TOÁN CHÍNH ===
    try {
        // 1. Lấy tất cả địa điểm đa dạng
        const mainLocation = locations[0];
        const allDestinations = await findDiverseDestinations(
            mainLocation.province,
            mainLocation.center,
            'medium', // budgetCategory
            30
        );

        // 2. Nếu user đã chọn, ưu tiên địa điểm user chọn
        const finalDestinations = userSelectedDestinations.length > 0 ?
            allDestinations.filter(dest =>
                userSelectedDestinations.some(selected =>
                    selected.placeId === dest.placeId
                )
            ) : allDestinations;

        // 3. Tạo lịch trình chi tiết
        const detailedItinerary = createDetailedItinerary(
            finalDestinations,
            days,
            mainLocation.province
        );

        // 4. Tìm khách sạn với giá thực tế
        const hotels = await findHotelsWithCache(
            mainLocation.province,
            mainLocation.center,
            'medium', // budgetCategory
            travelers
        );

        // 5. Tính toán chi phí
        const costs = calculateRealisticCosts(detailedItinerary, hotels, travelers, days);

        const itinerary = {
            userId,
            prefs,
            dailyPlan: detailedItinerary,
            hotels,
            cost: costs,
            selectedDestinations: finalDestinations,
            totalDestinations: finalDestinations.length,
            source: 'Smart Itinerary System v2.0 - User Selected Destinations',
            createdAt: new Date(),
            status: 'completed'
        };

        // Lưu itinerary
        const savedItinerary = await saveItinerary(userId, itinerary);
        console.log('✅ Smart itinerary created and saved successfully with ID:', savedItinerary.id);

        toast.success(`🎉 Lịch trình thông minh đã được tạo với ${finalDestinations.length} địa điểm bạn chọn!`);

        return {
            ...itinerary,
            id: savedItinerary.id
        };

    } catch (error) {
        console.error('❌ Lỗi tạo smart itinerary:', error);
        throw error;
    }
};

// ==================== HÀM LẤY ĐỀ XUẤT ĐỊA ĐIỂM CHO USER CHỌN ====================
// === HÀM TÌM ĐIỂM ĐẾN ĐA DẠNG ===
export const findDiverseDestinations = async (province, center, quality = 'medium', max = 30) => {
    try {
        console.log(`Tìm ${max} địa điểm đa dạng tại ${province}`);

        // Lấy từ cache thông minh
        const cached = await getCachedDestinationsByProvince(province, {}, center);

        if (cached.length === 0) {
            console.log(`Không có dữ liệu cache, đang cập nhật...`);
            await getCachedDestinationsByProvince(province, center);
            return await getCachedDestinationsByProvince(province, {}, center);
        }

        // Đảm bảo đa dạng loại hình
        const typePriority = [
            'tourist_attraction',
            'restaurant',
            'museum',
            'park',
            'beach',
            'historical_landmark',
            'amusement_park',
            'shopping_mall'
        ];

        const selected = [];
        const usedTypes = new Set();

        // Ưu tiên chọn các loại khác nhau
        for (const type of typePriority) {
            const candidates = cached
                .filter(d => d.types?.includes(type))
                .filter(d => !usedTypes.has(type))
                .sort((a, b) => b.rating - a.rating);

            if (candidates.length > 0) {
                selected.push(candidates[0]);
                usedTypes.add(type);
            }

            if (selected.length >= max) break;
        }

        // Nếu chưa đủ, bổ sung các điểm chất lượng cao còn lại
        const remaining = cached
            .filter(d => !selected.find(s => s.placeId === d.placeId))
            .sort((a, b) => (b.rating * b.userRatingsTotal) - (a.rating * a.userRatingsTotal))
            .slice(0, max - selected.length);

        const result = [...selected, ...remaining].slice(0, max);

        console.log(`Đã chọn ${result.length} địa điểm đa dạng`);
        return result;

    } catch (error) {
        console.error('Lỗi findDiverseDestinations:', error);
        return [];
    }
};
export const getDestinationSuggestionsForUser = async (province, center, tripTypes, maxSuggestions = 30) => {
    try {
        console.log(`🎯 Lấy đề xuất địa điểm cho ${province}`);

        const allDestinations = await findDiverseDestinations(province, center, 'medium', maxSuggestions);

        // Phân loại theo loại hình
        const categorized = {
            attractions: [],
            restaurants: [],
            activities: [],
            culture: [],
            nature: [],
            shopping: []
        };

        allDestinations.forEach(dest => {
            if (dest.type === 'restaurant' || dest.type === 'cafe' || dest.type === 'food') {
                categorized.restaurants.push(dest);
            } else if (dest.type === 'park' || dest.type === 'beach' || dest.type === 'garden') {
                categorized.nature.push(dest);
            } else if (dest.type === 'museum' || dest.type === 'temple' || dest.type === 'historical_landmark') {
                categorized.culture.push(dest);
            } else if (dest.type === 'amusement_park' || dest.type === 'zoo' || dest.type === 'spa') {
                categorized.activities.push(dest);
            } else if (dest.type === 'shopping_mall') {
                categorized.shopping.push(dest);
            } else {
                categorized.attractions.push(dest);
            }
        });

        console.log(`✅ Đã phân loại ${allDestinations.length} địa điểm thành ${Object.keys(categorized).length} danh mục`);

        return categorized;
    } catch (error) {
        console.error('❌ Lỗi lấy đề xuất địa điểm:', error);
        return {};
    }
};

// Hàm tạo itinerary nhanh với cache
export const createQuickItinerary = async (basicPrefs, userId, mapInstance) => {
    const quickItinerary = await createRealTimeItinerary({
        ...basicPrefs
    }, userId, mapInstance);

    return quickItinerary;
};

export default createRealTimeItinerary;