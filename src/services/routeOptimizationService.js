// src/services/routeOptimizationService.js - Tối ưu lộ trình với Google Maps API
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/**
 * Tính khoảng cách Haversine giữa 2 điểm (km)
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Bán kính trái đất (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

/**
 * Lấy khoảng cách thực tế từ Google Maps Directions API
 */
const getRealDistance = async (origin, destination) => {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();
        
        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
            const distance = data.routes[0].legs[0].distance.value / 1000; // Convert to km
            const duration = data.routes[0].legs[0].duration.value / 60; // Convert to minutes
            return { distance, duration };
        }
    } catch (error) {
        console.warn('Failed to get real distance, using haversine:', error);
    }
    
    // Fallback to haversine
    const distance = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    return { distance, duration: distance * 3 }; // Estimate 3 min per km
};

/**
 * Thuật toán Nearest Neighbor để tìm đường đi ngắn nhất qua tất cả các điểm
 * Cải tiến: Thử nhiều điểm xuất phát và chọn route tốt nhất
 */
export const optimizeRouteWithAStar = async (locations) => {
    if (!locations || locations.length <= 2) {
        return locations; // Không cần tối ưu nếu <= 2 điểm
    }

    console.log(`🗺️ Optimizing route for ${locations.length} locations...`);

    // Tạo ma trận khoảng cách
    const n = locations.length;
    const distanceMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Tính khoảng cách giữa tất cả các cặp điểm
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dist = haversineDistance(
                locations[i].lat, locations[i].lng,
                locations[j].lat, locations[j].lng
            );
            distanceMatrix[i][j] = dist;
            distanceMatrix[j][i] = dist;
        }
    }

    // Thử Nearest Neighbor từ nhiều điểm xuất phát khác nhau
    let bestRoute = null;
    let bestDistance = Infinity;
    
    // Thử từ 3 điểm đầu tiên (hoặc tất cả nếu < 3)
    const startPoints = Math.min(3, n);
    
    for (let startIdx = 0; startIdx < startPoints; startIdx++) {
        const route = nearestNeighborFromStart(locations, distanceMatrix, startIdx);
        const distance = calculateTotalDistance(route, distanceMatrix, locations);
        
        if (distance < bestDistance) {
            bestDistance = distance;
            bestRoute = route;
        }
    }

    // Áp dụng 2-opt optimization để cải thiện thêm
    const optimizedRoute = twoOptOptimization(bestRoute, distanceMatrix, locations);
    
    console.log(`✅ Route optimized! Total distance: ${bestDistance.toFixed(2)} km`);
    return optimizedRoute;
};

/**
 * Nearest Neighbor từ một điểm xuất phát cụ thể
 */
const nearestNeighborFromStart = (locations, distanceMatrix, startIdx) => {
    const n = locations.length;
    const visited = new Set();
    const route = [];
    let current = startIdx;
    
    visited.add(current);
    route.push(locations[current]);

    while (visited.size < n) {
        let nearest = -1;
        let minDist = Infinity;
        
        // Tìm điểm gần nhất chưa thăm
        for (let i = 0; i < n; i++) {
            if (!visited.has(i) && distanceMatrix[current][i] < minDist) {
                minDist = distanceMatrix[current][i];
                nearest = i;
            }
        }
        
        if (nearest !== -1) {
            visited.add(nearest);
            route.push(locations[nearest]);
            current = nearest;
        }
    }
    
    return route;
};

/**
 * Tính tổng khoảng cách của route
 */
const calculateTotalDistance = (route, distanceMatrix, locations) => {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const idx1 = locations.indexOf(route[i]);
        const idx2 = locations.indexOf(route[i + 1]);
        total += distanceMatrix[idx1][idx2];
    }
    return total;
};

/**
 * 2-opt optimization: Cải thiện route bằng cách swap các cạnh
 * Thuật toán này giúp loại bỏ các đường đi chéo nhau
 */
const twoOptOptimization = (route, distanceMatrix, originalLocations) => {
    if (route.length <= 3) return route;
    
    let improved = true;
    let optimizedRoute = [...route];
    let iterations = 0;
    const maxIterations = 100; // Giới hạn số lần lặp
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        for (let i = 1; i < optimizedRoute.length - 2; i++) {
            for (let j = i + 1; j < optimizedRoute.length - 1; j++) {
                // Tính khoảng cách hiện tại
                const idx_i = originalLocations.indexOf(optimizedRoute[i]);
                const idx_i_prev = originalLocations.indexOf(optimizedRoute[i - 1]);
                const idx_j = originalLocations.indexOf(optimizedRoute[j]);
                const idx_j_next = originalLocations.indexOf(optimizedRoute[j + 1]);
                
                const currentDist = 
                    distanceMatrix[idx_i_prev][idx_i] + 
                    distanceMatrix[idx_j][idx_j_next];
                
                // Tính khoảng cách sau khi swap
                const newDist = 
                    distanceMatrix[idx_i_prev][idx_j] + 
                    distanceMatrix[idx_i][idx_j_next];
                
                // Nếu swap tốt hơn, thực hiện swap
                if (newDist < currentDist) {
                    // Reverse đoạn từ i đến j
                    const newRoute = [
                        ...optimizedRoute.slice(0, i),
                        ...optimizedRoute.slice(i, j + 1).reverse(),
                        ...optimizedRoute.slice(j + 1)
                    ];
                    optimizedRoute = newRoute;
                    improved = true;
                }
            }
        }
    }
    
    console.log(`🔄 2-opt completed after ${iterations} iterations`);
    return optimizedRoute;
};

/**
 * Tối ưu route với thông tin chi tiết về khoảng cách và thời gian
 */
export const optimizeRouteWithDetails = async (locations) => {
    const optimized = await optimizeRouteWithAStar(locations);
    
    // Tính tổng khoảng cách và thời gian
    let totalDistance = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < optimized.length - 1; i++) {
        const dist = haversineDistance(
            optimized[i].lat, optimized[i].lng,
            optimized[i + 1].lat, optimized[i + 1].lng
        );
        totalDistance += dist;
        totalDuration += dist * 3; // Estimate 3 min per km
    }
    
    return {
        route: optimized,
        totalDistance: totalDistance.toFixed(2),
        totalDuration: Math.round(totalDuration),
        savings: calculateSavings(locations, optimized)
    };
};

/**
 * Tính toán tiết kiệm được bao nhiêu so với route gốc
 */
const calculateSavings = (original, optimized) => {
    let originalDist = 0;
    let optimizedDist = 0;
    
    for (let i = 0; i < original.length - 1; i++) {
        originalDist += haversineDistance(
            original[i].lat, original[i].lng,
            original[i + 1].lat, original[i + 1].lng
        );
    }
    
    for (let i = 0; i < optimized.length - 1; i++) {
        optimizedDist += haversineDistance(
            optimized[i].lat, optimized[i].lng,
            optimized[i + 1].lat, optimized[i + 1].lng
        );
    }
    
    const saved = originalDist - optimizedDist;
    const percentage = (saved / originalDist * 100).toFixed(1);
    
    return {
        distanceSaved: saved.toFixed(2),
        percentage: percentage > 0 ? percentage : 0
    };
};

export default {
    optimizeRouteWithAStar,
    optimizeRouteWithDetails,
    haversineDistance,
    getRealDistance
};
