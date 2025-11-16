// src/services/alertsAndAdjustmentsService.js
import { collection, addDoc, getDocs, query, where, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getRealTimeWeather, getRealTimePlaceData, getRealTimeTraffic } from './realTimeDataService';
import { searchPlacesByText } from './placesService';

/**
 * Hệ thống Cảnh báo & Tự động Điều chỉnh
 * - Push notifications cho thời tiết xấu, đóng cửa điểm đến
 * - AI dự đoán rủi ro + tự đề xuất phương án thay thế
 * - Tự động cập nhật lịch trình khi có thay đổi
 */

class AlertsAndAdjustmentsService {
    constructor() {
        this.activeAlerts = new Map();
        this.monitoringIntervals = new Map();
        this.alertSubscribers = new Set();
    }

    /**
     * 1. MONITORING & DETECTION
     */
    
    // Bắt đầu monitor một lịch trình
    async startMonitoring(itineraryId, itinerary, userId) {
        console.log(`🔍 Starting monitoring for itinerary: ${itineraryId}`);
        
        // Stop existing monitoring if any
        this.stopMonitoring(itineraryId);
        
        // Start monitoring interval
        const interval = setInterval(async () => {
            await this.checkForAlerts(itineraryId, itinerary, userId);
        }, 10 * 60 * 1000); // Check every 10 minutes
        
        this.monitoringIntervals.set(itineraryId, interval);
        
        // Initial check
        await this.checkForAlerts(itineraryId, itinerary, userId);
    }
    
    // Dừng monitor
    stopMonitoring(itineraryId) {
        const interval = this.monitoringIntervals.get(itineraryId);
        if (interval) {
            clearInterval(interval);
            this.monitoringIntervals.delete(itineraryId);
            console.log(`⏹️ Stopped monitoring for itinerary: ${itineraryId}`);
        }
    }
    
    // Kiểm tra các cảnh báo
    async checkForAlerts(itineraryId, itinerary, userId) {
        try {
            const alerts = [];
            
            // Check weather alerts
            const weatherAlerts = await this.checkWeatherAlerts(itinerary);
            alerts.push(...weatherAlerts);
            
            // Check place status alerts
            const placeAlerts = await this.checkPlaceStatusAlerts(itinerary);
            alerts.push(...placeAlerts);
            
            // Check traffic alerts
            const trafficAlerts = await this.checkTrafficAlerts(itinerary);
            alerts.push(...trafficAlerts);
            
            // Check pricing alerts
            const pricingAlerts = await this.checkPricingAlerts(itinerary);
            alerts.push(...pricingAlerts);
            
            // Check crowd alerts
            const crowdAlerts = await this.checkCrowdAlerts(itinerary);
            alerts.push(...crowdAlerts);
            
            // Process alerts
            if (alerts.length > 0) {
                await this.processAlerts(itineraryId, alerts, itinerary, userId);
            }
            
        } catch (error) {
            console.error('Error checking alerts:', error);
        }
    }

    /**
     * 2. WEATHER ALERTS
     */
    async checkWeatherAlerts(itinerary) {
        const alerts = [];
        
        for (const day of itinerary.dailyItinerary) {
            const dayDate = new Date(day.dateISO);
            const isToday = this.isToday(dayDate);
            const isTomorrow = this.isTomorrow(dayDate);
            
            if (!isToday && !isTomorrow) continue;
            
            // Get weather for destinations
            for (const destination of day.destinations) {
                if (!destination.lat || !destination.lng) continue;
                
                const weather = await getRealTimeWeather(destination.lat, destination.lng);
                
                if (weather) {
                    // Severe weather alerts
                    if (weather.alerts && weather.alerts.length > 0) {
                        alerts.push({
                            type: 'weather_severe',
                            severity: 'high',
                            title: 'Cảnh báo thời tiết nghiêm trọng',
                            message: `${destination.name}: ${weather.alerts[0].description}`,
                            destination: destination,
                            day: day.day,
                            data: weather.alerts[0],
                            suggestedActions: [
                                'Hoãn hoặc thay đổi kế hoạch',
                                'Tìm hoạt động trong nhà',
                                'Theo dõi cập nhật thời tiết'
                            ]
                        });
                    }
                    
                    // Heavy rain alert
                    if (weather.current.description.includes('mưa') && 
                        weather.forecast.some(f => f.precipitation > 10)) {
                        alerts.push({
                            type: 'weather_rain',
                            severity: 'medium',
                            title: 'Cảnh báo mưa lớn',
                            message: `${destination.name}: Dự báo mưa lớn ${isToday ? 'hôm nay' : 'ngày mai'}`,
                            destination: destination,
                            day: day.day,
                            data: weather.current,
                            suggestedActions: [
                                'Mang theo ô/áo mưa',
                                'Chọn hoạt động trong nhà',
                                'Kiểm tra giao thông'
                            ]
                        });
                    }
                    
                    // Extreme temperature alert
                    if (weather.current.temperature > 38 || weather.current.temperature < 5) {
                        alerts.push({
                            type: 'weather_temperature',
                            severity: 'medium',
                            title: weather.current.temperature > 38 ? 'Cảnh báo nắng nóng' : 'Cảnh báo lạnh',
                            message: `${destination.name}: Nhiệt độ ${weather.current.temperature}°C`,
                            destination: destination,
                            day: day.day,
                            data: weather.current,
                            suggestedActions: weather.current.temperature > 38 ? [
                                'Tránh hoạt động ngoài trời 11h-15h',
                                'Mang theo nước uống',
                                'Sử dụng kem chống nắng'
                            ] : [
                                'Mang theo áo ấm',
                                'Kiểm tra giờ mở cửa',
                                'Chuẩn bị đồ giữ ấm'
                            ]
                        });
                    }
                }
            }
        }
        
        return alerts;
    }

    /**
     * 3. PLACE STATUS ALERTS
     */
    async checkPlaceStatusAlerts(itinerary) {
        const alerts = [];
        
        for (const day of itinerary.dailyItinerary) {
            const dayDate = new Date(day.dateISO);
            const isUpcoming = dayDate >= new Date() && dayDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            
            if (!isUpcoming) continue;
            
            for (const destination of day.destinations) {
                const placeId = destination.place_id || destination.id;
                if (!placeId) continue;
                
                const rawPlaceData = await getRealTimePlaceData(placeId);
                const placeData = rawPlaceData ? this.sanitizeForFirebase(rawPlaceData) : null;
                
                if (placeData) {
                    // Closed permanently
                    if (placeData.business_status === 'CLOSED_PERMANENTLY') {
                        alerts.push({
                            type: 'place_closed_permanently',
                            severity: 'high',
                            title: 'Điểm đến đã đóng cửa vĩnh viễn',
                            message: `${destination.name} đã đóng cửa vĩnh viễn`,
                            destination: destination,
                            day: day.day,
                            data: placeData,
                            suggestedActions: [
                                'Tìm điểm đến thay thế',
                                'Cập nhật lịch trình',
                                'Kiểm tra hoàn tiền (nếu đã đặt vé)'
                            ]
                        });
                    }
                    
                    // Temporarily closed
                    if (placeData.business_status === 'CLOSED_TEMPORARILY') {
                        alerts.push({
                            type: 'place_closed_temporarily',
                            severity: 'high',
                            title: 'Điểm đến tạm thời đóng cửa',
                            message: `${destination.name} tạm thời đóng cửa`,
                            destination: destination,
                            day: day.day,
                            data: placeData,
                            suggestedActions: [
                                'Kiểm tra ngày mở cửa lại',
                                'Tìm điểm đến thay thế',
                                'Liên hệ để xác nhận'
                            ]
                        });
                    }
                    
                    // Opening hours changed
                    if (placeData.opening_hours && false && this.isToday(dayDate)) { // Disabled open_now check
                        const currentHour = new Date().getHours();
                        if (currentHour >= 8 && currentHour <= 20) { // During typical visiting hours
                            alerts.push({
                                type: 'place_closed_now',
                                severity: 'medium',
                                title: 'Điểm đến hiện tại đóng cửa',
                                message: `${destination.name} hiện tại đóng cửa`,
                                destination: destination,
                                day: day.day,
                                data: placeData.opening_hours,
                                suggestedActions: [
                                    'Kiểm tra giờ mở cửa',
                                    'Điều chỉnh thời gian tham quan',
                                    'Tham quan điểm khác trước'
                                ]
                            });
                        }
                    }
                }
            }
        }
        
        return alerts;
    }

    /**
     * 4. TRAFFIC ALERTS
     */
    async checkTrafficAlerts(itinerary) {
        const alerts = [];
        
        for (const day of itinerary.dailyItinerary) {
            const dayDate = new Date(day.dateISO);
            const isToday = this.isToday(dayDate);
            
            if (!isToday) continue;
            
            // Check traffic between destinations
            for (let i = 0; i < day.destinations.length - 1; i++) {
                const origin = day.destinations[i];
                const destination = day.destinations[i + 1];
                
                if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) continue;
                
                const trafficData = await getRealTimeTraffic(
                    { lat: origin.lat, lng: origin.lng },
                    { lat: destination.lat, lng: destination.lng }
                );
                
                if (trafficData && trafficData.trafficCondition === 'heavy') {
                    alerts.push({
                        type: 'traffic_heavy',
                        severity: 'medium',
                        title: 'Giao thông ùn tắc',
                        message: `Giao thông từ ${origin.name} đến ${destination.name} đang ùn tắc`,
                        origin: origin,
                        destination: destination,
                        day: day.day,
                        data: trafficData,
                        suggestedActions: [
                            'Khởi hành sớm hơn',
                            'Sử dụng tuyến đường khác',
                            'Chọn phương tiện khác'
                        ]
                    });
                }
            }
        }
        
        return alerts;
    }

    /**
     * 5. PRICING ALERTS
     */
    async checkPricingAlerts(itinerary) {
        const alerts = [];
        
        // Check for price increases
        for (const day of itinerary.dailyItinerary) {
            for (const destination of day.destinations) {
                // Simulate price monitoring
                const priceIncrease = Math.random() > 0.95; // 5% chance
                
                if (priceIncrease) {
                    alerts.push({
                        type: 'pricing_increase',
                        severity: 'low',
                        title: 'Giá vé tăng',
                        message: `Giá vé tại ${destination.name} đã tăng 20%`,
                        destination: destination,
                        day: day.day,
                        data: { oldPrice: 100000, newPrice: 120000 },
                        suggestedActions: [
                            'Đặt vé ngay để tránh tăng giá thêm',
                            'Tìm ưu đãi/khuyến mãi',
                            'Xem xét điểm đến thay thế'
                        ]
                    });
                }
            }
        }
        
        return alerts;
    }

    /**
     * 6. CROWD ALERTS
     */
    async checkCrowdAlerts(itinerary) {
        const alerts = [];
        
        for (const day of itinerary.dailyItinerary) {
            const dayDate = new Date(day.dateISO);
            const isToday = this.isToday(dayDate);
            const isTomorrow = this.isTomorrow(dayDate);
            
            if (!isToday && !isTomorrow) continue;
            
            for (const destination of day.destinations) {
                // Simulate crowd level check
                const currentHour = new Date().getHours();
                const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
                
                // High crowd during peak hours on weekends
                if (isWeekend && currentHour >= 10 && currentHour <= 16) {
                    alerts.push({
                        type: 'crowd_high',
                        severity: 'low',
                        title: 'Dự báo đông đúc',
                        message: `${destination.name} dự báo rất đông ${isToday ? 'hôm nay' : 'ngày mai'}`,
                        destination: destination,
                        day: day.day,
                        data: { crowdLevel: 'high', peakHours: '10:00-16:00' },
                        suggestedActions: [
                            'Đến sớm hơn (trước 10h)',
                            'Đến muộn hơn (sau 16h)',
                            'Đặt vé trước để tránh xếp hàng'
                        ]
                    });
                }
            }
        }
        
        return alerts;
    }

    /**
     * 7. PROCESS ALERTS & AUTO-ADJUSTMENTS
     */
    async processAlerts(itineraryId, alerts, itinerary, userId) {
        console.log(`🚨 Processing ${alerts.length} alerts for itinerary ${itineraryId}`);
        
        // Group alerts by severity
        const highSeverityAlerts = alerts.filter(a => a.severity === 'high');
        const mediumSeverityAlerts = alerts.filter(a => a.severity === 'medium');
        const lowSeverityAlerts = alerts.filter(a => a.severity === 'low');
        
        // Auto-adjust for high severity alerts
        if (highSeverityAlerts.length > 0) {
            const adjustments = await this.generateAutoAdjustments(highSeverityAlerts, itinerary);
            
            if (adjustments.length > 0) {
                await this.proposeAdjustments(itineraryId, adjustments, userId);
            }
        }
        
        // Send notifications
        await this.sendAlertNotifications(itineraryId, alerts, userId);
        
        // Store alerts in database
        await this.storeAlerts(itineraryId, alerts);
        
        // Update active alerts
        this.activeAlerts.set(itineraryId, alerts);
    }

    /**
     * 8. AUTO-ADJUSTMENTS GENERATION
     */
    async generateAutoAdjustments(alerts, itinerary) {
        const adjustments = [];
        
        for (const alert of alerts) {
            switch (alert.type) {
                case 'place_closed_permanently':
                case 'place_closed_temporarily':
                    // Find alternative destinations
                    const alternatives = await this.findAlternativeDestinations(alert.destination, itinerary);
                    if (alternatives.length > 0) {
                        adjustments.push({
                            type: 'replace_destination',
                            alert: alert,
                            originalDestination: alert.destination,
                            alternatives: alternatives,
                            reason: 'Điểm đến không khả dụng',
                            autoApply: false // Require user confirmation
                        });
                    }
                    break;
                    
                case 'weather_severe':
                    // Suggest indoor alternatives
                    const indoorAlternatives = await this.findIndoorAlternatives(alert.destination, itinerary);
                    adjustments.push({
                        type: 'weather_adjustment',
                        alert: alert,
                        alternatives: indoorAlternatives,
                        reason: 'Thời tiết không thuận lợi',
                        autoApply: false
                    });
                    break;
                    
                case 'traffic_heavy':
                    // Suggest time adjustment
                    adjustments.push({
                        type: 'time_adjustment',
                        alert: alert,
                        suggestedTime: this.calculateBetterTime(alert.data),
                        reason: 'Tránh giao thông ùn tắc',
                        autoApply: true // Can auto-apply time changes
                    });
                    break;
            }
        }
        
        return adjustments;
    }

    /**
     * 9. FIND ALTERNATIVES
     */
    async findAlternativeDestinations(originalDestination, itinerary) {
        try {
            const location = itinerary.header.destination.coordinates;
            
            // Search for similar places
            const searchQuery = `${originalDestination.types?.[0] || 'tourist_attraction'} near ${itinerary.header.destination.main}`;
            const alternatives = await searchPlacesByText(searchQuery, location, 30000);
            
            return alternatives
                .filter(place => place.place_id !== originalDestination.place_id)
                .slice(0, 3)
                .map(place => ({
                    name: place.name,
                    address: place.vicinity,
                    rating: place.rating,
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                    place_id: place.place_id,
                    types: place.types,
                    reason: `Thay thế cho ${originalDestination.name}`
                }));
        } catch (error) {
            console.error('Error finding alternatives:', error);
            return [];
        }
    }

    async findIndoorAlternatives(destination, itinerary) {
        try {
            const location = itinerary.header.destination.coordinates;
            
            // Search for indoor activities
            const indoorTypes = ['museum', 'shopping_mall', 'art_gallery', 'aquarium', 'movie_theater'];
            const alternatives = [];
            
            for (const type of indoorTypes) {
                const results = await searchPlacesByText(`${type} in ${itinerary.header.destination.main}`, location, 20000);
                alternatives.push(...results.slice(0, 2));
            }
            
            return alternatives.slice(0, 5).map(place => ({
                name: place.name,
                address: place.vicinity,
                rating: place.rating,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                place_id: place.place_id,
                types: place.types,
                reason: 'Hoạt động trong nhà'
            }));
        } catch (error) {
            console.error('Error finding indoor alternatives:', error);
            return [];
        }
    }

    /**
     * 10. NOTIFICATIONS
     */
    async sendAlertNotifications(itineraryId, alerts, userId) {
        // Group alerts by severity for notification
        const highPriorityAlerts = alerts.filter(a => a.severity === 'high');
        const mediumPriorityAlerts = alerts.filter(a => a.severity === 'medium');
        
        // Send immediate notifications for high priority
        if (highPriorityAlerts.length > 0) {
            await this.sendPushNotification(userId, {
                title: '🚨 Cảnh báo quan trọng cho chuyến đi',
                body: `${highPriorityAlerts.length} cảnh báo cần xử lý ngay`,
                data: { itineraryId, alerts: highPriorityAlerts }
            });
        }
        
        // Send summary for medium priority
        if (mediumPriorityAlerts.length > 0) {
            await this.sendPushNotification(userId, {
                title: '⚠️ Cập nhật cho chuyến đi',
                body: `${mediumPriorityAlerts.length} thông báo mới`,
                data: { itineraryId, alerts: mediumPriorityAlerts }
            });
        }
        
        // Notify subscribers
        this.notifySubscribers(itineraryId, alerts);
    }

    async sendPushNotification(userId, notification) {
        try {
            // Store notification in database for web app to pick up
            await addDoc(collection(db, 'notifications'), {
                userId,
                title: notification.title,
                body: notification.body,
                data: notification.data,
                timestamp: new Date(),
                read: false,
                type: 'alert'
            });
            
            console.log(`📱 Notification sent to user ${userId}: ${notification.title}`);
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    /**
     * 11. STORE & RETRIEVE ALERTS
     */
    async storeAlerts(itineraryId, alerts) {
        try {
            // Sanitize alerts data to remove undefined values
            const sanitizedAlerts = this.sanitizeForFirebase(alerts);
            
            await addDoc(collection(db, 'itinerary_alerts'), {
                itineraryId: itineraryId || 'unknown',
                alerts: sanitizedAlerts,
                timestamp: new Date(),
                processed: true
            });
        } catch (error) {
            console.error('Error storing alerts:', error);
        }
    }

    // Helper function to sanitize data for Firebase
    sanitizeForFirebase(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeForFirebase(item));
        }
        
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined && typeof value !== 'function') {
                    sanitized[key] = this.sanitizeForFirebase(value);
                }
            }
            return sanitized;
        }
        
        // Skip functions
        if (typeof obj === 'function') {
            return null;
        }
        
        return obj;
    }

    async getAlertsHistory(itineraryId) {
        try {
            const alertsSnap = await getDocs(
                query(
                    collection(db, 'itinerary_alerts'),
                    where('itineraryId', '==', itineraryId),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                )
            );

            return alertsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting alerts history:', error);
            return [];
        }
    }

    /**
     * 12. UTILITY FUNCTIONS
     */
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    isTomorrow(date) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return date.toDateString() === tomorrow.toDateString();
    }

    calculateBetterTime(trafficData) {
        // Suggest 30 minutes earlier to avoid traffic
        const currentTime = new Date();
        currentTime.setMinutes(currentTime.getMinutes() - 30);
        return currentTime.toTimeString().slice(0, 5);
    }

    async proposeAdjustments(itineraryId, adjustments, userId) {
        try {
            await addDoc(collection(db, 'itinerary_adjustments'), {
                itineraryId,
                userId,
                adjustments,
                status: 'pending',
                timestamp: new Date()
            });
            
            // Send notification about proposed adjustments
            await this.sendPushNotification(userId, {
                title: '🔄 Đề xuất điều chỉnh lịch trình',
                body: `${adjustments.length} điều chỉnh được đề xuất cho chuyến đi`,
                data: { itineraryId, adjustments }
            });
        } catch (error) {
            console.error('Error proposing adjustments:', error);
        }
    }

    // Subscribe to alerts
    subscribe(callback) {
        this.alertSubscribers.add(callback);
        return () => this.alertSubscribers.delete(callback);
    }

    // Notify all subscribers
    notifySubscribers(itineraryId, alerts) {
        this.alertSubscribers.forEach(callback => {
            try {
                callback(itineraryId, alerts);
            } catch (error) {
                console.error('Error notifying subscriber:', error);
            }
        });
    }

    // Get active alerts for an itinerary
    getActiveAlerts(itineraryId) {
        return this.activeAlerts.get(itineraryId) || [];
    }

    // Clear alerts for an itinerary
    clearAlerts(itineraryId) {
        this.activeAlerts.delete(itineraryId);
    }
}

// Singleton instance
export const alertsService = new AlertsAndAdjustmentsService();

// Export functions
export const startItineraryMonitoring = (itineraryId, itinerary, userId) => 
    alertsService.startMonitoring(itineraryId, itinerary, userId);

export const stopItineraryMonitoring = (itineraryId) => 
    alertsService.stopMonitoring(itineraryId);

export const getActiveAlerts = (itineraryId) => 
    alertsService.getActiveAlerts(itineraryId);

export const subscribeToAlerts = (callback) => 
    alertsService.subscribe(callback);

export const getAlertsHistory = (itineraryId) => 
    alertsService.getAlertsHistory(itineraryId);

export default alertsService;