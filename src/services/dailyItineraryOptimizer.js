// src/services/dailyItineraryOptimizer.js
// Tối ưu lịch trình hàng ngày - LIGHTWEIGHT VERSION
// Không dùng Haversine để tránh lag, chỉ dùng Euclidean distance đơn giản

/**
 * Tối ưu lịch trình hàng ngày với logic phức tạp:
 * 1. Sắp xếp theo loại địa điểm (sáng: tham quan, trưa: ăn, chiều: giải trí...)
 * 2. Tối ưu đường đi giữa các địa điểm cùng loại
 * 3. Đảm bảo logic và hợp lý
 */

/**
 * Phân loại địa điểm theo thời gian trong ngày phù hợp
 */
const categorizeByTimeOfDay = (destination) => {
    const category = destination.category || destination.types?.[0] || 'general';
    const name = destination.name?.toLowerCase() || '';
    
    // Sáng (6:00 - 11:00): Tham quan, thiên nhiên, chùa, đền
    if (
        category.includes('tourist_attraction') ||
        category.includes('park') ||
        category.includes('temple') ||
        category.includes('museum') ||
        category.includes('church') ||
        name.includes('chùa') ||
        name.includes('đền') ||
        name.includes('bảo tàng') ||
        name.includes('công viên')
    ) {
        return 'morning';
    }
    
    // Trưa (11:00 - 14:00): Nhà hàng, quán ăn
    if (
        category.includes('restaurant') ||
        category.includes('food') ||
        name.includes('nhà hàng') ||
        name.includes('quán ăn')
    ) {
        return 'lunch';
    }
    
    // Chiều (14:00 - 18:00): Mua sắm, cà phê, bãi biển
    if (
        category.includes('shopping') ||
        category.includes('cafe') ||
        category.includes('beach') ||
        category.includes('market') ||
        name.includes('chợ') ||
        name.includes('cà phê') ||
        name.includes('bãi biển')
    ) {
        return 'afternoon';
    }
    
    // Tối (18:00 - 22:00): Giải trí, bar, club
    if (
        category.includes('night_club') ||
        category.includes('bar') ||
        category.includes('entertainment') ||
        name.includes('bar') ||
        name.includes('club') ||
        name.includes('giải trí')
    ) {
        return 'evening';
    }
    
    // Mặc định: có thể đi bất kỳ lúc nào
    return 'flexible';
};

/**
 * Tối ưu route cho một nhóm địa điểm (Nearest Neighbor - SIMPLIFIED)
 * Chỉ tối ưu nếu có <= 10 địa điểm để tránh lag
 */
const optimizeRouteForGroup = (locations) => {
    if (!locations || locations.length === 0) return [];
    if (locations.length === 1) return locations;
    
    // Lọc địa điểm có tọa độ hợp lệ
    const validLocations = locations.filter(loc => 
        loc && 
        typeof loc.lat === 'number' && 
        typeof loc.lng === 'number' &&
        !isNaN(loc.lat) && 
        !isNaN(loc.lng)
    );
    
    if (validLocations.length === 0) {
        console.warn('⚠️ No valid locations with coordinates');
        return locations; // Trả về nguyên bản nếu không có tọa độ hợp lệ
    }
    
    // Nếu quá nhiều địa điểm (>10), chỉ sắp xếp theo lat/lng đơn giản
    if (validLocations.length > 10) {
        console.log(`⚠️ Too many locations (${validLocations.length}), using simple sort`);
        return validLocations.sort((a, b) => {
            // Sắp xếp theo latitude trước, sau đó longitude
            if (Math.abs(a.lat - b.lat) > 0.01) {
                return a.lat - b.lat;
            }
            return a.lng - b.lng;
        });
    }
    
    // Nearest Neighbor cho <= 10 địa điểm
    try {
        const visited = new Set();
        const optimized = [];
        let current = 0;
        
        visited.add(current);
        optimized.push(validLocations[current]);
        
        let iterations = 0;
        const maxIterations = validLocations.length * 2; // Safety limit
        
        while (visited.size < validLocations.length && iterations < maxIterations) {
            iterations++;
            let nearest = -1;
            let minDist = Infinity;
            
            for (let i = 0; i < validLocations.length; i++) {
                if (visited.has(i)) continue;
                
                try {
                    // Tính khoảng cách đơn giản (Euclidean)
                    const dist = Math.sqrt(
                        Math.pow(validLocations[current].lat - validLocations[i].lat, 2) +
                        Math.pow(validLocations[current].lng - validLocations[i].lng, 2)
                    );
                    
                    if (!isNaN(dist) && dist < minDist) {
                        minDist = dist;
                        nearest = i;
                    }
                } catch (distError) {
                    console.warn('Error calculating distance:', distError);
                    continue;
                }
            }
            
            if (nearest !== -1) {
                visited.add(nearest);
                optimized.push(validLocations[nearest]);
                current = nearest;
            } else {
                break; // Không tìm thấy nearest, thoát
            }
        }
        
        if (iterations >= maxIterations) {
            console.warn('⚠️ Max iterations reached in optimizeRouteForGroup');
        }
        
        return optimized;
    } catch (error) {
        console.error('❌ Error in optimizeRouteForGroup:', error);
        return validLocations; // Fallback
    }
};

/**
 * Tối ưu lịch trình cho một ngày - SIMPLIFIED VERSION
 * @param {Array} destinations - Danh sách địa điểm
 * @param {Object} options - Tùy chọn (interests, travelStyle, etc.)
 * @returns {Array} - Danh sách địa điểm đã tối ưu
 */
export const optimizeDayRoute = (destinations, options = {}) => {
    if (!destinations || destinations.length === 0) return [];
    if (destinations.length === 1) return destinations;
    
    // Timeout protection
    const startTime = Date.now();
    const timeout = 5000; // 5 seconds max
    
    try {
        // Nếu quá nhiều địa điểm (>15), chỉ sắp xếp đơn giản
        if (destinations.length > 15) {
            console.log(`⚠️ Too many destinations (${destinations.length}), using simple categorization only`);
            return simpleCategorizeAndSort(destinations);
        }
        
        console.log(`🗺️ Optimizing route for ${destinations.length} destinations...`);
    
        // Lọc địa điểm có tọa độ
        const locationsWithCoords = destinations.filter(d => d && d.lat && d.lng);
        const locationsWithoutCoords = destinations.filter(d => !d || !d.lat || !d.lng);
        
        if (locationsWithCoords.length === 0) {
            console.warn('⚠️ No locations with coordinates, keeping original order');
            return destinations;
        }
        
        // Check timeout
        if (Date.now() - startTime > timeout) {
            console.warn('⚠️ Timeout in optimizeDayRoute, returning simple sort');
            return simpleCategorizeAndSort(destinations);
        }
        
        // Phân loại địa điểm theo thời gian trong ngày
        const categorized = {
            morning: [],
            lunch: [],
            afternoon: [],
            evening: [],
            flexible: []
        };
        
        locationsWithCoords.forEach(dest => {
            try {
                const timeCategory = categorizeByTimeOfDay(dest);
                categorized[timeCategory].push(dest);
            } catch (catError) {
                console.warn('Error categorizing:', catError);
                categorized.flexible.push(dest);
            }
        });
        
        // Check timeout
        if (Date.now() - startTime > timeout) {
            console.warn('⚠️ Timeout after categorization, returning simple result');
            return simpleCategorizeAndSort(destinations);
        }
        
        // Tối ưu route cho từng nhóm (chỉ nếu nhóm có <= 10 địa điểm)
        const optimizedMorning = optimizeRouteForGroup(categorized.morning);
        const optimizedLunch = optimizeRouteForGroup(categorized.lunch);
        const optimizedAfternoon = optimizeRouteForGroup(categorized.afternoon);
        const optimizedEvening = optimizeRouteForGroup(categorized.evening);
        const optimizedFlexible = optimizeRouteForGroup(categorized.flexible);
        
        // Kết hợp đơn giản: Sáng → Trưa → Chiều → Tối → Flexible
        const optimizedRoute = [
            ...optimizedMorning,
            ...optimizedLunch,
            ...optimizedAfternoon,
            ...optimizedEvening,
            ...optimizedFlexible
        ];
        
        // Thêm địa điểm không có tọa độ vào cuối
        const finalRoute = [...optimizedRoute, ...locationsWithoutCoords];
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ Route optimized in ${elapsed}ms:`, finalRoute.map(d => d.name).join(' → '));
        
        return finalRoute;
    } catch (error) {
        console.error('❌ Error in optimizeDayRoute:', error);
        console.log('⚠️ Falling back to simple categorization');
        return simpleCategorizeAndSort(destinations);
    }
};

/**
 * Sắp xếp đơn giản chỉ theo loại, không tối ưu khoảng cách
 */
const simpleCategorizeAndSort = (destinations) => {
    if (!destinations || destinations.length === 0) return [];
    
    try {
        const categorized = {
            morning: [],
            lunch: [],
            afternoon: [],
            evening: [],
            flexible: []
        };
        
        destinations.forEach(dest => {
            if (!dest) return;
            try {
                const timeCategory = categorizeByTimeOfDay(dest);
                if (categorized[timeCategory]) {
                    categorized[timeCategory].push(dest);
                } else {
                    categorized.flexible.push(dest);
                }
            } catch (catError) {
                console.warn('Error categorizing destination:', catError);
                categorized.flexible.push(dest);
            }
        });
        
        return [
            ...categorized.morning,
            ...categorized.lunch,
            ...categorized.afternoon,
            ...categorized.evening,
            ...categorized.flexible
        ];
    } catch (error) {
        console.error('❌ Error in simpleCategorizeAndSort:', error);
        return destinations; // Fallback
    }
};

/**
 * Phân bổ địa điểm vào nhiều ngày - SIMPLIFIED VERSION
 * @param {Array} allDestinations - Tất cả địa điểm user chọn
 * @param {Number} numberOfDays - Số ngày
 * @param {Object} options - Tùy chọn
 * @returns {Array} - Mảng các ngày, mỗi ngày có danh sách địa điểm
 */
export const distributeDestinationsAcrossDays = (allDestinations, numberOfDays, options = {}) => {
    if (!allDestinations || allDestinations.length === 0) return [];
    if (numberOfDays <= 0) return [];
    
    console.log(`📅 Distributing ${allDestinations.length} destinations across ${numberOfDays} days...`);
    
    // Phân loại địa điểm
    const categorized = {
        morning: [],
        lunch: [],
        afternoon: [],
        evening: [],
        flexible: []
    };
    
    allDestinations.forEach(dest => {
        const timeCategory = categorizeByTimeOfDay(dest);
        categorized[timeCategory].push(dest);
    });
    
    // Tính số địa điểm mỗi ngày (tối đa 6 địa điểm/ngày)
    const destinationsPerDay = Math.ceil(allDestinations.length / numberOfDays);
    const maxPerDay = Math.min(6, destinationsPerDay + 1);
    
    console.log(`📊 Target: ~${destinationsPerDay} destinations/day (max: ${maxPerDay})`);
    
    // Phân bổ đơn giản - round robin
    const dailyPlans = Array.from({ length: numberOfDays }, (_, i) => ({
        day: i + 1,
        destinations: [],
        count: 0
    }));
    
    // Phân bổ từng loại theo round-robin
    const distributeCategory = (category, categoryName) => {
        category.forEach((dest, index) => {
            const dayIndex = index % numberOfDays;
            if (dailyPlans[dayIndex].destinations.length < maxPerDay) {
                dailyPlans[dayIndex].destinations.push(dest);
                dailyPlans[dayIndex].count++;
            }
        });
    };
    
    // Phân bổ theo thứ tự: morning, lunch, afternoon, evening, flexible
    distributeCategory(categorized.morning, 'morning');
    distributeCategory(categorized.lunch, 'lunch');
    distributeCategory(categorized.afternoon, 'afternoon');
    distributeCategory(categorized.evening, 'evening');
    distributeCategory(categorized.flexible, 'flexible');
    
    // Sắp xếp lại địa điểm trong mỗi ngày (nhẹ, không tối ưu khoảng cách)
    dailyPlans.forEach(plan => {
        if (plan.destinations.length > 0) {
            plan.destinations = simpleCategorizeAndSort(plan.destinations);
            console.log(`✅ Day ${plan.day}: ${plan.count} destinations`);
        }
    });
    
    return dailyPlans;
};

/**
 * Tính điểm đa dạng của lịch trình
 */
export const calculateDiversityScore = (destinations) => {
    if (!destinations || destinations.length === 0) return 0;
    
    const categories = new Set();
    destinations.forEach(dest => {
        const category = categorizeByTimeOfDay(dest);
        categories.add(category);
    });
    
    // Điểm = số loại khác nhau / 5 (có 5 loại: morning, lunch, afternoon, evening, flexible)
    return (categories.size / 5) * 100;
};

export default {
    optimizeDayRoute,
    distributeDestinationsAcrossDays,
    calculateDiversityScore,
    categorizeByTimeOfDay
};
