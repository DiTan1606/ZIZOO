// src/services/placesService.js
import { saveCachedPlace, getCachedPlace, getCachedPlacesByProvince } from './firestoreService';
import provinceCoords from '../assets/provinceCoord.json';

let placesService = null;
let geocoderService = null; 
let placesServiceElement = null; // Element giả định cho PlacesService nếu map là null

/**
 * Khởi tạo PlacesService và GeocodingService.
 * Hàm này được gọi từ MapViewer sau khi Maps API tải xong.
 * @param {google.maps.Map | null} map - Đối tượng bản đồ hiện tại (có thể là null nếu chỉ cần service).
 */
export const initPlacesService = async (map) => {
    if (!window.google?.maps) {
        console.log('Google Maps API không được sử dụng, chuyển sang Nominatim.');
        // Không cần khởi tạo Google Maps service, dùng Nominatim trực tiếp
        console.log('PlacesService initialized with Nominatim (OSM)');
        return;
    }
    
    if (window.google.maps.Geocoder && !geocoderService) {
        geocoderService = new window.google.maps.Geocoder();
        console.log('GeocoderService initialized');
    }

    if (window.google.maps.places && !placesService) {
        if (map) {
            placesService = new window.google.maps.places.PlacesService(map);
            console.log('PlacesService initialized with map');
        } else {
            placesServiceElement = document.createElement('div');
            placesService = new window.google.maps.places.PlacesService(placesServiceElement);
            console.log('PlacesService initialized without map (using dummy div)');
        }
    }
    
    return;
};

/**
 * Tìm kiếm các địa điểm lân cận bằng PlacesService.
 */
export const searchNearbyPlaces = async (request) => {
    if (!placesService) {
        console.log('PlacesService không có, sử dụng Nominatim thay thế.');
        // Sử dụng Nominatim nếu PlacesService không tồn tại
        const { location, radius, type, keyword, minRating } = request;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            `${type} in ${keyword}`
        )}&lat=${location.lat}&lon=${location.lng}&radius=${radius}&limit=5`;
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'ZiZooTravelApp/1.0 (your.email@example.com)', // Thay bằng email thật
                },
            });
            const results = await response.json();

            if (!results || results.length === 0) {
                console.log('No places found with Nominatim');
                return [];
            }

            const valid = results
                .filter(p => p.lat && p.lon)
                .map(p => ({
                    place_id: p.osm_id, // Sử dụng osm_id làm place_id giả định
                    name: p.display_name,
                    vicinity: p.display_name,
                    rating: minRating ? (minRating <= 3.5 ? 0 : minRating - 0.5) : 0, // Giả lập rating từ minRating
                    geometry: { location: { lat: () => parseFloat(p.lat), lng: () => parseFloat(p.lon) } },
                    types: [type],
                    photos: [], // Nominatim không cung cấp ảnh
                }))
                .slice(0, 5);

            console.log(`Found ${valid.length} places with Nominatim`);
            return valid;
        } catch (err) {
            console.error('Error fetching places from Nominatim:', err);
            return [];
        }
    } else {
        // Giữ nguyên logic Google Places nếu PlacesService tồn tại
        throw new Error('PlacesService chưa khởi tạo. Đảm bảo gọi initPlacesService.');

        // Kiểm tra cache trước
        const cached = await getCachedPlacesByProvince(request.keyword, request.type ? [request.type] : []);
        if (cached.length >= 5) {
            console.log(`Dùng cache cho ${request.keyword}: ${cached.length} điểm`);
            return cached.slice(0, 5);
        }

        return new Promise((resolve, reject) => {
            placesService.nearbySearch(request, async (results, status) => {
                if (status !== 'OK' && status !== 'ZERO_RESULTS') {
                    console.warn(`Places API lỗi: ${status}, request:`, request);
                    return resolve(cached); // Fallback về cache nếu API lỗi
                }

                const valid = (results || []).filter(p => p.place_id && p.rating >= (request.minRating || 3.5));
                if (valid.length === 0) {
                    console.log(`Không tìm thấy địa điểm hợp lệ cho ${request.type} ở ${request.keyword}`);
                    return resolve(cached); // Fallback về cache nếu không có kết quả hợp lệ
                }

                const promises = valid.map(async place => {
                    const cachedPlace = await getCachedPlace(place.place_id);
                    if (!cachedPlace) {
                        const data = {
                            name: place.name,
                            address: place.vicinity,
                            rating: place.rating,
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                            types: place.types,
                            photo: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null
                        };
                        await saveCachedPlace(place.place_id, data);
                        return { id: place.place_id, ...data };
                    }
                    return { id: place.place_id, ...cachedPlace };
                });

                const final = await Promise.all(promises);
                resolve(final.slice(0, 5));
            });
        });
    }
};

/**
 * Tìm kiếm và cache địa điểm (Giữ nguyên logic của bạn).
 */
export const searchAndCachePlaces = async (request, province) => {
    const cached = await getCachedPlacesByProvince(province, request.types || []);
    if (cached.length > 0) { // Chấp nhận cache ngay cả khi ít hơn 5 địa điểm
        console.log(`Dùng cache cho ${province}: ${cached.length} điểm`);
        return cached.slice(0, 5);
    }
    return searchNearbyPlaces(request);
};

/**
 * Chuyển đổi tên tỉnh/thành thành tọa độ bằng GeocodingService.
 */
export const geocodeProvince = async (province) => {
    const cachedCoord = provinceCoords[province];
    if (cachedCoord) return cachedCoord;

    // SỬ DỤNG geocoderService đã được khởi tạo
    if (!geocoderService) {
        console.log('GeocoderService không có, sử dụng Nominatim thay thế.');
        // Sử dụng Nominatim thay vì Geocoder
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            `${province}, Vietnam`
        )}&limit=1`;
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'ZiZooTravelApp/1.0 (your.email@example.com)' },
            });
            const results = await response.json();
            if (results[0]) {
                return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
            }
            throw new Error('Geocoding failed');
        } catch (err) {
            console.warn(`Geocoding ${province} failed with Nominatim:`, err);
            return { lat: 16.0471, lng: 108.2258 }; // Fallback Đà Nẵng
        }
    }
    
    return new Promise((resolve, reject) => {
        geocoderService.geocode({ address: `${province}, Vietnam` }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
                reject(`Geocode lỗi: ${status}`);
            }
        });
    });
};
