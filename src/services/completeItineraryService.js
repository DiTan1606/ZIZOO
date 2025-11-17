// src/services/completeItineraryService.js
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { searchPlacesByText, searchNearbyPlaces } from './placesService';
import { get7DayWeatherForecast } from './weatherService';
import { findRealPlacesByCategory, findRealRestaurants, getRealWeatherForItinerary } from './realTimeDataService';
import { startItineraryMonitoring } from './alertsAndAdjustmentsService';
import provinceCoords from '../assets/provinceCoord.json';
import { TRAVEL_STYLES, ACCOMMODATION_TYPES, TRANSPORT_OPTIONS } from '../constants';
import { formatMoney, getSeason, getClimate } from '../utils/commonUtils';
import transportDataService from './transportDataService';

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

        // 3. PHƯƠNG TIỆN DI CHUYỂN
        const transportPlan = await generateTransportPlan(preferences);

        // 4. LƯU TRÚ (tạo trước để có giá khách sạn)
        const accommodationPlan = await generateAccommodationPlan(preferences);

        // 5. DANH SÁCH CHI PHÍ DỰ KIẾN (tính sau khi có accommodation)
        const costBreakdown = await generateCostBreakdown(preferences, dailyItinerary, accommodationPlan);

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
            userId,
            summary: {
                totalDays: duration,
                totalNights: duration - 1,
                totalCost: costBreakdown.grandTotal,
                costPerPerson: Math.round(costBreakdown.grandTotal / travelers),
                totalDestinations: dailyItinerary.reduce((sum, day) => sum + day.destinations.length, 0),
                travelStyle: TRAVEL_STYLES[travelStyle].name
            }
        };

        // Lưu vào Firebase và lấy ID
        const itineraryId = await saveItineraryToFirebase(completeItinerary);
        completeItinerary.id = itineraryId;

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
    const { destination, startDate, duration, interests, travelStyle, budget, travelers } = preferences;
    const coord = provinceCoords[destination] || { lat: 16.047, lng: 108.220 };
    
    // Tính ngân sách hàng ngày
    const dailyBudget = budget ? (budget * 0.6) / (duration * travelers) : 500000; // 60% budget cho activities
    
    const dailyPlans = [];

    for (let day = 0; day < duration; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);

        // Tạo kế hoạch cho từng ngày với ngân sách
        const dayPlan = await generateSingleDayPlan(day + 1, currentDate, destination, coord, interests, travelStyle, dailyBudget, budget, travelers);
        dailyPlans.push(dayPlan);
    }

    return dailyPlans;
};

/**
 * Tạo kế hoạch cho một ngày cụ thể - CẢI THIỆN ĐA DẠNG
 */
const generateSingleDayPlan = async (dayNumber, date, destination, coord, interests, travelStyle, dailyBudget = 500000, budget = 5000000, travelers = 2) => {
    try {
        console.log(`📅 Generating DIVERSE day plan for Day ${dayNumber} in ${destination}...`);

        // Tìm địa điểm tham quan ĐA DẠNG (truyền thêm travelStyle và budget)
        const destinations = await findRealDestinationsForDay(dayNumber, destination, coord, interests, travelStyle, budget, travelers);
        
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
            estimatedCost: calculateEnhancedDayCost(destinations, restaurants, travelStyle, dayNumber, dailyBudget),
            
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

    // Thêm các hoạt động tham quan với thời gian di chuyển thực tế
    let currentTime = dayNumber === 1 ? '14:00' : '08:00';
    
    destinations.forEach((dest, index) => {
        schedule.push({
            time: currentTime,
            activity: `Tham quan ${dest.name}`,
            type: 'sightseeing',
            duration: dest.recommendedTime || dest.estimatedDuration || '1-2 giờ',
            location: dest,
            notes: dest.specialNotes || []
        });
        
        // Tính thời gian tiếp theo dựa trên thời gian tham quan + di chuyển
        const [hours, minutes] = currentTime.split(':').map(Number);
        
        // Thời gian tham quan (giả sử trung bình 1.5 giờ)
        let visitDuration = 1.5;
        if (dest.estimatedDuration) {
            const match = dest.estimatedDuration.match(/(\d+)/);
            if (match) visitDuration = parseFloat(match[0]);
        }
        
        // Thời gian di chuyển đến địa điểm tiếp theo
        let travelDuration = 0.5; // Mặc định 30 phút
        if (index < destinations.length - 1) {
            const nextDest = destinations[index + 1];
            const from = dest.address || dest.name;
            const to = nextDest.address || nextDest.name;
            
            // Thử lấy thời gian từ CSV
            const travelTime = transportDataService.getTravelTime(from, to);
            if (travelTime) {
                travelDuration = travelTime;
                console.log(`⏱️ Travel time ${from} → ${to}: ${travelTime}h`);
            } else {
                // Fallback: tính theo khoảng cách
                const distance = calculateDistance(
                    { lat: dest.lat || 0, lng: dest.lng || 0 },
                    { lat: nextDest.lat || 0, lng: nextDest.lng || 0 }
                );
                travelDuration = distance / 30; // 30km/h
            }
        }
        
        // Tổng thời gian = tham quan + di chuyển
        const totalHours = visitDuration + travelDuration;
        const nextHour = hours + totalHours;
        const nextMinutes = minutes;
        
        currentTime = `${Math.floor(nextHour).toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
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
const generateCostBreakdown = async (preferences, dailyItinerary, accommodationPlan = null) => {
    const { travelers, duration, travelStyle, departureCity, destination, budget } = preferences;
    
    // Tính chi phí THỰC TẾ (không giới hạn theo %)
    const transportCost = calculateTransportCost(departureCity, destination, travelers, travelStyle);
    const accommodationCost = calculateAccommodationCost(duration - 1, travelers, travelStyle, accommodationPlan);
    const foodCost = calculateFoodCost(dailyItinerary, travelers);
    const sightseeingCost = calculateSightseeingCost(dailyItinerary, travelers);
    const localTransportCost = calculateLocalTransportCost(duration, travelers, travelStyle);
    
    // Chi phí phát sinh 5%
    const subtotal = transportCost + accommodationCost + foodCost + sightseeingCost + localTransportCost;
    const contingencyCost = roundPrice(subtotal * 0.05);
    
    // Tổng cộng (làm tròn)
    const grandTotal = roundPrice(subtotal + contingencyCost);

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
 * Lấy danh sách khách sạn phù hợp
 */
const getHotelOptions = (destination, travelStyle, budget, travelers, nights) => {
    // Lấy danh sách khách sạn cho thành phố
    const cityHotels = HOTEL_OPTIONS[destination];
    
    if (!cityHotels || !cityHotels[travelStyle]) {
        // Fallback nếu không có dữ liệu
        return getDefaultHotelOptions(travelStyle, nights);
    }
    
    // Lấy khách sạn theo style
    let hotels = cityHotels[travelStyle];
    
    // Tính ngân sạch cho khách sạn (khoảng 30-35% tổng budget)
    const accommodationBudget = budget * 0.35;
    const budgetPerNight = accommodationBudget / nights;
    
    // Lọc theo ngân sách (lấy khách sạn có giá <= 150% budget)
    hotels = hotels.filter(hotel => hotel.pricePerNight <= budgetPerNight * 1.5);
    
    // Nếu không có khách sạn nào phù hợp, lấy tất cả
    if (hotels.length === 0) {
        hotels = cityHotels[travelStyle];
    }
    
    // Sort theo rating
    hotels.sort((a, b) => b.rating - a.rating);
    
    return hotels;
};

/**
 * Khách sạn mặc định nếu không có dữ liệu
 */
const getDefaultHotelOptions = (travelStyle, nights) => {
    const prices = {
        budget: 250000,
        standard: 500000,
        comfort: 1000000,
        luxury: 2000000
    };
    
    return [{
        name: `Khách sạn ${ACCOMMODATION_TYPES[travelStyle].type}`,
        rating: 4.0,
        pricePerNight: prices[travelStyle],
        location: 'Trung tâm',
        amenities: getRecommendedAmenities(travelStyle)
    }];
};

/**
 * 5. TẠO KẾ HOẠCH LƯU TRÚ
 */
const generateAccommodationPlan = async (preferences) => {
    const { destination, duration, travelers, travelStyle, startDate, budget } = preferences;
    
    const checkInDate = new Date(startDate);
    const checkOutDate = new Date(startDate);
    checkOutDate.setDate(checkOutDate.getDate() + duration - 1);
    const nights = duration - 1;
    
    // Lấy danh sách khách sạn thực tế
    const hotelOptions = getHotelOptions(destination, travelStyle, budget, travelers, nights);
    
    // Khách sạn được chọn mặc định (đầu tiên trong danh sách)
    const selectedHotel = hotelOptions[0];
    const totalCost = roundPrice(selectedHotel.pricePerNight * nights);

    return {
        duration: {
            nights: nights,
            checkIn: checkInDate.toLocaleDateString('vi-VN'),
            checkOut: checkOutDate.toLocaleDateString('vi-VN')
        },
        // Khách sạn được chọn (mặc định là option đầu tiên)
        selected: {
            ...selectedHotel,
            totalCost: totalCost,
            costPerNight: selectedHotel.pricePerNight
        },
        // Danh sách tất cả các tùy chọn
        options: hotelOptions.map(hotel => ({
            ...hotel,
            totalCost: roundPrice(hotel.pricePerNight * nights),
            costPerNight: hotel.pricePerNight
        })),
        bookingPlatforms: [
            { name: 'Booking.com', url: `https://booking.com/searchresults.html?ss=${destination}` },
            { name: 'Agoda', url: `https://agoda.com/search?city=${destination}` },
            { name: 'Traveloka', url: `https://traveloka.com/hotel/search?location=${destination}` }
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
            
        const results = await searchPlacesByText(searchQuery, coord, 20000, destination);
        
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
        
        // Lịch trình đã được lưu với userId trong complete_itineraries
        console.log('✅ Lịch trình đã được lưu với userId:', itinerary.userId);
        
        return docRef.id;
    } catch (error) {
        console.error('❌ Lỗi lưu lịch trình:', error);
        console.error('Itinerary data:', JSON.stringify(itinerary, null, 2));
        throw error;
    }
};

/**
 * Thêm hoạt động biển cho các điểm đến ven biển
 */
const addBeachActivities = (destination, interests) => {
    const coastalDestinations = [
        'vũng tàu', 'phan thiết', 'mũi né', 'nha trang', 'đà nẵng', 
        'hội an', 'phú quốc', 'quy nhon', 'sam son', 'cửa lò',
        'hạ long', 'cát bà', 'sầm sơn', 'thiên cầm'
    ];
    
    const isCoastal = coastalDestinations.some(coastal => 
        destination.toLowerCase().includes(coastal)
    );
    
    if (!isCoastal) return [];
    
    const beachActivities = [
        `swimming beaches ${destination}`,
        `water sports ${destination}`,
        `beach resorts ${destination}`,
        `fishing tours ${destination}`,
        `boat trips ${destination}`,
        `snorkeling ${destination}`,
        `diving spots ${destination}`,
        `beach volleyball ${destination}`,
        `jet ski rental ${destination}`,
        `parasailing ${destination}`,
        `beach bars ${destination}`,
        `seafood restaurants ${destination}`,
        `sunset viewing ${destination}`,
        `beach photography ${destination}`,
        `sand dunes ${destination}`,
        `fishing villages ${destination}`,
        `lighthouse ${destination}`,
        `coastal walks ${destination}`
    ];
    
    // Lọc theo interests
    if (interests.includes('adventure')) {
        return beachActivities.filter(activity => 
            activity.includes('water sports') || 
            activity.includes('diving') || 
            activity.includes('jet ski') ||
            activity.includes('parasailing')
        );
    }
    
    if (interests.includes('photography')) {
        return beachActivities.filter(activity => 
            activity.includes('sunset') || 
            activity.includes('lighthouse') || 
            activity.includes('photography') ||
            activity.includes('sand dunes')
        );
    }
    
    if (interests.includes('food')) {
        return beachActivities.filter(activity => 
            activity.includes('seafood') || 
            activity.includes('fishing') ||
            activity.includes('beach bars')
        );
    }
    
    if (interests.includes('relaxation')) {
        return beachActivities.filter(activity => 
            activity.includes('swimming') || 
            activity.includes('beach resorts') || 
            activity.includes('coastal walks')
        );
    }
    
    // Default beach activities
    return [
        `beaches ${destination}`,
        `water sports ${destination}`,
        `fishing villages ${destination}`,
        `sunset viewing ${destination}`
    ];
};

/**
 * Lấy thời gian phù hợp cho hoạt động dựa trên tên địa điểm
 */
const getOptimalTimeForActivity = (placeName, currentTime) => {
    const name = placeName.toLowerCase();
    const [hours] = currentTime.split(':').map(Number);
    
    // Sunset/Sunrise activities
    if (name.includes('sunset') || name.includes('hoàng hôn')) {
        return '17:30'; // 5:30 PM for sunset
    }
    if (name.includes('sunrise') || name.includes('bình minh')) {
        return '05:30'; // 5:30 AM for sunrise
    }
    
    // Beach activities - best in morning or late afternoon
    if (name.includes('beach') || name.includes('bãi biển') || name.includes('biển')) {
        if (hours < 10) return currentTime; // Morning is good
        if (hours > 16) return currentTime; // Late afternoon is good
        return '08:00'; // Default to morning
    }
    
    // Spa activities - afternoon/evening
    if (name.includes('spa') || name.includes('massage')) {
        if (hours < 14) return '15:00'; // Move to afternoon
        return currentTime;
    }
    
    // Market activities - morning
    if (name.includes('market') || name.includes('chợ')) {
        if (hours > 10) return '08:00'; // Markets are best in morning
        return currentTime;
    }
    
    // Temple/Religious sites - morning
    if (name.includes('temple') || name.includes('chùa') || name.includes('đền')) {
        if (hours > 16) return '09:00'; // Temples close early
        return currentTime;
    }
    
    return currentTime; // Default - no change
};

/**
 * Kiểm tra xem địa điểm có phù hợp với du lịch không
 */
const isTourismPlace = (place) => {
    const name = place.name?.toLowerCase() || '';
    const types = place.types || [];
    
    // Danh sách từ khóa KHÔNG phù hợp với du lịch
    const excludeKeywords = [
        'phòng khám', 'bệnh viện', 'hospital', 'clinic', 'medical',
        'ngân hàng', 'bank', 'atm', 'vietcombank', 'techcombank',
        'công ty', 'company', 'office', 'văn phòng',
        'trường học', 'school', 'university', 'đại học',
        'cửa hàng điện thoại', 'mobile', 'phone store',
        'garage', 'sửa chữa', 'repair', 'mechanic',
        'pharmacy', 'nhà thuốc', 'drugstore',
        'gas station', 'cửa hàng xăng', 'petrol',
        'real estate', 'bất động sản',
        'insurance', 'bảo hiểm',
        'law firm', 'luật sư', 'lawyer',
        'dentist', 'nha khoa', 'dental',
        'veterinary', 'thú y',
        'funeral', 'tang lễ',
        'government', 'chính phủ', 'ủy ban',
        'police', 'công an', 'cảnh sát',
        'post office', 'bưu điện',
        'rượu ngoại', 'liquor store', 'wine shop'
    ];
    
    // Danh sách types KHÔNG phù hợp
    const excludeTypes = [
        'hospital', 'doctor', 'dentist', 'pharmacy', 'veterinary_care',
        'bank', 'atm', 'finance', 'insurance_agency',
        'gas_station', 'car_repair', 'car_dealer', 'car_wash',
        'real_estate_agency', 'lawyer', 'accounting',
        'government', 'police', 'post_office',
        'school', 'university', 'library',
        'funeral_home', 'cemetery',
        'liquor_store', 'convenience_store'
    ];
    
    // Kiểm tra từ khóa loại trừ
    const hasExcludeKeyword = excludeKeywords.some(keyword => 
        name.includes(keyword)
    );
    
    // Kiểm tra types loại trừ
    const hasExcludeType = excludeTypes.some(type => 
        types.includes(type)
    );
    
    if (hasExcludeKeyword || hasExcludeType) {
        return false;
    }
    
    // Danh sách từ khóa và types PHÙ HỢP với du lịch
    const tourismKeywords = [
        'bãi biển', 'beach', 'biển', 'sea',
        'chùa', 'temple', 'pagoda', 'đền',
        'bảo tàng', 'museum', 'gallery',
        'công viên', 'park', 'garden', 'vườn',
        'núi', 'mountain', 'hill', 'đồi',
        'thác', 'waterfall', 'falls',
        'hồ', 'lake', 'pond', 'đầm',
        'cầu', 'bridge', 'cống',
        'tượng', 'statue', 'monument', 'đài',
        'lâu đài', 'castle', 'fortress', 'pháo đài',
        'lighthouse', 'hải đăng',
        'viewpoint', 'điểm ngắm', 'observation',
        'tourist attraction', 'điểm tham quan',
        'landmark', 'danh lam', 'thắng cảnh',
        'resort', 'khu nghỉ dưỡng',
        'spa', 'massage', 'wellness',
        'aquarium', 'thủy cung', 'zoo', 'vườn thú',
        'amusement park', 'khu vui chơi',
        'market', 'chợ', 'bazaar',
        'shopping mall', 'trung tâm thương mại',
        'restaurant', 'nhà hàng', 'quán ăn',
        'cafe', 'cà phê', 'coffee',
        'bar', 'pub', 'club', 'karaoke',
        'hotel', 'khách sạn', 'homestay'
    ];
    
    const tourismTypes = [
        'tourist_attraction', 'point_of_interest', 'establishment',
        'natural_feature', 'park', 'beach', 'museum',
        'place_of_worship', 'hindu_temple', 'buddhist_temple',
        'church', 'mosque', 'synagogue',
        'amusement_park', 'aquarium', 'zoo', 'campground',
        'lodging', 'restaurant', 'food', 'meal_takeaway',
        'cafe', 'bar', 'night_club',
        'shopping_mall', 'store', 'market',
        'spa', 'beauty_salon', 'gym', 'stadium',
        'movie_theater', 'bowling_alley', 'casino',
        'art_gallery', 'library', 'cultural_center'
    ];
    
    // Kiểm tra từ khóa du lịch
    const hasTourismKeyword = tourismKeywords.some(keyword => 
        name.includes(keyword)
    );
    
    // Kiểm tra types du lịch
    const hasTourismType = tourismTypes.some(type => 
        types.includes(type)
    );
    
    return hasTourismKeyword || hasTourismType;
};

/**
 * Calculate string similarity (Levenshtein distance)
 */
const calculateSimilarity = (str1, str2) => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
        for (let j = 1; j <= len1; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
};

/**
 * Generate interest-based queries for diverse destinations
 */
const generateInterestBasedQueries = (destination, interests, dayNumber) => {
    const interestQueries = {
        food: {
            primary: [`famous restaurants ${destination}`, `local food markets ${destination}`, `food streets ${destination}`],
            secondary: [`seafood restaurants ${destination}`, `traditional cuisine ${destination}`, `local specialties ${destination}`],
            tertiary: [`street food areas ${destination}`, `night markets ${destination}`, `food courts ${destination}`]
        },
        photography: {
            primary: [`scenic viewpoints ${destination}`, `beautiful landscapes ${destination}`, `photo spots ${destination}`],
            secondary: [`historic buildings ${destination}`, `architectural sites ${destination}`, `panoramic views ${destination}`],
            tertiary: [`sunset points ${destination}`, `observation decks ${destination}`, `lookout points ${destination}`]
        },
        adventure: {
            primary: [`adventure activities ${destination}`, `outdoor sports ${destination}`, `hiking trails ${destination}`],
            secondary: [`water sports ${destination}`, `beach activities ${destination}`, `mountain climbing ${destination}`],
            tertiary: [`adventure tours ${destination}`, `extreme sports ${destination}`, `outdoor adventures ${destination}`]
        },
        relaxation: {
            primary: [`beaches ${destination}`, `peaceful parks ${destination}`, `quiet gardens ${destination}`],
            secondary: [`spa resorts ${destination}`, `wellness centers ${destination}`, `relaxing spots ${destination}`],
            tertiary: [`serene lakes ${destination}`, `tranquil temples ${destination}`, `calm beaches ${destination}`]
        },
        culture: {
            primary: [`museums ${destination}`, `temples ${destination}`, `historical sites ${destination}`],
            secondary: [`cultural centers ${destination}`, `art galleries ${destination}`, `heritage buildings ${destination}`],
            tertiary: [`traditional markets ${destination}`, `cultural villages ${destination}`, `historic districts ${destination}`]
        },
        nature: {
            primary: [`beaches ${destination}`, `natural attractions ${destination}`, `scenic nature ${destination}`],
            secondary: [`sand dunes ${destination}`, `coastal areas ${destination}`, `fishing villages ${destination}`],
            tertiary: [`eco parks ${destination}`, `nature trails ${destination}`, `forest areas ${destination}`]
        }
    };

    // Combine queries based on user interests
    const result = { primary: [], secondary: [], tertiary: [] };
    
    interests.forEach(interest => {
        if (interestQueries[interest]) {
            result.primary.push(...interestQueries[interest].primary);
            result.secondary.push(...interestQueries[interest].secondary);
            result.tertiary.push(...interestQueries[interest].tertiary);
        }
    });

    // Add variety with random selection
    const shuffleArray = (array) => array.sort(() => 0.5 - Math.random());
    
    return {
        primary: shuffleArray(result.primary).slice(0, 4),
        secondary: shuffleArray(result.secondary).slice(0, 4),
        tertiary: shuffleArray(result.tertiary).slice(0, 4)
    };
};

/**
 * Lấy danh sách lịch trình của user
 */
export const getUserItineraries = async (userId) => {
    try {
        // Query trực tiếp từ complete_itineraries collection
        const completeItinerariesRef = collection(db, 'complete_itineraries');
        const q = query(
            completeItinerariesRef, 
            where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        const itineraries = [];
        
        querySnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            
            // Debug logging
            console.log('📅 Trip createdAt:', data.createdAt, 'Type:', typeof data.createdAt, 'Has toDate:', !!data.createdAt?.toDate);
            
            // Format data để match với MyTrips component
            itineraries.push({
                id: docSnap.id,
                tripName: data.header?.tripName || `Chuyến đi ${data.header?.destination?.main}`,
                destination: data.header?.destination?.main,
                startDate: data.header?.duration?.startDateISO || data.header?.duration?.startDate, // Ưu tiên ISO format
                duration: data.header?.duration?.days,
                travelers: typeof data.header?.travelers === 'object' 
                    ? data.header.travelers?.total || data.header.travelers?.adults || 2 
                    : data.header?.travelers || 2,
                budget: data.header?.budget?.total,
                createdAt: data.createdAt,
                status: 'active',
                fullItinerary: data // Toàn bộ data lịch trình
            });
        });
        
        // Sort by createdAt desc (client-side sorting)
        itineraries.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return dateB - dateA;
        });
        
        return itineraries;
    } catch (error) {
        console.error('Error getting user itineraries:', error);
        return [];
    }
};

/**
 * Xóa lịch trình của user
 */
export const deleteUserItinerary = async (userId, itineraryId) => {
    try {
        // Xóa trực tiếp từ complete_itineraries collection
        const itineraryRef = doc(db, 'complete_itineraries', itineraryId);
        const itineraryDoc = await getDoc(itineraryRef);
        
        if (itineraryDoc.exists() && itineraryDoc.data().userId === userId) {
            await deleteDoc(itineraryRef);
            console.log('✅ Đã xóa lịch trình');
            return true;
        } else {
            console.warn('⚠️ Không tìm thấy lịch trình hoặc không có quyền xóa');
            return false;
        }
    } catch (error) {
        console.error('Error deleting user itinerary:', error);
        return false;
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
    // Sử dụng dữ liệu thực từ CSV
    const transportInfo = transportDataService.getTransportSuggestion(from, to);
    
    if (transportInfo) {
        // Lấy giá từ dữ liệu thực
        const pricePerPerson = style === 'luxury' || style === 'comfort' 
            ? transportInfo.fastest.price 
            : transportInfo.cheapest.price;
        
        // Tính cho cả đi và về
        const totalCost = pricePerPerson * travelers * 2;
        console.log(`🚌 Transport cost ${from} ↔ ${to}: ${totalCost.toLocaleString('vi-VN')}đ (${travelers} người)`);
        return roundPrice(totalCost);
    }
    
    // Fallback nếu không tìm thấy trong CSV
    const baseCost = TRANSPORT_OPTIONS.intercity[style]?.cost || 800000;
    return roundPrice(Math.min(baseCost * travelers, 1500000));
};

const calculateAccommodationCost = (nights, travelers, style, accommodationPlan = null) => {
    // Nếu có accommodation plan (khách sạn đã chọn), dùng giá đó
    if (accommodationPlan && accommodationPlan.selected) {
        return accommodationPlan.selected.totalCost;
    }
    
    // Fallback: tính theo style
    const rooms = Math.ceil(travelers / 2);
    const baseCost = ACCOMMODATION_TYPES[style]?.pricePerNight || 300000;
    const totalCost = baseCost * nights * rooms;
    return roundPrice(totalCost);
};

// Hàm làm tròn giá tiền (làm tròn đến 10,000)
const roundPrice = (price) => {
    return Math.round(price / 10000) * 10000;
};

// Giá ăn uống trung vị thực tế
const MEAL_COSTS = {
    breakfast: { min: 30000, avg: 40000, max: 60000 },  // Phở, bánh mì, cơm tấm
    lunch: { min: 50000, avg: 70000, max: 120000 },     // Cơm bình dân, bún, mì
    dinner: { min: 80000, avg: 100000, max: 200000 },   // Nhà hàng, đặc sản
    streetFood: { min: 15000, avg: 25000, max: 50000 }, // Ăn vặt
    cafe: { min: 20000, avg: 35000, max: 80000 }        // Cà phê, nước uống
};

const calculateFoodCost = (dailyItinerary, travelers) => {
    // Tính chi phí ăn uống dựa trên giá trung vị thực tế
    const dailyCost = (MEAL_COSTS.breakfast.avg + MEAL_COSTS.lunch.avg + MEAL_COSTS.dinner.avg) * travelers;
    const totalCost = dailyItinerary.length * dailyCost;
    return roundPrice(totalCost);
};

const calculateSightseeingCost = (dailyItinerary, travelers) => {
    // Tính phí tham quan dựa trên giá thực tế
    const totalEntryFees = dailyItinerary.reduce((sum, day) => 
        sum + day.destinations.reduce((daySum, dest) => daySum + (dest.entryFee || 0), 0), 0
    );
    const totalCost = totalEntryFees * travelers;
    return roundPrice(totalCost);
};

const calculateLocalTransportCost = (duration, travelers, style) => {
    // Chi phí di chuyển địa phương
    const dailyCost = TRANSPORT_OPTIONS.local[style]?.costPerDay || 80000;
    const totalCost = Math.min(dailyCost * duration * travelers, duration * 100000);
    return roundPrice(totalCost);
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
    // Sử dụng dữ liệu thực từ CSV
    const transportInfo = transportDataService.getTransportSuggestion(from, to);
    
    if (transportInfo && transportInfo.allOptions.length > 0) {
        console.log(`🚌 Found ${transportInfo.allOptions.length} transport options from ${from} to ${to}`);
        
        return transportInfo.allOptions.map(option => {
            const hours = option.travelTime || 5;
            const hoursText = hours < 1 ? `${Math.round(hours * 60)} phút` : `${Math.round(hours * 10) / 10}h`;
            
            return {
                type: `Xe khách ${option.company}`,
                duration: hoursText,
                cost: option.price,
                note: option.note,
                company: option.company,
                pros: [
                    option.note.includes('Giường nằm') ? 'Thoải mái' : 'Tiết kiệm',
                    option.note.includes('Limousine') ? 'Sang trọng' : 'Phổ biến'
                ],
                cons: [
                    hours > 10 ? 'Thời gian dài' : 'Phụ thuộc giao thông',
                    'Cần đặt vé trước'
                ]
            };
        });
    }
    
    // Fallback nếu không tìm thấy trong CSV
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
    
    // Sử dụng dữ liệu thực từ CSV
    const transportInfo = transportDataService.getTransportSuggestion(from, to);
    
    if (transportInfo) {
        // Chọn theo style
        if (style === 'luxury' || style === 'comfort') {
            // Ưu tiên xe nhanh nhất hoặc limousine
            const limousine = options.find(o => o.note?.includes('Limousine'));
            if (limousine) return limousine;
            
            return options.find(o => o.company === transportInfo.fastest.company) || options[0];
        } else {
            // Ưu tiên xe rẻ nhất
            return options.find(o => o.company === transportInfo.cheapest.company) || options[0];
        }
    }
    
    // Fallback
    const distance = calculateCityDistance(from, to);

    if (distance > 500 && (style === 'comfort' || style === 'luxury')) {
        return options.find(o => o.type === 'Máy bay') || options[0];
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
// Giá vé vào cổng chính xác dựa trên dữ liệu thực tế
const ENTRY_FEES = {
    // Miễn phí
    free: ['công viên', 'park', 'chùa', 'đền', 'temple', 'pagoda', 'hồ', 'lake', 'biển', 'beach', 'bãi biển'],
    
    // 10-30k
    cheap: {
        keywords: ['thác', 'waterfall', 'đài', 'monument', 'tượng', 'statue'],
        price: 20000
    },
    
    // 30-50k
    moderate: {
        keywords: ['bảo tàng', 'museum', 'di tích', 'heritage', 'lăng', 'tomb', 'văn miếu'],
        price: 40000
    },
    
    // 50-100k
    expensive: {
        keywords: ['núi', 'mountain', 'động', 'cave', 'vườn quốc gia', 'national park'],
        price: 70000
    },
    
    // 100k+
    premium: {
        keywords: ['cáp treo', 'cable', 'khu vui chơi', 'amusement', 'vinpearl', 'bà nà', 'sun world'],
        price: 200000
    }
};

const estimateEntryFeeFromName = (name) => {
    if (!name) return 30000;
    
    const lowerName = name.toLowerCase();
    
    // Kiểm tra miễn phí
    if (ENTRY_FEES.free.some(keyword => lowerName.includes(keyword))) {
        return 0;
    }
    
    // Kiểm tra premium
    if (ENTRY_FEES.premium.keywords.some(keyword => lowerName.includes(keyword))) {
        return ENTRY_FEES.premium.price;
    }
    
    // Kiểm tra expensive
    if (ENTRY_FEES.expensive.keywords.some(keyword => lowerName.includes(keyword))) {
        return ENTRY_FEES.expensive.price;
    }
    
    // Kiểm tra moderate
    if (ENTRY_FEES.moderate.keywords.some(keyword => lowerName.includes(keyword))) {
        return ENTRY_FEES.moderate.price;
    }
    
    // Kiểm tra cheap
    if (ENTRY_FEES.cheap.keywords.some(keyword => lowerName.includes(keyword))) {
        return ENTRY_FEES.cheap.price;
    }
    
    // Default - địa điểm tham quan thông thường
    return 30000;
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
    // Nếu chỉ có 1 địa điểm, không cần di chuyển
    if (destinations.length <= 1) return 0;
    
    let totalMinutes = 0;
    
    // Tính thời gian di chuyển giữa các địa điểm liên tiếp
    for (let i = 0; i < destinations.length - 1; i++) {
        const from = destinations[i].address || destinations[i].name;
        const to = destinations[i + 1].address || destinations[i + 1].name;
        
        // Thử lấy thời gian từ CSV
        const travelTime = transportDataService.getTravelTime(from, to);
        
        if (travelTime) {
            // Chuyển từ giờ sang phút
            totalMinutes += Math.round(travelTime * 60);
            console.log(`⏱️ Travel time ${from} → ${to}: ${travelTime}h (${Math.round(travelTime * 60)} phút)`);
        } else {
            // Fallback: tính theo khoảng cách
            const distance = calculateDistance(
                { lat: destinations[i].lat || 0, lng: destinations[i].lng || 0 },
                { lat: destinations[i + 1].lat || 0, lng: destinations[i + 1].lng || 0 }
            );
            // Giả sử tốc độ trung bình 30km/h trong thành phố
            const minutes = Math.round(distance / 30 * 60);
            totalMinutes += minutes;
        }
    }
    
    return totalMinutes;
};

const getTransportDetails = (from, to, style) => {
    const recommended = getRecommendedTransport(from, to, style);
    const transportInfo = transportDataService.getTransportSuggestion(from, to);
    
    const details = {
        type: recommended.type,
        duration: recommended.duration,
        cost: recommended.cost,
        company: recommended.company,
        note: recommended.note,
        bookingTips: [
            'Đặt vé trước 1-2 tuần để có giá tốt',
            'Kiểm tra chính sách hủy/đổi vé',
            'Mang theo giấy tờ tùy thân khi đi'
        ]
    };
    
    // Thêm thông tin chi tiết từ CSV
    if (transportInfo) {
        details.allOptions = transportInfo.allOptions.length;
        details.priceRange = `${transportInfo.cheapest.price.toLocaleString('vi-VN')}đ - ${transportInfo.fastest.price.toLocaleString('vi-VN')}đ`;
        details.bookingTips.push(`Có ${transportInfo.allOptions.length} nhà xe khác nhau`);
    }
    
    return details;
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
 * Danh sách địa điểm MUST-SEE cho mỗi thành phố
 */
const MUST_SEE_ATTRACTIONS = {
    'Nha Trang': [
        { name: 'Vinpearl Land Nha Trang', entryFee: 800000, category: 'amusement_park', rating: 4.5, isPremium: true },
        { name: 'VinWonders Nha Trang', entryFee: 600000, category: 'amusement_park', rating: 4.4, isPremium: true },
        { name: 'Biển Nha Trang', entryFee: 0, category: 'beach', rating: 4.6 },
        { name: 'Tháp Bà Ponagar', entryFee: 22000, category: 'historical', rating: 4.3 },
        { name: 'Hòn Mun', entryFee: 100000, category: 'island', rating: 4.5 },
        { name: 'Chợ Đầm', entryFee: 0, category: 'market', rating: 4.2 }
    ],
    'Đà Nẵng': [
        { name: 'Bà Nà Hills', entryFee: 750000, category: 'amusement_park', rating: 4.5, isPremium: true },
        { name: 'Cầu Vàng (Golden Bridge)', entryFee: 750000, category: 'landmark', rating: 4.7, isPremium: true },
        { name: 'Biển Mỹ Khê', entryFee: 0, category: 'beach', rating: 4.6 },
        { name: 'Cầu Rồng', entryFee: 0, category: 'landmark', rating: 4.5 },
        { name: 'Ngũ Hành Sơn', entryFee: 40000, category: 'mountain', rating: 4.4 },
        { name: 'Bán đảo Sơn Trà', entryFee: 0, category: 'nature', rating: 4.5 }
    ],
    'Phú Quốc': [
        { name: 'Vinpearl Safari Phú Quốc', entryFee: 600000, category: 'zoo', rating: 4.6, isPremium: true },
        { name: 'VinWonders Phú Quốc', entryFee: 700000, category: 'amusement_park', rating: 4.5, isPremium: true },
        { name: 'Grand World Phú Quốc', entryFee: 0, category: 'entertainment', rating: 4.4, isPremium: true },
        { name: 'Bãi Sao', entryFee: 0, category: 'beach', rating: 4.7 },
        { name: 'Dinh Cậu', entryFee: 0, category: 'temple', rating: 4.3 },
        { name: 'Chợ Đêm Phú Quốc', entryFee: 0, category: 'market', rating: 4.4 }
    ],
    'Đà Lạt': [
        { name: 'Thác Datanla', entryFee: 50000, category: 'waterfall', rating: 4.4 },
        { name: 'Hồ Xuân Hương', entryFee: 0, category: 'lake', rating: 4.5 },
        { name: 'Crazy House', entryFee: 60000, category: 'attraction', rating: 4.3 },
        { name: 'Vườn Hoa Đà Lạt', entryFee: 20000, category: 'garden', rating: 4.4 },
        { name: 'Chợ Đà Lạt', entryFee: 0, category: 'market', rating: 4.2 },
        { name: 'Đồi Chè Cầu Đất', entryFee: 0, category: 'nature', rating: 4.6 }
    ],
    'Vũng Tàu': [
        { name: 'Tượng Chúa Kitô Vua', entryFee: 0, category: 'landmark', rating: 4.6 },
        { name: 'Ngọn Hải Đăng', entryFee: 20000, category: 'lighthouse', rating: 4.4 },
        { name: 'Bãi Trước', entryFee: 0, category: 'beach', rating: 4.3 },
        { name: 'Bãi Sau', entryFee: 0, category: 'beach', rating: 4.2 },
        { name: 'Bạch Dinh', entryFee: 15000, category: 'historical', rating: 4.3 },
        { name: 'Chùa Niet Ban Tinh Xa', entryFee: 0, category: 'temple', rating: 4.5 }
    ],
    'Hội An': [
        { name: 'Phố Cổ Hội An', entryFee: 120000, category: 'historical', rating: 4.7 },
        { name: 'Chùa Cầu', entryFee: 0, category: 'landmark', rating: 4.6 },
        { name: 'Rừng Dừa Bảy Mẫu', entryFee: 50000, category: 'nature', rating: 4.5 },
        { name: 'Bãi Biển An Bàng', entryFee: 0, category: 'beach', rating: 4.6 },
        { name: 'Làng Gốm Thanh Hà', entryFee: 30000, category: 'cultural', rating: 4.3 }
    ],
    'Hạ Long': [
        { name: 'Vịnh Hạ Long', entryFee: 200000, category: 'nature', rating: 4.8 },
        { name: 'Đảo Titop', entryFee: 0, category: 'island', rating: 4.5 },
        { name: 'Hang Sửng Sốt', entryFee: 0, category: 'cave', rating: 4.6 },
        { name: 'Sun World Hạ Long Park', entryFee: 500000, category: 'amusement_park', rating: 4.4, isPremium: true }
    ],
    'Sapa': [
        { name: 'Fansipan', entryFee: 700000, category: 'mountain', rating: 4.6, isPremium: true },
        { name: 'Thung Lũng Mường Hoa', entryFee: 0, category: 'nature', rating: 4.5 },
        { name: 'Bản Cát Cát', entryFee: 70000, category: 'village', rating: 4.4 },
        { name: 'Thác Bạc', entryFee: 30000, category: 'waterfall', rating: 4.3 }
    ]
};

/**
 * Danh sách khách sạn thực tế theo thành phố và phong cách
 */
const HOTEL_OPTIONS = {
    'Nha Trang': {
        budget: [
            { name: 'Khách sạn Hải Yến', rating: 3.5, pricePerNight: 250000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng'] },
            { name: 'Nha Trang Lodge', rating: 3.8, pricePerNight: 300000, location: 'Trung tâm', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi'] },
            { name: 'Backpacker Hostel', rating: 3.6, pricePerNight: 200000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa'] }
        ],
        standard: [
            { name: 'Khách sạn Mường Thanh', rating: 4.0, pricePerNight: 500000, location: 'Trung tâm', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Gym'] },
            { name: 'Liberty Central Nha Trang', rating: 4.2, pricePerNight: 600000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa'] },
            { name: 'Galina Hotel', rating: 4.1, pricePerNight: 550000, location: 'Trung tâm', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi'] }
        ],
        comfort: [
            { name: 'Sheraton Nha Trang', rating: 4.5, pricePerNight: 1200000, location: 'Bãi biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng buffet', 'Hồ bơi', 'Spa', 'Gym', 'Nhà hàng'] },
            { name: 'InterContinental Nha Trang', rating: 4.6, pricePerNight: 1500000, location: 'Bãi biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng buffet', 'Hồ bơi', 'Spa', 'Gym', 'Bar'] },
            { name: 'Novotel Nha Trang', rating: 4.4, pricePerNight: 1000000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa', 'Gym'] }
        ],
        luxury: [
            { name: 'Vinpearl Resort Nha Trang', rating: 4.8, pricePerNight: 3000000, location: 'Hòn Tre', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng buffet', 'Hồ bơi vô cực', 'Spa', 'Gym', 'Nhà hàng', 'Bar', 'Bãi biển riêng'] },
            { name: 'Mia Resort Nha Trang', rating: 4.7, pricePerNight: 2500000, location: 'Bãi Đông', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa', 'Nhà hàng', 'Bãi biển riêng'] },
            { name: 'Amiana Resort Nha Trang', rating: 4.6, pricePerNight: 2000000, location: 'Bãi Đông', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa', 'Gym', 'Nhà hàng'] }
        ]
    },
    'Đà Nẵng': {
        budget: [
            { name: 'Khách sạn Hải Châu', rating: 3.6, pricePerNight: 280000, location: 'Trung tâm', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng'] },
            { name: 'Memory Hotel', rating: 3.8, pricePerNight: 320000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng'] },
            { name: 'Danang Backpackers', rating: 3.5, pricePerNight: 220000, location: 'Trung tâm', amenities: ['WiFi', 'Điều hòa'] }
        ],
        standard: [
            { name: 'Khách sạn Mường Thanh', rating: 4.0, pricePerNight: 550000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Gym'] },
            { name: 'Brilliant Hotel', rating: 4.1, pricePerNight: 600000, location: 'Mỹ Khê', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi'] },
            { name: 'Nesta Hotel', rating: 4.2, pricePerNight: 650000, location: 'Gần biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa'] }
        ],
        comfort: [
            { name: 'Novotel Danang', rating: 4.4, pricePerNight: 1100000, location: 'Bãi biển Mỹ Khê', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng buffet', 'Hồ bơi', 'Spa', 'Gym'] },
            { name: 'Pullman Danang', rating: 4.5, pricePerNight: 1300000, location: 'Bãi biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa', 'Gym', 'Nhà hàng'] },
            { name: 'Hyatt Regency Danang', rating: 4.6, pricePerNight: 1500000, location: 'Bãi biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa', 'Gym', 'Bar'] }
        ],
        luxury: [
            { name: 'InterContinental Danang Sun Peninsula', rating: 4.9, pricePerNight: 4000000, location: 'Bán đảo Sơn Trà', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng buffet', 'Hồ bơi vô cực', 'Spa', 'Gym', 'Nhà hàng', 'Bar', 'Bãi biển riêng', 'Butler'] },
            { name: 'Premier Village Danang', rating: 4.7, pricePerNight: 3000000, location: 'Bãi biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa', 'Nhà hàng', 'Bãi biển riêng'] },
            { name: 'Fusion Maia Danang', rating: 4.8, pricePerNight: 3500000, location: 'Bãi biển', amenities: ['WiFi', 'Điều hòa', 'Bữa sáng', 'Hồ bơi', 'Spa miễn phí', 'Gym', 'Nhà hàng'] }
        ]
    }
};

/**
 * Danh sách địa điểm liên quan (nếu có A thì không nên có B vì trùng lặp)
 * Ví dụ: Vinpearl Land đã bao gồm Cable Car rồi
 */
const RELATED_ATTRACTIONS = {
    // Nha Trang - Vinpearl group
    'Vinpearl Land Nha Trang': ['Vinpearl Cable Car', 'VinWonders Nha Trang'],
    'VinWonders Nha Trang': ['Vinpearl Cable Car', 'Vinpearl Land Nha Trang'],
    'Vinpearl Cable Car': ['Vinpearl Land Nha Trang', 'VinWonders Nha Trang'],
    
    // Đà Nẵng - Bà Nà group
    'Bà Nà Hills': ['Cầu Vàng (Golden Bridge)', 'Sun World Ba Na Hills'],
    'Cầu Vàng (Golden Bridge)': ['Bà Nà Hills', 'Sun World Ba Na Hills'],
    'Sun World Ba Na Hills': ['Bà Nà Hills', 'Cầu Vàng (Golden Bridge)'],
    
    // Phú Quốc - Vinpearl group
    'Vinpearl Safari Phú Quốc': ['VinWonders Phú Quốc', 'Grand World Phú Quốc'],
    'VinWonders Phú Quốc': ['Vinpearl Safari Phú Quốc', 'Grand World Phú Quốc'],
    'Grand World Phú Quốc': ['Vinpearl Safari Phú Quốc', 'VinWonders Phú Quốc']
};

/**
 * Lấy địa điểm MUST-SEE cho thành phố (KHÔNG TRÙNG giữa các ngày)
 */
const getMustSeeAttractions = (destination, canAffordPremium, dayNumber, budget, travelers, duration) => {
    const attractions = MUST_SEE_ATTRACTIONS[destination];
    if (!attractions || attractions.length === 0) return [];
    
    // Tính ngân sách thực tế cho tham quan (khoảng 15-20% tổng budget)
    const sightseeingBudget = budget * 0.2; // 20% cho tham quan
    const budgetPerPerson = sightseeingBudget / travelers;
    const budgetPerDay = budgetPerPerson / duration;
    
    console.log(`💰 Sightseeing budget: ${sightseeingBudget.toLocaleString()}đ total, ${budgetPerDay.toLocaleString()}đ/người/ngày`);
    
    // Lọc theo ngân sách THỰC TẾ
    let filtered = attractions.filter(attr => {
        // Nếu địa điểm premium (>500k), cần ngân sách cao
        if (attr.isPremium && attr.entryFee > 500000) {
            // Cần ít nhất 1.5M/người cho tham quan mới đi được Vinpearl
            const canAfford = budgetPerPerson >= 1500000;
            if (!canAfford) {
                console.log(`⚠️ Cannot afford ${attr.name} (${attr.entryFee.toLocaleString()}đ) - budget: ${budgetPerPerson.toLocaleString()}đ/người`);
            }
            return canAfford;
        }
        
        // Địa điểm thường, kiểm tra có đủ tiền không
        const canAfford = attr.entryFee <= budgetPerDay * 2; // Cho phép vượt 2x budget 1 ngày
        if (!canAfford) {
            console.log(`⚠️ ${attr.name} (${attr.entryFee.toLocaleString()}đ) exceeds daily budget (${budgetPerDay.toLocaleString()}đ/ngày)`);
        }
        return canAfford;
    });
    
    // Lọc bỏ địa điểm đã dùng VÀ địa điểm liên quan (QUAN TRỌNG!)
    filtered = filtered.filter(attr => {
        // Kiểm tra tên đã dùng
        const nameUsed = usedDestinations.has(attr.name);
        
        // Kiểm tra tên tương tự
        const similarUsed = Array.from(usedDestinations).some(used => {
            if (typeof used === 'string') {
                const attrLower = attr.name.toLowerCase();
                const usedLower = used.toLowerCase();
                
                // Kiểm tra chứa nhau
                if (usedLower.includes(attrLower) || attrLower.includes(usedLower)) {
                    return true;
                }
                
                // Kiểm tra các từ khóa chung (Vinpearl, Bà Nà, etc.)
                const keywords = ['vinpearl', 'vinwonders', 'bà nà', 'ba na', 'sun world'];
                for (const keyword of keywords) {
                    if (attrLower.includes(keyword) && usedLower.includes(keyword)) {
                        return true; // Cùng nhóm Vinpearl hoặc Bà Nà
                    }
                }
            }
            return false;
        });
        
        // Kiểm tra địa điểm liên quan
        const relatedUsed = Array.from(usedDestinations).some(used => {
            if (typeof used === 'string') {
                // Nếu đã dùng địa điểm A, kiểm tra xem attr có phải là địa điểm liên quan không
                const relatedList = RELATED_ATTRACTIONS[used];
                if (relatedList && relatedList.includes(attr.name)) {
                    console.log(`⚠️ Skipping ${attr.name} because ${used} is already used (related)`);
                    return true;
                }
            }
            return false;
        });
        
        return !nameUsed && !similarUsed && !relatedUsed;
    });
    
    if (filtered.length === 0) {
        console.log(`⚠️ All MUST-SEE attractions already used for ${destination}`);
        return [];
    }
    
    // Shuffle để tăng tính ngẫu nhiên (không bị giống nhau mỗi lần)
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    
    // Chọn địa điểm theo ngày
    const count = Math.min(dayNumber === 1 ? 3 : 4, shuffled.length);
    const selected = shuffled.slice(0, count);
    
    // Đánh dấu đã dùng
    selected.forEach(attr => {
        usedDestinations.add(attr.name);
        usedDestinations.add(attr.name.toLowerCase());
    });
    
    console.log(`✅ Selected ${selected.length} MUST-SEE for day ${dayNumber}:`, selected.map(s => s.name));
    
    // Format theo cấu trúc chuẩn
    return selected.map(attr => ({
        name: attr.name,
        address: `${attr.name}, ${destination}`,
        rating: attr.rating,
        entryFee: attr.entryFee,
        category: attr.category,
        types: [attr.category],
        estimatedDuration: estimateVisitDuration({ types: [attr.category] }),
        specialNotes: attr.isPremium ? ['Địa điểm cao cấp', 'Nên đặt vé trước'] : [],
        dataSource: 'must_see',
        isPremium: attr.isPremium || false
    }));
};

/**
 * Kiểm tra xem địa điểm có phải là premium không
 */
const isPremiumAttraction = (name) => {
    if (!name) return false;
    
    const lowerName = name.toLowerCase();
    const premiumKeywords = [
        'vinpearl', 'vinwonders', 'sun world', 'bà nà', 'ba na',
        'cable car', 'cáp treo', 'fansipan', 'safari'
    ];
    
    return premiumKeywords.some(keyword => lowerName.includes(keyword));
};

/**
 * Lấy queries cho địa điểm cao cấp theo từng thành phố
 */
const getPremiumQueriesForDestination = (destination) => {
    const premiumAttractions = {
        'Nha Trang': [
            'Vinpearl Land Nha Trang',
            'VinWonders Nha Trang',
            'Vinpearl Resort Nha Trang',
            'Hon Tam Island Resort',
            'Luxury resorts Nha Trang'
        ],
        'Đà Nẵng': [
            'Bà Nà Hills',
            'Sun World Ba Na Hills',
            'Golden Bridge Da Nang',
            'Asia Park Da Nang',
            'Luxury resorts Da Nang'
        ],
        'Phú Quốc': [
            'Vinpearl Safari Phu Quoc',
            'VinWonders Phu Quoc',
            'Grand World Phu Quoc',
            'Sun World Hon Thom',
            'Luxury resorts Phu Quoc'
        ],
        'Vũng Tàu': [
            'Ho Tram Strip',
            'The Grand Ho Tram',
            'Luxury beach resorts Vung Tau'
        ],
        'Đà Lạt': [
            'Datanla Waterfall cable car',
            'Dalat Cable Car',
            'Luxury resorts Dalat'
        ],
        'Hạ Long': [
            'Halong Bay cruise luxury',
            'Sun World Halong Park',
            'Luxury cruises Halong'
        ]
    };
    
    return premiumAttractions[destination] || [];
};

/**
 * Tìm địa điểm thực tế cho từng ngày - SỬ DỤNG GOOGLE PLACES API
 */
const findRealDestinationsForDay = async (dayNumber, destination, coord, interests, travelStyle = 'standard', budget = 5000000, travelers = 2) => {
    try {
        console.log(`🔍 Finding REAL destinations for Day ${dayNumber} in ${destination} (${travelStyle}, budget: ${budget})...`);
        
        // Tính ngân sách cho địa điểm cao cấp
        const budgetPerPerson = budget / travelers;
        const canAffordPremium = budgetPerPerson > 3000000 || travelStyle === 'luxury' || travelStyle === 'comfort';
        console.log(`💰 Budget per person: ${budgetPerPerson}, Can afford premium: ${canAffordPremium}`);
        
        // BƯỚC 1: Lấy địa điểm MUST-SEE trước (không cần call API)
        const duration = 3; // Giả sử 3 ngày, sẽ được truyền từ preferences
        const mustSeeAttractions = getMustSeeAttractions(destination, canAffordPremium, dayNumber, budget, travelers, duration);
        if (mustSeeAttractions.length > 0) {
            console.log(`✨ Using ${mustSeeAttractions.length} MUST-SEE attractions for ${destination}`);
            return mustSeeAttractions;
        }

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
            
            // Tạo queries dựa trên interests của user VÀ BUDGET
            const interestBasedQueries = generateInterestBasedQueries(destination, interests, dayNumber);
            
            // Thêm queries cho địa điểm cao cấp nếu có ngân sách
            const premiumQueries = canAffordPremium ? getPremiumQueriesForDestination(destination) : [];
            console.log(`✨ Premium queries for ${destination}:`, premiumQueries);
            
            // Giảm số queries để tránh call API quá nhiều
            const daySpecificQueries = {
                1: [
                    `top attractions ${destination}`,
                    `must visit ${destination}`
                ],
                2: [
                    `cultural sites ${destination}`,
                    `museums ${destination}`
                ],
                3: [
                    `beaches ${destination}`,
                    `nature ${destination}`
                ]
            };
            
            const queries = daySpecificQueries[dayNumber] || [
                `tourist attractions ${destination}`
            ];
            
            for (const query of queries) {
                try {
                    const results = await searchPlacesByText(query, coord, 20000, destination);
                    
                    if (results && results.length > 0) {
                        const formattedResults = results
                            .filter(place => {
                                // Giảm yêu cầu để không loại bỏ địa điểm nổi tiếng
                                const hasGoodRating = place.rating >= 3.5; // Giảm từ 3.8 → 3.5
                                const hasReviews = place.user_ratings_total > 5; // Giảm từ 10 → 5
                                
                                // Lọc chỉ lấy địa điểm du lịch
                                const isTourismRelated = isTourismPlace(place);
                                // Enhanced anti-duplication with fuzzy matching
                                const nameUsed = usedDestinations.has(place.name) || usedDestinations.has(place.name.toLowerCase());
                                const idUsed = usedDestinations.has(place.place_id);
                                
                                // Enhanced fuzzy matching để tránh địa điểm tương tự
                                const similarUsed = Array.from(usedDestinations).some(used => {
                                    if (typeof used === 'string' && place.name) {
                                        const placeName = place.name.toLowerCase();
                                        const usedName = used.toLowerCase();
                                        
                                        // Exact match
                                        if (placeName === usedName) return true;
                                        
                                        // Contains check
                                        if (placeName.includes(usedName) || usedName.includes(placeName)) {
                                            if (Math.min(placeName.length, usedName.length) > 5) return true;
                                        }
                                        
                                        // Similarity check
                                        const similarity = calculateSimilarity(usedName, placeName);
                                        return similarity > 0.75; // 75% giống nhau thì coi như trùng
                                    }
                                    return false;
                                });
                                
                                const notUsed = !nameUsed && !idUsed && !similarUsed;
                                return hasGoodRating && hasReviews && notUsed && isTourismRelated;
                            })
                            .sort((a, b) => {
                                // Ưu tiên địa điểm cao cấp nếu có ngân sách
                                if (canAffordPremium) {
                                    const aIsPremium = isPremiumAttraction(a.name);
                                    const bIsPremium = isPremiumAttraction(b.name);
                                    if (aIsPremium && !bIsPremium) return -1;
                                    if (!aIsPremium && bIsPremium) return 1;
                                }
                                // Sort by rating
                                return (b.rating || 0) - (a.rating || 0);
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

    console.log(`🔍 Day ${dayNumber}: Filtering ${destinations.length} destinations. Used so far:`, Array.from(usedDestinations).slice(0, 10));
    
    // Lọc bỏ địa điểm đã dùng với fuzzy matching
    const availableDestinations = destinations.filter(dest => {
        const nameUsed = usedDestinations.has(dest.name);
        const idUsed = usedDestinations.has(dest.place_id);
        
        // Enhanced fuzzy matching để tránh địa điểm tương tự
        const similarUsed = Array.from(usedDestinations).some(used => {
            if (typeof used === 'string' && dest.name) {
                const destName = dest.name.toLowerCase();
                const usedName = used.toLowerCase();
                
                // Exact match
                if (destName === usedName) return true;
                
                // Contains check
                if (destName.includes(usedName) || usedName.includes(destName)) {
                    if (Math.min(destName.length, usedName.length) > 5) return true;
                }
                
                // Similarity check
                const similarity = calculateSimilarity(usedName, destName);
                return similarity > 0.75; // 75% giống nhau thì coi như trùng
            }
            return false;
        });
        
        return !nameUsed && !idUsed && !similarUsed;
    });

    if (availableDestinations.length === 0) {
        console.warn(`⚠️ No new destinations available for day ${dayNumber}, using original destinations`);
        // Nếu không còn địa điểm mới, trả về một số địa điểm gốc (có thể trùng)
        const fallbackCount = dayNumber === 1 ? 2 : 3;
        return destinations.slice(0, Math.min(fallbackCount, destinations.length));
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
    
    // Shuffle để tăng tính ngẫu nhiên
    const shuffled = [...availableDestinations].sort(() => 0.5 - Math.random());
    
    // Ưu tiên theo ngày với nhiều category hơn và tránh lặp
    const dayPriorities = {
        1: ['tourist_attraction', 'lighthouse', 'landmark', 'point_of_interest'], // Ngày đầu - điểm nổi tiếng
        2: ['museum', 'temple', 'religious', 'establishment'], // Ngày 2 - văn hóa
        3: ['beach', 'park', 'natural_feature', 'viewpoint'], // Ngày 3 - thiên nhiên
        4: ['amusement_park', 'zoo', 'aquarium', 'shopping_mall'], // Ngày 4 - giải trí
        5: ['spa', 'night_market', 'local_government_office', 'cemetery'], // Ngày 5 - đặc biệt
        6: ['university', 'library', 'hospital', 'school'], // Ngày 6 - khác
        7: ['gas_station', 'atm', 'bank', 'post_office'] // Ngày 7+ - tiện ích
    };
    
    const priorities = dayPriorities[dayNumber] || 
        dayPriorities[((dayNumber - 1) % 7) + 1] || // Cycle through priorities
        ['tourist_attraction', 'point_of_interest', 'establishment'];
    
    // Chọn theo thứ tự ưu tiên với random để tránh lặp
    for (const priority of priorities) {
        if (selected.length >= targetCount) break;
        
        if (byCategory[priority] && byCategory[priority].length > 0) {
            // Sort by rating và random để có diversity
            const sortedPlaces = byCategory[priority]
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 3); // Lấy top 3 để random
            
            const randomPlace = sortedPlaces[Math.floor(Math.random() * sortedPlaces.length)];
            selected.push(randomPlace);
            
            // Mark as used globally - multiple identifiers
            usedDestinations.add(randomPlace.name);
            usedDestinations.add(randomPlace.name.toLowerCase());
            if (randomPlace.place_id) usedDestinations.add(randomPlace.place_id);
            if (randomPlace.address) usedDestinations.add(randomPlace.address);
            
            // Add variations of the name
            const nameVariations = [
                randomPlace.name.replace(/\s+/g, ''),
                randomPlace.name.replace(/[^\w\s]/gi, ''),
                randomPlace.name.split(' ')[0] // First word
            ];
            nameVariations.forEach(variation => {
                if (variation && variation.length > 3) {
                    usedDestinations.add(variation.toLowerCase());
                }
            });
            
            // Remove from all categories to prevent reuse
            Object.keys(byCategory).forEach(cat => {
                byCategory[cat] = byCategory[cat].filter(d => 
                    d.name !== randomPlace.name && d.place_id !== randomPlace.place_id
                );
            });
        }
    }
    
    // Nếu chưa đủ, chọn từ các category còn lại
    const remainingCategories = Object.keys(byCategory).filter(cat => byCategory[cat].length > 0);
    for (const category of remainingCategories) {
        if (selected.length >= targetCount) break;
        
        const best = byCategory[category].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
        if (!selected.find(s => s.name === best.name)) {
            selected.push(best);
            // Mark as used globally - multiple identifiers
            usedDestinations.add(best.name);
            usedDestinations.add(best.name.toLowerCase());
            if (best.place_id) usedDestinations.add(best.place_id);
            if (best.address) usedDestinations.add(best.address);
            
            // Add variations of the name
            const nameVariations = [
                best.name.replace(/\s+/g, ''),
                best.name.replace(/[^\w\s]/gi, ''),
                best.name.split(' ')[0] // First word
            ];
            nameVariations.forEach(variation => {
                if (variation && variation.length > 3) {
                    usedDestinations.add(variation.toLowerCase());
                }
            });
        }
    }

    const finalSelected = selected.slice(0, targetCount);
    console.log(`✅ Day ${dayNumber}: Selected ${finalSelected.length} destinations:`, finalSelected.map(d => d.name));
    console.log(`📊 Total used destinations now:`, usedDestinations.size);
    
    return finalSelected;
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
 * Extract district from address
 */
const extractDistrict = (address) => {
    if (!address) return null;
    
    // Extract district/ward from Vietnamese address
    const districtMatch = address.match(/(Quận|Huyện|Phường|Xã)\s+([^,]+)/i);
    if (districtMatch) return districtMatch[0];
    
    // Extract city/province
    const cityMatch = address.match(/([^,]+),\s*([^,]+)$/);
    if (cityMatch) return cityMatch[2].trim();
    
    return address.split(',')[0]?.trim();
};

/**
 * Create location info object
 */
const createLocationInfo = (place) => {
    return {
        name: place.name,
        address: place.address || place.vicinity || 'Địa chỉ đang cập nhật',
        coordinates: place.lat && place.lng ? `${place.lat}, ${place.lng}` : null,
        district: extractDistrict(place.address || place.vicinity),
        googleMapsUrl: place.lat && place.lng ? 
            `https://maps.google.com/?q=${place.lat},${place.lng}` : null,
        rating: place.rating,
        priceLevel: place.price_level,
        dataSource: place.dataSource
    };
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
                const results = await searchPlacesByText(query, coord, 15000, destination);
                
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
                const results = await searchPlacesByText(query, coord, 10000, destination);
                
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
                const results = await searchPlacesByText(query, coord, 10000, destination);
                
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
                    const results = await searchPlacesByText(query, coord, 10000, destination);
                    
                    if (results && results.length > 0) {
                        const restaurants = results
                            .filter(place => {
                                // Kiểm tra là nhà hàng
                                const isRestaurant = place.types?.includes('restaurant') || 
                                    place.types?.includes('food') ||
                                    place.types?.includes('meal_takeaway');
                                return isRestaurant;
                            })
                            .filter(place => {
                                // Kiểm tra rating và chưa được sử dụng
                                const hasGoodRating = place.rating >= 4.0;
                                const notUsed = !usedRestaurants.has(place.name) && !usedRestaurants.has(place.place_id);
                                
                                // Fuzzy matching cho nhà hàng
                                const similarUsed = Array.from(usedRestaurants).some(used => {
                                    if (typeof used === 'string' && place.name) {
                                        const similarity = calculateSimilarity(used.toLowerCase(), place.name.toLowerCase());
                                        return similarity > 0.8;
                                    }
                                    return false;
                                });
                                
                                return hasGoodRating && notUsed && !similarUsed;
                            })
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
        
        // Shuffle restaurants để tránh lặp lại
        const shuffledRestaurants = [...realRestaurants].sort(() => 0.5 - Math.random());
        
        // Tạo danh sách đa dạng từ dữ liệu thực và Firebase
        const diverseOptions = {};
        
        // Breakfast - ưu tiên nhà hàng chưa dùng
        const availableForBreakfast = shuffledRestaurants.filter(r => !usedRestaurants.has(r.name));
        if (availableForBreakfast.length > 0) {
            const selected = availableForBreakfast[0];
            diverseOptions.breakfast = {
                name: selected.name,
                specialty: 'Ẩm thực địa phương',
                priceRange: '30,000-50,000 VNĐ',
                estimatedCost: 40000,
                rating: selected.rating || 4.2,
                isOpen: true,
                dataSource: 'places_search_real',
                address: selected.address
            };
            usedRestaurants.add(selected.name);
        } else {
            diverseOptions.breakfast = {
                name: `Quán ăn sáng ${destination}`,
                specialty: 'Phở bò/gà truyền thống',
                priceRange: '30,000-50,000 VNĐ',
                estimatedCost: 40000,
                rating: 4.2,
                isOpen: true,
                dataSource: 'firebase_fallback'
            };
        }
        
        // Lunch - ưu tiên nhà hàng khác
        const availableForLunch = shuffledRestaurants.filter(r => !usedRestaurants.has(r.name));
        if (availableForLunch.length > 0) {
            const selected = availableForLunch[0];
            diverseOptions.lunch = {
                name: selected.name,
                specialty: localCuisines.lunch || 'Cơm địa phương',
                priceRange: '50,000-100,000 VNĐ',
                estimatedCost: 75000,
                rating: selected.rating || 4.3,
                isOpen: true,
                dataSource: 'places_search_real',
                address: selected.address
            };
            usedRestaurants.add(selected.name);
        } else {
            diverseOptions.lunch = {
                name: `Nhà hàng cơm ${destination}`,
                specialty: localCuisines.lunch || 'Cơm địa phương',
                priceRange: '50,000-100,000 VNĐ',
                estimatedCost: 75000,
                rating: 4.3,
                isOpen: true,
                dataSource: 'firebase_fallback'
            };
        }
        
        // Dinner - ưu tiên nhà hàng khác nữa
        const availableForDinner = shuffledRestaurants.filter(r => !usedRestaurants.has(r.name));
        if (availableForDinner.length > 0) {
            const selected = availableForDinner[0];
            diverseOptions.dinner = {
                name: selected.name,
                specialty: localCuisines.dinner || 'Hải sản tươi sống',
                priceRange: '100,000-200,000 VNĐ',
                estimatedCost: 150000,
                rating: selected.rating || 4.4,
                isOpen: true,
                dataSource: 'places_search_real',
                address: selected.address
            };
            usedRestaurants.add(selected.name);
        } else {
            diverseOptions.dinner = {
                name: `Nhà hàng hải sản ${destination}`,
                specialty: localCuisines.dinner || 'Hải sản tươi sống',
                priceRange: '100,000-200,000 VNĐ',
                estimatedCost: 150000,
                rating: 4.4,
                isOpen: true,
                dataSource: 'firebase_fallback'
            };
        }
        
        // Thêm street food với địa chỉ thật từ Google Places
        diverseOptions.streetFood = await findRealStreetFood(destination, coord);
        
        // Thêm cafes với địa chỉ thật từ Google Places
        diverseOptions.cafes = await findRealCafes(destination, coord);
        
        // Thêm local specialties
        diverseOptions.localSpecialties = localCuisines.specialties || [
            {
                name: 'Món đặc sản địa phương',
                specialty: 'Theo mùa',
                priceRange: '50,000-150,000 VNĐ',
                estimatedCost: 100000,
                rating: 4.4,
                dataSource: 'firebase_fallback'
            }
        ];

        // Restaurants đã được mark as used trong quá trình tạo diverseOptions
        
        console.log(`✅ Found diverse dining options from Firebase: ${Object.keys(diverseOptions).length} categories`);
        console.log(`📊 Total used restaurants now:`, usedRestaurants.size);
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
const calculateRealDayCost = (destinations, restaurants, travelStyle, dailyBudget = 500000) => {
    let totalCost = 0;

    // Chi phí tham quan - giảm xuống tối đa 30% ngân sách ngày
    const maxSightseeingCost = dailyBudget * 0.3;
    let sightseeingCost = 0;
    destinations.forEach(dest => {
        sightseeingCost += dest.entryFee || 20000; // Giảm từ 50k xuống 20k
    });
    totalCost += Math.min(sightseeingCost, maxSightseeingCost);

    // Chi phí ăn uống - tối đa 50% ngân sách ngày
    const maxFoodCost = dailyBudget * 0.5;
    let foodCost = 0;
    if (restaurants.breakfast) foodCost += Math.min(restaurants.breakfast.estimatedCost || 30000, 30000);
    if (restaurants.lunch) foodCost += Math.min(restaurants.lunch.estimatedCost || 60000, 60000);
    if (restaurants.dinner) foodCost += Math.min(restaurants.dinner.estimatedCost || 80000, 80000);
    totalCost += Math.min(foodCost, maxFoodCost);

    // Chi phí di chuyển - tối đa 20% ngân sách ngày
    const maxTransportCost = dailyBudget * 0.2;
    const transportCost = Math.min(TRANSPORT_OPTIONS.local[travelStyle]?.costPerDay || 60000, maxTransportCost);
    totalCost += transportCost;

    return Math.round(Math.min(totalCost, dailyBudget));
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
const calculateEnhancedDayCost = (destinations, restaurants, travelStyle, dayNumber, dailyBudget = 500000) => {
    const multiplier = Math.min(TRAVEL_STYLES[travelStyle]?.multiplier || 1, 1.2);
    
    // 1. Chi phí vé vào cổng (sử dụng giá chính xác)
    const sightseeingCost = destinations.reduce((sum, dest) => sum + (dest.entryFee || 0), 0);
    
    // 2. Chi phí ăn uống (sử dụng giá trung vị)
    let foodCost = 0;
    if (restaurants.breakfast) foodCost += MEAL_COSTS.breakfast.avg;
    if (restaurants.lunch) foodCost += MEAL_COSTS.lunch.avg;
    if (restaurants.dinner) foodCost += MEAL_COSTS.dinner.avg;
    if (restaurants.streetFood && restaurants.streetFood.length > 0) foodCost += MEAL_COSTS.streetFood.avg;
    if (restaurants.cafes && restaurants.cafes.length > 0) foodCost += MEAL_COSTS.cafe.avg;
    
    // 3. Chi phí di chuyển giữa các địa điểm trong ngày
    let localTransportCost = 0;
    
    // Tính chi phí di chuyển giữa các địa điểm
    for (let i = 0; i < destinations.length - 1; i++) {
        const from = destinations[i].address || destinations[i].name;
        const to = destinations[i + 1].address || destinations[i + 1].name;
        
        // Thử lấy thời gian từ CSV (nếu có)
        const travelTime = transportDataService.getTravelTime(from, to);
        
        if (travelTime && travelTime > 0.5) {
            // Nếu > 30 phút, có thể cần xe
            localTransportCost += 50000; // Grab/taxi giữa các địa điểm
        } else {
            // Ngắn, có thể đi bộ hoặc xe ngắn
            localTransportCost += 20000;
        }
    }
    
    // Thêm chi phí di chuyển cơ bản trong ngày
    const baseTransportCost = TRANSPORT_OPTIONS.local[travelStyle]?.costPerDay || 80000;
    localTransportCost += baseTransportCost;
    
    // 4. Chi phí mua sắm/phát sinh
    const miscCost = 50000; // Nước uống, tip, mua sắm nhỏ
    
    const totalCost = (sightseeingCost + foodCost + localTransportCost + miscCost) * multiplier;
    
    // Làm tròn đến 10,000
    return roundPrice(totalCost);
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
    
    // Giữ nguyên Date object để Firebase tự convert thành Timestamp
    if (obj instanceof Date) {
        return obj;
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