// src/services/userTripAnalytics.js
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

/**
 * Service phân tích dữ liệu chuyến đi của người dùng
 */

/**
 * Lấy tất cả chuyến đi của người dùng
 */
export const getUserTrips = async (userId) => {
    try {
        const q = query(
            collection(db, 'itineraries'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const trips = [];
        
        snapshot.forEach(doc => {
            trips.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return trips;
    } catch (error) {
        console.error('Lỗi lấy chuyến đi:', error);
        return [];
    }
};

/**
 * Phân tích thống kê chuyến đi của người dùng
 */
export const analyzeUserTrips = async (userId) => {
    const trips = await getUserTrips(userId);
    
    if (trips.length === 0) {
        return {
            totalTrips: 0,
            totalDestinations: 0,
            totalSpent: 0,
            favoriteDestinations: [],
            averageBudget: 0,
            preferredTravelStyle: null,
            commonInterests: []
        };
    }
    
    // Đếm số chuyến đi
    const totalTrips = trips.length;
    
    // Đếm tổng số điểm đến
    const totalDestinations = trips.reduce((sum, trip) => {
        return sum + (trip.summary?.totalDestinations || 0);
    }, 0);
    
    // Tổng chi tiêu
    const totalSpent = trips.reduce((sum, trip) => {
        return sum + (trip.costBreakdown?.grandTotal || 0);
    }, 0);
    
    // Điểm đến yêu thích (đếm số lần đi)
    const destinationCount = {};
    trips.forEach(trip => {
        const dest = trip.header?.destination?.main;
        if (dest) {
            destinationCount[dest] = (destinationCount[dest] || 0) + 1;
        }
    });
    
    const favoriteDestinations = Object.entries(destinationCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([dest, count]) => ({ destination: dest, count }));
    
    // Ngân sách trung bình
    const averageBudget = Math.round(totalSpent / totalTrips);
    
    // Phong cách du lịch ưa thích
    const styleCount = {};
    trips.forEach(trip => {
        const style = trip.header?.travelStyle?.type;
        if (style) {
            styleCount[style] = (styleCount[style] || 0) + 1;
        }
    });
    
    const preferredTravelStyle = Object.entries(styleCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    // Sở thích phổ biến
    const interestCount = {};
    trips.forEach(trip => {
        const interests = trip.preferences?.interests || [];
        interests.forEach(interest => {
            interestCount[interest] = (interestCount[interest] || 0) + 1;
        });
    });
    
    const commonInterests = Object.entries(interestCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([interest, count]) => ({ interest, count }));
    
    return {
        totalTrips,
        totalDestinations,
        totalSpent,
        favoriteDestinations,
        averageBudget,
        preferredTravelStyle,
        commonInterests,
        trips // Trả về danh sách đầy đủ
    };
};

/**
 * Lấy địa điểm người dùng đã đi nhiều nhất
 */
export const getUserFavoritePlaces = async (userId) => {
    const trips = await getUserTrips(userId);
    const placeCount = {};
    
    trips.forEach(trip => {
        const dailyItinerary = trip.dailyItinerary || [];
        dailyItinerary.forEach(day => {
            const destinations = day.destinations || [];
            destinations.forEach(dest => {
                const key = dest.name;
                if (key) {
                    placeCount[key] = (placeCount[key] || 0) + 1;
                }
            });
        });
    });
    
    return Object.entries(placeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([place, count]) => ({ place, count }));
};

/**
 * Phân tích thời gian du lịch ưa thích
 */
export const analyzePreferredTravelTime = async (userId) => {
    const trips = await getUserTrips(userId);
    
    const monthCount = {};
    const durationCount = {};
    
    trips.forEach(trip => {
        // Phân tích tháng
        const startDate = trip.header?.duration?.startDateISO;
        if (startDate) {
            const month = new Date(startDate).getMonth() + 1;
            monthCount[month] = (monthCount[month] || 0) + 1;
        }
        
        // Phân tích độ dài chuyến đi
        const duration = trip.header?.duration?.days;
        if (duration) {
            durationCount[duration] = (durationCount[duration] || 0) + 1;
        }
    });
    
    const preferredMonths = Object.entries(monthCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([month, count]) => ({ month: parseInt(month), count }));
    
    const preferredDurations = Object.entries(durationCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([duration, count]) => ({ duration: parseInt(duration), count }));
    
    return {
        preferredMonths,
        preferredDurations
    };
};

/**
 * Tạo dashboard thống kê cho người dùng
 */
export const generateUserDashboard = async (userId) => {
    const analytics = await analyzeUserTrips(userId);
    const favoritePlaces = await getUserFavoritePlaces(userId);
    const timePreferences = await analyzePreferredTravelTime(userId);
    
    return {
        ...analytics,
        favoritePlaces,
        timePreferences,
        generatedAt: new Date()
    };
};
