// src/services/realTimeDataService.js
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { searchPlacesByText, searchNearbyPlaces } from './placesService';
import { CACHE_DURATION, PHOTOGRAPHY_KEYWORDS } from '../constants';
import { calculateDistance, estimateEntryFee, estimateVisitDuration } from '../utils/commonUtils';

/**
 * Service tích hợp dữ liệu đa nguồn thời gian thực
 * Google Maps, OpenWeatherMap, TripAdvisor, Events...
 * Hợp nhất từ realPlacesDataService.js để tránh trùng lặp
 */

// Cache để tránh gọi API quá nhiều
const dataCache = new Map();

/**
 * 1. GOOGLE PLACES API - Dữ liệu địa điểm thực tế
 */
export const getRealTimePlaceData = async (placeId) => {
    const cacheKey = `place_${placeId}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    try {
        // Check if Google Maps API is available
        if (!window.google?.maps?.places) {
            console.warn('Google Maps Places API not available, using cached data');
            return null;
        }

        // Use Places Service instead of direct API call to avoid CORS
        const service = new window.google.maps.places.PlacesService(
            document.createElement('div')
        );

        const data = await new Promise((resolve, reject) => {
            service.getDetails({
                placeId: placeId,
                fields: ['name', 'rating', 'formatted_address', 'formatted_phone_number', 
                        'opening_hours', 'website', 'price_level', 'user_ratings_total', 
                        'reviews', 'photos', 'geometry']
            }, (result, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve({ result, status: 'OK' });
                } else {
                    reject(new Error(`Places service failed: ${status}`));
                }
            });
        });
        
        if (data.status === 'OK') {
            const placeData = {
                ...data.result,
                lastUpdated: new Date(),
                isOpen: true, // Assume open during business hours
                currentPopularity: await getCurrentPopularity(placeId),
                realTimeReviews: data.result.reviews?.slice(0, 5) || []
            };

            // Cache data
            dataCache.set(cacheKey, {
                data: placeData,
                timestamp: Date.now()
            });

            return placeData;
        }
        
        throw new Error(`Places API error: ${data.status}`);
    } catch (error) {
        console.error('Error fetching real-time place data:', error);
        return null;
    }
};

/**
 * 2. OPENWEATHERMAP API - Thời tiết thời gian thực
 */
export const getRealTimeWeather = async (lat, lng, days = 5) => {
    const cacheKey = `weather_${lat}_${lng}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 min cache
        return cached.data;
    }

    try {
        // Current weather
        const currentResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}&units=metric&lang=vi`
        );
        
        // 5-day forecast
        const forecastResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}&units=metric&lang=vi`
        );

        const [currentData, forecastData] = await Promise.all([
            currentResponse.json(),
            forecastResponse.json()
        ]);

        const weatherData = {
            current: {
                temperature: Math.round(currentData.main.temp),
                feelsLike: Math.round(currentData.main.feels_like),
                humidity: currentData.main.humidity,
                description: currentData.weather[0].description,
                icon: currentData.weather[0].icon,
                windSpeed: currentData.wind.speed,
                visibility: currentData.visibility / 1000, // km
                uvIndex: await getUVIndex(lat, lng),
                airQuality: await getAirQuality(lat, lng)
            },
            forecast: forecastData.list.slice(0, days * 8).map(item => ({
                datetime: new Date(item.dt * 1000),
                temperature: Math.round(item.main.temp),
                description: item.weather[0].description,
                icon: item.weather[0].icon,
                precipitation: item.rain?.['3h'] || 0,
                windSpeed: item.wind.speed
            })),
            alerts: await getWeatherAlerts(lat, lng),
            lastUpdated: new Date()
        };

        // Cache data
        dataCache.set(cacheKey, {
            data: weatherData,
            timestamp: Date.now()
        });

        return weatherData;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
};

/**
 * 3. TRAFFIC & TRANSPORTATION - Giao thông thời gian thực
 */
export const getRealTimeTraffic = async (origin, destination, mode = 'driving') => {
    const cacheKey = `traffic_${origin.lat}_${origin.lng}_${destination.lat}_${destination.lng}_${mode}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
        return cached.data;
    }

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${mode}&departure_time=now&traffic_model=best_guess&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
        );
        
        const data = await response.json();
        
        if (data.status === 'OK' && data.routes.length > 0) {
            const route = data.routes[0];
            const leg = route.legs[0];
            
            const trafficData = {
                distance: leg.distance,
                duration: leg.duration,
                durationInTraffic: leg.duration_in_traffic || leg.duration,
                trafficCondition: getTrafficCondition(leg.duration, leg.duration_in_traffic),
                steps: leg.steps.map(step => ({
                    instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
                    distance: step.distance,
                    duration: step.duration
                })),
                alternativeRoutes: data.routes.slice(1, 3).map(altRoute => ({
                    distance: altRoute.legs[0].distance,
                    duration: altRoute.legs[0].duration,
                    summary: altRoute.summary
                })),
                lastUpdated: new Date()
            };

            // Cache data
            dataCache.set(cacheKey, {
                data: trafficData,
                timestamp: Date.now()
            });

            return trafficData;
        }
        
        throw new Error(`Directions API error: ${data.status}`);
    } catch (error) {
        console.error('Error fetching traffic data:', error);
        return null;
    }
};

/**
 * 4. EVENTS & FESTIVALS - Sự kiện địa phương
 */
export const getRealTimeEvents = async (location, radius = 50000, category = 'all') => {
    const cacheKey = `events_${location.lat}_${location.lng}_${category}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour cache
        return cached.data;
    }

    try {
        // Tích hợp với Eventbrite API (cần API key)
        const eventbriteResponse = await fetchEventbriteEvents(location, radius, category);
        
        // Tích hợp với Facebook Events (nếu có API access)
        const facebookEvents = await fetchFacebookEvents(location, radius);
        
        // Lấy từ Firebase local events
        const localEvents = await getLocalEventsFromFirebase(location, radius);

        const eventsData = {
            events: [
                ...eventbriteResponse,
                ...facebookEvents,
                ...localEvents
            ].sort((a, b) => new Date(a.startDate) - new Date(b.startDate)),
            lastUpdated: new Date()
        };

        // Cache data
        dataCache.set(cacheKey, {
            data: eventsData,
            timestamp: Date.now()
        });

        return eventsData;
    } catch (error) {
        console.error('Error fetching events data:', error);
        return { events: [], lastUpdated: new Date() };
    }
};

/**
 * 5. PRICING & AVAILABILITY - Giá vé và tình trạng
 */
export const getRealTimePricing = async (placeId, date = new Date()) => {
    const cacheKey = `pricing_${placeId}_${date.toDateString()}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour cache
        return cached.data;
    }

    try {
        // Tích hợp với Klook API (cần partnership)
        const klookPricing = await fetchKlookPricing(placeId, date);
        
        // Tích hợp với GetYourGuide API
        const gygPricing = await fetchGetYourGuidePricing(placeId, date);
        
        // Lấy giá từ database local
        const localPricing = await getLocalPricingFromFirebase(placeId);

        const pricingData = {
            ticketPrices: {
                adult: klookPricing?.adult || localPricing?.adult || 0,
                child: klookPricing?.child || localPricing?.child || 0,
                senior: klookPricing?.senior || localPricing?.senior || 0
            },
            availability: {
                isAvailable: true,
                slotsRemaining: klookPricing?.slotsRemaining || null,
                nextAvailableDate: klookPricing?.nextAvailableDate || date
            },
            promotions: [
                ...(klookPricing?.promotions || []),
                ...(gygPricing?.promotions || [])
            ],
            bookingUrls: {
                klook: klookPricing?.bookingUrl,
                getYourGuide: gygPricing?.bookingUrl,
                official: localPricing?.officialUrl
            },
            lastUpdated: new Date()
        };

        // Cache data
        dataCache.set(cacheKey, {
            data: pricingData,
            timestamp: Date.now()
        });

        return pricingData;
    } catch (error) {
        console.error('Error fetching pricing data:', error);
        return null;
    }
};

/**
 * 6. CROWD LEVELS - Mức độ đông đúc
 */
export const getRealTimeCrowdLevel = async (placeId) => {
    const cacheKey = `crowd_${placeId}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15 min cache
        return cached.data;
    }

    try {
        // Sử dụng Google Popular Times API (nếu có access)
        const popularTimes = await getPopularTimesData(placeId);
        
        // Phân tích từ social media mentions
        const socialMentions = await analyzeSocialMediaMentions(placeId);
        
        // Dữ liệu từ user reports
        const userReports = await getUserCrowdReports(placeId);

        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();

        const crowdData = {
            currentLevel: getCurrentCrowdLevel(popularTimes, currentHour, currentDay),
            todayForecast: getTodayForecast(popularTimes, currentDay),
            weekForecast: getWeekForecast(popularTimes),
            peakHours: getPeakHours(popularTimes),
            bestTimeToVisit: getBestTimeToVisit(popularTimes),
            userReports: userReports.slice(0, 5),
            lastUpdated: new Date()
        };

        // Cache data
        dataCache.set(cacheKey, {
            data: crowdData,
            timestamp: Date.now()
        });

        return crowdData;
    } catch (error) {
        console.error('Error fetching crowd data:', error);
        return null;
    }
};

// ==================== HELPER FUNCTIONS ====================

const getCurrentPopularity = async (placeId) => {
    // Placeholder - cần tích hợp với Google Popular Times API
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Simulate popularity based on time
    if (hour >= 10 && hour <= 12) return 'high';
    if (hour >= 14 && hour <= 16) return 'medium';
    if (hour >= 18 && hour <= 20) return 'high';
    return 'low';
};

const getUVIndex = async (lat, lng) => {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lng}&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}`
        );
        const data = await response.json();
        return data.value || 0;
    } catch (error) {
        return 0;
    }
};

const getAirQuality = async (lat, lng) => {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}`
        );
        const data = await response.json();
        return {
            aqi: data.list[0]?.main?.aqi || 1,
            components: data.list[0]?.components || {}
        };
    } catch (error) {
        return { aqi: 1, components: {} };
    }
};

const getWeatherAlerts = async (lat, lng) => {
    try {
        // OpenWeather OneCall API requires subscription, use free current weather instead
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}&units=metric&lang=vi`
        );
        const data = await response.json();
        
        // Generate alerts based on weather conditions
        const alerts = [];
        if (data.weather?.[0]?.main === 'Rain') {
            alerts.push({
                event: 'Rain Alert',
                description: 'Có mưa, nên mang theo áo mưa',
                severity: 'Minor'
            });
        }
        if (data.main?.temp > 35) {
            alerts.push({
                event: 'Heat Alert', 
                description: 'Thời tiết nóng, nên mang theo nước và kem chống nắng',
                severity: 'Minor'
            });
        }
        
        return alerts;
    } catch (error) {
        console.warn('Weather alerts error:', error);
        return [];
    }
};

const getTrafficCondition = (normalDuration, trafficDuration) => {
    if (!trafficDuration) return 'unknown';
    
    const ratio = trafficDuration.value / normalDuration.value;
    if (ratio > 1.5) return 'heavy';
    if (ratio > 1.2) return 'moderate';
    return 'light';
};

const fetchEventbriteEvents = async (location, radius, category) => {
    // Placeholder - cần Eventbrite API key
    try {
        // const response = await fetch(`https://www.eventbriteapi.com/v3/events/search/?location.latitude=${location.lat}&location.longitude=${location.lng}&location.within=${radius}km&token=${EVENTBRITE_TOKEN}`);
        // const data = await response.json();
        // return data.events || [];
        return [];
    } catch (error) {
        return [];
    }
};

const fetchFacebookEvents = async (location, radius) => {
    // Placeholder - Facebook Events API đã deprecated
    return [];
};

const getLocalEventsFromFirebase = async (location, radius) => {
    try {
        const eventsSnap = await getDocs(
            query(
                collection(db, 'local_events'),
                where('location.lat', '>=', location.lat - 0.1),
                where('location.lat', '<=', location.lat + 0.1),
                orderBy('startDate', 'asc'),
                limit(20)
            )
        );

        return eventsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            source: 'local'
        }));
    } catch (error) {
        console.error('Error fetching local events:', error);
        return [];
    }
};

const fetchKlookPricing = async (placeId, date) => {
    // Placeholder - cần Klook partnership API
    return null;
};

const fetchGetYourGuidePricing = async (placeId, date) => {
    // Placeholder - cần GetYourGuide API
    return null;
};

const getLocalPricingFromFirebase = async (placeId) => {
    try {
        const pricingSnap = await getDocs(
            query(
                collection(db, 'place_pricing'),
                where('placeId', '==', placeId),
                orderBy('lastUpdated', 'desc'),
                limit(1)
            )
        );

        if (pricingSnap.docs.length > 0) {
            return pricingSnap.docs[0].data();
        }
        return null;
    } catch (error) {
        console.error('Error fetching local pricing:', error);
        return null;
    }
};

const getPopularTimesData = async (placeId) => {
    // Placeholder - Google Popular Times không có public API
    // Có thể scrape hoặc sử dụng third-party services
    return null;
};

const analyzeSocialMediaMentions = async (placeId) => {
    // Placeholder - phân tích social media mentions
    return [];
};

const getUserCrowdReports = async (placeId) => {
    try {
        const reportsSnap = await getDocs(
            query(
                collection(db, 'crowd_reports'),
                where('placeId', '==', placeId),
                orderBy('timestamp', 'desc'),
                limit(10)
            )
        );

        return reportsSnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error fetching crowd reports:', error);
        return [];
    }
};

const getCurrentCrowdLevel = (popularTimes, hour, day) => {
    // Simulate crowd level based on time
    if (!popularTimes) {
        if (hour >= 10 && hour <= 12) return 4; // High
        if (hour >= 14 && hour <= 16) return 3; // Medium
        if (hour >= 18 && hour <= 20) return 4; // High
        return 2; // Low
    }
    
    // Use actual popular times data if available
    return popularTimes[day]?.[hour] || 2;
};

const getTodayForecast = (popularTimes, day) => {
    if (!popularTimes) {
        return Array.from({ length: 24 }, (_, hour) => ({
            hour,
            level: getCurrentCrowdLevel(null, hour, day)
        }));
    }
    
    return popularTimes[day] || [];
};

const getWeekForecast = (popularTimes) => {
    if (!popularTimes) {
        return Array.from({ length: 7 }, (_, day) => ({
            day,
            peakLevel: 4,
            peakHour: 11
        }));
    }
    
    return popularTimes;
};

const getPeakHours = (popularTimes) => {
    // Return typical peak hours
    return [
        { hour: 11, level: 4, description: 'Buổi sáng cuối tuần' },
        { hour: 15, level: 3, description: 'Buổi chiều' },
        { hour: 19, level: 4, description: 'Buổi tối' }
    ];
};

const getBestTimeToVisit = (popularTimes) => {
    return {
        weekday: { hour: 9, description: 'Sáng sớm trong tuần' },
        weekend: { hour: 8, description: 'Rất sớm cuối tuần' }
    };
};

// ==================== CACHE MANAGEMENT ====================

export const clearCache = () => {
    dataCache.clear();
    console.log('🧹 Real-time data cache cleared');
};

export const getCacheStats = () => {
    return {
        size: dataCache.size,
        keys: Array.from(dataCache.keys()),
        totalMemory: JSON.stringify(Array.from(dataCache.values())).length
    };
};

// ==================== BATCH DATA FETCHING ====================

export const getRealTimeDataBatch = async (places, location) => {
    const batchData = {};
    
    try {
        // Fetch weather once for the location
        batchData.weather = await getRealTimeWeather(location.lat, location.lng);
        
        // Fetch events once for the location
        batchData.events = await getRealTimeEvents(location);
        
        // Fetch data for each place
        batchData.places = {};
        
        const placePromises = places.map(async (place) => {
            const placeId = place.place_id || place.id;
            if (!placeId) return null;
            
            const [placeData, crowdData, pricingData] = await Promise.all([
                getRealTimePlaceData(placeId),
                getRealTimeCrowdLevel(placeId),
                getRealTimePricing(placeId)
            ]);
            
            return {
                placeId,
                placeData,
                crowdData,
                pricingData
            };
        });
        
        const placeResults = await Promise.all(placePromises);
        
        placeResults.forEach(result => {
            if (result) {
                batchData.places[result.placeId] = {
                    place: result.placeData,
                    crowd: result.crowdData,
                    pricing: result.pricingData
                };
            }
        });
        
        batchData.lastUpdated = new Date();
        
        return batchData;
    } catch (error) {
        console.error('Error fetching batch real-time data:', error);
        return { error: error.message, lastUpdated: new Date() };
    }
};

export default {
    getRealTimePlaceData,
    getRealTimeWeather,
    getRealTimeTraffic,
    getRealTimeEvents,
    getRealTimePricing,
    getRealTimeCrowdLevel,
    getRealTimeDataBatch,
    clearCache,
    getCacheStats
};

// ==================== PLACES DATA FUNCTIONS (từ realPlacesDataService) ====================

/**
 * Tìm địa điểm thực tế theo danh mục
 */
export const findRealPlacesByCategory = async (destination, coord, category, interests = []) => {
    const cacheKey = `${destination}_${category}_${coord.lat}_${coord.lng}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION.PLACES) {
        console.log(`📦 Using cached data for ${category} in ${destination}`);
        return cached.data;
    }

    console.log(`🔍 Searching REAL places for ${category} in ${destination}...`);

    const categoryConfig = getCategoryConfig(category, interests);
    let allPlaces = [];

    try {
        // 1. Text Search với multiple queries
        for (const searchQuery of categoryConfig.queries) {
            try {
                const textResults = await searchPlacesByText(
                    `${searchQuery} ${destination}`,
                    coord,
                    categoryConfig.radius
                );

                console.log(`📝 Text search "${searchQuery}": ${textResults.length} results`);
                allPlaces.push(...textResults);
            } catch (error) {
                console.warn(`Text search failed for "${searchQuery}":`, error);
            }
        }

        // 2. Nearby Search với specific types
        for (const placeType of categoryConfig.types) {
            try {
                const nearbyResults = await searchNearbyPlaces({
                    location: coord,
                    radius: categoryConfig.radius,
                    type: placeType
                });

                console.log(`📍 Nearby search "${placeType}": ${nearbyResults.length} results`);
                allPlaces.push(...nearbyResults);
            } catch (error) {
                console.warn(`Nearby search failed for "${placeType}":`, error);
            }
        }

        // 3. Filter và enhance dữ liệu
        const processedPlaces = await processRealPlacesData(allPlaces, category, coord);
        
        // 4. Cache kết quả
        dataCache.set(cacheKey, {
            data: processedPlaces,
            timestamp: Date.now()
        });

        console.log(`✅ Found ${processedPlaces.length} real places for ${category} in ${destination}`);
        return processedPlaces;

    } catch (error) {
        console.error(`❌ Error finding real places for ${category}:`, error);
        return [];
    }
};

/**
 * Tìm nhà hàng thực tế
 */
export const findRealRestaurants = async (destination, coord, travelStyle, mealType = 'all') => {
    console.log(`🍽️ Finding REAL restaurants in ${destination} for ${mealType}...`);

    const restaurantQueries = {
        breakfast: ['breakfast', 'phở', 'bánh mì', 'cà phê'],
        lunch: ['lunch', 'cơm', 'bún', 'restaurant'],
        dinner: ['dinner', 'nhà hàng', 'đặc sản', 'fine dining'],
        all: ['restaurant', 'food', 'ẩm thực', 'quán ăn']
    };

    const queries = restaurantQueries[mealType] || restaurantQueries.all;
    let restaurants = [];

    try {
        // Search bằng text
        for (const query of queries) {
            const results = await searchPlacesByText(
                `${query} ${destination}`,
                coord,
                15000 // 15km radius for restaurants
            );
            restaurants.push(...results);
        }

        // Search bằng type
        const nearbyRestaurants = await searchNearbyPlaces({
            location: coord,
            radius: 10000,
            type: 'restaurant'
        });
        restaurants.push(...nearbyRestaurants);

        // Process restaurants
        const processedRestaurants = await processRestaurantData(restaurants, travelStyle, mealType);
        
        console.log(`✅ Found ${processedRestaurants.length} real restaurants`);
        return processedRestaurants;

    } catch (error) {
        console.error('Error finding real restaurants:', error);
        return [];
    }
};

/**
 * Lấy dữ liệu thời tiết thực tế cho lịch trình
 */
export const getRealWeatherForItinerary = async (destination, coord, startDate, duration) => {
    console.log(`🌤️ Getting REAL weather for ${destination} from ${startDate}...`);

    try {
        const weather = await getRealTimeWeather(coord.lat, coord.lng, duration);
        
        if (!weather) {
            return generateFallbackWeather(duration);
        }

        // Process weather for each day
        const dailyWeather = [];
        const start = new Date(startDate);

        for (let i = 0; i < duration; i++) {
            const date = new Date(start);
            date.setDate(date.getDate() + i);
            
            const dayWeather = weather.forecast.find(f => 
                f.datetime.toDateString() === date.toDateString()
            ) || weather.current;

            dailyWeather.push({
                date: date.toISOString(),
                temperature: dayWeather.temperature,
                description: dayWeather.description,
                icon: dayWeather.icon,
                precipitation: dayWeather.precipitation || 0,
                windSpeed: dayWeather.windSpeed,
                humidity: weather.current.humidity,
                recommendations: generateWeatherRecommendations(dayWeather)
            });
        }

        return {
            daily: dailyWeather,
            alerts: weather.alerts || [],
            lastUpdated: weather.lastUpdated
        };

    } catch (error) {
        console.error('Error getting real weather:', error);
        return generateFallbackWeather(duration);
    }
};

// ==================== HELPER FUNCTIONS ====================

const processRealPlacesData = async (rawPlaces, category, centerCoord) => {
    // Loại bỏ trùng lặp dựa trên place_id
    const uniquePlaces = Array.from(
        new Map(rawPlaces.map(p => [p.place_id, p])).values()
    );

    // Filter theo chất lượng
    const qualityPlaces = uniquePlaces.filter(place => {
        return place.rating >= 3.5 && 
               place.user_ratings_total >= 10 &&
               place.name &&
               place.geometry?.location &&
               place.place_id;
    });

    // Enhance với dữ liệu thời gian thực
    const enhancedPlaces = await Promise.all(
        qualityPlaces.slice(0, 15).map(async (place) => {
            try {
                return await enhanceRealPlaceData(place, category, centerCoord);
            } catch (error) {
                console.warn(`Failed to enhance place ${place.name}:`, error);
                return enhanceBasicPlaceData(place, category);
            }
        })
    );

    // Sort theo relevance score
    const sortedPlaces = enhancedPlaces
        .filter(place => place !== null)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return sortedPlaces.slice(0, 8);
};

const enhanceRealPlaceData = async (place, category, centerCoord) => {
    try {
        // 1. Lấy chi tiết từ Places API
        const placeDetails = await getRealTimePlaceData(place.place_id);
        
        // 2. Lấy thông tin crowd level
        const crowdData = await getRealTimeCrowdLevel(place.place_id);
        
        // 3. Tính toán relevance score
        const relevanceScore = calculateRelevanceScore(place, category, centerCoord);

        return {
            // Basic info từ Places API
            place_id: place.place_id,
            name: place.name,
            address: place.vicinity || placeDetails?.formatted_address || '',
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            
            // Rating & reviews
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            priceLevel: place.price_level,
            
            // Real-time data
            isOpen: true, // Assume open during business hours
            openingHours: placeDetails?.opening_hours?.weekday_text || [],
            phoneNumber: placeDetails?.formatted_phone_number,
            website: placeDetails?.website,
            
            // Enhanced info
            types: place.types || [],
            photos: place.photos?.slice(0, 3) || [],
            category: category,
            
            // Crowd & timing
            currentCrowdLevel: crowdData?.currentLevel || 'unknown',
            bestTimeToVisit: crowdData?.bestTimeToVisit || 'Sáng sớm',
            peakHours: crowdData?.peakHours || [],
            
            // Pricing (estimated)
            entryFee: estimateEntryFee(place),
            estimatedDuration: estimateVisitDuration(place),
            
            // Relevance
            relevanceScore: relevanceScore,
            
            // Additional data
            businessStatus: placeDetails?.business_status || 'OPERATIONAL',
            lastUpdated: new Date(),
            dataSource: 'google_places_api'
        };

    } catch (error) {
        console.warn(`Error enhancing place ${place.name}:`, error);
        return enhanceBasicPlaceData(place, category);
    }
};

const enhanceBasicPlaceData = (place, category) => {
    return {
        place_id: place.place_id,
        name: place.name,
        address: place.vicinity || '',
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        priceLevel: place.price_level,
        types: place.types || [],
        photos: place.photos?.slice(0, 3) || [],
        category: category,
        entryFee: estimateEntryFee(place),
        estimatedDuration: estimateVisitDuration(place),
        relevanceScore: place.rating * 10 + (place.user_ratings_total / 100),
        businessStatus: 'OPERATIONAL',
        lastUpdated: new Date(),
        dataSource: 'google_places_basic'
    };
};

const processRestaurantData = async (rawRestaurants, travelStyle, mealType) => {
    // Remove duplicates
    const uniqueRestaurants = Array.from(
        new Map(rawRestaurants.map(r => [r.place_id, r])).values()
    );

    // Filter by quality and style
    const minRating = travelStyle === 'luxury' ? 4.2 : travelStyle === 'comfort' ? 4.0 : 3.5;
    const qualityRestaurants = uniqueRestaurants.filter(r => 
        r.rating >= minRating && 
        r.user_ratings_total >= 20 &&
        r.types?.includes('restaurant')
    );

    // Enhance with real data
    const enhancedRestaurants = await Promise.all(
        qualityRestaurants.slice(0, 10).map(async (restaurant) => {
            try {
                const details = await getRealTimePlaceData(restaurant.place_id);
                
                return {
                    place_id: restaurant.place_id,
                    name: restaurant.name,
                    address: restaurant.vicinity,
                    lat: restaurant.geometry.location.lat,
                    lng: restaurant.geometry.location.lng,
                    rating: restaurant.rating,
                    userRatingsTotal: restaurant.user_ratings_total,
                    priceLevel: restaurant.price_level,
                    cuisine: detectCuisineType(restaurant),
                    specialty: generateSpecialty(restaurant, mealType),
                    isOpen: true, // Assume open during business hours
                    openingHours: details?.opening_hours?.weekday_text || [],
                    phoneNumber: details?.formatted_phone_number,
                    website: details?.website,
                    photos: restaurant.photos?.slice(0, 2) || [],
                    estimatedCost: estimateRestaurantCost(restaurant.price_level, travelStyle),
                    mealType: mealType,
                    lastUpdated: new Date(),
                    dataSource: 'google_places_api'
                };
            } catch (error) {
                return {
                    place_id: restaurant.place_id,
                    name: restaurant.name,
                    address: restaurant.vicinity,
                    rating: restaurant.rating,
                    specialty: 'Món địa phương',
                    estimatedCost: 100000,
                    dataSource: 'google_places_basic'
                };
            }
        })
    );

    return enhancedRestaurants
        .filter(r => r !== null)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5);
};

const getCategoryConfig = (category, interests) => {
    const configs = {
        scenic_viewpoints: {
            queries: ['viewpoint', 'scenic view', 'panoramic', 'vista'],
            types: ['tourist_attraction', 'natural_feature', 'scenic_viewpoint'],
            radius: 50000
        },
        cultural_architecture: {
            queries: ['temple', 'pagoda', 'church', 'historical building', 'architecture'],
            types: ['place_of_worship', 'museum', 'tourist_attraction'],
            radius: 30000
        },
        local_restaurants: {
            queries: ['local restaurant', 'authentic food', 'traditional cuisine', 'đặc sản'],
            types: ['restaurant', 'meal_takeaway'],
            radius: 20000
        },
        parks_gardens: {
            queries: ['park', 'garden', 'botanical garden', 'công viên'],
            types: ['park', 'zoo'],
            radius: 40000
        },
        museums_galleries: {
            queries: ['museum', 'art gallery', 'exhibition', 'bảo tàng'],
            types: ['museum', 'art_gallery'],
            radius: 30000
        },
        top_attractions: {
            queries: ['tourist attraction', 'popular', 'famous', 'must visit'],
            types: ['tourist_attraction', 'amusement_park', 'scenic_viewpoint'],
            radius: 50000
        }
    };

    return configs[category] || configs.top_attractions;
};

const calculateRelevanceScore = (place, category, centerCoord) => {
    let score = 0;

    // Rating score (0-50 points)
    score += (place.rating || 0) * 10;

    // Popularity score (0-30 points)
    const popularity = Math.min((place.user_ratings_total || 0) / 100, 30);
    score += popularity;

    // Distance penalty (0-20 points deduction)
    const distance = calculateDistance(
        { lat: place.geometry.location.lat, lng: place.geometry.location.lng },
        centerCoord
    );
    const distancePenalty = Math.min(distance / 5, 20);
    score -= distancePenalty;

    // Category relevance (0-20 points)
    const categoryRelevance = calculateCategoryRelevance(place, category);
    score += categoryRelevance;

    return Math.max(0, score);
};

const calculateCategoryRelevance = (place, category) => {
    const types = place.types || [];
    const name = place.name?.toLowerCase() || '';

    const relevanceMap = {
        scenic_viewpoints: ['tourist_attraction', 'natural_feature', 'park', 'scenic_viewpoint'],
        cultural_architecture: ['place_of_worship', 'museum', 'tourist_attraction'],
        local_restaurants: ['restaurant', 'meal_takeaway', 'food'],
        parks_gardens: ['park', 'zoo', 'amusement_park'],
        museums_galleries: ['museum', 'art_gallery', 'library']
    };

    const relevantTypes = relevanceMap[category] || [];
    const typeMatches = types.filter(type => relevantTypes.includes(type)).length;

    return typeMatches * 5;
};

const detectCuisineType = (restaurant) => {
    const name = restaurant.name?.toLowerCase() || '';
    
    if (name.includes('phở')) return 'Phở';
    if (name.includes('bún')) return 'Bún';
    if (name.includes('cơm')) return 'Cơm';
    if (name.includes('bánh')) return 'Bánh';
    if (name.includes('chả cá')) return 'Chả cá';
    if (name.includes('lẩu')) return 'Lẩu';
    if (name.includes('nướng')) return 'Nướng';
    if (name.includes('hải sản')) return 'Hải sản';
    
    return 'Ẩm thực Việt Nam';
};

const generateSpecialty = (restaurant, mealType) => {
    const cuisine = detectCuisineType(restaurant);
    
    const specialties = {
        breakfast: ['Phở bò', 'Bánh mì', 'Cà phê sữa đá', 'Xôi'],
        lunch: ['Cơm tấm', 'Bún chả', 'Mì Quảng', 'Bánh cuốn'],
        dinner: ['Lẩu', 'Nướng', 'Hải sản', 'Đặc sản địa phương'],
        all: ['Đặc sản địa phương', cuisine]
    };
    
    const options = specialties[mealType] || specialties.all;
    return options[Math.floor(Math.random() * options.length)];
};

const estimateRestaurantCost = (priceLevel, travelStyle) => {
    const baseCosts = {
        budget: [30000, 50000, 80000, 120000, 200000],
        standard: [50000, 80000, 120000, 180000, 300000],
        comfort: [80000, 120000, 180000, 250000, 400000],
        luxury: [150000, 250000, 400000, 600000, 1000000]
    };
    
    const costs = baseCosts[travelStyle] || baseCosts.standard;
    return costs[priceLevel || 1];
};

const generateWeatherRecommendations = (weather) => {
    const recommendations = [];
    
    if (weather.precipitation > 5) {
        recommendations.push('Mang theo ô/áo mưa');
        recommendations.push('Ưu tiên hoạt động trong nhà');
    }
    
    if (weather.temperature > 32) {
        recommendations.push('Mang theo nước uống');
        recommendations.push('Tránh hoạt động ngoài trời 11h-15h');
        recommendations.push('Sử dụng kem chống nắng');
    }
    
    if (weather.temperature < 15) {
        recommendations.push('Mang theo áo ấm');
        recommendations.push('Kiểm tra giờ mở cửa các điểm tham quan');
    }
    
    return recommendations;
};

const generateFallbackWeather = (duration) => {
    const daily = [];
    const start = new Date();
    
    for (let i = 0; i < duration; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        
        daily.push({
            date: date.toISOString(),
            temperature: 25 + Math.random() * 10,
            description: 'Có thể có mưa rào',
            precipitation: Math.random() * 5,
            recommendations: ['Kiểm tra thời tiết trước khi đi']
        });
    }
    
    return { daily, alerts: [], lastUpdated: new Date() };
};