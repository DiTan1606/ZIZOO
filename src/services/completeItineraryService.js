// src/services/completeItineraryService.js
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, getDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { searchPlacesByText, searchNearbyPlaces } from './placesService';
import { get7DayWeatherForecast } from './weatherService';
import { findRealPlacesByCategory, findRealRestaurants, getRealWeatherForItinerary, findNightlifeVenues, findLocalFoodVenues } from './realTimeDataService';
import { startItineraryMonitoring } from './alertsAndAdjustmentsService';
import provinceCoords from '../assets/provinceCoord.json';
import { TRAVEL_STYLES, ACCOMMODATION_TYPES, TRANSPORT_OPTIONS, MEAL_COSTS } from '../constants';
import { formatMoney, getSeason, getClimate } from '../utils/commonUtils';
import transportDataService from './transportDataService';
import amadeusService from './amadeusService';
import { optimizeDayRoute } from './dailyItineraryOptimizer';
/**
 * Service tạo lịch trình du lịch hoàn chỉnh theo cấu trúc chuẩn
 * Bao gồm: Header, Daily Itinerary, Chi phí, Phương tiện, Lưu trú, Packing list, Lưu ý, Bản đồ
 */

/**
 * Tính thời gian tiếp theo dựa trên thời gian hiện tại + duration
 */
const calculateNextTime = (currentTime, durationStr) => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    
    // Parse duration (ví dụ: "45 phút", "1-2 giờ", "1.5 giờ")
    let durationMinutes = 60; // default
    
    if (durationStr.includes('phút')) {
        const match = durationStr.match(/(\d+)\s*phút/);
        if (match) durationMinutes = parseInt(match[1]);
    } else if (durationStr.includes('giờ')) {
        const match = durationStr.match(/([\d.]+)(?:-[\d.]+)?\s*giờ/);
        if (match) {
            const hourValue = parseFloat(match[1]);
            durationMinutes = hourValue * 60;
        }
    }
    
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
};

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
        departureCity = 'Hà Nội',
        startTime = '08:00', // Giờ bắt đầu tham quan (từ UI)
        specialActivities = {},
        customDestinations = [] // Địa điểm user đã chọn từ DestinationSelector
    } = preferences;
    
    // Map startTime thành departureTime để dùng trong code
    const departureTime = startTime;

    console.log('🗺️ Bắt đầu tạo lịch trình hoàn chỉnh...');
    console.log(`⏰ Giờ bắt đầu tham quan: ${departureTime}`);

    try {
        // Reset destination tracking for new itinerary
        resetDestinationTracking();
        console.log('🔄 Reset tracking - usedRestaurants:', usedRestaurants.size, 'usedDestinations:', usedDestinations.size);
        
        // 1. THÔNG TIN CƠ BẢN (HEADER)
        const tripHeader = await generateTripHeader(preferences);

        // 2. LỊCH TRÌNH CHI TIẾT THEO TỪNG NGÀY
        const dailyItinerary = await generateDailyItinerary(preferences);

        // 3. PHƯƠNG TIỆN DI CHUYỂN
        const transportPlan = await generateTransportPlan(preferences);

        // 4. LƯU TRÚ (tạo trước để có giá khách sạn)
        const accommodationPlan = await generateAccommodationPlan(preferences, dailyItinerary);

        // ✨ CẬP NHẬT TỌA ĐỘ KHÁCH SẠN VÀO SCHEDULE
        if (accommodationPlan?.selected?.lat && accommodationPlan?.selected?.lng) {
            console.log(`🏨 Updating hotel coordinates in schedule: ${accommodationPlan.selected.name}`);
            dailyItinerary.forEach(day => {
                if (day.schedule) {
                    day.schedule.forEach(item => {
                        // Tìm activity check-in khách sạn
                        if (item.type === 'accommodation' || 
                            item.activity?.toLowerCase().includes('check-in') ||
                            item.activity?.toLowerCase().includes('nhận phòng')) {
                            // Gắn tọa độ khách sạn
                            item.location = {
                                name: accommodationPlan.selected.name,
                                address: accommodationPlan.selected.address || accommodationPlan.selected.location,
                                lat: accommodationPlan.selected.lat,
                                lng: accommodationPlan.selected.lng
                            };
                            console.log(`  ✅ Updated check-in activity on Day ${day.day} with hotel coordinates`);
                        }
                    });
                }
            });
        }

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
            createdAt: Timestamp.now(),
            lastUpdated: Timestamp.now(),

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
            lastUpdated: Timestamp.now(),
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
    const { 
        destination, 
        startDate, 
        duration, 
        interests, 
        travelStyle, 
        budget, 
        travelers,
        startTime = '08:00', // Giờ bắt đầu
        specialActivities = {},
        workingLocations = [], // Thêm working locations
        customDestinations = [] // Địa điểm user đã chọn
    } = preferences;
    const coord = provinceCoords[destination] || { lat: 16.047, lng: 108.220 };
    
    // Map startTime thành departureTime
    const departureTime = startTime;
    
    // Tính ngân sách hàng ngày CHO 1 NGƯỜI
    // Công thức: (Tổng budget - Transport - Accommodation) / (Số ngày × Số người)
    // Ước tính: Transport ~20%, Accommodation ~25%, Activities ~55%
    const budgetPerPerson = budget / travelers;
    const dailyBudgetPerPerson = budget ? (budget * 0.55) / (duration * travelers) : 500000;
    
    console.log(`💰 Budget breakdown:`);
    console.log(`  - Total budget: ${budget.toLocaleString()}đ`);
    console.log(`  - Per person: ${budgetPerPerson.toLocaleString()}đ`);
    console.log(`  - Daily budget per person: ${dailyBudgetPerPerson.toLocaleString()}đ`);
    console.log(`  - Travelers: ${travelers} people`);
    
    // Điều chỉnh dailyBudget theo số người (nhóm đông có thể tiết kiệm hơn)
    let dailyBudget = dailyBudgetPerPerson;
    if (travelers >= 4) {
        // Nhóm 4+ người: giảm 10% chi phí/người (chia sẻ xe, phòng...)
        dailyBudget = dailyBudgetPerPerson * 0.9;
        console.log(`  - Group discount (4+ people): -10% → ${dailyBudget.toLocaleString()}đ/person/day`);
    } else if (travelers >= 6) {
        // Nhóm 6+ người: giảm 15%
        dailyBudget = dailyBudgetPerPerson * 0.85;
        console.log(`  - Group discount (6+ people): -15% → ${dailyBudget.toLocaleString()}đ/person/day`);
    }
    
    // Phân bổ customDestinations vào các ngày nếu có
    let destinationsPerDay = [];
    if (customDestinations && customDestinations.length > 0) {
        try {
            console.log(`📍 User selected ${customDestinations.length} custom destinations, distributing across ${duration} days...`);
            
            // Import distributeDestinationsAcrossDays
            const { distributeDestinationsAcrossDays } = require('./dailyItineraryOptimizer');
            
            // Phân bổ địa điểm vào các ngày
            destinationsPerDay = distributeDestinationsAcrossDays(customDestinations, duration, { interests, travelStyle });
            
            console.log('✅ Destinations distributed:', destinationsPerDay.map(d => `Day ${d.day}: ${d.count} destinations`).join(', '));
        } catch (error) {
            console.error('❌ Error distributing destinations:', error);
            // Fallback: phân bổ đơn giản nếu lỗi
            destinationsPerDay = Array.from({ length: duration }, (_, i) => ({
                day: i + 1,
                destinations: [],
                count: 0
            }));
            customDestinations.forEach((dest, index) => {
                const dayIndex = index % duration;
                destinationsPerDay[dayIndex].destinations.push(dest);
                destinationsPerDay[dayIndex].count++;
            });
            console.log('⚠️ Using fallback distribution');
        }
    }
    
    const dailyPlans = [];

    for (let day = 0; day < duration; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);
        const dateString = currentDate.toISOString().split('T')[0];
        
        // Lấy working locations cho ngày này
        const dayWorkingLocations = workingLocations.filter(loc => 
            loc.isAllDays || (loc.workingDays && loc.workingDays.includes(dateString))
        );
        
        // Lấy customDestinations cho ngày này (nếu có)
        const dayCustomDestinations = destinationsPerDay[day]?.destinations || [];
        
        // Tạo kế hoạch cho từng ngày với ngân sách và departureTime
        const dayPlan = await generateSingleDayPlan(
            day + 1, 
            currentDate, 
            destination, 
            coord, 
            interests, 
            travelStyle, 
            dailyBudget,
            budget,
            travelers,
            departureTime,
            specialActivities,
            dayCustomDestinations, // Truyền custom destinations cho ngày này
            duration,
            dayWorkingLocations // Truyền working locations cho ngày này
        );
        dailyPlans.push(dayPlan);
    }

    return dailyPlans;
};

/**
 * Tạo kế hoạch cho một ngày cụ thể - CẢI THIỆN ĐA DẠNG
 */
const generateSingleDayPlan = async (
    dayNumber, 
    date, 
    destination, 
    coord, 
    interests, 
    travelStyle, 
    dailyBudget = 500000,
    budget = 5000000,
    travelers = 2,
    departureTime = '08:00',
    specialActivities = {},
    customDestinations = [],
    duration = 3,
    workingLocations = [] // Thêm working locations
) => {
    try {
        console.log(`📅 Generating DIVERSE day plan for Day ${dayNumber} in ${destination}...`);

        // Tìm địa điểm tham quan
        let destinations = [];
        
        try {
            // Nếu có customDestinations (user đã chọn), ưu tiên dùng chúng
            if (customDestinations && customDestinations.length > 0) {
                console.log(`📍 Using ${customDestinations.length} custom destinations for Day ${dayNumber}`);
                destinations = customDestinations;
            } else {
                // Nếu không có, tìm địa điểm ĐA DẠNG từ hệ thống
                destinations = await findRealDestinationsForDay(dayNumber, destination, coord, interests, travelStyle, dailyBudget);
            }
            
            // ✨ TỐI ƯU ROUTE: Sắp xếp địa điểm theo:
            // 1. Loại địa điểm (sáng: tham quan, trưa: ăn, chiều: giải trí...)
            // 2. Khoảng cách gần nhất trong cùng loại
            // 3. Logic hợp lý
            if (destinations.length > 1) {
                console.log(`🗺️ Optimizing route for ${destinations.length} destinations on Day ${dayNumber}...`);
                try {
                    destinations = optimizeDayRoute(destinations, { interests, travelStyle });
                    console.log(`✅ Route optimized for Day ${dayNumber}:`, destinations.map(d => d.name).join(' → '));
                } catch (optimizeError) {
                    console.error(`⚠️ Error optimizing route for Day ${dayNumber}:`, optimizeError);
                    // Giữ nguyên thứ tự nếu lỗi
                    console.log(`⚠️ Keeping original order for Day ${dayNumber}`);
                }
            }
        } catch (error) {
            console.error(`❌ Error finding destinations for Day ${dayNumber}:`, error);
            // Fallback: tạo destinations rỗng
            destinations = [];
        }
        
        // Tìm nhà hàng ĐA DẠNG
        const restaurants = await findRealRestaurantsForDay(destination, coord, travelStyle);
        
        // Tìm quán ăn địa phương nếu user quan tâm food
        let localFoodVenues = [];
        if (interests.includes('food')) {
            localFoodVenues = await findLocalFoodVenues(destination, coord, travelStyle);
            console.log(`🍜 Found ${localFoodVenues.length} local food venues for day ${dayNumber}`);
            // Thêm vào danh sách nhà hàng
            restaurants.localFood = localFoodVenues;
        }
        
        // Tìm nightlife venues nếu user quan tâm
        let nightlifeVenues = [];
        if (interests.includes('nightlife')) {
            nightlifeVenues = await findNightlifeVenues(destination, coord, travelStyle);
            console.log(`🌃 Found ${nightlifeVenues.length} nightlife venues for day ${dayNumber}`);
        }
        
        // Thêm venues vào restaurants object
        restaurants.nightlife = nightlifeVenues;
        
        // Tạo lịch trình theo giờ phong phú
        const hourlySchedule = generateEnhancedHourlySchedule(
            dayNumber, 
            destinations, 
            restaurants, 
            interests,
            departureTime,
            specialActivities, // Sử dụng specialActivities từ parameter
            workingLocations, // Truyền working locations
            date // Truyền date object để business travel service sử dụng
        );

        // Lấy thời tiết thực tế với dự báo rủi ro (fallback nếu API key không có)
        const realWeather = await getRealWeatherForDay(destination, coord, date).catch(error => {
            console.warn('Weather API failed, using fallback:', error);
            return getDefaultWeatherForDestination(destination, date);
        });

        // Tạo theme đa dạng theo ngày
        const dayTheme = generateEnhancedDayTheme(dayNumber, destinations, interests, destination);

        // Kiểm tra xem ngày này có phải ngày làm việc không
        const dateString = date.toISOString().split('T')[0];
        const businessTravelService = require('./businessTravelScheduleService').default;
        const isWorkingDay = businessTravelService.isWorkingDay(dateString, workingLocations);
        const workingInfo = isWorkingDay ? businessTravelService.getWorkingInfoForDay(dateString, workingLocations) : null;
        
        return {
            day: dayNumber,
            date: date.toLocaleDateString('vi-VN'),
            dayOfWeek: date.toLocaleDateString('vi-VN', { weekday: 'long' }),
            dateISO: date.toISOString(),
            theme: dayTheme,
            
            // Thông tin công tác (nếu có)
            isWorkingDay: isWorkingDay,
            workingInfo: workingInfo,
            
            // Lịch trình theo giờ chi tiết và đa dạng
            schedule: hourlySchedule,
            
            // Danh sách địa điểm THỰC TẾ và ĐA DẠNG
            destinations: destinations.map(dest => {
                // Đảm bảo entryFee luôn có giá trị hợp lệ
                let entryFee = dest.entryFee;
                if (entryFee === undefined || entryFee === null) {
                    // Nếu chưa có entryFee, ước tính từ tên
                    entryFee = estimateEntryFeeFromName(dest.name);
                    console.log(`  💰 Estimated entry fee for ${dest.name}: ${entryFee.toLocaleString()}đ`);
                }
                
                return {
                    ...dest,
                    visitTime: dest.estimatedDuration || '1-2 giờ',
                    entryFee: entryFee,
                    notes: dest.specialNotes || [],
                    isOpen: dest.isOpen,
                    crowdLevel: dest.currentCrowdLevel,
                    bestTimeToVisit: dest.bestTimeToVisit,
                    category: dest.category || 'general'
                };
            }),
            
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
            lastUpdated: Timestamp.now(),
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
            location: createLocationInfo(dest),
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
const generateCostBreakdown = async (preferences, dailyItinerary, accommodationPlan = null) => {
    const { travelers, duration, travelStyle, departureCity, destination, budget } = preferences;
    
    // 1. Chi phí xe khứ hồi (intercity transport)
    const transportCost = calculateTransportCost(departureCity, destination, travelers, travelStyle);
    
    // 2. Chi phí khách sạn
    const accommodationCost = calculateAccommodationCost(duration - 1, travelers, travelStyle, accommodationPlan);
    
    // 3. Tính chi phí từ các ngày với GROUP DISCOUNT
    // Thay vì dùng estimatedCost × travelers (không có discount),
    // tính từ các hàm chi tiết đã có group discount
    const foodCostDetail = calculateFoodCostFromDays(dailyItinerary, travelers);
    const sightseeingCostDetail = calculateSightseeingCostFromDays(dailyItinerary, travelers);
    const localTransportCostDetail = calculateLocalTransportCostFromDays(dailyItinerary, travelers);
    
    // Tính misc cost (phát sinh nhỏ: nước uống, tip...)
    // 30k/người/ngày, nhưng nhóm đông có thể chia sẻ
    const miscCostPerPersonPerDay = 30000;
    let miscMultiplier = travelers;
    if (travelers >= 4) {
        miscMultiplier = travelers * 0.9; // Giảm 10% cho nhóm 4+
    }
    const miscCost = roundPrice(miscCostPerPersonPerDay * duration * miscMultiplier);
    
    // Tổng chi phí activities = Food + Sightseeing + LocalTransport + Misc
    const dailyActivitiesCost = foodCostDetail + sightseeingCostDetail + localTransportCostDetail + miscCost;
    
    console.log(`📊 Daily activities breakdown:`);
    console.log(`  - Food: ${foodCostDetail.toLocaleString()}đ (with group discount)`);
    console.log(`  - Sightseeing: ${sightseeingCostDetail.toLocaleString()}đ (no discount)`);
    console.log(`  - Local Transport: ${localTransportCostDetail.toLocaleString()}đ (with group discount)`);
    console.log(`  - Misc: ${miscCost.toLocaleString()}đ`);
    console.log(`  - TOTAL Activities: ${dailyActivitiesCost.toLocaleString()}đ`);
    
    // Tổng chi phí = Xe khứ hồi + Khách sạn + Hoạt động các ngày
    const subtotal = transportCost + accommodationCost + dailyActivitiesCost;
    
    // Chi phí phát sinh 5% (giảm từ 15% xuống 5%)
    const contingencyCost = roundPrice(subtotal * 0.05);
    
    // Tổng cộng (làm tròn)
    const grandTotal = roundPrice(subtotal + contingencyCost);

    console.log('');
    console.log('💰 ========== COST BREAKDOWN SUMMARY ==========');
    console.log(`📊 Trip: ${departureCity} → ${destination} (${duration} days, ${travelers} people)`);
    console.log(`💵 Total Budget: ${budget.toLocaleString()}đ`);
    console.log(`👤 Budget per person: ${Math.round(budget/travelers).toLocaleString()}đ`);
    console.log('');
    console.log('📋 Breakdown:');
    console.log(`  1. Transport (round trip):`);
    console.log(`     ${transportCost.toLocaleString()}đ (${Math.round(transportCost/travelers).toLocaleString()}đ/person)`);
    console.log(`  2. Accommodation (${duration-1} nights):`);
    console.log(`     ${accommodationCost.toLocaleString()}đ (${Math.round(accommodationCost/travelers).toLocaleString()}đ/person)`);
    console.log(`  3. Daily Activities (${duration} days × ${travelers} people):`);
    console.log(`     ${dailyActivitiesCost.toLocaleString()}đ (${Math.round(dailyActivitiesCost/travelers).toLocaleString()}đ/person)`);
    console.log(`     ├─ Food: ${foodCostDetail.toLocaleString()}đ`);
    console.log(`     ├─ Sightseeing: ${sightseeingCostDetail.toLocaleString()}đ`);
    console.log(`     └─ Local Transport: ${localTransportCostDetail.toLocaleString()}đ`);
    console.log(`  4. Contingency (5%):`);
    console.log(`     ${contingencyCost.toLocaleString()}đ`);
    console.log('');
    console.log(`💎 GRAND TOTAL: ${grandTotal.toLocaleString()}đ`);
    console.log(`👤 Per person: ${Math.round(grandTotal/travelers).toLocaleString()}đ`);
    console.log(`📊 Budget status: ${grandTotal <= budget ? '✅ Within budget' : '⚠️ Over budget'}`);
    if (grandTotal <= budget) {
        console.log(`💰 Remaining: ${(budget - grandTotal).toLocaleString()}đ`);
    } else {
        console.log(`⚠️ Exceeded by: ${(grandTotal - budget).toLocaleString()}đ`);
    }
    console.log('===============================================');
    console.log('');

    return {
        transport: {
            intercity: transportCost,
            local: localTransportCostDetail,
            total: transportCost + localTransportCostDetail,
            details: getTransportDetails(departureCity, destination, travelStyle)
        },
        accommodation: {
            total: accommodationCost,
            perNight: Math.round(accommodationCost / (duration - 1)),
            nights: duration - 1,
            type: 'Khách sạn',
            bookingLinks: generateBookingLinks(destination, travelStyle)
        },
        food: {
            total: foodCostDetail,
            perDay: Math.round(foodCostDetail / duration),
            perPerson: Math.round(foodCostDetail / travelers),
            breakdown: getFoodCostBreakdown(dailyItinerary)
        },
        sightseeing: {
            total: sightseeingCostDetail,
            perPerson: Math.round(sightseeingCostDetail / travelers),
            breakdown: getSightseeingCostBreakdown(dailyItinerary)
        },
        contingency: {
            amount: contingencyCost,
            percentage: 5,
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
 * 4. TẠO KẾ HOẠCH PHƯƠNG TIỆN DI CHUYỂN - TÍCH HỢP AMADEUS
 */
const generateTransportPlan = async (preferences) => {
    const { departureCity, destination, travelStyle, startDate, duration, travelers } = preferences;
    
    // Tính khoảng cách giữa 2 thành phố
    const distance = calculateDistanceBetweenCities(departureCity, destination);
    
    // Ngày về = ngày đi + số ngày chơi
    const returnDate = new Date(startDate);
    returnDate.setDate(returnDate.getDate() + duration);
    
    // Lấy options cho chiều đi
    const departureOptions = await getIntercityTransportOptions(
        departureCity, 
        destination, 
        travelStyle, 
        startDate, 
        travelers,
        distance
    );
    
    // Lấy options cho chiều về
    const returnOptions = await getIntercityTransportOptions(
        destination,
        departureCity, 
        travelStyle, 
        returnDate.toISOString(), 
        travelers,
        distance
    );
    
    return {
        // Đi từ nơi ở đến điểm du lịch
        intercity: {
            distance: distance,
            departure: {
                from: departureCity,
                to: destination,
                date: new Date(startDate).toLocaleDateString('vi-VN'),
                dateISO: startDate,
                options: departureOptions,
                recommended: getRecommendedTransport(departureOptions, distance)
            },
            return: {
                from: destination,
                to: departureCity,
                date: returnDate.toLocaleDateString('vi-VN'),
                dateISO: returnDate.toISOString(),
                options: returnOptions,
                recommended: getRecommendedTransport(returnOptions, distance)
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
const generateAccommodationPlan = async (preferences, dailyItinerary = null) => {
    const { destination, duration, travelers, travelStyle, startDate, budget } = preferences;
    
    const checkInDate = new Date(startDate);
    const checkOutDate = new Date(startDate);
    checkOutDate.setDate(checkOutDate.getDate() + duration - 1);
    const nights = duration - 1;
    
    // Tính tọa độ trung tâm từ các địa điểm trong lịch trình (nếu có)
    let coord = provinceCoords[destination] || { lat: 16.047, lng: 108.220 };
    if (dailyItinerary && dailyItinerary.length > 0) {
        const allDestinations = dailyItinerary.flatMap(day => day.destinations || []);
        if (allDestinations.length > 0) {
            // Tính tọa độ trung tâm của tất cả địa điểm
            const validDests = allDestinations.filter(d => d.lat && d.lng);
            if (validDests.length > 0) {
                const avgLat = validDests.reduce((sum, d) => sum + d.lat, 0) / validDests.length;
                const avgLng = validDests.reduce((sum, d) => sum + d.lng, 0) / validDests.length;
                coord = { lat: avgLat, lng: avgLng };
                console.log(`🏨 Tìm khách sạn gần các địa điểm tham quan (${validDests.length} địa điểm)`);
            }
        }
    }
    
    // Lấy danh sách khách sạn thực tế từ Google API
    const hotelOptions = await findAccommodationOptions(destination, travelStyle, travelers, budget, nights);
    
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
            createdAt: Timestamp.now(),
            lastUpdated: Timestamp.now(),
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
            activity.includes('lighthouse') || 
            activity.includes('photography') ||
            activity.includes('sand dunes') ||
            activity.includes('coastal')
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
        `coastal walks ${destination}`
    ];
};

/**
 * Lấy thời gian phù hợp cho hoạt động dựa trên tên địa điểm
 */
const getOptimalTimeForActivity = (placeName, currentTime) => {
    const name = placeName.toLowerCase();
    const [hours] = currentTime.split(':').map(Number);
    

    
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
            tertiary: [`observation decks ${destination}`, `lookout points ${destination}`, `panoramic spots ${destination}`]
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
            
            // Format data để match với MyTrips component
            itineraries.push({
                id: docSnap.id,
                tripName: data.header?.tripName || `Chuyến đi ${data.header?.destination?.main}`,
                destination: data.header?.destination?.main,
                startDate: data.header?.duration?.startDate,
                endDate: data.header?.duration?.endDateISO,
                duration: data.header?.duration?.days,
                travelers: typeof data.header?.travelers === 'object' 
                    ? data.header.travelers?.total || data.header.travelers?.adults || 2 
                    : data.header?.travelers || 2,
                budget: data.header?.budget?.total,
                createdAt: data.createdAt,
                status: data.status || 'active', // ✅ Fetch từ Firestore, fallback 'active'
                cancelReason: data.cancelReason,
                cancelledAt: data.cancelledAt,
                completedAt: data.completedAt,
                lastUpdated: data.lastUpdated,
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
    // Tính khoảng cách
    const distance = calculateDistanceBetweenCities(from, to);
    
    // Sử dụng dữ liệu thực từ CSV cho xe khách
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
    
    // Nếu khoảng cách > 500km, ước tính giá máy bay
    if (distance > 500) {
        const flightEstimate = amadeusService.getEstimatedFlightPrice(from, to, travelers);
        if (flightEstimate) {
            const totalCost = flightEstimate.totalPrice * 2; // Khứ hồi
            console.log(`✈️ Flight cost ${from} ↔ ${to}: ${totalCost.toLocaleString('vi-VN')}đ (${travelers} người)`);
            return roundPrice(totalCost);
        }
    }
    
    // Fallback nếu không tìm thấy trong CSV
    const baseCost = TRANSPORT_OPTIONS.intercity[style]?.cost || 800000;
    return roundPrice(Math.min(baseCost * travelers, 1500000));
};

// Hàm làm tròn giá tiền (làm tròn đến 10,000)
const roundPrice = (price) => {
    return Math.round(price / 10000) * 10000;
};

// Tính khoảng cách giữa 2 thành phố (km)
// Helper: Tính khoảng cách giữa 2 điểm (km) - Haversine formula
const calculateDistanceBetweenPoints = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 999; // Invalid coordinates
    
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

const calculateDistanceBetweenCities = (city1, city2) => {
    const coord1 = provinceCoords[city1];
    const coord2 = provinceCoords[city2];
    
    if (!coord1 || !coord2) {
        console.warn(`⚠️ No coordinates for ${city1} or ${city2}`);
        return 500; // Default 500km
    }
    
    return Math.round(calculateDistanceBetweenPoints(coord1.lat, coord1.lng, coord2.lat, coord2.lng));
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

// CÁC HÀM TÍNH CHI PHÍ CŨ - GIỮ LẠI ĐỂ TƯƠNG THÍCH
const calculateFoodCost = (dailyItinerary, travelers, travelStyle) => {
    // Giảm chi phí ăn uống xuống 150k/người/ngày
    return dailyItinerary.length * 150000 * travelers;
};

const calculateSightseeingCost = (dailyItinerary, travelers) => {
    // Giảm phí tham quan xuống 30k/địa điểm
    const totalEntryFees = dailyItinerary.reduce((sum, day) => 
        sum + day.destinations.reduce((daySum, dest) => daySum + (dest.entryFee || 30000), 0), 0
    );
    return totalEntryFees * travelers;
};

const calculateLocalTransportCost = (duration, travelers, style) => {
    // Chi phí di chuyển địa phương/người/ngày
    const dailyCostPerPerson = TRANSPORT_OPTIONS.local[style]?.costPerDay || 80000;
    
    // Áp dụng group discount (giống calculateLocalTransportCostFromDays)
    let groupMultiplier = travelers;
    if (travelers === 1) {
        groupMultiplier = 1;
    } else if (travelers === 2) {
        groupMultiplier = 2;
    } else if (travelers <= 4) {
        groupMultiplier = travelers * 0.6;
    } else if (travelers <= 7) {
        groupMultiplier = travelers * 0.4;
    } else {
        groupMultiplier = travelers * 0.5;
    }
    
    const totalCost = dailyCostPerPerson * duration * groupMultiplier;
    return roundPrice(totalCost);
};

// CÁC HÀM TÍNH CHI PHÍ MỚI - TRÍCH XUẤT TỪ estimatedCost CỦA TỪNG NGÀY
const calculateFoodCostFromDays = (dailyItinerary, travelers) => {
    // Tính tổng chi phí ăn uống từ meals của từng ngày
    let totalFoodCostPerPerson = 0;
    dailyItinerary.forEach(day => {
        if (day.meals) {
            if (day.meals.breakfast?.estimatedCost) totalFoodCostPerPerson += day.meals.breakfast.estimatedCost;
            if (day.meals.lunch?.estimatedCost) totalFoodCostPerPerson += day.meals.lunch.estimatedCost;
            if (day.meals.dinner?.estimatedCost) totalFoodCostPerPerson += day.meals.dinner.estimatedCost;
            // Không tính street food và cafe vào tổng (optional)
        }
    });
    
    // Áp dụng group discount cho ăn uống
    // Khi đi nhóm: gọi món chung, chia nhau, combo nhóm → tiết kiệm hơn
    let groupMultiplier = travelers;
    
    if (travelers === 1) {
        groupMultiplier = 1.0;        // 1 người: 100%
    } else if (travelers === 2) {
        groupMultiplier = 1.95;       // 2 người: 97.5% (giảm 2.5%)
    } else if (travelers <= 4) {
        groupMultiplier = travelers * 0.9;  // 3-4 người: 90% (giảm 10%)
    } else if (travelers <= 6) {
        groupMultiplier = travelers * 0.85; // 5-6 người: 85% (giảm 15%)
    } else {
        groupMultiplier = travelers * 0.8;  // 7+ người: 80% (giảm 20%)
    }
    
    const totalFoodCost = totalFoodCostPerPerson * groupMultiplier;
    
    console.log(`🍜 Food cost calculation:`);
    console.log(`  - Base cost/person: ${totalFoodCostPerPerson.toLocaleString()}đ`);
    console.log(`  - Travelers: ${travelers} people`);
    console.log(`  - Group multiplier: ${groupMultiplier.toFixed(2)}x`);
    console.log(`  - Total: ${totalFoodCost.toLocaleString()}đ`);
    console.log(`  - Per person: ${Math.round(totalFoodCost/travelers).toLocaleString()}đ`);
    console.log(`  - Savings: ${Math.round((1 - groupMultiplier/travelers) * 100)}%`);
    
    return roundPrice(totalFoodCost);
};

const calculateSightseeingCostFromDays = (dailyItinerary, travelers) => {
    // Tính tổng chi phí vé tham quan từ destinations của từng ngày
    let totalEntryFees = 0;
    let destinationCount = 0;
    
    dailyItinerary.forEach(day => {
        if (day.destinations && day.destinations.length > 0) {
            day.destinations.forEach(dest => {
                const fee = dest.entryFee || 0;
                totalEntryFees += fee;
                destinationCount++;
                if (fee === 0) {
                    console.log(`  ⚠️ ${dest.name}: FREE (entryFee = 0)`);
                }
            });
        }
    });
    
    console.log(`🎯 Sightseeing cost: ${destinationCount} destinations, total fees = ${totalEntryFees.toLocaleString()}đ × ${travelers} people = ${(totalEntryFees * travelers).toLocaleString()}đ`);
    
    return roundPrice(totalEntryFees * travelers);
};

const calculateLocalTransportCostFromDays = (dailyItinerary, travelers) => {
    // Tính tổng chi phí di chuyển địa phương
    // CHI PHÍ NÀY ĐÃ TÍNH CHO NHÓM, KHÔNG NHÂN VỚI SỐ NGƯỜI
    
    // Tính chi phí di chuyển/người/ngày từ estimatedCost
    const transportCostPerPersonPerDay = dailyItinerary.reduce((sum, day) => {
        const dayCost = day.estimatedCost || 0;
        // 20% chi phí ngày là di chuyển
        return sum + (dayCost * 0.2);
    }, 0);
    
    // Áp dụng group discount cho di chuyển địa phương
    let groupMultiplier = travelers;
    
    if (travelers === 1) {
        // 1 người: phải trả full giá Grab/taxi
        groupMultiplier = 1;
    } else if (travelers === 2) {
        // 2 người: chia đôi chi phí xe
        groupMultiplier = 2;
    } else if (travelers <= 4) {
        // 3-4 người: thuê xe 4 chỗ, chi phí tăng ~60% so với 1 người
        groupMultiplier = travelers * 0.6;
    } else if (travelers <= 7) {
        // 5-7 người: thuê xe 7 chỗ, chi phí tăng ~40% so với 1 người
        groupMultiplier = travelers * 0.4;
    } else {
        // 8+ người: thuê 2 xe, chi phí tăng ~50% so với 1 người
        groupMultiplier = travelers * 0.5;
    }
    
    const totalTransportCost = transportCostPerPersonPerDay * groupMultiplier;
    
    console.log(`🚗 Local transport cost calculation:`);
    console.log(`  - Base cost/person: ${transportCostPerPersonPerDay.toLocaleString()}đ`);
    console.log(`  - Travelers: ${travelers} people`);
    console.log(`  - Group multiplier: ${groupMultiplier.toFixed(2)}x`);
    console.log(`  - Total: ${totalTransportCost.toLocaleString()}đ`);
    console.log(`  - Per person: ${Math.round(totalTransportCost/travelers).toLocaleString()}đ`);
    
    return roundPrice(totalTransportCost);
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

const getIntercityTransportOptions = async (from, to, travelStyle, date, travelers, distance) => {
    const options = [];
    
    // 1. LẤY VÉ XE KHÁCH TỪ CSV (luôn có)
    const busInfo = transportDataService.getTransportSuggestion(from, to);
    
    if (busInfo) {
        // Option xe khách rẻ nhất
        options.push({
            type: 'bus',
            name: 'Xe khách',
            provider: busInfo.cheapest.company,
            price: busInfo.cheapest.price * travelers,
            pricePerPerson: busInfo.cheapest.price,
            duration: `${busInfo.cheapest.duration}h`,
            departure: busInfo.cheapest.departureTime,
            arrival: busInfo.cheapest.arrivalTime,
            comfort: 'Ghế ngồi',
            recommended: distance < 300 // Recommend cho dưới 300km
        });
        
        // Option xe khách nhanh nhất (nếu khác)
        if (busInfo.fastest.company !== busInfo.cheapest.company) {
            options.push({
                type: 'bus',
                name: 'Xe khách (Nhanh)',
                provider: busInfo.fastest.company,
                price: busInfo.fastest.price * travelers,
                pricePerPerson: busInfo.fastest.price,
                duration: `${busInfo.fastest.duration}h`,
                departure: busInfo.fastest.departureTime,
                arrival: busInfo.fastest.arrivalTime,
                comfort: 'Ghế ngồi/Giường nằm',
                recommended: false
            });
        }
    }
    
    // 2. LẤY VÉ MÁY BAY (nếu khoảng cách >= 300km VÀ cả 2 thành phố đều có sân bay)
    const hasFromAirport = amadeusService.hasAirport(from);
    const hasToAirport = amadeusService.hasAirport(to);
    
    if (distance >= 300 && hasFromAirport && hasToAirport) {
        try {
            console.log(`✈️ Distance ${distance}km >= 300km, searching flights...`);
            const flights = await amadeusService.searchFlights(from, to, date, travelers);
            
            if (flights && flights.length > 0) {
                // Lọc chỉ lấy 1 vé/hãng (unique airlines)
                const uniqueAirlines = {};
                flights.forEach(flight => {
                    const airline = flight.airline;
                    if (!uniqueAirlines[airline] || flight.price < uniqueAirlines[airline].price) {
                        uniqueAirlines[airline] = flight;
                    }
                });
                
                // Chuyển thành array và sort theo giá
                const sortedFlights = Object.values(uniqueAirlines).sort((a, b) => a.price - b.price);
                console.log(`✈️ Filtered to ${sortedFlights.length} unique airlines:`, sortedFlights.map(f => f.airline).join(', '));
                
                sortedFlights.forEach((flight, index) => {
                    console.log(`✈️ Adding flight option: ${flight.airline} - Price: ${flight.price} VND (${flight.pricePerPerson} VND/person)`);
                    
                    const flightOption = {
                        type: 'flight',
                        name: index === 0 ? 'Máy bay (Rẻ nhất)' : 'Máy bay',
                        provider: flight.airline,
                        flightNumber: flight.flightNumber,
                        price: flight.price,
                        pricePerPerson: flight.pricePerPerson,
                        duration: amadeusService.formatDuration(flight.duration),
                        departure: new Date(flight.departure.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        arrival: new Date(flight.arrival.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        comfort: flight.bookingClass,
                        recommended: distance > 500 && index === 0
                    };
                    
                    console.log('🔍 Flight option object:', JSON.stringify(flightOption, null, 2));
                    options.push(flightOption);
                });
                
                console.log(`✅ Added ${sortedFlights.length} real flights from Amadeus`);
            } else {
                // Fallback: ước tính giá máy bay
                console.log('⚠️ No flights from Amadeus, using estimated prices');
                const estimated = amadeusService.getEstimatedFlightPrice(from, to, travelers);
                if (estimated) {
                    options.push({
                        type: 'flight',
                        name: 'Máy bay (Giá ước tính)',
                        provider: 'Vietnam Airlines/VietJet/Bamboo',
                        price: estimated.totalPrice,
                        pricePerPerson: estimated.pricePerPerson,
                        duration: '~2h',
                        departure: 'Nhiều giờ bay',
                        arrival: 'Nhiều giờ bay',
                        comfort: 'Economy',
                        estimated: true,
                        recommended: distance > 500,
                        note: 'Giá tham khảo, vui lòng kiểm tra khi đặt vé'
                    });
                }
            }
        } catch (error) {
            console.warn('⚠️ Amadeus API error, using estimated prices:', error.message);
            // Fallback: ước tính giá máy bay
            const estimated = amadeusService.getEstimatedFlightPrice(from, to, travelers);
            if (estimated) {
                options.push({
                    type: 'flight',
                    name: 'Máy bay (Giá ước tính)',
                    provider: 'Vietnam Airlines/VietJet/Bamboo',
                    price: estimated.totalPrice,
                    pricePerPerson: estimated.pricePerPerson,
                    duration: '~2h',
                    departure: 'Nhiều giờ bay',
                    arrival: 'Nhiều giờ bay',
                    comfort: 'Economy',
                    estimated: true,
                    recommended: distance > 500,
                    note: 'Giá tham khảo, vui lòng kiểm tra khi đặt vé'
                });
            }
        }
    }
    
    return options;
};

const getRecommendedTransport = (options, distance) => {
    if (!options || options.length === 0) return null;
    
    // Dưới 300km: Xe khách
    if (distance < 300) {
        return options.find(opt => opt.type === 'bus') || options[0];
    }
    
    // 300-500km: Ưu tiên xe khách nhưng gợi ý cả máy bay
    if (distance < 500) {
        const bus = options.find(opt => opt.type === 'bus');
        if (bus) {
            bus.note = 'Đề xuất cho khoảng cách này. Máy bay cũng là lựa chọn tốt.';
            return bus;
        }
    }
    
    // Trên 500km: Ưu tiên máy bay
    const flight = options.find(opt => opt.type === 'flight');
    if (flight) {
        flight.note = 'Đề xuất cho khoảng cách xa. Tiết kiệm thời gian.';
        return flight;
    }
    
    // Fallback: option đầu tiên
    return options[0];
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

const findAccommodationOptions = async (destination, style, travelers, budget, nights, startDate) => {
    try {
        console.log(`🏨 Finding real hotels in ${destination}...`);
        
        // Tìm khách sạn bằng text search từ Google Maps
        // Ưu tiên khách sạn ở trung tâm thành phố
        const coord = provinceCoords[destination] || { lat: 16.047, lng: 108.220 };
        const hotels = await searchPlacesByText(
            `hotels in downtown ${destination} city center`, // Thêm "downtown" và "city center"
            coord,
            5000, // 5km radius (giảm từ 10km để tập trung vào trung tâm)
            destination
        );
        
        console.log(`📍 Searching hotels within 5km of city center (${coord.lat}, ${coord.lng})`);
        
        if (!hotels || hotels.length === 0) {
            console.warn('No hotels found from API, using fallback');
            return getDefaultHotelOptions(style, nights);
        }
        
        // Tính ngân sách cho khách sạn (30-35% tổng budget)
        const accommodationBudget = budget * 0.35;
        const budgetPerNight = accommodationBudget / nights / travelers; // Chia cho số người
        
        console.log(`💰 Budget per night per person: ${formatMoney(budgetPerNight)}`);
        
        // Xác định price_level phù hợp với budget
        const targetPriceLevel = determinePriceLevelByBudget(budgetPerNight, style);
        console.log(`🎯 Target price level: ${targetPriceLevel} (based on budget ${formatMoney(budgetPerNight)}/night/person)`);
        
        // Format và tính giá cho từng khách sạn
        const formattedHotels = hotels
            .filter(hotel => {
                // Lọc rating
                if (hotel.rating < 3.5) return false;
                
                // Lọc chỉ lấy khách sạn (lodging)
                const types = hotel.types || [];
                if (!types.includes('lodging') && !types.includes('hotel')) {
                    return false;
                }
                
                // ✨ Lọc theo price_level phù hợp với budget
                const hotelPriceLevel = hotel.price_level !== undefined ? hotel.price_level : 2;
                // Chấp nhận khách sạn trong khoảng ±1 level
                if (Math.abs(hotelPriceLevel - targetPriceLevel) > 1) {
                    return false;
                }
                
                return true;
            })
            .map(hotel => {
                // Tính giá dựa trên price_level từ Google + thị trường thực tế
                const pricePerNight = calculateRealHotelPrice(hotel, destination, style, budgetPerNight * travelers);
                
                // Tính khoảng cách từ khách sạn đến trung tâm
                const hotelLat = hotel.geometry?.location?.lat;
                const hotelLng = hotel.geometry?.location?.lng;
                const distanceFromCenter = calculateDistanceBetweenPoints(coord.lat, coord.lng, hotelLat, hotelLng);
                
                return {
                    name: hotel.name,
                    rating: hotel.rating || 4.0,
                    pricePerNight: pricePerNight,
                    location: hotel.vicinity || hotel.formatted_address || 'Trung tâm',
                    amenities: getHotelAmenities(hotel, style),
                    address: hotel.vicinity || hotel.formatted_address,
                    lat: hotelLat,
                    lng: hotelLng,
                    photos: hotel.photos,
                    priceLevel: hotel.price_level,
                    distanceFromCenter: distanceFromCenter, // Khoảng cách đến trung tâm (km)
                    dataSource: 'google_maps_api'
                };
            })
            .filter(hotel => {
                // Lọc theo budget
                if (hotel.pricePerNight > budgetPerNight * travelers * 1.5) return false;
                // Lọc khách sạn quá xa (> 3km từ trung tâm)
                if (hotel.distanceFromCenter > 3) {
                    console.log(`  ⚠️ ${hotel.name} too far from center: ${hotel.distanceFromCenter.toFixed(1)}km`);
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                // 1. Ưu tiên khách sạn có price_level gần với target
                const aDiff = Math.abs((a.priceLevel || 2) - targetPriceLevel);
                const bDiff = Math.abs((b.priceLevel || 2) - targetPriceLevel);
                if (aDiff !== bDiff) return aDiff - bDiff;
                
                // 2. Ưu tiên khách sạn gần trung tâm hơn
                const distanceDiff = a.distanceFromCenter - b.distanceFromCenter;
                if (Math.abs(distanceDiff) > 0.5) return distanceDiff; // Chênh lệch > 0.5km
                
                // 3. Sau đó sort theo rating
                return b.rating - a.rating;
            })
            .slice(0, 5); // Lấy 5 khách sạn tốt nhất
        
        if (formattedHotels.length === 0) {
            console.warn('No hotels match budget, using fallback');
            return getDefaultHotelOptions(style, nights);
        }
        
        console.log(`✅ Found ${formattedHotels.length} hotels in ${destination}`);
        formattedHotels.forEach(h => {
            console.log(`  - ${h.name}: ${formatMoney(h.pricePerNight)}/đêm (price_level: ${h.priceLevel || 'N/A'})`);
        });
        
        return formattedHotels.slice(0, 3); // Trả về 3 khách sạn tốt nhất
        
    } catch (error) {
        console.error('Error finding hotels:', error);
        return getDefaultHotelOptions(style, nights);
    }
};

/**
 * Xác định price_level phù hợp với budget
 * Budget cao → gợi ý khách sạn cao cấp hơn
 */
const determinePriceLevelByBudget = (budgetPerNightPerPerson, travelStyle) => {
    // Điều chỉnh theo travel style
    const styleAdjustment = {
        budget: -0.5,    // Ưu tiên khách sạn rẻ hơn
        standard: 0,     // Trung bình
        comfort: 0.5,    // Ưu tiên khách sạn tốt hơn
        luxury: 1        // Ưu tiên khách sạn cao cấp
    }[travelStyle] || 0;
    
    // Xác định price_level dựa trên budget (VNĐ/đêm/người)
    let targetLevel;
    if (budgetPerNightPerPerson < 250000) {
        targetLevel = 0; // Nhà nghỉ, hostel
    } else if (budgetPerNightPerPerson < 400000) {
        targetLevel = 1; // Khách sạn 2 sao
    } else if (budgetPerNightPerPerson < 700000) {
        targetLevel = 2; // Khách sạn 3 sao
    } else if (budgetPerNightPerPerson < 1500000) {
        targetLevel = 3; // Khách sạn 4 sao
    } else {
        targetLevel = 4; // Khách sạn 5 sao, resort
    }
    
    // Điều chỉnh theo style
    targetLevel = Math.round(targetLevel + styleAdjustment);
    
    // Giới hạn trong khoảng 0-4
    targetLevel = Math.max(0, Math.min(4, targetLevel));
    
    return targetLevel;
};

/**
 * Tính giá khách sạn THỰC TẾ dựa trên:
 * - price_level từ Google Maps (0-4)
 * - Thành phố (giá khác nhau theo địa điểm)
 * - Travel style
 * - Tên khách sạn (để tạo sự đa dạng giá)
 * - Dữ liệu thị trường thực tế Việt Nam
 */
const calculateRealHotelPrice = (hotel, destination, travelStyle, budgetPerNight) => {
    const priceLevel = hotel.price_level !== undefined ? hotel.price_level : 2; // 0-4 scale
    
    // Giá cơ bản theo thành phố (dựa trên thị trường thực tế VN)
    const cityPriceMultiplier = {
        'Hà Nội': 1.2,
        'TP Hồ Chí Minh': 1.3,
        'Đà Nẵng': 1.1,
        'Nha Trang': 1.0,
        'Phú Quốc': 1.4,
        'Đà Lạt': 0.9,
        'Vũng Tàu': 0.9,
        'Hội An': 1.0,
        'Huế': 0.8,
        'Cần Thơ': 0.7,
        'Quy Nhơn': 0.8
    };
    
    const cityMultiplier = cityPriceMultiplier[destination] || 1.0;
    
    // Giá cơ bản theo price_level (dựa trên khảo sát thị trường thực tế)
    const basePricesByLevel = {
        0: 150000,   // Nhà nghỉ, hostel giá rẻ
        1: 300000,   // Khách sạn 2 sao
        2: 600000,   // Khách sạn 3 sao
        3: 1200000,  // Khách sạn 4 sao
        4: 2500000   // Khách sạn 5 sao, resort cao cấp
    };
    
    let basePrice = basePricesByLevel[priceLevel] || 600000;
    
    // Điều chỉnh theo thành phố
    basePrice = Math.round(basePrice * cityMultiplier);
    
    // Điều chỉnh theo travelStyle
    const styleMultiplier = {
        budget: 0.8,      // Tìm phòng giá rẻ hơn
        standard: 1.0,    // Giá trung bình
        comfort: 1.2,     // Phòng tốt hơn
        luxury: 1.5       // Phòng cao cấp nhất
    }[travelStyle] || 1.0;
    
    let finalPrice = Math.round(basePrice * styleMultiplier);
    
    // Điều chỉnh theo rating (khách sạn rating cao thường đắt hơn)
    if (hotel.rating >= 4.5) {
        finalPrice = Math.round(finalPrice * 1.15);
    } else if (hotel.rating >= 4.0) {
        finalPrice = Math.round(finalPrice * 1.05);
    } else if (hotel.rating < 3.8) {
        finalPrice = Math.round(finalPrice * 0.9);
    }
    
    // ✨ TẠO SỰ ĐA DẠNG GIÁ dựa trên tên khách sạn
    // Sử dụng hash của tên để tạo variation ổn định (không thay đổi mỗi lần load)
    const nameHash = hotel.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variationPercent = (nameHash % 21) - 10; // -10% đến +10%
    const variationMultiplier = 1 + (variationPercent / 100);
    finalPrice = Math.round(finalPrice * variationMultiplier);
    
    // Kiểm tra từ khóa trong tên để điều chỉnh giá
    const hotelName = hotel.name.toLowerCase();
    if (hotelName.includes('resort') || hotelName.includes('grand') || hotelName.includes('royal')) {
        finalPrice = Math.round(finalPrice * 1.15); // Resort/Grand thường đắt hơn
    } else if (hotelName.includes('boutique') || hotelName.includes('premium')) {
        finalPrice = Math.round(finalPrice * 1.1);
    } else if (hotelName.includes('budget') || hotelName.includes('hostel')) {
        finalPrice = Math.round(finalPrice * 0.85);
    }
    
    // Đảm bảo không vượt quá budget quá nhiều
    if (finalPrice > budgetPerNight * 1.5) {
        finalPrice = Math.round(budgetPerNight * 1.3);
    }
    
    // Đảm bảo giá tối thiểu hợp lý
    if (finalPrice < 150000) {
        finalPrice = 150000;
    }
    
    // Làm tròn đẹp (về bội số 10,000)
    finalPrice = Math.round(finalPrice / 10000) * 10000;
    
    return finalPrice;
};

// Lấy amenities dựa trên hotel info và travelStyle
const getHotelAmenities = (hotel, travelStyle) => {
    const baseAmenities = ['WiFi miễn phí', 'Điều hòa'];
    
    if (travelStyle === 'budget') {
        return [...baseAmenities, 'Nhà vệ sinh riêng'];
    } else if (travelStyle === 'standard') {
        return [...baseAmenities, 'TV', 'Tủ lạnh mini', 'Bữa sáng'];
    } else if (travelStyle === 'comfort') {
        return [...baseAmenities, 'TV', 'Tủ lạnh', 'Bữa sáng', 'Hồ bơi', 'Gym'];
    } else {
        return [...baseAmenities, 'TV 4K', 'Minibar', 'Bữa sáng buffet', 'Hồ bơi', 'Spa', 'Concierge'];
    }
};

// Khách sạn mặc định nếu không có dữ liệu
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

    if (interests.includes('nightlife')) {
        items.push('Trang phục dạo phố/đi bar', 'Giày/sandal thoải mái', 'Túi nhỏ đựng đồ cá nhân', 'Pin dự phòng');
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
        activities.push('Khám phá quán bar/pub địa phương', 'Thưởng thức nhạc sống', 'Trải nghiệm rooftop bar với view đẹp');
    }

    // Default activities
    activities.push('Dạo phố, chụp ảnh');
    activities.push('Uống cà phê, thư giãn');

    return activities;
};

const estimateEntryFee = (place, travelStyle = 'standard') => {
    const types = place.types || [];
    const name = (place.name || '').toLowerCase();
    
    // Địa điểm miễn phí
    if (types.includes('park') || types.includes('beach')) return 0;
    if (types.includes('church') || types.includes('temple')) return 0;
    if (name.includes('công viên') || name.includes('bãi biển')) return 0;
    if (name.includes('chùa') || name.includes('đền') || name.includes('miếu')) return 0;
    
    // Điều chỉnh theo travelStyle
    const multiplier = {
        budget: 0.7,
        standard: 1.0,
        comfort: 1.3,
        luxury: 1.5
    }[travelStyle] || 1.0;
    
    // Địa điểm có phí
    if (types.includes('museum') || name.includes('bảo tàng')) {
        return Math.round(40000 * multiplier);
    }
    if (types.includes('amusement_park') || name.includes('khu vui chơi')) {
        return Math.round(150000 * multiplier);
    }
    if (types.includes('zoo') || name.includes('thảo cầm viên')) {
        return Math.round(60000 * multiplier);
    }
    if (types.includes('aquarium') || name.includes('thủy cung')) {
        return Math.round(100000 * multiplier);
    }
    if (types.includes('tourist_attraction')) {
        return Math.round(30000 * multiplier);
    }
    
    // Default cho địa điểm khác
    return Math.round(20000 * multiplier);
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
    
    // 100k-500k
    premium: {
        keywords: ['cáp treo', 'cable', 'khu vui chơi', 'amusement', 'vinpearl', 'bà nà', 'sun world', 'safari', 'aquarium', 'thủy cung'],
        price: 300000
    },
    
    // 500k+
    ultra_premium: {
        keywords: ['vinwonders', 'vinpearl land', 'bà nà hills'],
        price: 700000
    }
};

const estimateEntryFeeFromName = (name) => {
    if (!name) return 40000; // Tăng giá mặc định lên 40k
    
    const lowerName = name.toLowerCase();
    
    // Kiểm tra miễn phí
    if (ENTRY_FEES.free.some(keyword => lowerName.includes(keyword))) {
        return 0;
    }
    
    // Kiểm tra ultra premium
    if (ENTRY_FEES.ultra_premium.keywords.some(keyword => lowerName.includes(keyword))) {
        return ENTRY_FEES.ultra_premium.price;
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

/**
 * Kiểm tra xem địa điểm có phải là premium không
 */
const isPremiumAttraction = (name) => {
    if (!name) return false;
    const lowerName = name.toLowerCase();
    const premiumKeywords = [
        'vinpearl', 'vinwonders', 'sun world', 'bà nà', 'ba na',
        'cable car', 'cáp treo', 'fansipan', 'safari',
        'resort', 'luxury', 'premium', '5 sao', 'five star'
    ];
    return premiumKeywords.some(keyword => lowerName.includes(keyword));
};

/**
 * Nhóm các địa điểm cùng khu vực/tên tương tự
 * VD: Vinpearl, VinWonders, Vinpearl Land = cùng 1 nhóm
 */
const ATTRACTION_GROUPS = {
    // Nha Trang - Vinpearl group
    'vinpearl_nhatrang': ['vinpearl', 'vinwonders', 'vin pearl', 'vin wonders', 'vinpearl land', 'vinpearl resort nha trang'],
    
    // Đà Nẵng - Bà Nà group
    'bana_danang': ['bà nà', 'ba na', 'sun world', 'cầu vàng', 'golden bridge', 'ba na hills'],
    
    // Phú Quốc - Vinpearl group
    'vinpearl_phuquoc': ['vinpearl safari', 'vinwonders phu quoc', 'vinpearl phu quoc', 'grand world'],
    
    // Hạ Long - Sun World group
    'sunworld_halong': ['sun world halong', 'sun world ha long', 'queen cable car'],
    
    // Sapa - Fansipan group
    'fansipan_sapa': ['fansipan', 'cáp treo fansipan', 'fansipan cable car', 'đỉnh fansipan'],
    
    // Vũng Tàu - Núi Nhỏ group
    'nuinho_vungtau': ['tượng chúa', 'ngọn hải đăng', 'núi nhỏ', 'christ statue', 'lighthouse vung tau'],
    
    // Đà Lạt - Hồ group
    'lake_dalat': ['hồ xuân hương', 'hồ than thở', 'hồ tuyền lâm', 'lake xuan huong']
};

/**
 * Lấy nhóm của địa điểm (nếu có)
 */
const getAttractionGroup = (name) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();
    
    for (const [groupId, keywords] of Object.entries(ATTRACTION_GROUPS)) {
        if (keywords.some(keyword => lowerName.includes(keyword))) {
            return groupId;
        }
    }
    return null;
};

/**
 * Kiểm tra 2 địa điểm có cùng nhóm không
 */
const isSameAttractionGroup = (name1, name2) => {
    const group1 = getAttractionGroup(name1);
    const group2 = getAttractionGroup(name2);
    
    if (!group1 || !group2) return false;
    return group1 === group2;
};

/**
 * Nhóm các nhà hàng cùng chuỗi/brand
 */
const RESTAURANT_CHAINS = [
    // Chuỗi nhà hàng quốc tế
    ['kfc', 'kentucky fried chicken'],
    ['mcdonald', 'mcdonalds', 'mcdonald\'s'],
    ['lotteria', 'lotte'],
    ['pizza hut', 'pizza'],
    ['starbucks', 'starbuck'],
    ['highland', 'highlands coffee'],
    ['phở 24', 'pho 24'],
    ['cơm tấm', 'com tam'],
    
    // Chuỗi nhà hàng Việt Nam
    ['golden gate', 'gogi', 'sumo bbq', 'kichi kichi', 'hotpot story'],
    ['quán ăn ngon', 'quan an ngon'],
    ['phở hòa', 'pho hoa'],
    ['bún chả hương liên', 'bun cha huong lien'],
    
    // Chuỗi cafe
    ['trung nguyên', 'trung nguyen'],
    ['phúc long', 'phuc long'],
    ['the coffee house', 'coffee house'],
    ['cộng cà phê', 'cong ca phe']
];

/**
 * Kiểm tra 2 nhà hàng có cùng chuỗi không
 */
const isSameRestaurantChain = (name1, name2) => {
    if (!name1 || !name2) return false;
    
    const lower1 = name1.toLowerCase();
    const lower2 = name2.toLowerCase();
    
    // Kiểm tra có cùng chuỗi không
    for (const chain of RESTAURANT_CHAINS) {
        const in1 = chain.some(keyword => lower1.includes(keyword));
        const in2 = chain.some(keyword => lower2.includes(keyword));
        
        if (in1 && in2) {
            return true; // Cùng chuỗi
        }
    }
    
    return false;
};

/**
 * Kiểm tra xem nhà hàng có phải là luxury không
 */
const isLuxuryRestaurant = (name) => {
    if (!name) return false;
    const lowerName = name.toLowerCase();
    const luxuryKeywords = [
        'fine dining', 'luxury', 'premium', '5 sao', 'five star',
        'rooftop', 'sky', 'intercontinental', 'sheraton', 'marriott',
        'hilton', 'hyatt', 'pullman', 'novotel', 'lotte',
        'cao cấp', 'sang trọng', 'resort'
    ];
    return luxuryKeywords.some(keyword => lowerName.includes(keyword));
};

/**
 * Ước tính giá bữa ăn từ price_level của Google Places
 * @param {number} priceLevel - Google Places price_level (0-4)
 * @param {string} mealType - breakfast, lunch, dinner
 * @param {string} travelStyle - budget, standard, comfort, luxury
 */
const estimateMealCostFromPriceLevel = (priceLevel, mealType, travelStyle) => {
    const styleCosts = MEAL_COSTS[travelStyle] || MEAL_COSTS.standard;
    const mealCosts = styleCosts[mealType] || styleCosts.lunch;
    
    // Map Google price_level (0-4) to cost
    // 0 = Free, 1 = Inexpensive, 2 = Moderate, 3 = Expensive, 4 = Very Expensive
    if (!priceLevel || priceLevel === 0) return mealCosts.min;
    if (priceLevel === 1) return mealCosts.min;
    if (priceLevel === 2) return mealCosts.avg;
    if (priceLevel === 3) return mealCosts.max;
    if (priceLevel === 4) return mealCosts.max * 1.5;
    
    return mealCosts.avg;
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

// optimizeDayRoute đã được import từ dailyItineraryOptimizer.js
// Các helper functions cho distance calculation
const routeOptimizationService = require('./routeOptimizationService').default;
const { haversineDistance } = routeOptimizationService;

const calculateDistance = (point1, point2) => {
    return haversineDistance(point1.lat || 0, point1.lng || 0, point2.lat || 0, point2.lng || 0);
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
    const transportInfo = transportDataService.getTransportSuggestion(from, to);
    
    if (!transportInfo) {
        return {
            type: 'Xe khách',
            duration: '8-10 giờ',
            cost: 300000,
            company: 'Các nhà xe',
            note: 'Đặt vé trước',
            bookingTips: [
                'Đặt vé trước 1-2 tuần để có giá tốt',
                'Kiểm tra chính sách hủy/đổi vé',
                'Mang theo giấy tờ tùy thân khi đi'
            ]
        };
    }
    
    // Chọn xe theo style
    const recommended = style === 'luxury' || style === 'comfort' 
        ? transportInfo.fastest 
        : transportInfo.cheapest;
    
    const details = {
        type: `Xe khách ${recommended.company}`,
        duration: `${recommended.duration}h`,
        cost: recommended.price,
        company: recommended.company,
        note: recommended.note || 'Xe khách',
        bookingTips: [
            'Đặt vé trước 1-2 tuần để có giá tốt',
            'Kiểm tra chính sách hủy/đổi vé',
            'Mang theo giấy tờ tùy thân khi đi',
            `Có ${transportInfo.allOptions.length} nhà xe khác nhau`
        ],
        allOptions: transportInfo.allOptions.length,
        priceRange: `${transportInfo.cheapest.price.toLocaleString('vi-VN')}đ - ${transportInfo.fastest.price.toLocaleString('vi-VN')}đ`
    };
    
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
    if (interests.includes('nightlife')) {
        categories = [...categories, 'night_club', 'bar', 'live_music', 'rooftop_bar', 'night_market'];
    }

    return [...new Set(categories)]; // Remove duplicates
};

/**
 * Tìm địa điểm thực tế cho từng ngày - SỬ DỤNG GOOGLE PLACES API
 * Ưu tiên địa điểm cao cấp nếu budget cao
 */
const findRealDestinationsForDay = async (dayNumber, destination, coord, interests, travelStyle = 'standard', dailyBudget = 500000) => {
    try {
        console.log(`🔍 Finding REAL destinations for Day ${dayNumber} in ${destination} (${travelStyle}, budget: ${dailyBudget})...`);
        
        // Tính toán khả năng chi trả cho địa điểm cao cấp
        const canAffordPremium = dailyBudget > 800000 || travelStyle === 'luxury' || travelStyle === 'comfort';
        console.log(`💰 Daily budget: ${dailyBudget.toLocaleString()}đ, Can afford premium: ${canAffordPremium}`);

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
            
            // Tạo queries dựa trên interests của user
            const interestBasedQueries = generateInterestBasedQueries(destination, interests, dayNumber);
            
            // Thêm queries cho địa điểm cao cấp nếu có budget
            const premiumQueries = canAffordPremium ? [
                `luxury attractions ${destination}`,
                `premium experiences ${destination}`,
                `vinpearl ${destination}`,
                `sun world ${destination}`,
                `cable car ${destination}`,
                `resort ${destination}`
            ] : [];
            
            const daySpecificQueries = {
                1: [
                    ...premiumQueries,
                    ...(interestBasedQueries.primary || []),
                    `tourist attractions ${destination}`,
                    `famous landmarks ${destination}`,
                    `must visit places ${destination}`,
                    `top sightseeing ${destination}`,
                    `popular destinations ${destination}`
                ],
                2: [
                    ...(canAffordPremium ? [`fine dining ${destination}`, `luxury experiences ${destination}`] : []),
                    ...(interestBasedQueries.secondary || []),
                    `museums ${destination}`,
                    `temples ${destination}`,
                    `cultural sites ${destination}`,
                    `historical places ${destination}`,
                    `art galleries ${destination}`
                ],
                3: [
                    ...(canAffordPremium ? [`beach resorts ${destination}`, `spa ${destination}`] : []),
                    ...(interestBasedQueries.tertiary || []),
                    `beaches ${destination}`,
                    `parks ${destination}`,
                    `nature spots ${destination}`,
                    `scenic viewpoints ${destination}`,
                    `outdoor activities ${destination}`
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
                                const hasGoodRating = place.rating >= 3.5;
                                const hasReviews = place.user_ratings_total > 5;
                                
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
                                // Ưu tiên địa điểm cao cấp nếu có budget
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
                        
                        // Lấy nhiều địa điểm hơn để có nhiều lựa chọn cho route optimization
                        if (googlePlacesDestinations.length >= 20) {
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
    
    // Lọc bỏ địa điểm đã dùng với fuzzy matching + group matching
    const availableDestinations = destinations.filter(dest => {
        const nameUsed = usedDestinations.has(dest.name);
        const idUsed = usedDestinations.has(dest.place_id);
        
        // QUAN TRỌNG: Kiểm tra nhóm địa điểm (Vinpearl, VinWonders = cùng nhóm)
        const groupUsed = Array.from(usedDestinations).some(used => {
            if (typeof used === 'string' && dest.name) {
                return isSameAttractionGroup(dest.name, used);
            }
            return false;
        });
        
        if (groupUsed) {
            console.log(`⚠️ Skipping ${dest.name} - same group as used destination`);
            return false;
        }
        
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

    // Chọn đa dạng theo ngày - tăng số lượng địa điểm lên 5-6
    const selected = [];
    const targetCount = Math.min(dayNumber === 1 ? 4 : 6, availableDestinations.length);
    
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
        console.log(`📋 Currently used restaurants:`, Array.from(usedRestaurants));

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
            
            // Ưu tiên nhà hàng cao cấp nếu travelStyle là luxury/comfort
            const restaurantQueries = travelStyle === 'luxury' || travelStyle === 'comfort' ? [
                `fine dining ${destination}`,
                `luxury restaurants ${destination}`,
                `5 star restaurants ${destination}`,
                `premium dining ${destination}`,
                `rooftop restaurants ${destination}`,
                `best restaurants ${destination}`,
                `seafood restaurants ${destination}`,
                `vietnamese restaurants ${destination}`,
                `asian restaurants ${destination}`,
                `international restaurants ${destination}`
            ] : [
                `best restaurants ${destination}`,
                `restaurants ${destination}`,
                `nhà hàng ${destination}`,
                `quán ăn ${destination}`,
                `local food ${destination}`,
                `popular restaurants ${destination}`,
                `seafood restaurants ${destination}`,
                `vietnamese restaurants ${destination}`,
                `family restaurants ${destination}`,
                `casual dining ${destination}`,
                `cơm ${destination}`,
                `bún ${destination}`,
                `phở ${destination}`
            ];
            
            for (const query of restaurantQueries) {
                try {
                    const results = await searchPlacesByText(query, coord, 15000, destination);
                    
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
                                // Kiểm tra rating - cao hơn cho luxury/comfort
                                const minRating = (travelStyle === 'luxury' || travelStyle === 'comfort') ? 4.3 : 4.0;
                                const hasGoodRating = place.rating >= minRating;
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
                            .sort((a, b) => {
                                // Ưu tiên nhà hàng cao cấp cho luxury/comfort
                                if (travelStyle === 'luxury' || travelStyle === 'comfort') {
                                    const aIsLuxury = isLuxuryRestaurant(a.name);
                                    const bIsLuxury = isLuxuryRestaurant(b.name);
                                    if (aIsLuxury && !bIsLuxury) return -1;
                                    if (!aIsLuxury && bIsLuxury) return 1;
                                }
                                
                                // Sort by rating
                                return (b.rating || 0) - (a.rating || 0);
                            })
                            .slice(0, 10) // Lấy 10 nhà hàng từ mỗi query
                            .map(place => ({
                                name: place.name,
                                place_id: place.place_id, // ✅ FIX: Thêm place_id để track đúng
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
                        
                        // ✅ FIX: Tăng target lên 50 nhà hàng để đủ cho nhiều ngày (3 ngày × 3 bữa = 9 nhà hàng tối thiểu)
                        // Với 50 nhà hàng, sau khi loại duplicate còn ~30-40, đủ cho 10+ ngày
                        if (realRestaurants.length >= 50) break;
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
        
        // ✅ FIX: Loại bỏ duplicate restaurants trước khi shuffle
        const uniqueRestaurants = [];
        const seenNames = new Set();
        const seenIds = new Set();
        
        for (const r of realRestaurants) {
            // Skip nếu đã thấy name hoặc place_id
            if (seenNames.has(r.name) || (r.place_id && seenIds.has(r.place_id))) {
                continue;
            }
            
            // Skip nếu tên quá giống với nhà hàng đã có
            const isDuplicate = uniqueRestaurants.some(existing => {
                const similarity = calculateSimilarity(existing.name.toLowerCase(), r.name.toLowerCase());
                return similarity > 0.85; // 85% giống = duplicate
            });
            
            if (!isDuplicate) {
                uniqueRestaurants.push(r);
                seenNames.add(r.name);
                if (r.place_id) seenIds.add(r.place_id);
            }
        }
        
        console.log(`🍽️ Unique restaurants: ${uniqueRestaurants.length}/${realRestaurants.length} (removed ${realRestaurants.length - uniqueRestaurants.length} duplicates)`);
        console.log(`📋 Already used restaurants (${usedRestaurants.size}):`, Array.from(usedRestaurants).slice(0, 10));
        
        // ⚠️ CẢNH BÁO: Nếu không đủ nhà hàng
        if (uniqueRestaurants.length < 3) {
            console.warn(`⚠️ WARNING: Only ${uniqueRestaurants.length} unique restaurants found! May have duplicates across days.`);
        }
        
        // 🔍 DEBUG: Log top 5 restaurants
        console.log(`🔍 Top 5 unique restaurants:`, uniqueRestaurants.slice(0, 5).map(r => `${r.name} (${r.rating})`));
        
        // Shuffle restaurants để tránh lặp lại - MỖI NGÀY SHUFFLE LẠI
        const shuffledRestaurants = [...uniqueRestaurants].sort(() => 0.5 - Math.random());
        
        // 🔍 DEBUG: Log top 5 after shuffle
        console.log(`🔍 Top 5 after shuffle:`, shuffledRestaurants.slice(0, 5).map(r => `${r.name} (${r.rating})`));
        
        // Tạo danh sách đa dạng từ dữ liệu thực và Firebase
        const diverseOptions = {};
        
        // Track nhà hàng đã dùng TRONG NGÀY này (để tránh trùng trong cùng ngày)
        const usedInThisDay = new Set();
        
        // Breakfast - ưu tiên nhà hàng chưa dùng, tính giá theo travelStyle
        const styleCosts = MEAL_COSTS[travelStyle] || MEAL_COSTS.standard;
        const availableForBreakfast = shuffledRestaurants.filter(r => {
            // Check đã dùng trong các ngày trước chưa
            if (usedRestaurants.has(r.name) || usedRestaurants.has(r.place_id)) {
                // console.log(`⚠️ Skipping ${r.name} - already used in previous days`); // Bỏ log này để giảm spam
                return false;
            }
            
            // Check cùng chuỗi với nhà hàng đã dùng chưa
            const sameChainUsed = Array.from(usedRestaurants).some(used => {
                if (typeof used === 'string') {
                    return isSameRestaurantChain(r.name, used);
                }
                return false;
            });
            
            if (sameChainUsed) {
                // console.log(`⚠️ Skipping ${r.name} - same chain as used restaurant`); // Bỏ log này để giảm spam
                return false;
            }
            
            return true;
        });
        
        console.log(`🍽️ Available breakfast restaurants: ${availableForBreakfast.length}/${shuffledRestaurants.length}`);
        
        if (availableForBreakfast.length > 0) {
            const selected = availableForBreakfast[0];
            const estimatedCost = estimateMealCostFromPriceLevel(selected.price_level, 'breakfast', travelStyle);
            diverseOptions.breakfast = {
                name: selected.name,
                specialty: 'Ẩm thực địa phương',
                priceRange: `${(estimatedCost * 0.8).toLocaleString()}-${(estimatedCost * 1.2).toLocaleString()} VNĐ`,
                estimatedCost: estimatedCost,
                rating: selected.rating || 4.2,
                isOpen: true,
                dataSource: 'places_search_real',
                address: selected.address,
                lat: selected.geometry?.location?.lat(),
                lng: selected.geometry?.location?.lng()
            };
            // ✅ FIX: Add vào cả 2 Set
            usedRestaurants.add(selected.name);
            if (selected.place_id) usedRestaurants.add(selected.place_id);
            usedInThisDay.add(selected.name);
            console.log(`✅ Selected breakfast: ${selected.name}`);
        } else {
            console.warn(`⚠️ No available breakfast restaurants, using fallback`);
            // ✅ FIX: Thêm random suffix để tránh trùng tên fallback
            const fallbackSuffixes = ['Trung Tâm', 'Phố Cổ', 'Bến Cảng', 'Chợ Đêm', 'Bãi Biển', 'Trung Tâm Thành Phố'];
            const randomSuffix = fallbackSuffixes[Math.floor(Math.random() * fallbackSuffixes.length)];
            diverseOptions.breakfast = {
                name: `Quán ăn sáng ${randomSuffix} - ${destination}`,
                specialty: 'Phở bò/gà truyền thống',
                priceRange: `${styleCosts.breakfast.min.toLocaleString()}-${styleCosts.breakfast.max.toLocaleString()} VNĐ`,
                estimatedCost: styleCosts.breakfast.avg,
                rating: 4.2,
                isOpen: true,
                dataSource: 'firebase_fallback'
            };
        }
        
        // Lunch - ưu tiên nhà hàng khác, tính giá theo travelStyle
        const availableForLunch = shuffledRestaurants.filter(r => {
            // ✅ FIX: Check cả usedRestaurants (các ngày trước) VÀ usedInThisDay (trong ngày)
            if (usedRestaurants.has(r.name) || usedRestaurants.has(r.place_id) || usedInThisDay.has(r.name)) {
                console.log(`⚠️ Skipping ${r.name} - already used`);
                return false;
            }
            
            const sameChainUsed = Array.from(usedRestaurants).some(used => {
                if (typeof used === 'string') {
                    return isSameRestaurantChain(r.name, used);
                }
                return false;
            });
            
            if (sameChainUsed) {
                console.log(`⚠️ Skipping ${r.name} - same chain as used restaurant`);
                return false;
            }
            
            return true;
        });
        
        console.log(`🍽️ Available lunch restaurants: ${availableForLunch.length}/${shuffledRestaurants.length}`);
        
        if (availableForLunch.length > 0) {
            const selected = availableForLunch[0];
            console.log(`🔍 LUNCH SELECTION DEBUG:`, {
                name: selected.name,
                place_id: selected.place_id,
                hasPlaceId: !!selected.place_id,
                usedRestaurantsSize: usedRestaurants.size,
                usedRestaurantsList: Array.from(usedRestaurants).slice(0, 5)
            });
            
            const estimatedCost = estimateMealCostFromPriceLevel(selected.price_level, 'lunch', travelStyle);
            diverseOptions.lunch = {
                name: selected.name,
                specialty: localCuisines.lunch || 'Cơm địa phương',
                priceRange: `${(estimatedCost * 0.8).toLocaleString()}-${(estimatedCost * 1.2).toLocaleString()} VNĐ`,
                estimatedCost: estimatedCost,
                rating: selected.rating || 4.3,
                isOpen: true,
                dataSource: 'places_search_real',
                address: selected.address,
                lat: selected.geometry?.location?.lat(),
                lng: selected.geometry?.location?.lng()
            };
            // ✅ FIX: Add vào cả 2 Set
            usedRestaurants.add(selected.name);
            if (selected.place_id) {
                usedRestaurants.add(selected.place_id);
                console.log(`✅ Added to usedRestaurants: name="${selected.name}", place_id="${selected.place_id}"`);
            } else {
                console.warn(`⚠️ WARNING: No place_id for "${selected.name}"!`);
            }
            usedInThisDay.add(selected.name);
            console.log(`✅ Selected lunch: ${selected.name} (Total used: ${usedRestaurants.size})`);
        } else {
            console.warn(`⚠️ No available lunch restaurants, using fallback`);
            // ✅ FIX: Thêm random suffix để tránh trùng tên fallback
            const fallbackSuffixes = ['Trung Tâm', 'Phố Cổ', 'Bến Cảng', 'Chợ Đêm', 'Bãi Biển', 'Khu Du Lịch'];
            const randomSuffix = fallbackSuffixes[Math.floor(Math.random() * fallbackSuffixes.length)];
            diverseOptions.lunch = {
                name: `Nhà hàng cơm ${randomSuffix} - ${destination}`,
                specialty: localCuisines.lunch || 'Cơm địa phương',
                priceRange: `${styleCosts.lunch.min.toLocaleString()}-${styleCosts.lunch.max.toLocaleString()} VNĐ`,
                estimatedCost: styleCosts.lunch.avg,
                rating: 4.3,
                isOpen: true,
                dataSource: 'firebase_fallback'
            };
        }
        
        // Dinner - ưu tiên nhà hàng khác nữa, tính giá theo travelStyle
        const availableForDinner = shuffledRestaurants.filter(r => {
            // ✅ FIX: Check cả usedRestaurants (các ngày trước) VÀ usedInThisDay (trong ngày)
            if (usedRestaurants.has(r.name) || usedRestaurants.has(r.place_id) || usedInThisDay.has(r.name)) {
                console.log(`⚠️ Skipping ${r.name} - already used`);
                return false;
            }
            
            const sameChainUsed = Array.from(usedRestaurants).some(used => {
                if (typeof used === 'string') {
                    return isSameRestaurantChain(r.name, used);
                }
                return false;
            });
            
            if (sameChainUsed) {
                console.log(`⚠️ Skipping ${r.name} - same chain as used restaurant`);
                return false;
            }
            
            return true;
        });
        
        console.log(`🍽️ Available dinner restaurants: ${availableForDinner.length}/${shuffledRestaurants.length}`);
        
        if (availableForDinner.length > 0) {
            const selected = availableForDinner[0];
            const estimatedCost = estimateMealCostFromPriceLevel(selected.price_level, 'dinner', travelStyle);
            diverseOptions.dinner = {
                name: selected.name,
                specialty: localCuisines.dinner || 'Hải sản tươi sống',
                priceRange: `${(estimatedCost * 0.8).toLocaleString()}-${(estimatedCost * 1.2).toLocaleString()} VNĐ`,
                estimatedCost: estimatedCost,
                rating: selected.rating || 4.4,
                isOpen: true,
                dataSource: 'places_search_real',
                address: selected.address,
                lat: selected.geometry?.location?.lat(),
                lng: selected.geometry?.location?.lng()
            };
            // ✅ FIX: Add vào cả 2 Set
            usedRestaurants.add(selected.name);
            if (selected.place_id) usedRestaurants.add(selected.place_id);
            usedInThisDay.add(selected.name);
            console.log(`✅ Selected dinner: ${selected.name}`);
        } else {
            console.warn(`⚠️ No available dinner restaurants, using fallback`);
            // ✅ FIX: Thêm random suffix để tránh trùng tên fallback
            const fallbackSuffixes = ['Bãi Sau', 'Bãi Trước', 'Bến Cảng', 'Chợ Đêm', 'Khu Du Lịch', 'Trung Tâm'];
            const randomSuffix = fallbackSuffixes[Math.floor(Math.random() * fallbackSuffixes.length)];
            diverseOptions.dinner = {
                name: `Nhà hàng hải sản ${randomSuffix} - ${destination}`,
                specialty: localCuisines.dinner || 'Hải sản tươi sống',
                priceRange: `${styleCosts.dinner.min.toLocaleString()}-${styleCosts.dinner.max.toLocaleString()} VNĐ`,
                estimatedCost: styleCosts.dinner.avg,
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
    } else if (interests.includes('nightlife') && dayNumber >= 2) {
        baseTheme += ' & Cuộc sống đêm';
    } else if (interests.includes('photography')) {
        baseTheme += ' & Săn ảnh đẹp';
    }

    return baseTheme;
};

/**
 * Tạo lịch trình theo giờ phong phú
 * @param {string} departureTime - Giờ bắt đầu (giả định đã đến nơi)
 * @param {Object} specialActivities - Hoạt động đặc biệt
 */
/**
 * Tạo lịch trình theo giờ với thời gian động và hợp lý
 * Ngày 1: Dùng departureTime (giờ bắt đầu hành trình)
 * Ngày 2+: Bắt đầu từ 7:00 (ăn sáng)
 */
const generateEnhancedHourlySchedule = (dayNumber, destinations, restaurants, interests, departureTime = '08:00', specialActivities = {}, workingLocations = [], date = new Date()) => {
    // ===== TÍCH HỢP BUSINESS TRAVEL LOGIC =====
    // Nếu có working locations, sử dụng business travel service
    if (workingLocations && workingLocations.length > 0) {
        console.log(`💼 Day ${dayNumber} has working locations, using business travel logic...`);
        const businessTravelService = require('./businessTravelScheduleService').default;
        
        const result = businessTravelService.generateBusinessTravelDaySchedule(
            dayNumber,
            date,
            destinations,
            restaurants,
            interests,
            departureTime,
            specialActivities,
            workingLocations
        );
        
        console.log(`✅ Business travel schedule created for Day ${dayNumber}:`, result.isWorkingDay ? 'WORKING DAY' : 'NON-WORKING DAY');
        return result.schedule; // Trả về schedule đã được tạo bởi business travel service
    }
    
    // ===== LOGIC DU LỊCH THUẦN (KHÔNG ĐƯỢC SỬA) =====
    const schedule = [];
    let currentTime = '';
    // Dùng global usedRestaurants để tránh lặp giữa các ngày
    
    // Helper function: Gộp các địa điểm liên quan gần nhau
    const groupRelatedDestinations = (dests) => {
        if (!dests || dests.length === 0) return [];
        
        const groups = [];
        const used = new Set();
        
        dests.forEach((dest, index) => {
            if (used.has(index)) return;
            
            const group = {
                main: dest,
                related: []
            };
            
            // Tìm các địa điểm gần (trong bán kính 2km)
            for (let j = index + 1; j < dests.length; j++) {
                if (used.has(j)) continue;
                
                const otherDest = dests[j];
                if (dest.lat && dest.lng && otherDest.lat && otherDest.lng) {
                    const distance = calculateHaversineDistance(
                        dest.lat, dest.lng,
                        otherDest.lat, otherDest.lng
                    );
                    
                    if (distance <= 2) { // 2km
                        group.related.push(otherDest);
                        used.add(j);
                    }
                }
            }
            
            used.add(index);
            groups.push(group);
        });
        
        return groups;
    };
    
    // Helper function: Calculate Haversine distance
    const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };
    
    // ===== NGÀY 1: Logic đặc biệt =====
    // Helper function: Kiểm tra xem thời gian có conflict với working hours không
    const isInWorkingHours = (time) => {
        if (workingLocations.length === 0) return false;
        
        const timeMinutes = timeToMinutes(time);
        
        for (const workLoc of workingLocations) {
            const startMinutes = timeToMinutes(workLoc.startTime);
            const endMinutes = timeToMinutes(workLoc.endTime);
            
            if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
                return true;
            }
        }
        return false;
    };
    
    // Helper function: Chuyển time string thành minutes
    const timeToMinutes = (timeStr) => {
        const [hours, mins] = timeStr.split(':').map(Number);
        return hours * 60 + mins;
    };
    
    // Helper function: Tìm thời gian available tiếp theo (sau working hours)
    const getNextAvailableTime = (time) => {
        if (!isInWorkingHours(time)) return time;
        
        // Tìm working location đang conflict
        const timeMinutes = timeToMinutes(time);
        let latestEndTime = timeMinutes;
        
        for (const workLoc of workingLocations) {
            const startMinutes = timeToMinutes(workLoc.startTime);
            const endMinutes = timeToMinutes(workLoc.endTime);
            
            if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
                latestEndTime = Math.max(latestEndTime, endMinutes);
            }
        }
        
        // Convert back to time string
        const hours = Math.floor(latestEndTime / 60);
        const mins = latestEndTime % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };
    
    // Helper function: Tính duration giữa 2 thời gian
    const calculateDuration = (startTime, endTime) => {
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        const durationMinutes = endMinutes - startMinutes;
        
        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;
        
        if (hours > 0 && mins > 0) {
            return `${hours} giờ ${mins} phút`;
        } else if (hours > 0) {
            return `${hours} giờ`;
        } else {
            return `${mins} phút`;
        }
    };
    
    // Thêm working locations vào schedule trước (nếu có)
    if (workingLocations && workingLocations.length > 0) {
        workingLocations.forEach(workLoc => {
            schedule.push({
                time: workLoc.startTime,
                activity: `💼 ${workLoc.name}`,
                type: 'working',
                duration: calculateDuration(workLoc.startTime, workLoc.endTime),
                location: {
                    name: workLoc.name,
                    address: workLoc.address || '',
                    coordinates: workLoc.coordinates || {}
                },
                notes: [
                    'Thời gian làm việc cố định',
                    workLoc.description || 'Công việc',
                    '⚠️ Không thể thay đổi thời gian này'
                ],
                isFixed: true, // Đánh dấu là không thể di chuyển
                realData: true
            });
        });
    }
    
    // Ngày 1: Khởi hành và check-in
    if (dayNumber === 1) {
        // Bắt đầu hành trình từ departureTime
        currentTime = departureTime;
        const [startHour] = departureTime.split(':').map(Number);
        
        // Nếu đến sớm (< 12:00), tham quan trước khi check-in
        if (startHour < 12) {
            // Ăn sáng nếu đến trước 10:00
            if (startHour < 10 && restaurants.breakfast) {
                schedule.push({
                    time: currentTime,
                    activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
                    type: 'meal',
                    duration: '45 phút',
                    location: restaurants.breakfast,
                    specialty: restaurants.breakfast.specialty,
                    estimatedCost: restaurants.breakfast.estimatedCost,
                    notes: ['Bắt đầu hành trình với bữa sáng ngon'],
                    realData: true
                });
                usedRestaurants.add(restaurants.breakfast.name);
                currentTime = calculateNextTime(currentTime, '45 phút');
                currentTime = getNextAvailableTime(currentTime);
            }
            
            // Tham quan 1-2 địa điểm trước check-in
            const morningDests = destinations.slice(0, Math.min(2, destinations.length));
            morningDests.forEach(dest => {
                schedule.push({
                    time: currentTime,
                    activity: `Tham quan ${dest.name}`,
                    type: 'sightseeing',
                    duration: dest.estimatedDuration || '1-2 giờ',
                    location: dest,
                    entryFee: dest.entryFee,
                    notes: ['Khám phá trước khi check-in'],
                    realData: true
                });
                currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
            });
            
            // Check-in khách sạn lúc 12:30
            schedule.push({
                time: '12:30',
                activity: 'Check-in khách sạn',
                type: 'accommodation',
                duration: '30 phút',
                notes: ['Nhận phòng', 'Để hành lý', 'Nghỉ ngơi'],
                realData: true
            });
            currentTime = '13:00';
            
            // Ăn trưa - ✅ FIX: Dùng restaurants.lunch đã được track đúng, KHÔNG dùng localFood
            const lunchVenue = restaurants.lunch;
            
            if (lunchVenue) {
                schedule.push({
                    time: currentTime,
                    activity: `Ăn trưa tại ${lunchVenue.name}`,
                    type: 'meal',
                    duration: '1 giờ',
                    location: lunchVenue,
                    specialty: lunchVenue.specialty,
                    estimatedCost: lunchVenue.estimatedCost,
                    realData: true
                });
                // Không cần add vào usedRestaurants vì đã add trong findRealRestaurantsForDay
                currentTime = '14:00';
            }
            
            // Tham quan các địa điểm còn lại buổi chiều
            const afternoonDests = destinations.slice(morningDests.length);
            afternoonDests.forEach((dest, index) => {
                schedule.push({
                    time: currentTime,
                    activity: `Tham quan ${dest.name}`,
                    type: 'sightseeing',
                    duration: dest.estimatedDuration || '1-2 giờ',
                    location: dest,
                    entryFee: dest.entryFee,
                    realData: true
                });
                currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
                
                // Nghỉ giữa các điểm
                if (index < afternoonDests.length - 1) {
                    currentTime = calculateNextTime(currentTime, '15 phút');
                }
            });
        } else {
            // Đến trễ (>= 12:00), check-in ngay
            schedule.push({
                time: currentTime,
                activity: 'Check-in khách sạn',
                type: 'accommodation',
                duration: '30 phút',
                notes: ['Nhận phòng', 'Để hành lý', 'Nghỉ ngơi'],
                realData: true
            });
            currentTime = calculateNextTime(currentTime, '30 phút');
            
            // Ăn trưa nếu chưa quá 14:00
            const [currentHour] = currentTime.split(':').map(Number);
            if (currentHour < 14) {
                // ✅ FIX: Dùng restaurants.lunch đã được track đúng, KHÔNG dùng localFood
                const lunchVenue = restaurants.lunch;
                
                if (lunchVenue) {
                    schedule.push({
                        time: currentTime,
                        activity: `Ăn trưa tại ${lunchVenue.name}`,
                        type: 'meal',
                        duration: '1 giờ',
                        location: lunchVenue,
                        specialty: lunchVenue.specialty,
                        estimatedCost: lunchVenue.estimatedCost,
                        realData: true
                    });
                    // Không cần add vào usedRestaurants vì đã add trong findRealRestaurantsForDay
                    currentTime = calculateNextTime(currentTime, '1 giờ');
                }
            }
            
            // Tham quan các địa điểm buổi chiều
            destinations.forEach((dest, index) => {
                schedule.push({
                    time: currentTime,
                    activity: `Tham quan ${dest.name}`,
                    type: 'sightseeing',
                    duration: dest.estimatedDuration || '1-2 giờ',
                    location: dest,
                    entryFee: dest.entryFee,
                    realData: true
                });
                currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
                
                // Nghỉ giữa các điểm
                if (index < destinations.length - 1) {
                    currentTime = calculateNextTime(currentTime, '15 phút');
                }
            });
        }
    } 
    // ===== NGÀY 2+: Logic chuẩn =====
    else {
        // Bắt đầu từ 7:00 - Ăn sáng
        currentTime = '07:00';
        
        if (restaurants.breakfast) {
            schedule.push({
                time: currentTime,
                activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
                type: 'meal',
                duration: '45 phút',
                location: restaurants.breakfast,
                specialty: restaurants.breakfast.specialty,
                estimatedCost: restaurants.breakfast.estimatedCost,
                notes: ['Bắt đầu ngày mới với năng lượng'],
                realData: true
            });
            usedRestaurants.add(restaurants.breakfast.name); // Track để tránh lặp
            currentTime = '07:45';
        }
        
        // Chia destinations thành buổi sáng và buổi chiều
        const morningDestCount = Math.ceil(destinations.length / 2);
        const morningDests = destinations.slice(0, morningDestCount);
        const afternoonDests = destinations.slice(morningDestCount);
        
        // Tham quan buổi sáng từ 8:00
        currentTime = '08:00';
        morningDests.forEach((dest, index) => {
            schedule.push({
                time: currentTime,
                activity: `Tham quan ${dest.name}`,
                type: 'sightseeing',
                duration: dest.estimatedDuration || '1-2 giờ',
                location: dest,
                entryFee: dest.entryFee,
                notes: dest.notes || [],
                realData: true
            });
            currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
            
            // Nghỉ giữa các điểm (15 phút di chuyển)
            if (index < morningDests.length - 1) {
                currentTime = calculateNextTime(currentTime, '15 phút');
            }
        });
        
        // Ăn trưa trong khung 11:30-12:30
        const [lunchHour] = currentTime.split(':').map(Number);
        if (lunchHour < 11) {
            currentTime = '11:30';
        } else if (lunchHour > 13) {
            currentTime = '12:00';
        }
        
        // ✅ FIX: Dùng restaurants.lunch đã được track đúng, KHÔNG dùng localFood
        const lunchVenue = restaurants.lunch;
        
        if (lunchVenue) {
            schedule.push({
                time: currentTime,
                activity: `Ăn trưa tại ${lunchVenue.name}`,
                type: 'meal',
                duration: '1 giờ',
                location: lunchVenue,
                specialty: lunchVenue.specialty,
                estimatedCost: lunchVenue.estimatedCost,
                priceRange: lunchVenue.priceRange,
                popularDishes: lunchVenue.popularDishes,
                notes: ['Nghỉ ngơi, thưởng thức ẩm thực địa phương'],
                realData: true
            });
            // Không cần add vào usedRestaurants vì đã add trong findRealRestaurantsForDay
            currentTime = calculateNextTime(currentTime, '1 giờ');
        }
        
        // Tham quan buổi chiều (tiếp tục các địa điểm còn lại)
        afternoonDests.forEach((dest, index) => {
            schedule.push({
                time: currentTime,
                activity: `Tham quan ${dest.name}`,
                type: 'sightseeing',
                duration: dest.estimatedDuration || '1-2 giờ',
                location: dest,
                entryFee: dest.entryFee,
                notes: dest.notes || [],
                realData: true
            });
            currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
            
            // Nghỉ giữa các điểm
            if (index < afternoonDests.length - 1) {
                currentTime = calculateNextTime(currentTime, '15 phút');
            }
        });
    }

    // Hoạt động chiều - chỉ thêm nếu còn thời gian trước bữa tối
    const [currentHour] = currentTime.split(':').map(Number);
    
    // Nếu còn thời gian (< 17:00) và user quan tâm food
    if (currentHour < 17 && interests.includes('food')) {
        if (restaurants.localFood && restaurants.localFood.length >= 3) {
            // Food tour
            schedule.push({
                time: currentTime,
                activity: 'Khám phá ẩm thực địa phương',
                type: 'food_tour',
                duration: '1 giờ',
                suggestions: restaurants.localFood.slice(1, 4).map(venue => ({
                    name: venue.name,
                    specialty: venue.specialty,
                    priceRange: venue.priceRange,
                    rating: venue.rating
                })),
                notes: [
                    'Thử các món ăn đường phố',
                    'Trải nghiệm văn hóa ẩm thực địa phương',
                    'Mang theo tiền mặt'
                ],
                estimatedCost: 100000,
                realData: true
            });
            currentTime = calculateNextTime(currentTime, '1 giờ');
        } else if (restaurants.streetFood && restaurants.streetFood.length > 0) {
            // Street food
            schedule.push({
                time: currentTime,
                activity: `Thử street food: ${restaurants.streetFood[0].name}`,
                type: 'street_food',
                duration: '30 phút',
                location: restaurants.streetFood[0],
                specialty: restaurants.streetFood[0].specialty,
                estimatedCost: restaurants.streetFood[0].estimatedCost,
                notes: ['Trải nghiệm ẩm thực đường phố', 'Giá rẻ, ngon'],
                realData: true
            });
            currentTime = calculateNextTime(currentTime, '30 phút');
        }
    }
    
    // Nếu vẫn còn thời gian trống trước bữa tối, thêm hoạt động thư giãn
    const [predinnerHour] = currentTime.split(':').map(Number);
    if (predinnerHour < 18) {
        schedule.push({
            time: currentTime,
            activity: 'Thư giãn, dạo phố, mua sắm',
            type: 'free_time',
            duration: '30 phút - 1 giờ',
            suggestions: ['Dạo chợ địa phương', 'Uống cà phê', 'Mua quà lưu niệm'],
            notes: ['Nghỉ ngơi trước bữa tối'],
            realData: false
        });
    }
    
    // Ăn tối trong khung 18:00-19:00
    const [dinnerHour] = currentTime.split(':').map(Number);
    if (dinnerHour < 18) {
        currentTime = '18:30';
    } else if (dinnerHour > 19) {
        currentTime = '18:30';
    }
    
    if (restaurants.dinner) {
        schedule.push({
            time: currentTime,
            activity: `Ăn tối tại ${restaurants.dinner.name}`,
            type: 'meal',
            duration: '1.5 giờ',
            location: restaurants.dinner,
            specialty: restaurants.dinner.specialty,
            estimatedCost: restaurants.dinner.estimatedCost,
            notes: ['Bữa tối thịnh soạn', 'Thưởng thức đặc sản địa phương'],
            realData: true
        });
        usedRestaurants.add(restaurants.dinner.name); // Track để tránh lặp
        currentTime = calculateNextTime(currentTime, '1.5 giờ');
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

    // Nightlife activities nếu user quan tâm
    if (interests.includes('nightlife') && restaurants.nightlife && restaurants.nightlife.length > 0) {
        // Sử dụng nightlife venues thực tế
        const topVenue = restaurants.nightlife[0];
        const venueTypeNames = {
            'rooftop_bar': 'Rooftop Bar',
            'night_club': 'Night Club',
            'bar': 'Bar/Pub',
            'live_music': 'Quán nhạc sống',
            'night_market': 'Chợ đêm'
        };
        
        activities.push({
            time: '20:30',
            activity: `Trải nghiệm ${venueTypeNames[topVenue.venueType] || 'Bar'}: ${topVenue.name}`,
            type: 'nightlife',
            duration: '2-3 giờ',
            location: topVenue,
            venueType: topVenue.venueType,
            rating: topVenue.rating,
            estimatedCost: topVenue.estimatedCost,
            suggestions: restaurants.nightlife.slice(1, 4).map(v => v.name),
            notes: [
                'Giữ an toàn cá nhân',
                'Uống có trách nhiệm',
                'Đi theo nhóm',
                topVenue.isOpen === false ? '⚠️ Kiểm tra giờ mở cửa' : 'Có thể đông vào cuối tuần'
            ].filter(Boolean),
            realData: true
        });
    } else if (interests.includes('nightlife')) {
        // Fallback nếu không tìm được venues thực tế
        activities.push({
            time: '20:30',
            activity: 'Khám phá cuộc sống đêm',
            type: 'nightlife',
            duration: '2-3 giờ',
            suggestions: [
                'Rooftop bar với view thành phố',
                'Quán bar/pub có nhạc sống',
                'Chợ đêm sôi động',
                'Khu phố đi bộ về đêm'
            ],
            notes: [
                'Giữ an toàn cá nhân',
                'Uống có trách nhiệm',
                'Đi theo nhóm',
                'Giữ liên lạc với đồng hành'
            ],
            estimatedCost: 200000,
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

    if (interests.includes('nightlife')) {
        activities.push('Khám phá bar/club địa phương', 'Thưởng thức nhạc sống', 'Trải nghiệm chợ đêm sôi động');
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
 * Tính chi phí ngày nâng cao - SỬ DỤNG GIÁ THỰC TẾ
 * CHI PHÍ CHO 1 NGƯỜI/NGÀY (chưa nhân với số người)
 * 
 * @param {Array} destinations - Danh sách địa điểm
 * @param {Object} restaurants - Nhà hàng
 * @param {String} travelStyle - Phong cách du lịch
 * @param {Number} dayNumber - Ngày thứ mấy
 * @param {Number} dailyBudget - Ngân sách/người/ngày (để tham khảo)
 */
const calculateEnhancedDayCost = (destinations, restaurants, travelStyle, dayNumber, dailyBudget = 500000) => {
    // 1. Chi phí vé vào cổng (sử dụng giá THỰC TẾ từ API)
    const sightseeingCost = destinations.reduce((sum, dest) => {
        const fee = dest.entryFee || estimateEntryFeeFromName(dest.name);
        return sum + fee;
    }, 0);
    
    // 2. Chi phí ăn uống (ưu tiên giá THỰC TẾ từ restaurants.estimatedCost)
    const styleCosts = MEAL_COSTS[travelStyle] || MEAL_COSTS.standard;
    let foodCost = 0;
    
    if (restaurants.breakfast) {
        foodCost += restaurants.breakfast.estimatedCost || styleCosts.breakfast.avg;
    }
    if (restaurants.lunch) {
        foodCost += restaurants.lunch.estimatedCost || styleCosts.lunch.avg;
    }
    if (restaurants.dinner) {
        foodCost += restaurants.dinner.estimatedCost || styleCosts.dinner.avg;
    }
    
    // 3. Chi phí di chuyển trong ngày
    const baseTransportCost = TRANSPORT_OPTIONS.local[travelStyle]?.costPerDay || 80000;
    let localTransportCost = baseTransportCost;
    
    // Thêm chi phí di chuyển giữa các địa điểm (nếu có nhiều địa điểm)
    if (destinations.length > 2) {
        localTransportCost += (destinations.length - 2) * 30000; // 30k cho mỗi chuyến thêm
    }
    
    // 4. Chi phí phát sinh (nước uống, tip, mua sắm nhỏ)
    const miscCost = 30000;
    
    // Tổng chi phí trong ngày CHO 1 NGƯỜI (KHÔNG bao gồm khách sạn/xe khứ hồi)
    let totalCost = sightseeingCost + foodCost + localTransportCost + miscCost;
    
    // Kiểm tra xem có vượt ngân sách không
    const budgetStatus = totalCost > dailyBudget ? 'over' : 'within';
    const budgetDiff = Math.abs(totalCost - dailyBudget);
    
    console.log(`💰 Day ${dayNumber} cost breakdown (per person):`);
    console.log(`  - Sightseeing: ${sightseeingCost.toLocaleString()}đ (${destinations.length} places)`);
    console.log(`  - Food: ${foodCost.toLocaleString()}đ (3 meals)`);
    console.log(`  - Local Transport: ${localTransportCost.toLocaleString()}đ`);
    console.log(`  - Misc: ${miscCost.toLocaleString()}đ`);
    console.log(`  - TOTAL: ${totalCost.toLocaleString()}đ`);
    console.log(`  - Daily budget: ${dailyBudget.toLocaleString()}đ`);
    console.log(`  - Status: ${budgetStatus} (${budgetStatus === 'over' ? '+' : '-'}${budgetDiff.toLocaleString()}đ)`);
    
    // Nếu vượt ngân sách quá nhiều (>20%), cảnh báo
    if (totalCost > dailyBudget * 1.2) {
        console.warn(`  ⚠️ WARNING: Day ${dayNumber} cost exceeds budget by ${Math.round((totalCost/dailyBudget - 1) * 100)}%`);
    }
    
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