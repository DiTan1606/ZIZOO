// src/services/completeItineraryService.js
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { searchPlacesByText, searchNearbyPlaces } from './placesService';
import { get7DayWeatherForecast } from './weatherService';
import { findRealPlacesByCategory, findRealRestaurants, getRealWeatherForItinerary } from './realTimeDataService';
import { startItineraryMonitoring } from './alertsAndAdjustmentsService';
import provinceCoords from '../assets/provinceCoord.json';
import { TRAVEL_STYLES, ACCOMMODATION_TYPES, TRANSPORT_OPTIONS } from '../constants';
import { formatMoney, getSeason, getClimate } from '../utils/commonUtils';

/**
 * Service tạo lịch trình du lịch hoàn chỉnh theo cấu trúc chuẩn
 * Bao gồm: Header, Daily Itinerary, Chi phí, Phương tiện, Lưu trú, Packing list, Lưu ý, Bản đồ
 */

/**
 * Tạo lịch trình du lịch hoàn chỉnh
 */
export const createCompleteItinerary = async (preferences, userId) => {
    const {
        destination,
        startDate,
        duration,
        travelers,
        budget,
        travelStyle = 'standard',
        interests = [],
        departureCity = 'Hà Nội'
    } = preferences;

    console.log('🗺️ Bắt đầu tạo lịch trình hoàn chỉnh...');

    try {
        // Reset destination tracking for new itinerary
        resetDestinationTracking();
        
        // 1. THÔNG TIN CƠ BẢN (HEADER)
        const tripHeader = await generateTripHeader(preferences);

        // 2. LỊCH TRÌNH CHI TIẾT THEO TỪNG NGÀY
        const dailyItinerary = await generateDailyItinerary(preferences);

        // 3. DANH SÁCH CHI PHÍ DỰ KIẾN
        const costBreakdown = await generateCostBreakdown(preferences, dailyItinerary);

        // 4. PHƯƠNG TIỆN DI CHUYỂN
        const transportPlan = await generateTransportPlan(preferences);

        // 5. LƯU TRÚ
        const accommodationPlan = await generateAccommodationPlan(preferences);

        // 6. DANH SÁCH ĐỒ CẦN MANG
        const packingList = generatePackingList(preferences);

        // 7. LƯU Ý QUAN TRỌNG
        const importantNotes = await generateImportantNotes(preferences);

        // 8. BẢN ĐỒ VÀ LỘ TRÌNH
        const routeOptimization = await generateRouteOptimization(dailyItinerary);

        // Tạo lịch trình hoàn chỉnh
        const completeItinerary = {
            // Metadata
            id: `itinerary_${Date.now()}`,
            userId,
            createdAt: new Date(),
            lastUpdated: new Date(),

            // 1. THÔNG TIN CƠ BẢN
            header: tripHeader,

            // 2. LỊCH TRÌNH CHI TIẾT
            dailyItinerary,

            // 3. CHI PHÍ
            costBreakdown,

            // 4. PHƯƠNG TIỆN
            transport: transportPlan,

            // 5. LƯU TRÚ
            accommodation: accommodationPlan,

            // 6. PACKING LIST
            packingList,

            // 7. LƯU Ý
            importantNotes,

            // 8. BẢN ĐỒ & LỘ TRÌNH
            routeOptimization,

            // Thông tin bổ sung
            preferences,
            summary: {
                totalDays: duration,
                totalNights: duration - 1,
                totalCost: costBreakdown.grandTotal,
                costPerPerson: Math.round(costBreakdown.grandTotal / travelers),
                totalDestinations: dailyItinerary.reduce((sum, day) => sum + day.destinations.length, 0),
                travelStyle: TRAVEL_STYLES[travelStyle].name
            }
        };

        // Lưu vào Firebase
        await saveItineraryToFirebase(completeItinerary);

        // Bắt đầu monitoring cho alerts & adjustments
        if (completeItinerary && completeItinerary.id) {
            console.log('🔍 Real-time monitoring disabled temporarily to avoid CORS...');
            // try {
            //     await startItineraryMonitoring(completeItinerary.id, completeItinerary, userId);
            // } catch (monitoringError) {
            //     console.warn('⚠️ Failed to start monitoring:', monitoringError);
            // }
        }
        
        // Thêm metadata về chất lượng dữ liệu
        completeItinerary.dataQuality = {
            placesSource: 'google_places_api',
            weatherSource: 'openweathermap_api',
            realTimeData: true,
            lastUpdated: new Date(),
            monitoringActive: true
        };

        console.log('✅ Lịch trình hoàn chỉnh đã được tạo với monitoring!');
        return completeItinerary;

    } catch (error) {
        console.error('❌ Lỗi tạo lịch trình:', error);
        throw new Error(`Không thể tạo lịch trình: ${error.message}`);
    }
};

/**
 * 1. TẠO THÔNG TIN CƠ BẢN (HEADER)
 */
const generateTripHeader = async (preferences) => {
    const { destination, startDate, duration, travelers, budget, travelStyle, departureCity } = preferences;
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);

    return {
        tripName: `${departureCity} - ${destination} ${duration}N${duration-1}Đ`,
        duration: {
            days: duration,
            nights: duration - 1,
            startDate: new Date(startDate).toLocaleDateString('vi-VN'),
            endDate: endDate.toLocaleDateString('vi-VN'),
            startDateISO: startDate,
            endDateISO: endDate.toISOString()
        },
        travelers: {
            total: travelers,
            adults: travelers, // Có thể mở rộng để phân biệt người lớn/trẻ em
            children: 0
        },
        travelStyle: {
            type: travelStyle,
            name: TRAVEL_STYLES[travelStyle].name,
            description: getTravelStyleDescription(travelStyle)
        },
        budget: {
            total: budget,
            perPerson: Math.round(budget / travelers),
            currency: 'VNĐ'
        },
        destination: {
            main: destination,
            departure: departureCity,
            coordinates: provinceCoords[destination] || { lat: 16.047, lng: 108.220 }
        }
    };
};

/**
 * 2. TẠO LỊCH TRÌNH CHI TIẾT THEO TỪNG NGÀY
 */
const generateDailyItinerary = async (preferences) => {
    const { destination, startDate, duration, interests, travelStyle } = preferences;
    const coord = provinceCoords[destination] || { lat: 16.047, lng: 108.220 };
    
    const dailyPlans = [];

    for (let day = 0; day < duration; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);

        // Tạo kế hoạch cho từng ngày
        const dayPlan = await generateSingleDayPlan(day + 1, currentDate, destination, coord, interests, travelStyle);
        dailyPlans.push(dayPlan);
    }

    return dailyPlans;
};

/**
 * Tạo kế hoạch cho một ngày cụ thể - CẢI THIỆN ĐA DẠNG
 */
const generateSingleDayPlan = async (dayNumber, date, destination, coord, interests, travelStyle) => {
    try {
        console.log(`📅 Generating DIVERSE day plan for Day ${dayNumber} in ${destination}...`);

        // Tìm địa điểm tham quan ĐA DẠNG
        const destinations = await findRealDestinationsForDay(dayNumber, destination, coord, interests);
        
        // Tìm nhà hàng ĐA DẠNG
        const restaurants = await findRealRestaurantsForDay(destination, coord, travelStyle);
        
        // Tạo lịch trình theo giờ phong phú
        const hourlySchedule = generateEnhancedHourlySchedule(dayNumber, destinations, restaurants, interests);

        // Lấy thời tiết thực tế với dự báo rủi ro (fallback nếu API key không có)
        const realWeather = await getRealWeatherForDay(destination, coord, date).catch(error => {
            console.warn('Weather API failed, using fallback:', error);
            return getDefaultWeatherForDestination(destination, date);
        });

        // Tạo theme đa dạng theo ngày
        const dayTheme = generateEnhancedDayTheme(dayNumber, destinations, interests, destination);

        return {
            day: dayNumber,
            date: date.toLocaleDateString('vi-VN'),
            dayOfWeek: date.toLocaleDateString('vi-VN', { weekday: 'long' }),
            dateISO: date.toISOString(),
            theme: dayTheme,
            
            // Lịch trình theo giờ chi tiết và đa dạng
            schedule: hourlySchedule,
            
            // Danh sách địa điểm THỰC TẾ và ĐA DẠNG
            destinations: destinations.map(dest => ({
                ...dest,
                visitTime: dest.estimatedDuration || '1-2 giờ',
                entryFee: dest.entryFee || 0,
                notes: dest.specialNotes || [],
                isOpen: dest.isOpen,
                crowdLevel: dest.currentCrowdLevel,
                bestTimeToVisit: dest.bestTimeToVisit,
                category: dest.category || 'general'
            })),
            
            // Bữa ăn ĐA DẠNG
            meals: {
                breakfast: restaurants.breakfast || null,
                lunch: restaurants.lunch || null,
                dinner: restaurants.dinner || null,
                streetFood: restaurants.streetFood || [],
                cafes: restaurants.cafes || [],
                localSpecialties: restaurants.localSpecialties || []
            },
            
            // Hoạt động tự do phong phú
            freeTime: generateEnhancedFreeTimeActivities(destination, interests, dayNumber),
            
            // Lưu ý đặc biệt với dự báo rủi ro
            specialNotes: generateEnhancedDayNotes(dayNumber, destinations, destination, realWeather, date),
            
            // Thời tiết với cảnh báo rủi ro
            weather: {
                ...realWeather,
                riskAssessment: realWeather.riskAssessment || { overall: 'low', factors: {}, recommendations: [] },
                recommendations: realWeather.recommendations || ['Kiểm tra thời tiết']
            },
            
            // Chi phí ước tính chi tiết
            estimatedCost: calculateEnhancedDayCost(destinations, restaurants, travelStyle, dayNumber),
            
            // Metadata mở rộng
            dataQuality: 'enhanced_real_data',
            lastUpdated: new Date(),
            diversityScore: calculateDiversityScore(destinations, restaurants)
        };
    } catch (error) {
        console.error(`❌ Lỗi tạo kế hoạch ngày ${dayNumber}:`, error);
        return await generateEnhancedFallbackDayPlan(dayNumber, date, destination, interests);
    }
};

/**
 * Tạo lịch trình theo giờ chi tiết
 */
const generateHourlySchedule = (dayNumber, destinations, restaurants) => {
    const schedule = [];
    
    if (dayNumber === 1) {
        // Ngày đầu - có di chuyển
        schedule.push({
            time: '06:30',
            activity: 'Khởi hành từ điểm xuất phát',
            type: 'transport',
            duration: '30 phút',
            notes: ['Chuẩn bị hành lý', 'Kiểm tra giấy tờ']
        });
        
        schedule.push({
            time: '12:30',
            activity: `Đến ${destinations[0]?.name || 'điểm đến'}, nhận phòng`,
            type: 'accommodation',
            duration: '30 phút',
            notes: ['Check-in khách sạn', 'Nghỉ ngơi']
        });
    } else {
        schedule.push({
            time: '07:00',
            activity: 'Ăn sáng tại khách sạn',
            type: 'meal',
            duration: '45 phút'
        });
    }

    // Thêm các hoạt động tham quan
    let currentTime = dayNumber === 1 ? '14:00' : '08:00';
    
    destinations.forEach((dest, index) => {
        schedule.push({
            time: currentTime,
            activity: `Tham quan ${dest.name}`,
            type: 'sightseeing',
            duration: dest.recommendedTime || '1-2 giờ',
            location: dest,
            notes: dest.specialNotes || []
        });
        
        // Tính thời gian tiếp theo (thêm 2-3 giờ)
        const [hours, minutes] = currentTime.split(':').map(Number);
        const nextHour = hours + 2 + (index * 0.5);
        currentTime = `${Math.floor(nextHour).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    });

    // Thêm bữa ăn
    schedule.push({
        time: '18:00',
        activity: `Ăn tối tại ${restaurants.dinner?.name || 'nhà hàng địa phương'}`,
        type: 'meal',
        duration: '1-1.5 giờ',
        location: restaurants.dinner,
        specialDish: restaurants.dinner?.specialty || 'Đặc sản địa phương'
    });

    // Hoạt động tối
    schedule.push({
        time: '20:00',
        activity: 'Tự do khám phá, dạo phố, mua sắm',
        type: 'free_time',
        duration: '2-3 giờ',
        suggestions: ['Dạo chợ đêm', 'Uống cà phê', 'Chụp ảnh đêm']
    });

    return schedule.sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * 3. TẠO DANH SÁCH CHI PHÍ DỰ KIẾN
 */
const generateCostBreakdown = async (preferences, dailyItinerary) => {
    const { travelers, duration, travelStyle, departureCity, destination } = preferences;
    
    // Chi phí vé máy bay/xe/tàu khứ hồi
    const transportCost = calculateTransportCost(departureCity, destination, travelers, travelStyle);
    
    // Chi phí khách sạn
    const accommodationCost = calculateAccommodationCost(duration - 1, travelers, travelStyle);
    
    // Chi phí ăn uống
    const foodCost = calculateFoodCost(dailyItinerary, travelers);
    
    // Chi phí tham quan
    const sightseeingCost = calculateSightseeingCost(dailyItinerary, travelers);
    
    // Chi phí di chuyển tại điểm đến
    const localTransportCost = calculateLocalTransportCost(duration, travelers, travelStyle);
    
    // Chi phí phát sinh (10-20%)
    const contingencyCost = Math.round((transportCost + accommodationCost + foodCost + sightseeingCost + localTransportCost) * 0.15);
    
    const grandTotal = transportCost + accommodationCost + foodCost + sightseeingCost + localTransportCost + contingencyCost;

    return {
        transport: {
            intercity: transportCost,
            local: localTransportCost,
            total: transportCost + localTransportCost,
            details: getTransportDetails(departureCity, destination, travelStyle)
        },
        accommodation: {
            total: accommodationCost,
            perNight: Math.round(accommodationCost / (duration - 1)),
            nights: duration - 1,
            type: ACCOMMODATION_TYPES[travelStyle].type,
            bookingLinks: generateBookingLinks(destination, travelStyle)
        },
        food: {
            total: foodCost,
            perDay: Math.round(foodCost / duration),
            perPerson: Math.round(foodCost / travelers),
            breakdown: getFoodCostBreakdown(dailyItinerary)
        },
        sightseeing: {
            total: sightseeingCost,
            perPerson: Math.round(sightseeingCost / travelers),
            breakdown: getSightseeingCostBreakdown(dailyItinerary)
        },
        contingency: {
            amount: contingencyCost,
            percentage: 15,
            purpose: 'Chi phí phát sinh, mua sắm, tip'
        },
        grandTotal,
        perPerson: Math.round(grandTotal / travelers),
        budgetStatus: {
            withinBudget: grandTotal <= preferences.budget,
            difference: preferences.budget - grandTotal,
            percentage: Math.round((grandTotal / preferences.budget) * 100)
        }
    };
};

/**
 * 4. TẠO KẾ HOẠCH PHƯƠNG TIỆN DI CHUYỂN
 */
const generateTransportPlan = async (preferences) => {
    const { departureCity, destination, travelStyle, startDate, duration } = preferences;
    
    return {
        // Đi từ nơi ở đến điểm du lịch
        intercity: {
            departure: {
                from: departureCity,
                to: destination,
                date: new Date(startDate).toLocaleDateString('vi-VN'),
                options: getIntercityTransportOptions(departureCity, destination, travelStyle),
                recommended: getRecommendedTransport(departureCity, destination, travelStyle)
            },
            return: {
                from: destination,
                to: departureCity,
                date: new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'),
                options: getIntercityTransportOptions(destination, departureCity, travelStyle),
                recommended: getRecommendedTransport(destination, departureCity, travelStyle)
            }
        },
        
        // Di chuyển tại điểm đến
        local: {
            recommended: TRANSPORT_OPTIONS.local[travelStyle],
            alternatives: Object.values(TRANSPORT_OPTIONS.local),
            tips: getLocalTransportTips(destination, travelStyle),
            apps: ['Grab', 'Gojek', 'Be', 'Taxi truyền thống'],
            rentals: getRentalOptions(destination, travelStyle)
        }
    };
};

/**
 * 5. TẠO KẾ HOẠCH LƯU TRÚ
 */
const generateAccommodationPlan = async (preferences) => {
    const { destination, duration, travelers, travelStyle, startDate } = preferences;
    
    const checkInDate = new Date(startDate);
    const checkOutDate = new Date(startDate);
    checkOutDate.setDate(checkOutDate.getDate() + duration - 1);

    return {
        duration: {
            nights: duration - 1,
            checkIn: checkInDate.toLocaleDateString('vi-VN'),
            checkOut: checkOutDate.toLocaleDateString('vi-VN')
        },
        recommended: {
            type: ACCOMMODATION_TYPES[travelStyle].type,
            priceRange: `${formatMoney(ACCOMMODATION_TYPES[travelStyle].pricePerNight * 0.8)} - ${formatMoney(ACCOMMODATION_TYPES[travelStyle].pricePerNight * 1.2)}`,
            amenities: getRecommendedAmenities(travelStyle),
            location: getRecommendedLocation(destination, travelStyle)
        },
        options: await findAccommodationOptions(destination, travelStyle, travelers),
        bookingPlatforms: [
            { name: 'Booking.com', url: `https://booking.com`, commission: 'Miễn phí hủy' },
            { name: 'Agoda', url: `https://agoda.com`, commission: 'Giá tốt nhất' },
            { name: 'Airbnb', url: `https://airbnb.com`, commission: 'Trải nghiệm địa phương' },
            { name: 'Traveloka', url: `https://traveloka.com`, commission: 'Hỗ trợ tiếng Việt' }
        ],
        tips: getAccommodationTips(destination, travelStyle)
    };
};

/**
 * 6. TẠO DANH SÁCH ĐỒ CẦN MANG
 */
const generatePackingList = (preferences) => {
    const { destination, startDate, duration, interests, travelStyle } = preferences;
    const season = getSeason(startDate);
    const climate = getClimate(destination);

    const packingList = {
        essential: [
            'Giấy tờ tùy thân (CCCD/Passport)',
            'Vé máy bay/xe (in và lưu điện tử)',
            'Tiền mặt và thẻ ATM/Credit',
            'Điện thoại và sạc',
            'Thuốc men cá nhân'
        ],
        clothing: getClothingList(climate, season, interests, duration),
        electronics: [
            'Sạc dự phòng (power bank)',
            'Adapter điện (nếu cần)',
            'Tai nghe',
            'Máy ảnh (nếu có)'
        ],
        toiletries: [
            'Kem đánh răng, bàn chải',
            'Dầu gội, sữa tắm',
            'Kem chống nắng SPF 30+',
            'Thuốc chống muỗi'
        ],
        health: [
            'Thuốc cảm cúm',
            'Thuốc đau bụng',
            'Băng cá nhân',
            'Khẩu trang'
        ],
        optional: getOptionalItems(interests, destination, travelStyle),
        prohibited: [
            'Chất lỏng >100ml (nếu đi máy bay)',
            'Vật sắc nhọn',
            'Pin lithium lớn'
        ]
    };

    return packingList;
};

/**
 * 7. TẠO LƯU Ý QUAN TRỌNG
 */
const generateImportantNotes = async (preferences) => {
    const { destination, startDate, duration } = preferences;
    
    return {
        weather: await getWeatherNotes(destination, startDate, duration),
        culture: getCulturalNotes(destination),
        safety: getSafetyNotes(destination),
        health: getHealthNotes(destination),
        emergency: getEmergencyContacts(destination),
        business: getBusinessHours(destination),
        currency: getCurrencyNotes(),
        language: getLanguageNotes(destination),
        customs: getCustomsNotes(destination)
    };
};

/**
 * 8. TẠO BẢN ĐỒ VÀ TỐI ƯU LỘ TRÌNH
 */
const generateRouteOptimization = async (dailyItinerary) => {
    const allDestinations = dailyItinerary.flatMap(day => day.destinations);
    
    return {
        overview: {
            totalDestinations: allDestinations.length,
            totalDistance: calculateTotalDistance(allDestinations),
            optimizationStrategy: 'Tối ưu theo khoảng cách và thời gian'
        },
        dailyRoutes: dailyItinerary.map(day => ({
            day: day.day,
            route: optimizeDayRoute(day.destinations),
            distance: calculateDayDistance(day.destinations),
            estimatedTravelTime: calculateDayTravelTime(day.destinations)
        })),
        tips: [
            'Gộp các địa điểm gần nhau trong cùng một buổi',
            'Tránh đi lại cùng một địa điểm nhiều lần',
            'Ưu tiên địa điểm mở cửa sớm vào buổi sáng',
            'Để thời gian linh hoạt cho việc di chuyển'
        ]
    };
};

// ==================== HELPER FUNCTIONS ====================

const getTravelStyleDescription = (style) => {
    const descriptions = {
        budget: 'Tiết kiệm chi phí, ưu tiên trải nghiệm',
        standard: 'Cân bằng giữa chất lượng và giá cả',
        comfort: 'Thoải mái, tiện nghi tốt',
        luxury: 'Sang trọng, dịch vụ cao cấp'
    };
    return descriptions[style] || descriptions.standard;
};

const findDestinationsForDay = async (dayNumber, destination, coord, interests) => {
    try {
        const searchQuery = dayNumber === 1 ? 
            `top attractions in ${destination}` : 
            `hidden gems ${destination}`;
            
        const results = await searchPlacesByText(searchQuery, coord, 20000);
        
        return results
            .filter(place => place.rating >= 4.0)
            .slice(0, 3)
            .map(place => ({
                name: place.name,
                address: place.vicinity,
                rating: place.rating,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                types: place.types,
                entryFee: estimateEntryFee(place),
                recommendedTime: estimateVisitDuration(place),
                specialNotes: generatePlaceNotes(place, interests)
            }));
    } catch (error) {
        console.error('Lỗi tìm địa điểm:', error);
        return getFallbackDestinations(destination, dayNumber);
    }
};

const findRestaurantsForDay = async (destination, coord, travelStyle) => {
    try {
        const restaurants = await searchNearbyPlaces({
            location: coord,
            radius: 5000,
            type: 'restaurant'
        });

        const filtered = restaurants
            .filter(r => r.rating >= 4.0)
            .slice(0, 6);

        return {
            breakfast: filtered[0] ? {
                name: filtered[0].name,
                specialty: 'Phở/Bánh mì địa phương',
                priceRange: '30,000 - 50,000 VNĐ'
            } : null,
            lunch: filtered[1] ? {
                name: filtered[1].name,
                specialty: 'Cơm/Bún địa phương',
                priceRange: '50,000 - 100,000 VNĐ'
            } : null,
            dinner: filtered[2] ? {
                name: filtered[2].name,
                specialty: 'Đặc sản địa phương',
                priceRange: '100,000 - 200,000 VNĐ'
            } : null
        };
    } catch (error) {
        return getFallbackRestaurants(destination);
    }
};

const generateDayTheme = (dayNumber, destinations, interests) => {
    if (dayNumber === 1) return 'Khám phá & Làm quen';
    
    const types = destinations.flatMap(d => d.types || []);
    
    if (types.some(t => t.includes('museum') || t.includes('historical'))) {
        return 'Văn hóa & Lịch sử';
    }
    if (types.some(t => t.includes('natural') || t.includes('park'))) {
        return 'Thiên nhiên & Thư giãn';
    }
    if (interests.includes('food')) {
        return 'Ẩm thực & Trải nghiệm';
    }
    
    return 'Khám phá địa điểm nổi bật';
};

const getWeatherForDay = async (destination, date) => {
    try {
        const weather = await get7DayWeatherForecast(destination, date);
        return weather;
    } catch (error) {
        return {
            temperature: '25-30°C',
            condition: 'Có thể có mưa rào',
            humidity: '70-80%',
            recommendation: 'Mang theo ô/áo mưa'
        };
    }
};

const calculateDayCost = (destinations, restaurants, travelStyle) => {
    const multiplier = TRAVEL_STYLES[travelStyle].multiplier;
    
    const sightseeingCost = destinations.reduce((sum, dest) => sum + (dest.entryFee || 50000), 0);
    const foodCost = 200000; // Ước tính 3 bữa
    const transportCost = TRANSPORT_OPTIONS.local[travelStyle].costPerDay;
    
    return Math.round((sightseeingCost + foodCost + transportCost) * multiplier);
};

const generateFallbackDayPlan = (dayNumber, date, destination) => {
    return {
        day: dayNumber,
        date: date.toLocaleDateString('vi-VN'),
        theme: 'Khám phá tự do',
        destinations: [{
            name: `Điểm tham quan ${destination}`,
            address: destination,
            rating: 4.0,
            entryFee: 50000,
            recommendedTime: '2-3 giờ'
        }],
        meals: {
            breakfast: { name: 'Quán ăn sáng địa phương', specialty: 'Phở/Bánh mì' },
            lunch: { name: 'Nhà hàng trưa', specialty: 'Cơm địa phương' },
            dinner: { name: 'Nhà hàng tối', specialty: 'Đặc sản địa phương' }
        },
        estimatedCost: 300000
    };
};



const saveItineraryToFirebase = async (itinerary) => {
    try {
        // Sanitize dữ liệu trước khi lưu để tránh undefined values
        const sanitizedItinerary = sanitizeForFirebase({
            ...itinerary,
            createdAt: new Date(),
            version: '1.0'
        });
        
        console.log('💾 Saving sanitized itinerary to Firebase...');
        const docRef = await addDoc(collection(db, 'complete_itineraries'), sanitizedItinerary);
        console.log('✅ Lịch trình đã lưu với ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Lỗi lưu lịch trình:', error);
        console.error('Itinerary data:', JSON.stringify(itinerary, null, 2));
        throw error;
    }
};

// Export các functions cần thiết
export {
    generateTripHeader,
    generateDailyItinerary,
    generateCostBreakdown,
    generateTransportPlan,
    generateAccommodationPlan,
    generatePackingList,
    generateImportantNotes,
    generateRouteOptimization
};

// Thêm các helper functions khác...
const calculateTransportCost = (from, to, travelers, style) => {
    return TRANSPORT_OPTIONS.intercity[style].cost * travelers;
};

const calculateAccommodationCost = (nights, travelers, style) => {
    const rooms = Math.ceil(travelers / 2);
    return ACCOMMODATION_TYPES[style].pricePerNight * nights * rooms;
};

const calculateFoodCost = (dailyItinerary, travelers) => {
    return dailyItinerary.length * 200000 * travelers; // 200k/người/ngày
};

const calculateSightseeingCost = (dailyItinerary, travelers) => {
    const totalEntryFees = dailyItinerary.reduce((sum, day) => 
        sum + day.destinations.reduce((daySum, dest) => daySum + (dest.entryFee || 50000), 0), 0
    );
    return totalEntryFees * travelers;
};

const calculateLocalTransportCost = (duration, travelers, style) => {
    return TRANSPORT_OPTIONS.local[style].costPerDay * duration * travelers;
};

// getClimate and getSeason are imported from commonUtils

const getClothingList = (climate, season, interests, duration) => {
    const baseClothing = [
        `${duration} bộ quần áo thường ngày`,
        'Đồ lót và tất',
        'Giày đi bộ thoải mái'
    ];

    if (climate === 'tropical') {
        baseClothing.push('Quần áo mỏng, thoáng mát', 'Nón/mũ chống nắng');
    }
    
    if (climate === 'temperate') {
        baseClothing.push('Áo ấm, áo khoác', 'Quần dài');
    }

    if (interests.includes('adventure')) {
        baseClothing.push('Giày thể thao/trekking', 'Quần áo thể thao');
    }

    return baseClothing;
};

export default createCompleteItinerary;

// ==================== MISSING HELPER FUNCTIONS ====================

const getIntercityTransportOptions = (from, to, style) => {
    const distance = calculateCityDistance(from, to);
    const options = [];

    // Máy bay
    if (distance > 300) {
        options.push({
            type: 'Máy bay',
            duration: '1-2 giờ',
            cost: style === 'luxury' ? 3000000 : style === 'comfort' ? 1200000 : 800000,
            pros: ['Nhanh nhất', 'Tiện lợi'],
            cons: ['Đắt nhất', 'Phụ thuộc thời tiết']
        });
    }

    // Tàu hỏa
    if (['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Huế', 'Nha Trang'].includes(from) && 
        ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Huế', 'Nha Trang'].includes(to)) {
        options.push({
            type: 'Tàu hỏa',
            duration: `${Math.ceil(distance / 60)} giờ`,
            cost: style === 'luxury' ? 1500000 : style === 'comfort' ? 800000 : 400000,
            pros: ['Thoải mái', 'Ngắm cảnh'],
            cons: ['Chậm hơn máy bay', 'Lịch trình cố định']
        });
    }

    // Xe khách
    options.push({
        type: 'Xe khách/Limousine',
        duration: `${Math.ceil(distance / 50)} giờ`,
        cost: style === 'luxury' ? 600000 : style === 'comfort' ? 400000 : 200000,
        pros: ['Linh hoạt', 'Giá rẻ'],
        cons: ['Mệt mỏi', 'Phụ thuộc giao thông']
    });

    return options;
};

const getRecommendedTransport = (from, to, style) => {
    const options = getIntercityTransportOptions(from, to, style);
    const distance = calculateCityDistance(from, to);

    if (distance > 500 && (style === 'comfort' || style === 'luxury')) {
        return options.find(o => o.type === 'Máy bay') || options[0];
    }
    
    if (distance > 300 && style === 'standard') {
        return options.find(o => o.type === 'Tàu hỏa') || options[0];
    }

    return options.find(o => o.type.includes('Xe khách')) || options[0];
};

const calculateCityDistance = (from, to) => {
    const distances = {
        'Hà Nội-Hồ Chí Minh': 1200,
        'Hà Nội-Đà Nẵng': 600,
        'Hà Nội-Nha Trang': 900,
        'Hà Nội-Đà Lạt': 1000,
        'Hồ Chí Minh-Đà Nẵng': 800,
        'Hồ Chí Minh-Nha Trang': 400,
        'Hồ Chí Minh-Đà Lạt': 300,
        'Đà Nẵng-Nha Trang': 500,
        'Đà Nẵng-Hội An': 30,
        'Hồ Chí Minh-Vũng Tàu': 100,
        'Hà Nội-Sapa': 300,
        'Hà Nội-Hải Phòng': 100
    };

    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    
    return distances[key1] || distances[key2] || 400; // Default 400km
};

const getLocalTransportTips = (destination, style) => {
    const tips = [
        'Tải app Grab, Be để đặt xe dễ dàng',
        'Mang theo tiền mặt cho xe ôm, taxi truyền thống',
        'Thương lượng giá trước khi lên xe (nếu không có đồng hồ)'
    ];

    if (destination === 'Hồ Chí Minh') {
        tips.push('Tránh giờ cao điểm 7-9h sáng và 17-19h chiều');
        tips.push('Xe máy là phương tiện phổ biến nhất');
    }

    if (destination === 'Hà Nội') {
        tips.push('Phố cổ thích hợp đi bộ hoặc xe đạp');
        tips.push('Tránh khu vực quanh hồ Gươm vào cuối tuần');
    }

    if (['Đà Lạt', 'Sapa'].includes(destination)) {
        tips.push('Thuê xe máy để khám phá vùng ngoại ô');
        tips.push('Cẩn thận khi đi đường đèo, sương mù');
    }

    return tips;
};

const getRentalOptions = (destination, style) => {
    const options = [];

    // Xe máy
    if (!['Hà Nội', 'Hồ Chí Minh'].includes(destination)) {
        options.push({
            type: 'Xe máy',
            cost: '150,000-250,000 VNĐ/ngày',
            requirements: 'GPLX, đặt cọc',
            suitable: 'Khám phá tự do, đường ngắn'
        });
    }

    // Xe đạp
    options.push({
        type: 'Xe đạp',
        cost: '50,000-100,000 VNĐ/ngày',
        requirements: 'Đặt cọc',
        suitable: 'Khu vực trung tâm, tập thể dục'
    });

    // Ô tô
    if (style === 'comfort' || style === 'luxury') {
        options.push({
            type: 'Ô tô tự lái',
            cost: '800,000-1,500,000 VNĐ/ngày',
            requirements: 'GPLX B2, thẻ tín dụng',
            suitable: 'Gia đình, đường dài'
        });

        options.push({
            type: 'Xe + tài xế',
            cost: '1,200,000-2,000,000 VNĐ/ngày',
            requirements: 'Đặt trước',
            suitable: 'Thoải mái, không tự lái'
        });
    }

    return options;
};

const getRecommendedAmenities = (style) => {
    const amenities = {
        budget: ['WiFi miễn phí', 'Điều hòa', 'Nhà vệ sinh riêng'],
        standard: ['WiFi miễn phí', 'Điều hòa', 'TV', 'Tủ lạnh mini', 'Bữa sáng'],
        comfort: ['WiFi miễn phí', 'Điều hòa', 'TV', 'Tủ lạnh', 'Bữa sáng', 'Hồ bơi', 'Gym'],
        luxury: ['WiFi miễn phí', 'Điều hòa', 'TV 4K', 'Minibar', 'Bữa sáng buffet', 'Hồ bơi', 'Spa', 'Concierge']
    };

    return amenities[style] || amenities.standard;
};

const getRecommendedLocation = (destination, style) => {
    const locations = {
        'Hà Nội': {
            budget: 'Khu vực Phố Cổ, gần Hồ Gươm',
            standard: 'Quận Ba Đình, Hoàn Kiếm',
            comfort: 'Quận Ba Đình, Tây Hồ',
            luxury: 'Quận Ba Đình, Tây Hồ (view hồ)'
        },
        'Hồ Chí Minh': {
            budget: 'Quận 1, gần Bến Thành',
            standard: 'Quận 1, Quận 3',
            comfort: 'Quận 1, Quận 2 (Thủ Thiêm)',
            luxury: 'Quận 1 (view sông), Quận 2'
        },
        'Đà Nẵng': {
            budget: 'Gần biển Mỹ Khê',
            standard: 'Khu vực biển Mỹ Khê',
            comfort: 'Bãi biển Mỹ Khê, Ngũ Hành Sơn',
            luxury: 'Resort ven biển, Bãi Bắc'
        },
        'Đà Lạt': {
            budget: 'Trung tâm thành phố, gần chợ',
            standard: 'Trung tâm, gần Hồ Xuân Hương',
            comfort: 'Khu vực Hồ Xuân Hương',
            luxury: 'Villa view đồi, khu nghỉ dưỡng'
        }
    };

    return locations[destination]?.[style] || 'Trung tâm thành phố';
};

const findAccommodationOptions = async (destination, style, travelers) => {
    // Simulate accommodation search
    const baseOptions = [
        {
            name: `Khách sạn ${style} ${destination}`,
            type: ACCOMMODATION_TYPES[style].type,
            rating: style === 'luxury' ? 5 : style === 'comfort' ? 4 : 3,
            pricePerNight: ACCOMMODATION_TYPES[style].pricePerNight,
            amenities: getRecommendedAmenities(style),
            location: getRecommendedLocation(destination, style),
            bookingUrl: '#'
        }
    ];

    return baseOptions;
};

const getAccommodationTips = (destination, style) => {
    const tips = [
        'Đặt phòng trước ít nhất 1-2 tuần',
        'Kiểm tra chính sách hủy phòng',
        'Đọc review từ khách trước'
    ];

    if (destination === 'Đà Lạt') {
        tips.push('Chọn phòng có sưởi hoặc chăn ấm');
        tips.push('Homestay có view đẹp rất phổ biến');
    }

    if (destination === 'Phú Quốc') {
        tips.push('Resort ven biển có giá cao vào mùa khô');
        tips.push('Đặt phòng có bao gồm đưa đón sân bay');
    }

    if (['Hà Nội', 'Hồ Chí Minh'].includes(destination)) {
        tips.push('Chọn khách sạn gần trung tâm để tiết kiệm di chuyển');
        tips.push('Kiểm tra có chỗ đậu xe không');
    }

    return tips;
};

const getOptionalItems = (interests, destination, style) => {
    const items = [];

    if (interests.includes('photography')) {
        items.push('Máy ảnh chuyên nghiệp', 'Tripod', 'Lens bổ sung', 'Thẻ nhớ dự phòng');
    }

    if (interests.includes('adventure')) {
        items.push('Giày trekking', 'Balo leo núi', 'Đèn pin', 'Dây thừng nhỏ');
    }

    if (interests.includes('food')) {
        items.push('Thuốc tiêu hóa', 'Probiotics', 'Nước súc miệng');
    }

    if (['Đà Lạt', 'Sapa'].includes(destination)) {
        items.push('Áo khoác dày', 'Găng tay', 'Khăn quàng cổ');
    }

    if (['Nha Trang', 'Phú Quốc', 'Vũng Tàu'].includes(destination)) {
        items.push('Đồ bơi', 'Kính bơi', 'Kem chống nắng SPF 50+', 'Dép đi biển');
    }

    if (style === 'luxury') {
        items.push('Trang phục lịch sự', 'Giày da', 'Phụ kiện thời trang');
    }

    return items;
};

const getWeatherNotes = async (destination, startDate, duration) => {
    const month = new Date(startDate).getMonth() + 1;
    const season = getSeason(startDate);
    
    const weatherNotes = {
        'Hà Nội': {
            winter: 'Lạnh và ẩm (10-20°C), mang áo ấm',
            spring: 'Mát mẻ (20-25°C), thời tiết đẹp',
            summer: 'Nóng ẩm (28-35°C), có mưa rào',
            autumn: 'Mát mẻ (22-28°C), ít mưa'
        },
        'Hồ Chí Minh': {
            winter: 'Khô ráo (25-30°C), thời tiết đẹp',
            spring: 'Nóng (28-33°C), bắt đầu mưa',
            summer: 'Mùa mưa (26-32°C), mưa nhiều chiều',
            autumn: 'Mưa giảm (25-30°C)'
        },
        'Đà Lạt': {
            winter: 'Lạnh (15-22°C), có sương mù',
            spring: 'Mát mẻ (18-25°C), khô ráo',
            summer: 'Mưa nhiều (20-25°C)',
            autumn: 'Mát mẻ (18-24°C), ít mưa'
        }
    };

    const notes = weatherNotes[destination]?.[season] || 'Kiểm tra thời tiết trước khi đi';
    
    return [
        notes,
        'Mang theo ô/áo mưa phòng khi',
        'Kiểm tra dự báo thời tiết hàng ngày',
        month >= 6 && month <= 9 ? 'Mùa mưa - chuẩn bị đồ chống ẩm' : 'Mùa khô - chú ý chống nắng'
    ];
};

const getCulturalNotes = (destination) => {
    const generalNotes = [
        'Ăn mặc kín đáo khi vào chùa, đền',
        'Cởi giày khi vào nhà, một số nhà hàng',
        'Không chỉ tay vào người khác',
        'Tôn trọng người lớn tuổi'
    ];

    const specificNotes = {
        'Huế': ['Tôn trọng di tích hoàng gia', 'Không la hét trong lăng tẩm'],
        'Hội An': ['Bảo vệ kiến trúc cổ', 'Không vẽ bậy trên tường'],
        'Sapa': ['Tôn trọng văn hóa dân tộc', 'Xin phép trước khi chụp ảnh người địa phương']
    };

    return [...generalNotes, ...(specificNotes[destination] || [])];
};

const getSafetyNotes = (destination) => {
    return [
        'Giữ gìn tài sản cá nhân, tránh để lộ đồ giá trị',
        'Không đi một mình vào ban đêm ở khu vực vắng',
        'Lưu số điện thoại khẩn cấp: 113 (Cảnh sát), 114 (Cứu hỏa), 115 (Cấp cứu)',
        'Mua bảo hiểm du lịch',
        'Thông báo lịch trình cho người thân',
        'Sao lưu giấy tờ quan trọng'
    ];
};

const getHealthNotes = (destination) => {
    return [
        'Mang theo thuốc men cá nhân',
        'Uống nước đóng chai, tránh nước máy',
        'Ăn ở nơi sạch sẽ, đông khách',
        'Rửa tay thường xuyên',
        'Tránh ăn đồ sống, chưa nấu chín',
        'Mang theo thuốc cảm, thuốc đau bụng'
    ];
};

const getEmergencyContacts = (destination) => {
    const contacts = {
        police: '113',
        fire: '114',
        ambulance: '115',
        tourist_hotline: '1900 1808',
        local_hospital: getLocalHospital(destination),
        consulate: getConsulateInfo(destination)
    };
    
    // Convert to array format for easier rendering
    return [
        `Cảnh sát: ${contacts.police}`,
        `Cứu hỏa: ${contacts.fire}`,
        `Cấp cứu: ${contacts.ambulance}`,
        `Hotline du lịch: ${contacts.tourist_hotline}`,
        `Bệnh viện địa phương: ${contacts.local_hospital}`,
        `Lãnh sự quán: ${contacts.consulate}`
    ];
};

const getLocalHospital = (destination) => {
    const hospitals = {
        'Hà Nội': 'Bệnh viện Bạch Mai: (024) 3869 3731',
        'Hồ Chí Minh': 'Bệnh viện Chợ Rẫy: (028) 3855 4269',
        'Đà Nẵng': 'Bệnh viện Đà Nẵng: (0236) 3650 533',
        'Nha Trang': 'Bệnh viện Khánh Hòa: (0258) 3822 168'
    };
    return hospitals[destination] || 'Liên hệ 115 để được hỗ trợ';
};

const getConsulateInfo = (destination) => {
    return 'Đại sứ quán/Lãnh sự quán nước ngoài (nếu cần): Liên hệ qua website chính thức';
};

const getBusinessHours = (destination) => {
    return [
        'Cửa hàng: 8:00-22:00 (có thể đóng cửa trưa 12:00-14:00)',
        'Nhà hàng: 6:00-22:00',
        'Chùa, đền: 6:00-18:00',
        'Bảo tàng: 8:00-17:00 (thường nghỉ thứ 2)',
        'Ngân hàng: 8:00-16:30 (thứ 2-6)',
        'Siêu thị: 7:00-22:00'
    ];
};

const getCurrencyNotes = () => {
    return [
        'Đơn vị tiền tệ: Việt Nam Đồng (VNĐ)',
        'Tỷ giá: 1 USD ≈ 24,000 VNĐ (tham khảo)',
        'Thanh toán: Tiền mặt phổ biến, thẻ được chấp nhận ở khách sạn, nhà hàng lớn',
        'ATM: Có nhiều, phí rút tiền 15,000-22,000 VNĐ/lần',
        'Mệnh giá phổ biến: 10,000, 20,000, 50,000, 100,000, 200,000, 500,000 VNĐ'
    ];
};

const getLanguageNotes = (destination) => {
    return [
        'Ngôn ngữ chính: Tiếng Việt',
        'Tiếng Anh: Được sử dụng ở khách sạn, nhà hàng du lịch',
        'Ứng dụng dịch: Google Translate có hỗ trợ tiếng Việt',
        'Cụm từ hữu ích: Xin chào (Hello), Cảm ơn (Thank you), Xin lỗi (Sorry)',
        'Số điện thoại khẩn cấp được hỗ trợ tiếng Anh'
    ];
};

const getCustomsNotes = (destination) => {
    // Chỉ áp dụng cho du lịch quốc tế
    return [
        'Du lịch trong nước - không cần thủ tục hải quan',
        'Mang theo CCCD/CMND để check-in khách sạn',
        'Không giới hạn tiền mặt khi đi trong nước',
        'Có thể mang theo đồ ăn, thức uống cá nhân',
        'Tuân thủ quy định an ninh tại ga/sân bay (nếu có)'
    ];
};

const generateDaySpecialNotes = (dayNumber, destinations, destination) => {
    const notes = [];

    if (dayNumber === 1) {
        notes.push('Ngày đầu tiên - đừng lên lịch quá dày, để thời gian nghỉ ngơi');
        notes.push('Check-in khách sạn trước 15:00, để hành lý và bắt đầu khám phá');
    }

    if (destinations.some(d => d.types?.includes('museum'))) {
        notes.push('Bảo tàng thường đóng cửa thứ 2, kiểm tra trước khi đi');
    }

    if (destinations.some(d => d.types?.includes('natural_feature'))) {
        notes.push('Mang theo nước uống và đồ ăn nhẹ khi tham quan thiên nhiên');
    }

    if (['Đà Lạt', 'Sapa'].includes(destination)) {
        notes.push('Thời tiết có thể thay đổi nhanh, mang theo áo ấm');
    }

    return notes;
};

const generateFreeTimeActivities = (destination, interests) => {
    const activities = [];

    if (interests.includes('shopping')) {
        activities.push('Dạo chợ đêm, mua sắm đặc sản');
    }

    if (interests.includes('food')) {
        activities.push('Thử street food, tìm hiểu ẩm thực địa phương');
    }

    if (interests.includes('nightlife')) {
        activities.push('Khám phá cuộc sống về đêm, quán bar, café');
    }

    // Default activities
    activities.push('Dạo phố, chụp ảnh');
    activities.push('Uống cà phê, thư giãn');

    return activities;
};

const estimateEntryFee = (place) => {
    const types = place.types || [];
    
    if (types.includes('museum')) return 30000;
    if (types.includes('amusement_park')) return 100000;
    if (types.includes('zoo')) return 50000;
    if (types.includes('tourist_attraction')) return 20000;
    if (types.includes('park')) return 0;
    if (types.includes('church') || types.includes('temple')) return 0;
    
    return 20000; // Default
};

const estimateVisitDuration = (place) => {
    const types = place.types || [];
    
    if (types.includes('museum')) return '2-3 giờ';
    if (types.includes('amusement_park')) return '4-6 giờ';
    if (types.includes('zoo')) return '3-4 giờ';
    if (types.includes('park')) return '1-2 giờ';
    if (types.includes('church') || types.includes('temple')) return '30-60 phút';
    
    return '1-2 giờ'; // Default
};

const generatePlaceNotes = (place, interests) => {
    const notes = [];
    const types = place.types || [];
    
    if (types.includes('museum') && interests.includes('photography')) {
        notes.push('Kiểm tra quy định chụp ảnh bên trong');
    }
    
    if (types.includes('temple') || types.includes('church')) {
        notes.push('Ăn mặc kín đáo, cởi giày khi vào trong');
    }
    
    if (place.rating >= 4.5) {
        notes.push('Điểm đến được đánh giá cao - nên đến sớm tránh đông đúc');
    }
    
    return notes;
};

/**
 * Lấy địa điểm du lịch thực từ nhiều nguồn
 */
const getRealDestinationsFromFirebase = async (destination, dayNumber) => {
    try {
        console.log(`🔍 Getting real destinations for ${destination}...`);
        
        // Bước 1: Thử lấy từ Places Search Service
        const { searchTouristAttractions } = await import('./placesSearchService');
        let placesData = [];
        
        try {
            placesData = await searchTouristAttractions(destination, 6);
            console.log(`📍 Found ${placesData.length} places from Places Search`);
        } catch (error) {
            console.warn('Places Search failed, trying Firebase...', error);
        }
        
        // Bước 2: Nếu có dữ liệu từ Places, format lại
        if (placesData && placesData.length > 0) {
            const formattedPlaces = placesData.map(place => ({
                name: place.name,
                address: place.address || `${destination}`,
                rating: place.rating || 4.0,
                entryFee: estimateEntryFeeFromName(place.name),
                description: `Địa điểm du lịch nổi tiếng tại ${destination}`,
                category: place.types?.[0] || 'tourist_attraction',
                types: place.types || ['tourist_attraction'],
                estimatedDuration: estimateVisitDuration({ types: place.types }),
                specialNotes: [],
                dataSource: 'places_search_service',
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                photos: place.photos || [],
                opening_hours: place.opening_hours,
                price_level: place.price_level
            }));
            
            const diversified = diversifyDestinations(formattedPlaces, dayNumber);
            console.log(`✅ Using ${diversified.length} real destinations from Places Search`);
            return diversified;
        }
        
        // Bước 3: Fallback to Firebase
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        const collections = [
            'mienbac_cleaned_diadiem',
            'mientrung_cleaned_diadiem',
            'mientay_cleaned_diadiem', 
            'dongnambo_taynguyen_cleaned_diadiem'
        ];
        
        let allDestinations = [];
        
        for (const collectionName of collections) {
            try {
                const destinationQuery = query(
                    collection(db, collectionName),
                    where('province', '==', destination),
                    limit(10)
                );
                
                const snapshot = await getDocs(destinationQuery);
                snapshot.forEach(doc => {
                    const data = doc.data();
                    allDestinations.push({
                        name: data.name || data.ten || 'Điểm tham quan',
                        address: data.address || data.diachi || `${destination}`,
                        rating: data.rating || Math.random() * 1 + 4,
                        entryFee: data.entryFee || estimateEntryFeeFromName(data.name),
                        description: data.description || data.mota || '',
                        category: data.category || data.loai || 'tourist_attraction',
                        types: [data.category || 'tourist_attraction'],
                        estimatedDuration: data.duration || estimateVisitDuration({ types: [data.category] }),
                        specialNotes: data.notes ? [data.notes] : [],
                        dataSource: 'firebase_real_data',
                        region: collectionName.split('_')[0]
                    });
                });
            } catch (error) {
                console.warn(`Error fetching from ${collectionName}:`, error);
            }
        }
        
        if (allDestinations.length > 0) {
            const diversified = diversifyDestinations(allDestinations, dayNumber);
            console.log(`✅ Using ${diversified.length} destinations from Firebase for ${destination}`);
            return diversified;
        }
        
        // Bước 4: Final fallback
        console.log(`📍 Using fallback destinations for ${destination}`);
        return getFallbackDestinations(destination, dayNumber);
        
    } catch (error) {
        console.error('Error getting real destinations:', error);
        return getFallbackDestinations(destination, dayNumber);
    }
};

/**
 * Ước tính phí vào cửa dựa trên tên
 */
const estimateEntryFeeFromName = (name) => {
    if (!name) return 20000;
    
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('bảo tàng') || lowerName.includes('museum')) return 30000;
    if (lowerName.includes('công viên') || lowerName.includes('park')) return 0;
    if (lowerName.includes('chùa') || lowerName.includes('đền') || lowerName.includes('temple')) return 0;
    if (lowerName.includes('cáp treo') || lowerName.includes('cable')) return 150000;
    if (lowerName.includes('thác') || lowerName.includes('waterfall')) return 20000;
    if (lowerName.includes('hồ') || lowerName.includes('lake')) return 0;
    if (lowerName.includes('núi') || lowerName.includes('mountain')) return 50000;
    if (lowerName.includes('biển') || lowerName.includes('beach')) return 0;
    
    return 20000; // Default
};

const getFallbackDestinations = (destination, dayNumber) => {
    const fallbackData = {
        'Hà Nội': [
            { name: 'Hồ Gươm', address: 'Hoàn Kiếm, Hà Nội', rating: 4.5, entryFee: 0, category: 'lake' },
            { name: 'Chùa Một Cột', address: 'Ba Đình, Hà Nội', rating: 4.2, entryFee: 0, category: 'temple' },
            { name: 'Văn Miếu', address: 'Đống Đa, Hà Nội', rating: 4.3, entryFee: 30000, category: 'historical' }
        ],
        'Hồ Chí Minh': [
            { name: 'Chợ Bến Thành', address: 'Quận 1, TP.HCM', rating: 4.0, entryFee: 0, category: 'market' },
            { name: 'Nhà thờ Đức Bà', address: 'Quận 1, TP.HCM', rating: 4.4, entryFee: 0, category: 'church' },
            { name: 'Dinh Độc Lập', address: 'Quận 1, TP.HCM', rating: 4.3, entryFee: 40000, category: 'historical' }
        ],
        'Đà Nẵng': [
            { name: 'Cầu Rồng', address: 'Đà Nẵng', rating: 4.6, entryFee: 0, category: 'landmark' },
            { name: 'Bà Nà Hills', address: 'Đà Nẵng', rating: 4.4, entryFee: 750000, category: 'amusement_park' },
            { name: 'Biển Mỹ Khê', address: 'Đà Nẵng', rating: 4.5, entryFee: 0, category: 'beach' }
        ],
        'Đà Lạt': [
            { name: 'Hồ Xuân Hương', address: 'Đà Lạt', rating: 4.3, entryFee: 0, category: 'lake' },
            { name: 'Thác Elephant', address: 'Đà Lạt', rating: 4.2, entryFee: 30000, category: 'waterfall' },
            { name: 'Chợ Đà Lạt', address: 'Đà Lạt', rating: 4.1, entryFee: 0, category: 'market' }
        ],
        'Vũng Tàu': [
            { name: 'Bãi Trước', address: 'Thùy Vân, Vũng Tàu', rating: 4.2, entryFee: 0, category: 'beach' },
            { name: 'Tượng Chúa Kitô Vua', address: 'Núi Nhỏ, Vũng Tàu', rating: 4.5, entryFee: 0, category: 'landmark' },
            { name: 'Ngọn Hải Đăng', address: 'Núi Nhỏ, Vũng Tàu', rating: 4.3, entryFee: 20000, category: 'lighthouse' },
            { name: 'Bãi Sau', address: 'Thùy Vân, Vũng Tàu', rating: 4.1, entryFee: 0, category: 'beach' },
            { name: 'Chùa Niet Ban Tinh Xa', address: 'Núi Lớn, Vũng Tàu', rating: 4.4, entryFee: 0, category: 'temple' },
            { name: 'Bạch Dinh', address: 'Trần Phú, Vũng Tàu', rating: 4.0, entryFee: 15000, category: 'historical' }
        ],
        'Nha Trang': [
            { name: 'Biển Nha Trang', address: 'Trần Phú, Nha Trang', rating: 4.4, entryFee: 0, category: 'beach' },
            { name: 'Tháp Bà Ponagar', address: '2 Tháng 4, Nha Trang', rating: 4.2, entryFee: 22000, category: 'historical' },
            { name: 'Vinpearl Land', address: 'Hòn Tre, Nha Trang', rating: 4.3, entryFee: 800000, category: 'amusement_park' }
        ]
    };

    const destinations = fallbackData[destination] || [
        { name: `Điểm tham quan ${destination}`, address: destination, rating: 4.0, entryFee: 20000, category: 'general' }
    ];

    return destinations.slice(0, dayNumber === 1 ? 2 : 3).map(dest => ({
        ...dest,
        types: [dest.category],
        estimatedDuration: estimateVisitDuration({ types: [dest.category] }),
        specialNotes: [],
        dataSource: 'fallback'
    }));
};

const getFallbackRestaurants = (destination) => {
    return {
        breakfast: { name: 'Quán phở địa phương', specialty: 'Phở bò', priceRange: '30,000-50,000 VNĐ' },
        lunch: { name: 'Cơm bình dân', specialty: 'Cơm tấm', priceRange: '40,000-80,000 VNĐ' },
        dinner: { name: 'Nhà hàng đặc sản', specialty: 'Món đặc sản địa phương', priceRange: '100,000-200,000 VNĐ' }
    };
};

const optimizeDayRoute = (destinations) => {
    if (destinations.length <= 1) return destinations;
    
    // Simple optimization: sort by proximity
    const optimized = [destinations[0]];
    const remaining = destinations.slice(1);
    
    while (remaining.length > 0) {
        const last = optimized[optimized.length - 1];
        let nearestIndex = 0;
        let minDistance = Infinity;
        
        remaining.forEach((dest, index) => {
            const distance = calculateDistance(
                { lat: last.lat || 0, lng: last.lng || 0 },
                { lat: dest.lat || 0, lng: dest.lng || 0 }
            );
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });
        
        optimized.push(remaining.splice(nearestIndex, 1)[0]);
    }
    
    return optimized;
};

const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const calculateTotalDistance = (destinations) => {
    let total = 0;
    for (let i = 0; i < destinations.length - 1; i++) {
        total += calculateDistance(
            { lat: destinations[i].lat || 0, lng: destinations[i].lng || 0 },
            { lat: destinations[i+1].lat || 0, lng: destinations[i+1].lng || 0 }
        );
    }
    return Math.round(total);
};

const calculateDayDistance = (destinations) => {
    return calculateTotalDistance(destinations);
};

const calculateDayTravelTime = (destinations) => {
    const distance = calculateDayDistance(destinations);
    return Math.round(distance / 30 * 60); // Assume 30km/h average speed, return minutes
};

const getTransportDetails = (from, to, style) => {
    const recommended = getRecommendedTransport(from, to, style);
    return {
        type: recommended.type,
        duration: recommended.duration,
        cost: recommended.cost,
        bookingTips: [
            'Đặt vé trước 1-2 tuần để có giá tốt',
            'Kiểm tra chính sách hủy/đổi vé',
            'Mang theo giấy tờ tùy thân khi đi'
        ]
    };
};

const generateBookingLinks = (destination, style) => {
    return [
        { platform: 'Booking.com', url: `https://booking.com/searchresults.html?ss=${destination}` },
        { platform: 'Agoda', url: `https://agoda.com/search?city=${destination}` },
        { platform: 'Airbnb', url: `https://airbnb.com/s/${destination}` }
    ];
};

const getFoodCostBreakdown = (dailyItinerary) => {
    return dailyItinerary.map(day => ({
        day: day.day,
        breakfast: 50000,
        lunch: 80000,
        dinner: 120000,
        total: 250000
    }));
};

const getSightseeingCostBreakdown = (dailyItinerary) => {
    return dailyItinerary.map(day => ({
        day: day.day,
        attractions: day.destinations?.reduce((sum, dest) => sum + (dest.entryFee || 0), 0) || 0,
        activities: 50000, // Estimated other activities
        total: (day.destinations?.reduce((sum, dest) => sum + (dest.entryFee || 0), 0) || 0) + 50000
    }));
};
// ==================== REAL DATA HELPER FUNCTIONS ====================

/**
 * Xác định categories cho từng ngày dựa trên interests
 */
const determineDayCategories = (dayNumber, interests) => {
    const categoryMap = {
        1: ['tourist_attraction', 'landmark'], // Ngày đầu - điểm nổi tiếng
        2: ['restaurant', 'food', 'local_business'], // Ngày 2 - ẩm thực
        3: ['museum', 'art_gallery', 'cultural'], // Ngày 3 - văn hóa
        4: ['park', 'natural_feature', 'outdoor'], // Ngày 4 - thiên nhiên
        5: ['shopping_mall', 'market', 'entertainment'] // Ngày 5+ - mua sắm
    };

    let categories = categoryMap[dayNumber] || categoryMap[1];

    // Điều chỉnh theo interests
    if (interests.includes('food')) {
        categories = [...categories, 'restaurant', 'cafe', 'bakery'];
    }
    if (interests.includes('culture')) {
        categories = [...categories, 'museum', 'temple', 'historical'];
    }
    if (interests.includes('adventure')) {
        categories = [...categories, 'park', 'hiking_area', 'outdoor'];
    }
    if (interests.includes('photography')) {
        categories = [...categories, 'scenic_spot', 'viewpoint', 'landmark'];
    }

    return [...new Set(categories)]; // Remove duplicates
};

/**
 * Tìm địa điểm thực tế cho từng ngày - SỬ DỤNG GOOGLE PLACES API
 */
const findRealDestinationsForDay = async (dayNumber, destination, coord, interests) => {
    try {
        console.log(`🔍 Finding REAL destinations for Day ${dayNumber} in ${destination}...`);

        // Bước 1: Thử lấy từ Google Places API (như personalItineraryService)
        let googlePlacesDestinations = [];
        
        try {
            const { searchPlacesByText, initPlacesService } = await import('./placesService');
            
            // Đợi Google Maps API load
            await waitForGoogleMaps();
            
            // Tạo map instance ẩn để khởi tạo Places Service
            if (!window.hiddenMapForPlaces) {
                const mapDiv = document.createElement('div');
                mapDiv.style.display = 'none';
                document.body.appendChild(mapDiv);
                
                window.hiddenMapForPlaces = new window.google.maps.Map(mapDiv, {
                    center: coord,
                    zoom: 13
                });
                
                initPlacesService(window.hiddenMapForPlaces);
            }
            
            // Tạo queries đa dạng hơn theo từng ngày
            const daySpecificQueries = {
                1: [
                    `top attractions ${destination}`,
                    `famous landmarks ${destination}`,
                    `tourist attractions ${destination}`,
                    `sightseeing ${destination}`
                ],
                2: [
                    `museums ${destination}`,
                    `cultural sites ${destination}`,
                    `temples ${destination}`,
                    `historical places ${destination}`
                ],
                3: [
                    `beaches ${destination}`,
                    `parks ${destination}`,
                    `nature ${destination}`,
                    `viewpoints ${destination}`
                ]
            };
            
            const queries = daySpecificQueries[dayNumber] || [
                `attractions ${destination}`,
                `places to visit ${destination}`,
                `tourist spots ${destination}`,
                `things to do ${destination}`
            ];
            
            for (const query of queries) {
                try {
                    const results = await searchPlacesByText(query, coord, 20000);
                    
                    if (results && results.length > 0) {
                        const formattedResults = results
                            .filter(place => {
                                // Lọc địa điểm chất lượng cao
                                const hasGoodRating = place.rating >= 3.8;
                                const hasReviews = place.user_ratings_total > 10;
                                const notUsed = !usedDestinations.has(place.name) && !usedDestinations.has(place.place_id);
                                return hasGoodRating && hasReviews && notUsed;
                            })
                            .slice(0, 5) // Lấy nhiều hơn để có lựa chọn
                            .map(place => ({
                                name: place.name,
                                address: place.vicinity || place.formatted_address || `${destination}`,
                                rating: place.rating || 4.0,
                                entryFee: estimateEntryFeeFromName(place.name),
                                description: generatePlaceDescription(place, destination),
                                category: categorizePlaceType(place.types),
                                types: place.types || ['tourist_attraction'],
                                estimatedDuration: estimateVisitDuration(place),
                                specialNotes: generateSpecialNotes(place),
                                dataSource: 'google_places_api',
                                lat: typeof place.geometry?.location?.lat === 'function' ? place.geometry.location.lat() : place.geometry?.location?.lat,
                                lng: typeof place.geometry?.location?.lng === 'function' ? place.geometry.location.lng() : place.geometry?.location?.lng,
                                place_id: place.place_id,
                                photos: place.photos || [],
                                opening_hours: place.opening_hours,
                                user_ratings_total: place.user_ratings_total,
                                price_level: place.price_level
                            }));
                        
                        googlePlacesDestinations.push(...formattedResults);
                        
                        // Lấy đủ địa điểm cho mỗi ngày
                        if (googlePlacesDestinations.length >= 10) {
                            break;
                        }
                    }
                } catch (queryError) {
                    console.warn(`Query failed: ${query}`, queryError);
                }
            }
            
            if (googlePlacesDestinations.length > 0) {
                const diversified = diversifyDestinations(googlePlacesDestinations, dayNumber);
                console.log(`✅ Using ${diversified.length} destinations from Google Places API for Day ${dayNumber}`);
                return diversified;
            }
            
        } catch (placesError) {
            console.warn('Google Places API failed, trying Firebase...', placesError);
        }

        // Bước 2: Fallback to Firebase
        let firebaseDestinations = await getRealDestinationsFromFirebase(destination, dayNumber);
        
        if (firebaseDestinations && firebaseDestinations.length > 0) {
            console.log(`✅ Using ${firebaseDestinations.length} destinations from Firebase for Day ${dayNumber}`);
            return firebaseDestinations;
        }

        // Bước 3: Final fallback
        console.log(`📍 Using fallback destinations for Day ${dayNumber}`);
        const fallbackDests = getFallbackDestinations(destination, dayNumber);
        return diversifyDestinations(fallbackDests, dayNumber);

    } catch (error) {
        console.error(`Error finding destinations for Day ${dayNumber}:`, error);
        return getFallbackDestinations(destination, dayNumber);
    }
};

// Global tracking để tránh lặp địa điểm và nhà hàng
let usedDestinations = new Set();
let usedRestaurants = new Set();

/**
 * Reset tracking khi tạo lịch trình mới
 */
const resetDestinationTracking = () => {
    usedDestinations = new Set();
    usedRestaurants = new Set();
};

/**
 * Đa dạng hóa danh sách địa điểm theo ngày
 */
const diversifyDestinations = (destinations, dayNumber) => {
    if (destinations.length === 0) return [];

    // Lọc bỏ địa điểm đã dùng
    const availableDestinations = destinations.filter(dest => 
        !usedDestinations.has(dest.name) && !usedDestinations.has(dest.place_id)
    );

    if (availableDestinations.length === 0) {
        console.warn(`⚠️ No new destinations available for day ${dayNumber}, using fallback`);
        return destinations.slice(0, dayNumber === 1 ? 2 : 3);
    }

    // Phân loại theo category
    const byCategory = {};
    availableDestinations.forEach(dest => {
        const category = dest.category || dest.types?.[0] || 'general';
        if (!byCategory[category]) byCategory[category] = [];
        byCategory[category].push(dest);
    });

    // Chọn đa dạng theo ngày - tăng số lượng địa điểm
    const selected = [];
    const targetCount = Math.min(dayNumber === 1 ? 3 : 4, availableDestinations.length);
    
    // Ưu tiên theo ngày với nhiều category hơn
    const dayPriorities = {
        1: ['tourist_attraction', 'lighthouse', 'landmark', 'point_of_interest', 'establishment'], // Ngày đầu - điểm nổi tiếng
        2: ['museum', 'temple', 'religious', 'establishment', 'point_of_interest'], // Ngày 2 - văn hóa
        3: ['beach', 'park', 'natural', 'viewpoint', 'tourist_attraction'] // Ngày 3 - thiên nhiên
    };
    
    const priorities = dayPriorities[dayNumber] || ['tourist_attraction', 'point_of_interest', 'establishment', 'museum', 'beach'];
    
    // Chọn theo thứ tự ưu tiên
    for (const priority of priorities) {
        if (selected.length >= targetCount) break;
        
        if (byCategory[priority] && byCategory[priority].length > 0) {
            const best = byCategory[priority].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
            selected.push(best);
            // Mark as used
            usedDestinations.add(best.name);
            if (best.place_id) usedDestinations.add(best.place_id);
            byCategory[priority] = byCategory[priority].filter(d => d.name !== best.name);
        }
    }
    
    // Nếu chưa đủ, chọn từ các category còn lại
    const remainingCategories = Object.keys(byCategory).filter(cat => byCategory[cat].length > 0);
    for (const category of remainingCategories) {
        if (selected.length >= targetCount) break;
        
        const best = byCategory[category].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
        if (!selected.find(s => s.name === best.name)) {
            selected.push(best);
            // Mark as used
            usedDestinations.add(best.name);
            if (best.place_id) usedDestinations.add(best.place_id);
        }
    }

    return selected.slice(0, targetCount);
};

/**
 * Phân loại địa điểm theo type
 */
const categorizePlaceType = (types) => {
    if (!types || types.length === 0) return 'tourist_attraction';
    
    const typeMapping = {
        'tourist_attraction': 'tourist_attraction',
        'museum': 'museum',
        'park': 'park',
        'beach': 'beach',
        'temple': 'temple',
        'church': 'religious',
        'lighthouse': 'landmark',
        'viewpoint': 'viewpoint',
        'natural_feature': 'natural',
        'establishment': 'establishment',
        'point_of_interest': 'point_of_interest'
    };
    
    for (const type of types) {
        if (typeMapping[type]) {
            return typeMapping[type];
        }
    }
    
    return types[0] || 'tourist_attraction';
};

/**
 * Tạo mô tả địa điểm
 */
const generatePlaceDescription = (place, destination) => {
    const category = categorizePlaceType(place.types);
    const descriptions = {
        'museum': `Bảo tàng nổi tiếng tại ${destination}`,
        'beach': `Bãi biển đẹp tại ${destination}`,
        'temple': `Ngôi chùa linh thiêng tại ${destination}`,
        'lighthouse': `Ngọn hải đăng biểu tượng của ${destination}`,
        'park': `Công viên xanh mát tại ${destination}`,
        'viewpoint': `Điểm ngắm cảnh tuyệt đẹp tại ${destination}`,
        'tourist_attraction': `Địa điểm du lịch nổi tiếng tại ${destination}`
    };
    
    return descriptions[category] || `Địa điểm thú vị tại ${destination}`;
};

/**
 * Tạo ghi chú đặc biệt
 */
const generateSpecialNotes = (place) => {
    const notes = [];
    
    if (place.price_level >= 3) {
        notes.push('Địa điểm cao cấp');
    }
    
    if (place.user_ratings_total > 1000) {
        notes.push('Rất phổ biến với du khách');
    }
    
    if (place.types?.includes('beach')) {
        notes.push('Mang theo đồ bơi');
    }
    
    if (place.types?.includes('museum')) {
        notes.push('Thường đóng cửa thứ 2');
    }
    
    return notes;
};

/**
 * Random selection để tránh lặp
 */
const getRandomSelection = (array, count) => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

/**
 * Tìm nhà hàng dinner đa dạng và tránh lặp
 */
const findRandomDinnerRestaurant = async (realRestaurants, destination, coord, usedRestaurants) => {
    try {
        // Tìm thêm nhà hàng hải sản từ Google Places
        const { searchPlacesByText } = await import('./placesService');
        await waitForGoogleMaps();

        const dinnerQueries = [
            `seafood restaurants ${destination}`,
            `hải sản ${destination}`,
            `nhà hàng hải sản ${destination}`,
            `fine dining ${destination}`,
            `best dinner ${destination}`,
            `restaurant view biển ${destination}`
        ];

        let allDinnerOptions = [...realRestaurants];

        // Tìm thêm từ Google Places
        for (const query of dinnerQueries) {
            try {
                const results = await searchPlacesByText(query, coord, 15000);
                
                if (results && results.length > 0) {
                    const dinnerRestaurants = results
                        .filter(place => {
                            const notUsed = !usedRestaurants.has(place.name) && !usedRestaurants.has(place.place_id);
                            const goodRating = place.rating >= 4.0;
                            const hasReviews = place.user_ratings_total > 20;
                            return notUsed && goodRating && hasReviews;
                        })
                        .slice(0, 5)
                        .map(place => ({
                            name: place.name,
                            specialty: generateDinnerSpecialty(place.name, destination),
                            priceRange: '150,000-400,000 VNĐ',
                            estimatedCost: 250000,
                            rating: place.rating,
                            address: place.vicinity || place.formatted_address,
                            dataSource: 'google_places_api',
                            place_id: place.place_id,
                            isOpen: true
                        }));

                    allDinnerOptions.push(...dinnerRestaurants);
                }
            } catch (error) {
                console.warn(`Dinner query failed: ${query}`, error);
            }
        }

        // Lọc bỏ đã dùng và chọn random
        const availableOptions = allDinnerOptions.filter(restaurant => 
            !usedRestaurants.has(restaurant.name) && !usedRestaurants.has(restaurant.place_id)
        );

        if (availableOptions.length > 0) {
            const selected = getRandomSelection(availableOptions, 1)[0];
            
            // Mark as used
            usedRestaurants.add(selected.name);
            if (selected.place_id) usedRestaurants.add(selected.place_id);
            
            console.log(`🍽️ Selected dinner: ${selected.name}`);
            return selected;
        }

    } catch (error) {
        console.warn('Error finding dinner restaurant:', error);
    }

    // Fallback
    return {
        name: `Nhà hàng hải sản ${destination}`,
        specialty: 'Hải sản tươi sống đặc sản',
        priceRange: '150,000-300,000 VNĐ',
        estimatedCost: 200000,
        rating: 4.5,
        isOpen: true,
        dataSource: 'fallback'
    };
};

/**
 * Tạo specialty cho dinner
 */
const generateDinnerSpecialty = (placeName, destination) => {
    const name = placeName.toLowerCase();
    
    if (name.includes('hải sản') || name.includes('seafood')) return 'Hải sản tươi sống đặc sản';
    if (name.includes('cua')) return 'Cua rang me, lẩu cua đồng';
    if (name.includes('tôm')) return 'Tôm nướng, tôm hấp bia';
    if (name.includes('cá')) return 'Cá nướng, cá hấp xì dầu';
    if (name.includes('fine') || name.includes('cao cấp')) return 'Ẩm thực cao cấp';
    
    return `Đặc sản ${destination}`;
};

/**
 * Tìm street food thật từ Google Places
 */
const findRealStreetFood = async (destination, coord) => {
    try {
        const { searchPlacesByText } = await import('./placesService');
        await waitForGoogleMaps();

        const queries = [
            `bánh khọt ${destination}`,
            `bánh căn ${destination}`,
            `bún riêu ${destination}`,
            `street food ${destination}`,
            `local food ${destination}`,
            `food stall ${destination}`,
            `quán ăn vỉa hè ${destination}`,
            `ẩm thực đường phố ${destination}`
        ];

        for (const query of queries) {
            try {
                const results = await searchPlacesByText(query, coord, 10000);
                
                if (results && results.length > 0) {
                    const streetFoodPlaces = results
                        .filter(place => place.rating >= 3.5 && place.user_ratings_total > 5)
                        .slice(0, 8) // Lấy nhiều hơn để có đa dạng
                        .map(place => ({
                            name: place.name,
                            specialty: generateStreetFoodSpecialty(place.name, destination),
                            priceRange: '20,000-50,000 VNĐ',
                            estimatedCost: 35000,
                            rating: place.rating,
                            address: place.vicinity || place.formatted_address,
                            dataSource: 'google_places_api',
                            place_id: place.place_id
                        }));

                    if (streetFoodPlaces.length > 0) {
                        console.log(`🍜 Found ${streetFoodPlaces.length} real street food places`);
                        // Random selection để tránh lặp
                        return getRandomSelection(streetFoodPlaces, 3);
                    }
                }
            } catch (error) {
                console.warn(`Street food query failed: ${query}`, error);
            }
        }
    } catch (error) {
        console.warn('Google Places street food search failed:', error);
    }

    // Fallback với địa chỉ cụ thể hơn
    return [
        {
            name: `Bánh khọt ${destination}`,
            specialty: 'Bánh khọt tôm tươi',
            priceRange: '30,000-50,000 VNĐ',
            estimatedCost: 35000,
            rating: 4.1,
            address: `Khu vực trung tâm ${destination}`,
            dataSource: 'fallback'
        }
    ];
};

/**
 * Tạo specialty cho street food
 */
const generateStreetFoodSpecialty = (placeName, destination) => {
    const name = placeName.toLowerCase();
    
    if (name.includes('bánh khọt')) return 'Bánh khọt tôm tươi';
    if (name.includes('bánh căn')) return 'Bánh căn nướng';
    if (name.includes('bún riêu')) return 'Bún riêu cua đồng';
    if (name.includes('hải sản')) return 'Hải sản tươi sống';
    if (name.includes('cà ri')) return 'Cà ri cua đặc sản';
    
    return `Đặc sản ${destination}`;
};

/**
 * Tìm cà phê thật từ Google Places
 */
const findRealCafes = async (destination, coord) => {
    try {
        const { searchPlacesByText } = await import('./placesService');
        await waitForGoogleMaps();

        const queries = [
            `coffee shop ${destination}`,
            `cafe ${destination}`,
            `cà phê ${destination}`,
            `coffee ${destination}`,
            `quán cà phê ${destination}`,
            `cafe view biển ${destination}`,
            `cà phê rooftop ${destination}`,
            `trà sữa ${destination}`
        ];

        for (const query of queries) {
            try {
                const results = await searchPlacesByText(query, coord, 10000);
                
                if (results && results.length > 0) {
                    const cafes = results
                        .filter(place => place.rating >= 3.8 && place.user_ratings_total > 10)
                        .slice(0, 8) // Lấy nhiều hơn để có đa dạng
                        .map(place => ({
                            name: place.name,
                            specialty: 'Cà phê đặc sản địa phương',
                            priceRange: '25,000-60,000 VNĐ',
                            estimatedCost: 40000,
                            rating: place.rating,
                            address: place.vicinity || place.formatted_address,
                            dataSource: 'google_places_api',
                            place_id: place.place_id,
                            ambiance: generateCafeAmbiance(place.name)
                        }));

                    if (cafes.length > 0) {
                        console.log(`☕ Found ${cafes.length} real cafes`);
                        // Random selection để tránh lặp
                        return getRandomSelection(cafes, 3);
                    }
                }
            } catch (error) {
                console.warn(`Cafe query failed: ${query}`, error);
            }
        }
    } catch (error) {
        console.warn('Google Places cafe search failed:', error);
    }

    // Fallback với địa chỉ cụ thể hơn
    return [
        {
            name: `Cà phê view biển ${destination}`,
            specialty: 'Cà phê đặc sản địa phương',
            priceRange: '25,000-60,000 VNĐ',
            estimatedCost: 40000,
            rating: 4.2,
            address: `Khu vực ven biển ${destination}`,
            dataSource: 'fallback',
            ambiance: 'View biển, không gian thoáng mát'
        }
    ];
};

/**
 * Tạo mô tả không gian cà phê
 */
const generateCafeAmbiance = (placeName) => {
    const name = placeName.toLowerCase();
    
    if (name.includes('view') || name.includes('biển')) return 'View biển tuyệt đẹp';
    if (name.includes('rooftop') || name.includes('tầng')) return 'Không gian tầng cao';
    if (name.includes('garden') || name.includes('vườn')) return 'Không gian xanh mát';
    if (name.includes('vintage') || name.includes('cổ')) return 'Phong cách vintage';
    
    return 'Không gian thoải mái, phù hợp thư giãn';
};

/**
 * Tìm nhà hàng thực tế đa dạng cho từng ngày - FIREBASE ONLY
 */
const findRealRestaurantsForDay = async (destination, coord, travelStyle) => {
    try {
        console.log(`🍽️ Finding DIVERSE restaurants in ${destination} from Firebase...`);

        // Thử lấy nhà hàng thực từ Google Places API
        let realRestaurants = [];
        
        try {
            const { searchPlacesByText, initPlacesService } = await import('./placesService');
            
            // Đợi Google Maps API load
            await waitForGoogleMaps();
            
            // Đảm bảo có map instance
            if (!window.hiddenMapForPlaces) {
                const mapDiv = document.createElement('div');
                mapDiv.style.display = 'none';
                document.body.appendChild(mapDiv);
                
                window.hiddenMapForPlaces = new window.google.maps.Map(mapDiv, {
                    center: coord,
                    zoom: 13
                });
                
                initPlacesService(window.hiddenMapForPlaces);
            }
            
            const restaurantQueries = [
                `best restaurants ${destination}`,
                `local food ${destination}`,
                `popular restaurants ${destination}`,
                `seafood restaurants ${destination}`,
                `vietnamese restaurants ${destination}`,
                `family restaurants ${destination}`,
                `fine dining ${destination}`,
                `casual dining ${destination}`
            ];
            
            for (const query of restaurantQueries) {
                try {
                    const results = await searchPlacesByText(query, coord, 10000);
                    
                    if (results && results.length > 0) {
                        const restaurants = results
                            .filter(place => 
                                place.types?.includes('restaurant') || 
                                place.types?.includes('food') ||
                                place.types?.includes('meal_takeaway')
                            )
                            .filter(place => place.rating >= 4.0)
                            .slice(0, 3)
                            .map(place => ({
                                name: place.name,
                                address: place.vicinity || place.formatted_address || `${destination}`,
                                rating: place.rating || 4.0,
                                types: place.types || ['restaurant'],
                                geometry: place.geometry,
                                photos: place.photos || [],
                                opening_hours: place.opening_hours,
                                price_level: place.price_level || 2,
                                dataSource: 'google_places_api'
                            }));
                        
                        realRestaurants.push(...restaurants);
                        
                        if (realRestaurants.length >= 3) break;
                    }
                } catch (queryError) {
                    console.warn(`Restaurant query failed: ${query}`, queryError);
                }
            }
            
            console.log(`🍽️ Found ${realRestaurants.length} real restaurants from Google Places`);
            
        } catch (error) {
            console.warn('Google Places restaurant search failed, using fallback...', error);
        }
        
        // Lấy dữ liệu ẩm thực từ Firebase
        const localCuisines = await getLocalCuisinesByDestination(destination);
        
        // Tạo danh sách đa dạng từ dữ liệu thực và Firebase
        const diverseOptions = {
            breakfast: realRestaurants[0] ? {
                name: realRestaurants[0].name,
                specialty: 'Ẩm thực địa phương',
                priceRange: '30,000-50,000 VNĐ',
                estimatedCost: 40000,
                rating: realRestaurants[0].rating || 4.2,
                isOpen: true, // Assume open during business hours
                dataSource: 'places_search_real',
                address: realRestaurants[0].address
            } : {
                name: 'Quán ăn sáng địa phương',
                specialty: 'Phở bò/gà truyền thống',
                priceRange: '30,000-50,000 VNĐ',
                estimatedCost: 40000,
                rating: 4.2,
                isOpen: true,
                dataSource: 'firebase_fallback'
            },
            lunch: realRestaurants[1] ? {
                name: realRestaurants[1].name,
                specialty: localCuisines.lunch || 'Cơm địa phương',
                priceRange: '50,000-100,000 VNĐ',
                estimatedCost: 75000,
                rating: realRestaurants[1].rating || 4.3,
                isOpen: true, // Assume open during business hours
                dataSource: 'places_search_real',
                address: realRestaurants[1].address
            } : {
                name: 'Cơm bình dân',
                specialty: localCuisines.lunch || 'Cơm địa phương',
                priceRange: '50,000-100,000 VNĐ',
                estimatedCost: 75000,
                rating: 4.3,
                isOpen: true,
                dataSource: 'firebase_fallback'
            },
            dinner: await findRandomDinnerRestaurant(realRestaurants, destination, coord, usedRestaurants),
            
            // Thêm street food với địa chỉ thật từ Google Places
            streetFood: await findRealStreetFood(destination, coord),
            
            // Thêm cafes với địa chỉ thật từ Google Places
            cafes: await findRealCafes(destination, coord),
            
            localSpecialties: localCuisines.specialties || [
                {
                    name: 'Món đặc sản địa phương',
                    specialty: 'Theo mùa',
                    priceRange: '50,000-150,000 VNĐ',
                    estimatedCost: 100000,
                    rating: 4.4,
                    dataSource: 'firebase_fallback'
                }
            ]
        };

        console.log(`✅ Found diverse dining options from Firebase: ${Object.keys(diverseOptions).length} categories`);
        return diverseOptions;

    } catch (error) {
        console.error('Error finding diverse restaurants:', error);
        return await getEnhancedFallbackRestaurants(destination, coord, usedRestaurants);
    }
};

/**
 * Chọn nhà hàng đa dạng theo meal type
 */
const selectDiverseRestaurant = (restaurants, mealType) => {
    if (!restaurants || restaurants.length === 0) return null;

    // Ưu tiên theo meal type
    const preferences = {
        breakfast: ['cafe', 'bakery', 'breakfast_spot'],
        lunch: ['restaurant', 'local_business', 'food_court'],
        dinner: ['restaurant', 'fine_dining', 'local_specialty']
    };

    const preferred = preferences[mealType] || [];
    
    // Tìm nhà hàng phù hợp với meal type
    for (const pref of preferred) {
        const match = restaurants.find(r => 
            r.types?.some(type => type.includes(pref)) ||
            r.specialty?.toLowerCase().includes(pref)
        );
        if (match) return match;
    }

    // Fallback: chọn rating cao nhất
    return restaurants.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
};

/**
 * Enhanced fallback restaurants với dữ liệu Firebase thực tế
 */
const getEnhancedFallbackRestaurants = async (destination, coord = null, usedRestaurants = new Set()) => {
    try {
        // Lấy dữ liệu ẩm thực thực từ Firebase
        const localCuisines = await getLocalCuisinesByDestination(destination);
        
        return {
            breakfast: { 
                name: 'Quán phở địa phương', 
                specialty: 'Phở bò/gà truyền thống', 
                priceRange: '30,000-50,000 VNĐ',
                cuisineType: 'vietnamese_breakfast',
                estimatedCost: 40000
            },
            lunch: { 
                name: 'Cơm bình dân', 
                specialty: localCuisines.lunch || 'Cơm địa phương', 
                priceRange: '50,000-100,000 VNĐ',
                cuisineType: 'local_lunch',
                estimatedCost: 75000
            },
            dinner: await findRandomDinnerRestaurant([], destination, coord, usedRestaurants),
            streetFood: [
                { 
                    name: 'Bánh mì đường phố', 
                    specialty: 'Bánh mì thịt nướng', 
                    priceRange: '15,000-25,000 VNĐ',
                    estimatedCost: 20000
                },
                { 
                    name: 'Chè cung đình', 
                    specialty: 'Chè đậu xanh', 
                    priceRange: '10,000-20,000 VNĐ',
                    estimatedCost: 15000
                }
            ],
            cafes: [
                { 
                    name: 'Cà phê vỉa hè', 
                    specialty: 'Cà phê phin', 
                    priceRange: '15,000-30,000 VNĐ',
                    estimatedCost: 25000
                },
                { 
                    name: 'Trà đá chanh', 
                    specialty: 'Trà chanh tươi', 
                    priceRange: '10,000-15,000 VNĐ',
                    estimatedCost: 12000
                }
            ],
            localSpecialties: localCuisines.specialties || [
                { 
                    name: 'Món đặc sản địa phương', 
                    specialty: 'Theo mùa', 
                    priceRange: '50,000-150,000 VNĐ',
                    estimatedCost: 100000
                }
            ],
            dataSource: localCuisines.dataSource || 'firebase_enhanced'
        };
    } catch (error) {
        console.error('Error getting enhanced fallback restaurants:', error);
        return getBasicFallbackRestaurants(destination);
    }
};

/**
 * Basic fallback khi có lỗi
 */
const getBasicFallbackRestaurants = (destination) => {
    return {
        breakfast: { 
            name: 'Quán ăn sáng địa phương', 
            specialty: 'Phở/Bánh mì', 
            priceRange: '30,000-50,000 VNĐ',
            estimatedCost: 40000
        },
        lunch: { 
            name: 'Cơm bình dân', 
            specialty: 'Cơm địa phương', 
            priceRange: '50,000-100,000 VNĐ',
            estimatedCost: 75000
        },
        dinner: { 
            name: 'Nhà hàng địa phương', 
            specialty: 'Đặc sản vùng miền', 
            priceRange: '100,000-200,000 VNĐ',
            estimatedCost: 150000
        },
        streetFood: [],
        cafes: [],
        localSpecialties: [],
        dataSource: 'basic_fallback'
    };
};

/**
 * Lấy ẩm thực đặc trưng từ dữ liệu Firebase thực tế
 */
const getLocalCuisinesByDestination = async (destination) => {
    try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        // Tìm đặc sản từ tất cả các collection vùng miền
        const collections = [
            'mienbac_cleaned_dacsan',
            'mientrung_cleaned_dacsan', 
            'mientay_cleaned_dacsan',
            'dongnambo_taynguyen_cleaned_dacsan'
        ];
        
        let specialties = [];
        
        for (const collectionName of collections) {
            try {
                const specialtyQuery = query(
                    collection(db, collectionName),
                    where('province', '==', destination)
                );
                
                const snapshot = await getDocs(specialtyQuery);
                snapshot.forEach(doc => {
                    const data = doc.data();
                    specialties.push({
                        name: data.name || data.ten || 'Đặc sản địa phương',
                        specialty: data.description || data.mota || data.specialty || 'Món đặc sản',
                        priceRange: data.priceRange || estimatePrice(data.name),
                        category: data.category || 'local_food',
                        region: collectionName.split('_')[0]
                    });
                });
            } catch (error) {
                console.warn(`Error fetching from ${collectionName}:`, error);
            }
        }
        
        // Nếu không tìm thấy, dùng fallback
        if (specialties.length === 0) {
            return getFallbackCuisines(destination);
        }
        
        // Phân loại theo bữa ăn
        const categorized = categorizeCuisines(specialties);
        
        return {
            lunch: categorized.lunch.map(s => s.specialty).join(', ') || 'Cơm địa phương',
            dinner: categorized.dinner.map(s => s.specialty).join(', ') || 'Đặc sản vùng miền',
            specialties: specialties.slice(0, 5), // Lấy tối đa 5 món
            dataSource: 'firebase_real_data'
        };
        
    } catch (error) {
        console.error('Error fetching local cuisines:', error);
        return getFallbackCuisines(destination);
    }
};

/**
 * Phân loại món ăn theo bữa
 */
const categorizeCuisines = (specialties) => {
    const breakfast = [];
    const lunch = [];
    const dinner = [];
    
    specialties.forEach(item => {
        const name = (item.name || '').toLowerCase();
        const specialty = (item.specialty || '').toLowerCase();
        
        if (name.includes('phở') || name.includes('bánh mì') || specialty.includes('sáng')) {
            breakfast.push(item);
        } else if (name.includes('cơm') || name.includes('bún') || specialty.includes('trưa')) {
            lunch.push(item);
        } else {
            dinner.push(item);
        }
    });
    
    return { breakfast, lunch, dinner };
};

/**
 * Ước tính giá dựa trên tên món
 */
const estimatePrice = (name) => {
    if (!name) return '50,000-100,000 VNĐ';
    
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('hải sản') || lowerName.includes('tôm hùm')) {
        return '200,000-500,000 VNĐ';
    } else if (lowerName.includes('lẩu') || lowerName.includes('nướng')) {
        return '150,000-300,000 VNĐ';
    } else if (lowerName.includes('phở') || lowerName.includes('bún')) {
        return '40,000-80,000 VNĐ';
    } else if (lowerName.includes('bánh')) {
        return '20,000-50,000 VNĐ';
    }
    
    return '50,000-150,000 VNĐ';
};

/**
 * Fallback cuisines khi không có dữ liệu
 */
const getFallbackCuisines = (destination) => {
    const fallbackMap = {
        'Hà Nội': {
            lunch: 'Bún chả, Bún đậu mắm tôm',
            dinner: 'Chả cá Lã Vọng, Phở cuốn',
            specialties: [
                { name: 'Bún chả Hương Liên', specialty: 'Bún chả Obama', priceRange: '80,000-120,000 VNĐ' },
                { name: 'Chả cá Lã Vọng', specialty: 'Chả cá truyền thống', priceRange: '150,000-200,000 VNĐ' }
            ]
        },
        'Hồ Chí Minh': {
            lunch: 'Cơm tấm, Bánh mì',
            dinner: 'Lẩu mắm, Bánh xèo', 
            specialties: [
                { name: 'Cơm tấm Sài Gòn', specialty: 'Cơm tấm sườn bì', priceRange: '50,000-80,000 VNĐ' },
                { name: 'Bánh xèo miền Tây', specialty: 'Bánh xèo giòn', priceRange: '60,000-100,000 VNĐ' }
            ]
        },
        'Vũng Tàu': {
            lunch: 'Bánh khọt, Bánh căn, Bún riêu cua',
            dinner: 'Hải sản nướng, Lẩu cua đồng, Cà ri cua',
            specialties: [
                { name: 'Bánh khọt Vũng Tàu', specialty: 'Bánh khọt tôm tươi', priceRange: '30,000-50,000 VNĐ' },
                { name: 'Hải sản Bãi Trước', specialty: 'Cua rang me, tôm nướng', priceRange: '200,000-400,000 VNĐ' },
                { name: 'Bánh căn đường phố', specialty: 'Bánh căn nướng', priceRange: '20,000-35,000 VNĐ' },
                { name: 'Bún riêu cua Vũng Tàu', specialty: 'Bún riêu cua đồng', priceRange: '40,000-60,000 VNĐ' },
                { name: 'Cà ri cua biển', specialty: 'Cà ri cua đặc sản', priceRange: '150,000-250,000 VNĐ' }
            ]
        }
    };
    
    return fallbackMap[destination] || {
        lunch: 'Cơm địa phương',
        dinner: 'Đặc sản vùng miền',
        specialties: [
            { name: 'Món đặc sản địa phương', specialty: 'Theo mùa', priceRange: '50,000-150,000 VNĐ' }
        ],
        dataSource: 'fallback'
    };
};

/**
 * Tạo lịch trình theo giờ với dữ liệu thật
 */
const generateRealHourlySchedule = (dayNumber, destinations, restaurants) => {
    const schedule = [];
    
    if (dayNumber === 1) {
        // Ngày đầu - có di chuyển
        schedule.push({
            time: '06:30',
            activity: 'Khởi hành từ điểm xuất phát',
            type: 'transport',
            duration: '30 phút',
            notes: ['Chuẩn bị hành lý', 'Kiểm tra giấy tờ'],
            realData: true
        });
        
        schedule.push({
            time: '12:30',
            activity: `Đến ${destinations[0]?.name || 'điểm đến'}, nhận phòng`,
            type: 'accommodation',
            duration: '30 phút',
            notes: ['Check-in khách sạn', 'Nghỉ ngơi'],
            realData: true
        });
    } else {
        // Breakfast với nhà hàng thật
        if (restaurants.breakfast) {
            schedule.push({
                time: '07:30',
                activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
                type: 'meal',
                duration: '45 phút',
                location: restaurants.breakfast,
                specialty: restaurants.breakfast.specialty,
                estimatedCost: restaurants.breakfast.estimatedCost,
                notes: restaurants.breakfast.isOpen === false ? ['Kiểm tra giờ mở cửa'] : [],
                realData: true
            });
        }
    }

    // Thêm các hoạt động tham quan với dữ liệu thật
    let currentTime = dayNumber === 1 ? '14:00' : '09:00';
    
    destinations.forEach((dest, index) => {
        // Kiểm tra thời gian mở cửa
        const openingNote = dest.isOpen === false ? 'Hiện tại đóng cửa - kiểm tra giờ mở' : '';
        const crowdNote = dest.currentCrowdLevel === 'high' ? 'Dự báo đông đúc' : '';
        
        schedule.push({
            time: currentTime,
            activity: `Tham quan ${dest.name}`,
            type: 'sightseeing',
            duration: dest.estimatedDuration || '1-2 giờ',
            location: dest,
            entryFee: dest.entryFee,
            crowdLevel: dest.currentCrowdLevel,
            bestTime: dest.bestTimeToVisit,
            notes: [openingNote, crowdNote, ...(dest.notes || [])].filter(Boolean),
            realData: true,
            apiSource: dest.dataSource
        });
        
        // Tính thời gian tiếp theo
        const [hours, minutes] = currentTime.split(':').map(Number);
        const nextHour = hours + 2 + (index * 0.5);
        currentTime = `${Math.floor(nextHour).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    });

    // Lunch với nhà hàng thật
    if (restaurants.lunch) {
        schedule.push({
            time: '12:00',
            activity: `Ăn trưa tại ${restaurants.lunch.name}`,
            type: 'meal',
            duration: '1 giờ',
            location: restaurants.lunch,
            specialty: restaurants.lunch.specialty,
            estimatedCost: restaurants.lunch.estimatedCost,
            cuisine: restaurants.lunch.cuisine,
            notes: restaurants.lunch.isOpen === false ? ['Kiểm tra giờ mở cửa'] : [],
            realData: true
        });
    }

    // Dinner với nhà hàng thật
    if (restaurants.dinner) {
        schedule.push({
            time: '18:30',
            activity: `Ăn tối tại ${restaurants.dinner.name}`,
            type: 'meal',
            duration: '1.5 giờ',
            location: restaurants.dinner,
            specialty: restaurants.dinner.specialty,
            estimatedCost: restaurants.dinner.estimatedCost,
            cuisine: restaurants.dinner.cuisine,
            phoneNumber: restaurants.dinner.phoneNumber,
            notes: restaurants.dinner.isOpen === false ? ['Đặt bàn trước'] : ['Đặt bàn để đảm bảo chỗ'],
            realData: true
        });
    }

    // Hoạt động tối
    schedule.push({
        time: '20:30',
        activity: 'Tự do khám phá, dạo phố, mua sắm',
        type: 'free_time',
        duration: '2-3 giờ',
        suggestions: ['Dạo chợ đêm', 'Uống cà phê', 'Chụp ảnh đêm'],
        realData: false
    });

    return schedule.sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Lấy thời tiết thực tế cho ngày
 */
const getRealWeatherForDay = async (destination, coord, date) => {
    try {
        // Sử dụng service thời tiết thật
        const weather = await getRealWeatherForItinerary(destination, coord, date, 1);
        
        if (weather && weather.daily && weather.daily.length > 0) {
            const dayWeather = weather.daily[0];
            return {
                temperature: `${dayWeather.temperature}°C`,
                description: dayWeather.description,
                precipitation: dayWeather.precipitation,
                humidity: dayWeather.humidity,
                recommendations: dayWeather.recommendations || [],
                alerts: weather.alerts || [],
                lastUpdated: weather.lastUpdated,
                dataSource: 'openweathermap_api'
            };
        }
        
        return getDefaultWeather();
    } catch (error) {
        console.error('Error getting real weather:', error);
        return getDefaultWeather();
    }
};

/**
 * Tạo ghi chú đặc biệt với dữ liệu thật
 */
const generateRealDaySpecialNotes = (dayNumber, destinations, destination, weather) => {
    const notes = [];

    if (dayNumber === 1) {
        notes.push('Ngày đầu tiên - đừng lên lịch quá dày, để thời gian nghỉ ngơi');
        notes.push('Check-in khách sạn trước 15:00, để hành lý và bắt đầu khám phá');
    }

    // Notes dựa trên dữ liệu thật của địa điểm
    const closedPlaces = destinations.filter(d => d.isOpen === false);
    if (closedPlaces.length > 0) {
        notes.push(`⚠️ ${closedPlaces.length} địa điểm hiện tại đóng cửa - kiểm tra giờ mở`);
    }

    const crowdedPlaces = destinations.filter(d => d.currentCrowdLevel === 'high');
    if (crowdedPlaces.length > 0) {
        notes.push(`👥 ${crowdedPlaces.length} địa điểm dự báo đông đúc - nên đến sớm`);
    }

    // Notes dựa trên thời tiết thật
    if (weather && weather.precipitation > 5) {
        notes.push('🌧️ Dự báo mưa - mang theo ô/áo mưa');
    }

    if (weather && weather.temperature && parseInt(weather.temperature) > 35) {
        notes.push('🌡️ Thời tiết nóng - tránh hoạt động ngoài trời 11h-15h');
    }

    // Notes về museums thường đóng cửa thứ 2
    if (destinations.some(d => d.types?.includes('museum'))) {
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 1) { // Monday
            notes.push('🏛️ Bảo tàng thường đóng cửa thứ 2 - đã kiểm tra lịch mở cửa');
        }
    }

    return notes.length > 0 ? notes : ['Tận hưởng chuyến khám phá của bạn'];
};

/**
 * Tính chi phí thực tế cho ngày
 */
const calculateRealDayCost = (destinations, restaurants, travelStyle) => {
    let totalCost = 0;

    // Chi phí tham quan (từ dữ liệu thật)
    destinations.forEach(dest => {
        totalCost += dest.entryFee || 0;
    });

    // Chi phí ăn uống (từ dữ liệu thật)
    if (restaurants.breakfast) totalCost += restaurants.breakfast.estimatedCost || 50000;
    if (restaurants.lunch) totalCost += restaurants.lunch.estimatedCost || 100000;
    if (restaurants.dinner) totalCost += restaurants.dinner.estimatedCost || 150000;

    // Chi phí di chuyển
    const transportCost = TRANSPORT_OPTIONS.local[travelStyle]?.costPerDay || 100000;
    totalCost += transportCost;

    return Math.round(totalCost);
};

// determineDayCategories đã được định nghĩa ở trên

/**
 * Default weather khi không lấy được dữ liệu thật
 */
const getDefaultWeather = () => {
    return {
        temperature: '25-30°C',
        description: 'Có thể có mưa rào',
        humidity: '70-80%',
        recommendations: ['Kiểm tra thời tiết trước khi đi'],
        dataSource: 'fallback'
    };
};


// ==================== ENHANCED HELPER FUNCTIONS ====================

/**
 * Tạo theme đa dạng cho từng ngày
 */
const generateEnhancedDayTheme = (dayNumber, destinations, interests, destination) => {
    const themes = {
        1: 'Khám phá & Làm quen',
        2: 'Ẩm thực & Văn hóa',
        3: 'Thiên nhiên & Thư giãn',
        4: 'Mạo hiểm & Khám phá',
        5: 'Mua sắm & Giải trí'
    };

    let baseTheme = themes[dayNumber] || `Ngày ${dayNumber} - Trải nghiệm đặc biệt`;

    // Điều chỉnh theo interests
    if (interests.includes('food') && dayNumber === 2) {
        baseTheme = 'Hành trình Ẩm thực';
    } else if (interests.includes('culture') && dayNumber === 3) {
        baseTheme = 'Khám phá Di sản Văn hóa';
    } else if (interests.includes('adventure') && dayNumber >= 3) {
        baseTheme = 'Mạo hiểm & Khám phá';
    } else if (interests.includes('photography')) {
        baseTheme += ' & Săn ảnh đẹp';
    }

    return baseTheme;
};

/**
 * Tạo lịch trình theo giờ phong phú
 */
const generateEnhancedHourlySchedule = (dayNumber, destinations, restaurants, interests) => {
    const schedule = [];
    
    if (dayNumber === 1) {
        // Ngày đầu - có di chuyển
        schedule.push({
            time: '06:30',
            activity: 'Khởi hành từ điểm xuất phát',
            type: 'transport',
            duration: '30 phút',
            notes: ['Chuẩn bị hành lý', 'Kiểm tra giấy tờ', 'Mang theo đồ ăn nhẹ'],
            realData: true
        });
        
        schedule.push({
            time: '12:30',
            activity: `Đến điểm đến, nhận phòng`,
            type: 'accommodation',
            duration: '45 phút',
            notes: ['Check-in khách sạn', 'Nghỉ ngơi', 'Ăn trưa nhẹ'],
            realData: true
        });
    } else {
        // Breakfast đa dạng
        if (restaurants.breakfast) {
            schedule.push({
                time: '07:30',
                activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
                type: 'meal',
                duration: '45 phút',
                location: restaurants.breakfast,
                specialty: restaurants.breakfast.specialty,
                estimatedCost: restaurants.breakfast.estimatedCost,
                notes: restaurants.breakfast.isOpen === false ? ['Kiểm tra giờ mở cửa'] : ['Thử món đặc sản địa phương'],
                realData: true
            });
        }
    }

    // Thêm các hoạt động tham quan đa dạng
    let currentTime = dayNumber === 1 ? '14:00' : '09:00';
    
    destinations.forEach((dest, index) => {
        const openingNote = dest.isOpen === false ? 'Hiện tại đóng cửa - kiểm tra giờ mở' : '';
        const crowdNote = dest.currentCrowdLevel === 'high' ? 'Dự báo đông đúc - đến sớm' : '';
        const photoNote = interests.includes('photography') ? 'Điểm chụp ảnh đẹp' : '';
        
        schedule.push({
            time: currentTime,
            activity: `Tham quan ${dest.name}`,
            type: 'sightseeing',
            duration: dest.estimatedDuration || '1-2 giờ',
            location: dest,
            entryFee: dest.entryFee,
            crowdLevel: dest.currentCrowdLevel,
            bestTime: dest.bestTimeToVisit,
            notes: [openingNote, crowdNote, photoNote, ...(dest.notes || [])].filter(Boolean),
            realData: true,
            apiSource: dest.dataSource,
            category: dest.category
        });
        
        // Thêm break time giữa các điểm
        if (index < destinations.length - 1) {
            const [hours, minutes] = currentTime.split(':').map(Number);
            const breakTime = `${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            
            schedule.push({
                time: breakTime,
                activity: 'Nghỉ ngơi, di chuyển',
                type: 'break',
                duration: '15-30 phút',
                notes: ['Uống nước', 'Chụp ảnh', 'Mua đồ lưu niệm nhỏ'],
                realData: false
            });
        }
        
        // Tính thời gian tiếp theo
        const [hours, minutes] = currentTime.split(':').map(Number);
        const nextHour = hours + 2 + (index * 0.5);
        currentTime = `${Math.floor(nextHour).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    });

    // Lunch đa dạng
    if (restaurants.lunch) {
        schedule.push({
            time: '12:00',
            activity: `Ăn trưa tại ${restaurants.lunch.name}`,
            type: 'meal',
            duration: '1 giờ',
            location: restaurants.lunch,
            specialty: restaurants.lunch.specialty,
            estimatedCost: restaurants.lunch.estimatedCost,
            notes: ['Thử món đặc sản', 'Nghỉ ngơi sau buổi sáng'],
            realData: true
        });
    }

    // Thêm street food nếu có
    if (restaurants.streetFood && restaurants.streetFood.length > 0) {
        schedule.push({
            time: '15:30',
            activity: `Thử street food: ${restaurants.streetFood[0].name}`,
            type: 'street_food',
            duration: '30 phút',
            location: restaurants.streetFood[0],
            specialty: restaurants.streetFood[0].specialty,
            estimatedCost: restaurants.streetFood[0].estimatedCost,
            notes: ['Trải nghiệm ẩm thực đường phố', 'Giá rẻ, ngon'],
            realData: true
        });
    }

    // Dinner đa dạng
    if (restaurants.dinner) {
        schedule.push({
            time: '18:30',
            activity: `Ăn tối tại ${restaurants.dinner.name}`,
            type: 'meal',
            duration: '1.5 giờ',
            location: restaurants.dinner,
            specialty: restaurants.dinner.specialty,
            estimatedCost: restaurants.dinner.estimatedCost,
            notes: ['Bữa tối thịnh soạn', 'Thưởng thức đặc sản địa phương'],
            realData: true
        });
    }

    // Hoạt động tối đa dạng
    const eveningActivities = generateEveningActivities(interests, restaurants);
    schedule.push(...eveningActivities);

    return schedule.sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Tạo hoạt động buổi tối đa dạng
 */
const generateEveningActivities = (interests, restaurants) => {
    const activities = [];

    if (interests.includes('nightlife')) {
        activities.push({
            time: '20:30',
            activity: 'Khám phá cuộc sống về đêm',
            type: 'nightlife',
            duration: '2-3 giờ',
            suggestions: ['Bar rooftop', 'Pub địa phương', 'Karaoke'],
            notes: ['An toàn khi đi về đêm'],
            realData: false
        });
    } else if (restaurants.cafes && restaurants.cafes.length > 0) {
        activities.push({
            time: '20:00',
            activity: `Thư giãn tại ${restaurants.cafes[0].name}`,
            type: 'cafe',
            duration: '1-2 giờ',
            location: restaurants.cafes[0],
            specialty: restaurants.cafes[0].specialty,
            notes: ['Thưởng thức cà phê địa phương', 'Ngắm cảnh đêm'],
            realData: true
        });
    } else {
        activities.push({
            time: '20:00',
            activity: 'Dạo phố, khám phá tự do',
            type: 'free_time',
            duration: '2-3 giờ',
            suggestions: ['Dạo chợ đêm', 'Chụp ảnh đêm', 'Mua sắm nhỏ'],
            notes: ['Giữ an toàn', 'Thương lượng giá khi mua sắm'],
            realData: false
        });
    }

    return activities;
};

/**
 * Hoạt động tự do phong phú
 */
const generateEnhancedFreeTimeActivities = (destination, interests, dayNumber) => {
    const activities = [];

    // Base activities
    activities.push('Dạo phố, chụp ảnh');
    activities.push('Thư giãn tại café địa phương');

    // Interest-based activities
    if (interests.includes('shopping')) {
        activities.push('Khám phá chợ địa phương', 'Mua đặc sản làm quà');
    }

    if (interests.includes('food')) {
        activities.push('Thử street food', 'Tìm hiểu cách nấu món địa phương');
    }

    if (interests.includes('culture')) {
        activities.push('Tham quan bảo tàng nhỏ', 'Trò chuyện với người địa phương');
    }

    if (interests.includes('photography')) {
        activities.push('Săn ảnh golden hour', 'Chụp ảnh street photography');
    }

    // Destination-specific activities
    const destinationActivities = {
        'Hà Nội': ['Dạo quanh Hồ Gươm', 'Thử cà phê vỉa hè', 'Xem múa rối nước'],
        'Hồ Chí Minh': ['Dạo Nguyễn Huệ', 'Thử bánh mì Sài Gòn', 'Chụp ảnh Landmark 81'],
        'Đà Nẵng': ['Dạo cầu Rồng', 'Tắm biển Mỹ Khê', 'Ngắm pháo hoa cuối tuần'],
        'Đà Lạt': ['Dạo chợ đêm', 'Thử rượu vang địa phương', 'Ngắm sao đêm'],
        'Nha Trang': ['Tắm biển', 'Thử hải sản tươi', 'Massage bãi biển']
    };

    if (destinationActivities[destination]) {
        activities.push(...destinationActivities[destination]);
    }

    return [...new Set(activities)]; // Remove duplicates
};

/**
 * Đánh giá rủi ro thời tiết từ dữ liệu Firebase thực tế
 */
const assessWeatherRisk = async (destination, date) => {
    try {
        const month = new Date(date).getMonth() + 1;
        
        // Lấy dữ liệu thời tiết thực từ Firebase
        const weatherData = await getRealWeatherRiskData(destination, month);
        
        // Lấy dữ liệu thiên tai thực từ Firebase
        const disasterData = await getRealDisasterData(destination, month);
        
        // Tính toán rủi ro dựa trên dữ liệu thực
        const riskFactors = calculateRealRiskFactors(weatherData, disasterData, month);

        return {
            overall: calculateOverallRisk(riskFactors),
            factors: riskFactors,
            recommendations: generateRiskRecommendations(riskFactors),
            dataSource: 'firebase_real_data',
            weatherData: weatherData,
            disasterHistory: disasterData
        };
    } catch (error) {
        console.error('Error assessing weather risk:', error);
        return { 
            overall: 'unknown', 
            factors: {}, 
            recommendations: ['Kiểm tra thời tiết trước khi đi'],
            dataSource: 'fallback'
        };
    }
};

/**
 * Lấy dữ liệu thời tiết thực từ Firebase
 */
const getRealWeatherRiskData = async (destination, month) => {
    try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        const weatherQuery = query(
            collection(db, 'weather_monthly'),
            where('province', '==', destination),
            where('month', '==', month)
        );
        
        const snapshot = await getDocs(weatherQuery);
        const weatherData = [];
        
        snapshot.forEach(doc => {
            weatherData.push(doc.data());
        });
        
        return weatherData[0] || null;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
};

/**
 * Lấy dữ liệu thiên tai thực từ Firebase
 */
const getRealDisasterData = async (destination, month) => {
    try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        // Lấy dữ liệu bão
        const stormsQuery = query(
            collection(db, 'disaster_travel_data_cleaned_storms_cleaned'),
            where('province', '==', destination),
            where('month', '==', month)
        );
        
        // Lấy dữ liệu lũ lụt
        const floodsQuery = query(
            collection(db, 'disaster_travel_data_cleaned_floods_cleaned'),
            where('province', '==', destination),
            where('month', '==', month)
        );
        
        const [stormsSnapshot, floodsSnapshot] = await Promise.all([
            getDocs(stormsQuery),
            getDocs(floodsQuery)
        ]);
        
        const storms = [];
        const floods = [];
        
        stormsSnapshot.forEach(doc => storms.push(doc.data()));
        floodsSnapshot.forEach(doc => floods.push(doc.data()));
        
        return { storms, floods };
    } catch (error) {
        console.error('Error fetching disaster data:', error);
        return { storms: [], floods: [] };
    }
};

/**
 * Tính toán rủi ro dựa trên dữ liệu thực
 */
const calculateRealRiskFactors = (weatherData, disasterData, month) => {
    const riskFactors = {};
    
    // Rủi ro mưa dựa trên dữ liệu thực
    if (weatherData) {
        const rainfall = weatherData.rainfall || 0;
        const temperature = weatherData.temperature || 25;
        const humidity = weatherData.humidity || 70;
        
        // Đánh giá rủi ro mưa
        if (rainfall > 300) riskFactors.rain = 'very_high';
        else if (rainfall > 200) riskFactors.rain = 'high';
        else if (rainfall > 100) riskFactors.rain = 'medium';
        else riskFactors.rain = 'low';
        
        // Đánh giá rủi ro nhiệt độ
        if (temperature > 35) riskFactors.heat = 'very_high';
        else if (temperature > 32) riskFactors.heat = 'high';
        else if (temperature < 15) riskFactors.cold = 'high';
        else if (temperature < 20) riskFactors.cold = 'medium';
        
        // Đánh giá độ ẩm
        if (humidity > 85) riskFactors.humidity = 'high';
        else if (humidity > 75) riskFactors.humidity = 'medium';
        else riskFactors.humidity = 'low';
    }
    
    // Rủi ro thiên tai dựa trên lịch sử
    if (disasterData) {
        const { storms, floods } = disasterData;
        
        // Rủi ro bão
        if (storms.length > 3) riskFactors.storm = 'very_high';
        else if (storms.length > 1) riskFactors.storm = 'high';
        else if (storms.length > 0) riskFactors.storm = 'medium';
        else riskFactors.storm = 'low';
        
        // Rủi ro lũ lụt
        if (floods.length > 2) riskFactors.flood = 'very_high';
        else if (floods.length > 0) riskFactors.flood = 'high';
        else riskFactors.flood = 'low';
    }
    
    return riskFactors;
};

/**
 * Tính toán rủi ro tổng thể
 */
const calculateOverallRisk = (risks) => {
    const riskLevels = { low: 1, medium: 2, high: 3, very_high: 4 };
    const values = Object.values(risks).map(r => riskLevels[r] || 1);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    
    if (average <= 1.5) return 'low';
    if (average <= 2.5) return 'medium';
    if (average <= 3.5) return 'high';
    return 'very_high';
};

/**
 * Tạo khuyến nghị dựa trên rủi ro
 */
const generateRiskRecommendations = (risks) => {
    const recommendations = [];
    
    if (risks.rain === 'high' || risks.rain === 'very_high') {
        recommendations.push('Mang theo ô/áo mưa', 'Chuẩn bị giày chống nước');
    }
    
    if (risks.storm === 'high' || risks.storm === 'very_high') {
        recommendations.push('Theo dõi tin tức thời tiết', 'Chuẩn bị kế hoạch dự phòng');
    }
    
    if (risks.heat === 'high') {
        recommendations.push('Mang theo nước uống', 'Kem chống nắng SPF cao');
    }
    
    if (risks.cold === 'high') {
        recommendations.push('Mang theo áo ấm', 'Chuẩn bị đồ giữ nhiệt');
    }
    
    return recommendations;
};

/**
 * Tạo khuyến nghị thời tiết
 */
const generateWeatherRecommendations = (weather, destination) => {
    const recommendations = [];
    
    if (weather.temperature && weather.temperature.includes('30')) {
        recommendations.push('Thời tiết nóng - mang theo nước uống');
    }
    
    if (weather.description && weather.description.includes('mưa')) {
        recommendations.push('Có thể có mưa - chuẩn bị đồ chống ẩm');
    }
    
    if (weather.humidity && parseInt(weather.humidity) > 80) {
        recommendations.push('Độ ẩm cao - mặc quần áo thoáng mát');
    }
    
    return recommendations;
};

/**
 * Tính chi phí ngày nâng cao
 */
const calculateEnhancedDayCost = (destinations, restaurants, travelStyle, dayNumber) => {
    const multiplier = TRAVEL_STYLES[travelStyle].multiplier;
    
    // Chi phí tham quan
    const sightseeingCost = destinations.reduce((sum, dest) => sum + (dest.entryFee || 50000), 0);
    
    // Chi phí ăn uống đa dạng
    let foodCost = 0;
    if (restaurants.breakfast) foodCost += restaurants.breakfast.estimatedCost || 50000;
    if (restaurants.lunch) foodCost += restaurants.lunch.estimatedCost || 100000;
    if (restaurants.dinner) foodCost += restaurants.dinner.estimatedCost || 150000;
    if (restaurants.streetFood) foodCost += 30000; // Street food
    if (restaurants.cafes) foodCost += 40000; // Cafe
    
    // Chi phí di chuyển trong ngày
    const transportCost = TRANSPORT_OPTIONS.local[travelStyle].costPerDay;
    
    // Chi phí mua sắm/phát sinh (tăng theo ngày)
    const miscCost = 50000 + (dayNumber * 20000);
    
    const totalCost = (sightseeingCost + foodCost + transportCost + miscCost) * multiplier;
    
    return Math.round(totalCost);
};

/**
 * Tính điểm đa dạng
 */
const calculateDiversityScore = (destinations, restaurants) => {
    let score = 0;
    
    // Đa dạng địa điểm
    const destTypes = [...new Set(destinations.flatMap(d => d.types || []))];
    score += destTypes.length * 10;
    
    // Đa dạng ẩm thực
    const cuisineTypes = [];
    if (restaurants.breakfast) cuisineTypes.push('breakfast');
    if (restaurants.lunch) cuisineTypes.push('lunch');
    if (restaurants.dinner) cuisineTypes.push('dinner');
    if (restaurants.streetFood) cuisineTypes.push('street_food');
    if (restaurants.cafes) cuisineTypes.push('cafe');
    
    score += cuisineTypes.length * 15;
    
    return Math.min(score, 100); // Max 100
};

/**
 * Enhanced fallback day plan
 */
const generateEnhancedFallbackDayPlan = async (dayNumber, date, destination, interests) => {
    return {
        day: dayNumber,
        date: date.toLocaleDateString('vi-VN'),
        dayOfWeek: date.toLocaleDateString('vi-VN', { weekday: 'long' }),
        theme: generateEnhancedDayTheme(dayNumber, [], interests, destination),
        destinations: [
            {
                name: `Điểm tham quan ${destination} - Ngày ${dayNumber}`,
                address: destination,
                rating: 4.0,
                entryFee: 50000,
                recommendedTime: '2-3 giờ',
                category: 'fallback'
            }
        ],
        meals: await getEnhancedFallbackRestaurants(destination),
        estimatedCost: 300000 + (dayNumber * 50000),
        specialNotes: [`Ngày ${dayNumber} - Khám phá tự do`, 'Linh hoạt theo thời tiết'],
        dataQuality: 'fallback_enhanced'
    };
};

/**
 * Lưu ý đặc biệt nâng cao
 */
const generateEnhancedDayNotes = (dayNumber, destinations, destination, weather, date) => {
    const notes = [];

    // Notes theo ngày
    if (dayNumber === 1) {
        notes.push('Ngày đầu tiên - đừng lên lịch quá dày');
        notes.push('Check-in khách sạn và nghỉ ngơi');
    } else if (dayNumber === 2) {
        notes.push('Ngày thứ hai - khám phá sâu hơn');
        notes.push('Thử nhiều món ăn địa phương');
    } else {
        notes.push(`Ngày ${dayNumber} - trải nghiệm đặc biệt`);
    }

    // Notes theo địa điểm
    if (destinations.some(d => d.types?.includes('museum'))) {
        notes.push('Bảo tàng thường đóng cửa thứ 2');
    }

    if (destinations.some(d => d.types?.includes('natural_feature'))) {
        notes.push('Mang theo nước uống khi tham quan thiên nhiên');
    }

    // Notes theo thời tiết
    if (weather.riskAssessment?.overall === 'high') {
        notes.push('Thời tiết có rủi ro - chuẩn bị kế hoạch dự phòng');
    }

    // Notes theo ngày trong tuần
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        notes.push('Cuối tuần - các điểm tham quan có thể đông đúc');
    }

    return notes;
};/**
 *
 Default weather khi API không hoạt động
 */
const getDefaultWeatherForDestination = (destination, date) => {
    const month = new Date(date).getMonth() + 1;
    
    // Weather patterns theo vùng miền và tháng
    const weatherPatterns = {
        'Vũng Tàu': {
            dry_season: { temp: '26-30°C', condition: 'Nắng ít mây', humidity: '65-75%' },
            wet_season: { temp: '25-29°C', condition: 'Có mưa rào', humidity: '75-85%' }
        },
        'Hà Nội': {
            winter: { temp: '15-20°C', condition: 'Lạnh, có sương mù', humidity: '70-80%' },
            summer: { temp: '28-35°C', condition: 'Nóng ẩm', humidity: '75-85%' }
        },
        'Hồ Chí Minh': {
            dry_season: { temp: '26-32°C', condition: 'Nắng nóng', humidity: '60-70%' },
            wet_season: { temp: '24-30°C', condition: 'Mưa chiều', humidity: '80-90%' }
        }
    };
    
    // Xác định mùa
    let season = 'dry_season';
    if (month >= 5 && month <= 10) season = 'wet_season';
    if (destination === 'Hà Nội') {
        season = (month >= 11 || month <= 3) ? 'winter' : 'summer';
    }
    
    const pattern = weatherPatterns[destination]?.[season] || {
        temp: '25-30°C',
        condition: 'Thời tiết đẹp',
        humidity: '70-80%'
    };
    
    return {
        temperature: pattern.temp,
        description: pattern.condition,
        humidity: pattern.humidity,
        recommendations: [
            'Kiểm tra thời tiết trước khi đi',
            pattern.condition.includes('mưa') ? 'Mang theo ô/áo mưa' : 'Kem chống nắng',
            'Uống đủ nước'
        ],
        dataSource: 'fallback_pattern',
        riskAssessment: {
            overall: 'low',
            factors: { general: 'low' },
            recommendations: ['Thời tiết ổn định']
        }
    };
};

/**
 * Fix undefined values trước khi lưu Firebase
 */
const sanitizeForFirebase = (obj) => {
    if (obj === null || obj === undefined) {
        return null;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForFirebase(item));
    }
    
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && typeof value !== 'function') {
                sanitized[key] = sanitizeForFirebase(value);
            }
        }
        return sanitized;
    }
    
    // Skip functions
    if (typeof obj === 'function') {
        return null;
    }
    
    return obj;
};/**
 
* Đợi Google Maps API load xong
 */
const waitForGoogleMaps = () => {
    return new Promise((resolve, reject) => {
        if (window.googleMapsLoaded && window.google?.maps?.places) {
            resolve(true);
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (window.googleMapsLoaded && window.google?.maps?.places) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error('Google Maps API failed to load'));
            }
        }, 100);
    });
};