// src/utils/commonUtils.js
// Các utility functions chung để tránh trùng lặp

import { LOCATION_ALIASES } from '../constants';

/**
 * Normalize location name
 */
export const normalizeVietnamLocation = (inputName) => {
    if (!inputName) return null;

    const normalizedInput = inputName
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return LOCATION_ALIASES[normalizedInput] || inputName;
};

/**
 * Format money
 */
export const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
};

/**
 * Format date
 */
export const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Calculate distance between two points
 */
export const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

/**
 * Get current season
 */
export const getSeason = (date) => {
    const month = new Date(date).getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
};

/**
 * Get climate type for destination
 */
export const getClimate = (destination) => {
    const tropicalCities = ['Hồ Chí Minh', 'Cần Thơ', 'Nha Trang', 'Phú Quốc'];
    const temperateHighlands = ['Đà Lạt', 'Sapa', 'Lào Cai'];
    
    if (tropicalCities.includes(destination)) return 'tropical';
    if (temperateHighlands.includes(destination)) return 'temperate';
    return 'subtropical';
};

/**
 * Estimate entry fee based on place type
 */
export const estimateEntryFee = (place) => {
    const types = place.types || [];
    
    if (types.includes('museum')) return 30000;
    if (types.includes('amusement_park')) return 100000;
    if (types.includes('zoo')) return 50000;
    if (types.includes('tourist_attraction')) return 20000;
    if (types.includes('park')) return 0;
    if (types.includes('place_of_worship')) return 0;
    
    return place.price_level ? place.price_level * 25000 : 20000;
};

/**
 * Estimate visit duration
 */
export const estimateVisitDuration = (place) => {
    const types = place.types || [];
    
    if (types.includes('museum')) return '2-3 giờ';
    if (types.includes('amusement_park')) return '4-6 giờ';
    if (types.includes('zoo')) return '3-4 giờ';
    if (types.includes('park')) return '1-2 giờ';
    if (types.includes('place_of_worship')) return '30-60 phút';
    
    return '1-2 giờ';
};

/**
 * Generate time ago string
 */
export const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} ngày trước`;
    if (hours > 0) return `${hours} giờ trước`;
    if (minutes > 0) return `${minutes} phút trước`;
    return 'Vừa xong';
};

/**
 * Check if date is today
 */
export const isToday = (date) => {
    const today = new Date();
    return new Date(date).toDateString() === today.toDateString();
};

/**
 * Check if date is tomorrow
 */
export const isTomorrow = (date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return new Date(date).toDateString() === tomorrow.toDateString();
};

/**
 * Generate unique ID
 */
export const generateId = () => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove duplicates from array based on key
 */
export const removeDuplicates = (array, key) => {
    return Array.from(new Map(array.map(item => [item[key], item])).values());
};

/**
 * Validate email
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number (Vietnam)
 */
export const isValidPhoneVN = (phone) => {
    const phoneRegex = /^(\+84|84|0)(3|5|7|8|9)[0-9]{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Get random item from array
 */
export const getRandomItem = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

/**
 * Shuffle array
 */
export const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

/**
 * Chunk array into smaller arrays
 */
export const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

/**
 * Get province coordinates with fallback
 */
export const getProvinceCoordinates = (provinceName, provinceCoords) => {
    const coord = provinceCoords[provinceName];
    if (coord) return coord;

    // Fallback coordinates
    const fallbackCoords = {
        'Bà Rịa - Vũng Tàu': { lat: 10.346, lng: 107.084 },
        'Vũng Tàu': { lat: 10.346, lng: 107.084 },
        'Hồ Chí Minh': { lat: 10.823, lng: 106.629 },
        'Hà Nội': { lat: 21.028, lng: 105.854 },
        'Đà Nẵng': { lat: 16.047, lng: 108.220 },
        'Đà Lạt': { lat: 11.940, lng: 108.437 },
        'Nha Trang': { lat: 12.238, lng: 109.196 },
        'Phú Quốc': { lat: 10.227, lng: 103.967 },
        'Hội An': { lat: 15.880, lng: 108.338 },
        'Huế': { lat: 16.464, lng: 107.586 },
        'Quảng Ninh': { lat: 20.958, lng: 107.002 },
        'Cần Thơ': { lat: 10.045, lng: 105.746 },
        'Lào Cai': { lat: 22.486, lng: 103.955 },
        'Khánh Hòa': { lat: 12.238, lng: 109.196 },
        'Kiên Giang': { lat: 10.227, lng: 103.967 },
        'Quảng Nam': { lat: 15.880, lng: 108.338 },
        'Thừa Thiên Huế': { lat: 16.464, lng: 107.586 }
    };

    return fallbackCoords[provinceName] || { lat: 10.823, lng: 106.629 }; // Default to HCM
};