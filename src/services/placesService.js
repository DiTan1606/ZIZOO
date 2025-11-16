// src/services/placesService.js
let mapInstance = null;
let placesService = null;

// Khởi tạo Places Service
export const initPlacesService = (map) => {
    if (!map) {
        console.warn('Map instance is required for Places Service');
        return false;
    }

    mapInstance = map;

    // Tạo Places Service instance
    if (window.google?.maps?.places) {
        placesService = new window.google.maps.places.PlacesService(mapInstance);
        console.log('✅ Places Service initialized successfully');
        return true;
    } else {
        console.error('❌ Google Maps Places API not available');
        return false;
    }
};

// Kiểm tra Places Service availability
const isPlacesServiceAvailable = () => {
    const available = !!(window.google?.maps?.places && placesService);
    if (!available) {
        console.error('Places Service not available. Make sure:');
        console.error('1. Google Maps API key is valid');
        console.error('2. Places library is loaded: &libraries=places');
        console.error('3. Map instance is properly initialized');
    }
    return available;
};

// Tìm kiếm địa điểm gần đó - SỬA để gọi API thật
export const searchNearbyPlaces = async (options) => {
    return new Promise((resolve, reject) => {
        if (!isPlacesServiceAvailable()) {
            reject(new Error('Google Maps Places API not available. Please check your API key and libraries.'));
            return;
        }

        try {
            console.log(`🔍 Searching nearby places:`, options);

            placesService.nearbySearch(options, (results, status) => {
                console.log(`📍 Nearby search status: ${status}, results: ${results?.length || 0}`);

                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results || []);
                } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.log('ℹ️ No nearby places found');
                    resolve([]);
                } else {
                    console.error(`Nearby search error: ${status}`);
                    reject(new Error(`Places API error: ${status}`));
                }
            });
        } catch (error) {
            console.error('Nearby search service error:', error);
            reject(error);
        }
    });
};

// Text Search - Giới hạn trong Việt Nam và theo tỉnh thành
export const searchPlacesByText = async (query, location, radius = 50000, provinceName = '') => {
    return new Promise((resolve, reject) => {
        if (!isPlacesServiceAvailable()) {
            reject(new Error('Google Maps Places API not available. Please check your API key and libraries.'));
            return;
        }

        try {
            const searchOptions = {
                query: query,
                radius: radius
            };

            // Thêm location nếu có
            if (location && location.lat && location.lng) {
                searchOptions.location = new window.google.maps.LatLng(location.lat, location.lng);
            }

            console.log(`🔍 Text search: "${query}"`, location ? `near ${location.lat},${location.lng}` : '', provinceName ? `in ${provinceName}` : '');

            placesService.textSearch(searchOptions, (results, status) => {
                console.log(`📝 Text search status: ${status}, results: ${results?.length || 0}`);

                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    // Filter kết quả chỉ lấy địa điểm ở Việt Nam và trong tỉnh
                    const filteredResults = filterResultsByCountryAndProvince(results || [], provinceName);
                    console.log(`✅ Filtered to ${filteredResults.length} results in Vietnam${provinceName ? ` (${provinceName})` : ''}`);
                    resolve(filteredResults);
                } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.log(`ℹ️ No results for: "${query}"`);
                    resolve([]);
                } else {
                    console.error(`Text search error for "${query}": ${status}`);
                    reject(new Error(`Text search error: ${status}`));
                }
            });
        } catch (error) {
            console.error(`Text search service error for "${query}":`, error);
            reject(error);
        }
    });
};

// Lấy chi tiết địa điểm
export const getPlaceDetails = (placeId) => {
    return new Promise((resolve, reject) => {
        if (!isPlacesServiceAvailable()) {
            reject(new Error('Places API not available'));
            return;
        }

        try {
            placesService.getDetails({ placeId }, (place, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve(place);
                } else {
                    reject(new Error(`Place details error: ${status}`));
                }
            });
        } catch (error) {
            reject(new Error(`Place details service error: ${error.message}`));
        }
    });
};

// Hàm lấy URL ảnh từ Google Places
export const getPhotoUrl = (photoRef, maxWidth = 400) => {
    if (!photoRef) return null;

    if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
        console.error('Google Maps API key not found in environment variables');
        return null;
    }

    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoRef}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`;
};

// Hàm tìm kiếm địa điểm theo type
export const searchPlacesByType = async (type, location, radius = 50000, keyword = '') => {
    return new Promise((resolve, reject) => {
        if (!isPlacesServiceAvailable()) {
            reject(new Error('Places API not available'));
            return;
        }

        try {
            const options = {
                location: location,
                radius: radius,
                type: type
            };

            if (keyword) {
                options.keyword = keyword;
            }

            console.log(`🔍 Searching ${type} places`, keyword ? `with keyword: ${keyword}` : '');

            placesService.nearbySearch(options, (results, status) => {
                console.log(`🏷️ ${type} search status: ${status}, results: ${results?.length || 0}`);

                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results || []);
                } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.log(`ℹ️ No ${type} places found`);
                    resolve([]);
                } else {
                    console.error(`Type search error for ${type}: ${status}`);
                    resolve([]);
                }
            });
        } catch (error) {
            console.error(`Type search service error for ${type}:`, error);
            resolve([]);
        }
    });
};

// Hàm autocomplete
export const getPlacePredictions = (input) => {
    return new Promise((resolve, reject) => {
        if (!window.google?.maps?.places || !window.google.maps.places.AutocompleteService) {
            console.warn('Autocomplete service not available');
            resolve([]);
            return;
        }

        try {
            const autocompleteService = new window.google.maps.places.AutocompleteService();

            autocompleteService.getPlacePredictions(
                { input: input, componentRestrictions: { country: 'vn' } },
                (predictions, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                        resolve(predictions);
                    } else {
                        resolve([]);
                    }
                }
            );
        } catch (error) {
            console.error('Autocomplete service error:', error);
            resolve([]);
        }
    });
};

// Hàm kiểm tra trạng thái Places Service
export const getPlacesServiceStatus = () => {
    return {
        isAvailable: isPlacesServiceAvailable(),
        isInitialized: !!placesService,
        hasGoogleMaps: !!window.google?.maps,
        hasPlacesAPI: !!window.google?.maps?.places,
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? '✅ Set' : '❌ Missing'
    };
};

// Hàm reset service
export const resetPlacesService = () => {
    mapInstance = null;
    placesService = null;
    console.log('🔄 Places Service reset');
};

// Filter kết quả chỉ lấy địa điểm ở Việt Nam và trong tỉnh
const filterResultsByCountryAndProvince = (results, provinceName = '') => {
    if (!results || results.length === 0) return [];

    return results.filter(place => {
        // Lấy địa chỉ đầy đủ
        const address = place.formatted_address || place.vicinity || '';
        const addressLower = address.toLowerCase();

        // 1. Kiểm tra có ở Việt Nam không
        const isInVietnam = 
            addressLower.includes('việt nam') || 
            addressLower.includes('vietnam') || 
            addressLower.includes('viet nam') ||
            !addressLower.includes('cambodia') && 
            !addressLower.includes('campuchia') &&
            !addressLower.includes('laos') && 
            !addressLower.includes('lào') &&
            !addressLower.includes('china') && 
            !addressLower.includes('trung quốc') &&
            !addressLower.includes('thailand') &&
            !addressLower.includes('thái lan');

        if (!isInVietnam) {
            console.log(`❌ Filtered out (not in Vietnam): ${place.name} - ${address}`);
            return false;
        }

        // 2. Nếu có provinceName, kiểm tra địa điểm có trong tỉnh không
        if (provinceName) {
            const provinceNameLower = provinceName.toLowerCase();
            const provinceVariants = getProvinceVariants(provinceName);
            
            const isInProvince = provinceVariants.some(variant => 
                addressLower.includes(variant.toLowerCase())
            );

            if (!isInProvince) {
                console.log(`❌ Filtered out (not in ${provinceName}): ${place.name} - ${address}`);
                return false;
            }
        }

        return true;
    });
};

// Lấy các biến thể tên tỉnh (có dấu, không dấu, viết tắt)
const getProvinceVariants = (provinceName) => {
    const variants = [provinceName];
    
    // Map các tên tỉnh với biến thể
    const provinceMap = {
        'Vũng Tàu': ['vũng tàu', 'vung tau', 'bà rịa - vũng tàu', 'ba ria - vung tau', 'brvt'],
        'Hà Nội': ['hà nội', 'ha noi', 'hanoi'],
        'TP. Hồ Chí Minh': ['hồ chí minh', 'ho chi minh', 'tp.hcm', 'tphcm', 'sài gòn', 'saigon'],
        'Đà Nẵng': ['đà nẵng', 'da nang', 'danang'],
        'Đà Lạt': ['đà lạt', 'da lat', 'dalat', 'lâm đồng', 'lam dong'],
        'Nha Trang': ['nha trang', 'khánh hòa', 'khanh hoa'],
        'Phú Quốc': ['phú quốc', 'phu quoc', 'kiên giang', 'kien giang'],
        'Hội An': ['hội an', 'hoi an', 'quảng nam', 'quang nam'],
        'Huế': ['huế', 'hue', 'thừa thiên huế', 'thua thien hue'],
        'Sapa': ['sapa', 'sa pa', 'lào cai', 'lao cai'],
        'Hạ Long': ['hạ long', 'ha long', 'quảng ninh', 'quang ninh'],
        'Quy Nhơn': ['quy nhơn', 'quy nhon', 'bình định', 'binh dinh'],
        'Cần Thơ': ['cần thơ', 'can tho'],
        'Hải Phòng': ['hải phòng', 'hai phong']
    };

    // Tìm biến thể
    for (const [key, values] of Object.entries(provinceMap)) {
        if (key.toLowerCase() === provinceName.toLowerCase() || 
            values.some(v => v.toLowerCase() === provinceName.toLowerCase())) {
            variants.push(...values);
            break;
        }
    }

    return [...new Set(variants)]; // Remove duplicates
};
