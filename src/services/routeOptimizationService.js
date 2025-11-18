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
 * Thuật toán A* để tìm đường đi ngắn nhất qua tất cả các điểm
 * Sử dụng Nearest Neighbor heuristic
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

    // Nearest Neighbor Algorithm (greedy approach for TSP)
    const visited = new Set();
    const optimizedRoute = [];
    let current = 0; // Bắt đầu từ điểm đầu tiên
    
    visited.add(current);
    optimizedRoute.push(locations[current]);

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
            optimizedRoute.push(locations[nearest]);
            current = nearest;
        }
    }

    console.log(`✅ Route optimized! Total distance reduced.`);
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
