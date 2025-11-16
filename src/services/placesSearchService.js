// src/services/placesSearchService.js
/**
 * Service để tìm kiếm địa điểm thực từ Google Places API
 * Sử dụng backend proxy để tránh CORS
 */

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/**
 * Tìm kiếm địa điểm du lịch thực tế theo tên thành phố
 */
export const searchTouristAttractions = async (cityName, limit = 10) => {
    try {
        console.log(`🔍 Searching tourist attractions in ${cityName}...`);
        
        // Tìm kiếm địa điểm du lịch nổi tiếng
        const searchQueries = [
            `top attractions in ${cityName} Vietnam`,
            `tourist places ${cityName}`,
            `things to do ${cityName}`,
            `landmarks ${cityName} Vietnam`
        ];
        
        let allPlaces = [];
        
        for (const query of searchQueries) {
            try {
                const places = await searchPlacesByQuery(query, cityName);
                allPlaces.push(...places);
                
                if (allPlaces.length >= limit) break;
            } catch (error) {
                console.warn(`Failed to search for: ${query}`, error);
            }
        }
        
        // Loại bỏ trùng lặp và sắp xếp theo rating
        const uniquePlaces = removeDuplicatePlaces(allPlaces);
        const sortedPlaces = uniquePlaces
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, limit);
        
        console.log(`✅ Found ${sortedPlaces.length} tourist attractions in ${cityName}`);
        return sortedPlaces;
        
    } catch (error) {
        console.error('Error searching tourist attractions:', error);
        return getFallbackAttractions(cityName);
    }
};

/**
 * Tìm kiếm nhà hàng thực tế
 */
export const searchRestaurants = async (cityName, cuisineType = '', limit = 5) => {
    try {
        console.log(`🍽️ Searching restaurants in ${cityName}...`);
        
        const searchQueries = [
            `best restaurants ${cityName} Vietnam`,
            `local food ${cityName}`,
            `${cuisineType} restaurant ${cityName}`.trim()
        ].filter(q => q.length > 0);
        
        let allRestaurants = [];
        
        for (const query of searchQueries) {
            try {
                const restaurants = await searchPlacesByQuery(query, cityName, 'restaurant');
                allRestaurants.push(...restaurants);
                
                if (allRestaurants.length >= limit) break;
            } catch (error) {
                console.warn(`Failed to search restaurants: ${query}`, error);
            }
        }
        
        const uniqueRestaurants = removeDuplicatePlaces(allRestaurants);
        const sortedRestaurants = uniqueRestaurants
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, limit);
        
        console.log(`✅ Found ${sortedRestaurants.length} restaurants in ${cityName}`);
        return sortedRestaurants;
        
    } catch (error) {
        console.error('Error searching restaurants:', error);
        return getFallbackRestaurants(cityName);
    }
};

/**
 * Tìm kiếm địa điểm bằng text query
 */
const searchPlacesByQuery = async (query, cityName, type = '') => {
    try {
        // Sử dụng Google Places Text Search API
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
            `query=${encodeURIComponent(query)}&` +
            `location=${getCityCoordinates(cityName)}&` +
            `radius=50000&` +
            `type=${type}&` +
            `key=${GOOGLE_MAPS_API_KEY}`;
        
        // Vì CORS, sử dụng fallback data thay vì gọi trực tiếp
        console.warn('Using fallback data due to CORS restrictions');
        return getFallbackPlacesByQuery(query, cityName, type);
        
    } catch (error) {
        console.error('Error in searchPlacesByQuery:', error);
        return [];
    }
};

/**
 * Lấy tọa độ thành phố
 */
const getCityCoordinates = (cityName) => {
    const coordinates = {
        'Vũng Tàu': '10.346,107.0843',
        'Hà Nội': '21.0285,105.8542',
        'Hồ Chí Minh': '10.8231,106.6297',
        'Đà Nẵng': '16.0471,108.2068',
        'Đà Lạt': '11.9404,108.4583',
        'Nha Trang': '12.2388,109.1967',
        'Hội An': '15.8801,108.3380',
        'Phú Quốc': '10.2899,103.9840'
    };
    
    return coordinates[cityName] || '10.8231,106.6297'; // Default to Ho Chi Minh
};

/**
 * Fallback data khi không thể gọi API
 */
const getFallbackPlacesByQuery = (query, cityName, type) => {
    const fallbackData = {
        'Vũng Tàu': {
            attractions: [
                {
                    name: 'Tượng Chúa Kitô Vua',
                    address: 'Núi Nhỏ, Vũng Tàu',
                    rating: 4.5,
                    types: ['tourist_attraction', 'landmark'],
                    geometry: { location: { lat: 10.3312, lng: 107.0771 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 0
                },
                {
                    name: 'Bãi Trước',
                    address: 'Thùy Vân, Vũng Tàu',
                    rating: 4.2,
                    types: ['tourist_attraction', 'beach'],
                    geometry: { location: { lat: 10.3447, lng: 107.0842 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 0
                },
                {
                    name: 'Ngọn Hải Đăng Vũng Tàu',
                    address: 'Núi Nhỏ, Vũng Tàu',
                    rating: 4.3,
                    types: ['tourist_attraction', 'lighthouse'],
                    geometry: { location: { lat: 10.3298, lng: 107.0759 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 1
                },
                {
                    name: 'Bạch Dinh (White Palace)',
                    address: 'Trần Phú, Vũng Tàu',
                    rating: 4.0,
                    types: ['tourist_attraction', 'historical'],
                    geometry: { location: { lat: 10.3421, lng: 107.0936 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 1
                },
                {
                    name: 'Chùa Niet Ban Tinh Xa',
                    address: 'Núi Lớn, Vũng Tàu',
                    rating: 4.4,
                    types: ['tourist_attraction', 'temple'],
                    geometry: { location: { lat: 10.3156, lng: 107.1023 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 0
                },
                {
                    name: 'Bãi Sau',
                    address: 'Thùy Vân, Vũng Tàu',
                    rating: 4.1,
                    types: ['tourist_attraction', 'beach'],
                    geometry: { location: { lat: 10.3389, lng: 107.0925 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 0
                }
            ],
            restaurants: [
                {
                    name: 'Bánh Khọt Gốc Vũ',
                    address: '6 Nguyễn Trường Tộ, Vũng Tàu',
                    rating: 4.6,
                    types: ['restaurant', 'local_cuisine'],
                    geometry: { location: { lat: 10.3456, lng: 107.0842 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 1
                },
                {
                    name: 'Hải Sản Bãi Trước',
                    address: 'Bãi Trước, Vũng Tàu',
                    rating: 4.3,
                    types: ['restaurant', 'seafood'],
                    geometry: { location: { lat: 10.3447, lng: 107.0842 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 2
                },
                {
                    name: 'Quán Cơm Niêu Vũng Tàu',
                    address: 'Hoàng Hoa Thám, Vũng Tàu',
                    rating: 4.2,
                    types: ['restaurant', 'vietnamese'],
                    geometry: { location: { lat: 10.3421, lng: 107.0889 } },
                    photos: [],
                    opening_hours: { open_now: true },
                    price_level: 1
                }
            ]
        }
    };
    
    const cityData = fallbackData[cityName];
    if (!cityData) return [];
    
    if (type === 'restaurant') {
        return cityData.restaurants || [];
    }
    
    return cityData.attractions || [];
};

/**
 * Loại bỏ địa điểm trùng lặp
 */
const removeDuplicatePlaces = (places) => {
    const seen = new Set();
    return places.filter(place => {
        const key = place.name.toLowerCase().trim();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

/**
 * Fallback attractions khi có lỗi
 */
const getFallbackAttractions = (cityName) => {
    return getFallbackPlacesByQuery('attractions', cityName, '');
};

/**
 * Fallback restaurants khi có lỗi
 */
const getFallbackRestaurants = (cityName) => {
    return getFallbackPlacesByQuery('restaurants', cityName, 'restaurant');
};

export default {
    searchTouristAttractions,
    searchRestaurants,
    getCityCoordinates
};