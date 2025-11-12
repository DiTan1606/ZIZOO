// src/services/locationService.js
import provinceCoords from '../assets/provinceCoord.json';

// Map các tên địa danh phổ biến
const vietnamLocationAliases = {
    // Thành phố
    'hồ chí minh': 'Hồ Chí Minh',
    'sài gòn': 'Hồ Chí Minh',
    'sg': 'Hồ Chí Minh',
    'tphcm': 'Hồ Chí Minh',
    'hà nội': 'Hà Nội',
    'hn': 'Hà Nội',
    'đà nẵng': 'Đà Nẵng',
    'dn': 'Đà Nẵng',
    'hải phòng': 'Hải Phòng',
    'hp': 'Hải Phòng',
    'cần thơ': 'Cần Thơ',
    'ct': 'Cần Thơ',

    // Địa điểm du lịch
    'đà lạt': 'Lâm Đồng',
    'vũng tàu': 'Bà Rịa - Vũng Tàu',
    'phú quốc': 'Kiên Giang',
    'hội an': 'Quảng Nam',
    'huế': 'Thừa Thiên Huế',
    'mũi né': 'Bình Thuận',
    'cát bà': 'Hải Phòng',
    'côn đảo': 'Bà Rịa - Vũng Tàu',
    'mai châu': 'Hòa Bình',
    'tam đảo': 'Vĩnh Phúc',
    'ba vì': 'Hà Nội',
    'tràng an': 'Ninh Bình',
    'hạ long': 'Quảng Ninh',
    'cửa lò': 'Nghệ An',
    'sam sơn': 'Thanh Hóa',
    'mộc châu': 'Sơn La',
    'yên tử': 'Quảng Ninh',
    'bà nà': 'Đà Nẵng',

    // Tên tiếng Anh
    'ho chi minh': 'Hồ Chí Minh',
    'hanoi': 'Hà Nội',
    'danang': 'Đà Nẵng',
    'haiphong': 'Hải Phòng',
    'can tho': 'Cần Thơ',
    'da lat': 'Lâm Đồng',
    'vung tau': 'Bà Rịa - Vũng Tàu',
    'nha trang': 'Khánh Hòa',
    'phu quoc': 'Kiên Giang',
    'hoi an': 'Quảng Nam',
    'hue': 'Thừa Thiên Huế',
    'sapa': 'Lào Cai',
    'mui ne': 'Bình Thuận',
    'cat ba': 'Hải Phòng',
    'con dao': 'Bà Rịa - Vũng Tàu',
    'mai chau': 'Hòa Bình',
    'tam dao': 'Vĩnh Phúc',
    'ba vi': 'Hà Nội',
    'trang an': 'Ninh Bình',
    'ha long': 'Quảng Ninh',
    'cua lo': 'Nghệ An',
    'sam son': 'Thanh Hóa',
    'moc chau': 'Sơn La',
    'yen tu': 'Quảng Ninh',
    'ba na': 'Đà Nẵng',
    'lam dong': 'Lâm Đồng'
};

// THÊM MAP typeToPlaces - LOẠI BỎ local_government_office
export const typeToPlaces = {
    'Nghỉ dưỡng biển': ['beach', 'resort', 'spa'],
    'Khám phá văn hóa': ['museum', 'art_gallery', 'church', 'temple', 'historical_landmark'],
    'Du lịch ẩm thực': ['restaurant', 'cafe', 'food'],
    'Phiêu lưu mạo hiểm': ['park', 'hiking_area', 'amusement_park'],
    'Thiền và yoga': ['spa', 'park', 'yoga'],
    'Du lịch gia đình': ['zoo', 'amusement_park', 'park'],
    'Chụp ảnh sống ảo': ['tourist_attraction', 'park', 'art_gallery'],
    'Trải nghiệm bản địa': ['tourist_attraction', 'cultural_center'] // THAY local_government_office bằng cultural_center
};

export const normalizeVietnamLocation = (inputName) => {
    if (!inputName) return null;

    const lowerInput = inputName.toLowerCase().trim();

    // Kiểm tra alias trước
    if (vietnamLocationAliases[lowerInput]) {
        return vietnamLocationAliases[lowerInput];
    }

    // Kiểm tra trực tiếp trong provinceCoords
    const exactMatch = Object.keys(provinceCoords).find(
        province => province.toLowerCase() === lowerInput
    );

    if (exactMatch) return exactMatch;

    // Tìm kiếm gần đúng
    const fuzzyMatch = Object.keys(provinceCoords).find(
        province => province.toLowerCase().includes(lowerInput) ||
            lowerInput.includes(province.toLowerCase())
    );

    return fuzzyMatch || null;
};

// THÊM HÀM getProvinceFromLocation
export const getProvinceFromLocation = (locationName) => {
    if (!locationName) return null;

    const normalized = normalizeVietnamLocation(locationName);
    if (normalized) return normalized;

    // Nếu không tìm thấy trong alias, trả về locationName gốc
    return locationName;
};

export const geocodeVietnamLocation = async (locationName) => {
    try {
        const normalizedName = normalizeVietnamLocation(locationName);

        if (normalizedName && provinceCoords[normalizedName]) {
            return {
                name: locationName,
                province: normalizedName,
                center: provinceCoords[normalizedName],
                address: `${normalizedName}, Việt Nam`,
                placeId: null
            };
        }

        // Fallback: dùng Google Geocoding với giới hạn Việt Nam
        const searchQuery = locationName.includes('Việt Nam') ? locationName : `${locationName}, Việt Nam`;

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&components=country:VN`
        );

        const data = await response.json();

        if (data.results?.[0]) {
            const { lat, lng } = data.results[0].geometry.location;
            const address = data.results[0].formatted_address;

            // KIỂM TRA XEM CÓ PHẢI Ở VIỆT NAM KHÔNG
            const isInVietnam = data.results[0].address_components.some(component =>
                component.types.includes('country') && component.short_name === 'VN'
            );

            if (!isInVietnam) {
                console.warn(`⚠️ Địa điểm ${locationName} không nằm trong Việt Nam`);
                return null;
            }

            // Xác định tỉnh/thành phố
            let province = locationName;
            const addressComponents = data.results[0].address_components;

            const provinceComponent = addressComponents.find(comp =>
                comp.types.includes('administrative_area_level_1')
            );

            const cityComponent = addressComponents.find(comp =>
                comp.types.includes('locality')
            );

            if (provinceComponent) {
                province = provinceComponent.long_name;
            } else if (cityComponent) {
                province = cityComponent.long_name;
            }

            const normalizedProvince = normalizeVietnamLocation(province) || province;

            return {
                name: locationName,
                province: normalizedProvince,
                center: { lat, lng },
                address: address,
                placeId: data.results[0].place_id
            };
        }
    } catch (error) {
        console.warn('Geocoding failed:', error);
    }

    return null;
};

export const getVietnamProvinces = () => {
    return Object.keys(provinceCoords);
};

export const getLocationSuggestions = (input) => {
    if (!input || input.length < 1) return [];

    const allLocations = [
        ...Object.keys(provinceCoords),
        ...Object.keys(vietnamLocationAliases)
    ];

    const uniqueLocations = [...new Set(allLocations)];

    return uniqueLocations
        .filter(location =>
            location.toLowerCase().includes(input.toLowerCase()) ||
            input.toLowerCase().includes(location.toLowerCase())
        )
        .slice(0, 8);
};

// THÊM CÁC HÀM MỚI
export const getRegionalActivities = (province) => {
    const regionalActivities = {
        'Hồ Chí Minh': {
            placeTypes: ['shopping_mall', 'museum', 'restaurant', 'park'],
            activities: ['tham quan đô thị', 'mua sắm', 'ẩm thực đường phố', 'bảo tàng'],
            keywords: ['trung tâm', 'thành phố', 'sài gòn']
        },
        'Hà Nội': {
            placeTypes: ['historical_landmark', 'museum', 'temple', 'restaurant'],
            activities: ['di tích lịch sử', 'ẩm thực', 'phố cổ', 'bảo tàng'],
            keywords: ['lịch sử', 'văn hóa', 'thủ đô']
        },
        'Đà Nẵng': {
            placeTypes: ['beach', 'bridge', 'amusement_park', 'restaurant'],
            activities: ['biển', 'cầu Rồng', 'Bà Nà Hills', 'ẩm thực hải sản'],
            keywords: ['biển', 'cầu rồng', 'bà nà']
        },
        'Quảng Ninh': {
            placeTypes: ['bay', 'island', 'boat_tour', 'seafood_restaurant'],
            activities: ['vịnh Hạ Long', 'đảo', 'du thuyền', 'hải sản'],
            keywords: ['vịnh hạ long', 'đảo', 'du thuyền']
        },
        'Lâm Đồng': {
            placeTypes: ['waterfall', 'garden', 'park', 'cafe'],
            activities: ['Đà Lạt', 'thác nước', 'vườn hoa', 'đồi thông'],
            keywords: ['đà lạt', 'thác', 'vườn hoa']
        },
        'Khánh Hòa': {
            placeTypes: ['beach', 'island', 'spa', 'seafood_restaurant'],
            activities: ['biển Nha Trang', 'đảo', 'suối khoáng', 'hải sản'],
            keywords: ['nha trang', 'biển', 'đảo']
        },
        'Thừa Thiên Huế': {
            placeTypes: ['historical_landmark', 'temple', 'river', 'restaurant'],
            activities: ['di sản', 'ẩm thực cung đình', 'sông Hương', 'lăng tẩm'],
            keywords: ['cố đô', 'di sản', 'lăng tẩm']
        },
        'Quảng Nam': {
            placeTypes: ['historical_landmark', 'ancient_city', 'beach', 'tailor_shop'],
            activities: ['phố cổ Hội An', 'biển', 'di sản', 'làng nghề'],
            keywords: ['hội an', 'phố cổ', 'đèn lồng']
        },
        'Kiên Giang': {
            placeTypes: ['beach', 'island', 'snorkeling_spot', 'seafood_restaurant'],
            activities: ['đảo Phú Quốc', 'biển', 'snorkeling', 'hải sản'],
            keywords: ['phú quốc', 'đảo', 'biển']
        },
        'Bà Rịa - Vũng Tàu': {
            placeTypes: ['beach', 'mountain', 'historical_landmark', 'seafood_restaurant'],
            activities: ['biển', 'núi', 'di tích', 'hải sản'],
            keywords: ['vũng tàu', 'biển', 'núi lớn']
        }
    };

    return regionalActivities[province] || {
        placeTypes: ['tourist_attraction', 'park', 'museum'],
        activities: ['tham quan', 'khám phá văn hóa', 'ẩm thực'],
        keywords: ['du lịch', 'điểm đến']
    };
};

export const getFestivalsByMonth = (month) => {
    const festivalsByMonth = {
        1: ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Quảng Ninh'],
        2: ['Hà Nội', 'Phú Thọ', 'Bắc Ninh', 'Hải Dương'],
        3: ['Bình Định', 'Gia Lai', 'Đắk Lắk', 'Khánh Hòa'],
        4: ['An Giang', 'Sóc Trăng', 'Kiên Giang', 'Cần Thơ'],
        5: ['Ninh Bình', 'Nam Định', 'Hà Nam', 'Thái Bình'],
        6: ['Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình'],
        7: ['Quảng Ninh', 'Hải Phòng', 'Thái Bình', 'Nam Định'],
        8: ['Lào Cai', 'Yên Bái', 'Sơn La', 'Điện Biên'],
        9: ['Thừa Thiên Huế', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định'],
        10: ['Lâm Đồng', 'Đắk Lắk', 'Gia Lai', 'Kon Tum'],
        11: ['Kiên Giang', 'Cà Mau', 'Bạc Liêu', 'Sóc Trăng'],
        12: ['Hồ Chí Minh', 'Đồng Nai', 'Bình Dương', 'Tây Ninh']
    };

    return festivalsByMonth[month] || [];
};

export const getVietnamRegion = (province) => {
    const regions = {
        // Miền Bắc
        'Hà Nội': 'Bắc',
        'Hải Phòng': 'Bắc',
        'Quảng Ninh': 'Bắc',
        'Lào Cai': 'Bắc',
        'Yên Bái': 'Bắc',
        'Thái Nguyên': 'Bắc',
        'Bắc Giang': 'Bắc',
        'Phú Thọ': 'Bắc',
        'Vĩnh Phúc': 'Bắc',
        'Bắc Ninh': 'Bắc',
        'Hải Dương': 'Bắc',
        'Hưng Yên': 'Bắc',
        'Hà Nam': 'Bắc',
        'Nam Định': 'Bắc',
        'Thái Bình': 'Bắc',
        'Ninh Bình': 'Bắc',
        'Hà Giang': 'Bắc',
        'Cao Bằng': 'Bắc',
        'Bắc Kạn': 'Bắc',
        'Tuyên Quang': 'Bắc',
        'Lạng Sơn': 'Bắc',
        'Điện Biên': 'Bắc',
        'Lai Châu': 'Bắc',
        'Sơn La': 'Bắc',
        'Hòa Bình': 'Bắc',

        // Miền Trung
        'Thanh Hóa': 'Trung',
        'Nghệ An': 'Trung',
        'Hà Tĩnh': 'Trung',
        'Quảng Bình': 'Trung',
        'Quảng Trị': 'Trung',
        'Thừa Thiên Huế': 'Trung',
        'Đà Nẵng': 'Trung',
        'Quảng Nam': 'Trung',
        'Quảng Ngãi': 'Trung',
        'Bình Định': 'Trung',
        'Phú Yên': 'Trung',
        'Khánh Hòa': 'Trung',
        'Ninh Thuận': 'Trung',
        'Bình Thuận': 'Trung',

        // Tây Nguyên
        'Kon Tum': 'Tây Nguyên',
        'Gia Lai': 'Tây Nguyên',
        'Đắk Lắk': 'Tây Nguyên',
        'Đắk Nông': 'Tây Nguyên',
        'Lâm Đồng': 'Tây Nguyên',

        // Miền Nam
        'Bình Phước': 'Nam',
        'Bình Dương': 'Nam',
        'Đồng Nai': 'Nam',
        'Tây Ninh': 'Nam',
        'Bà Rịa - Vũng Tàu': 'Nam',
        'Hồ Chí Minh': 'Nam',
        'Long An': 'Nam',
        'Tiền Giang': 'Nam',
        'Bến Tre': 'Nam',
        'Trà Vinh': 'Nam',
        'Vĩnh Long': 'Nam',
        'Đồng Tháp': 'Nam',
        'An Giang': 'Nam',
        'Kiên Giang': 'Nam',
        'Cần Thơ': 'Nam',
        'Hậu Giang': 'Nam',
        'Sóc Trăng': 'Nam',
        'Bạc Liêu': 'Nam',
        'Cà Mau': 'Nam'
    };

    return regions[province] || 'Nam';
};

// THÊM HÀM KIỂM TRA VỊ TRÍ CÓ TRONG VIỆT NAM KHÔNG
export const isLocationInVietnam = (lat, lng) => {
    // Giới hạn địa lý Việt Nam (tọa độ gần đúng)
    const vietnamBounds = {
        north: 23.5,   // Biên giới phía Bắc
        south: 8.5,    // Biên giới phía Nam
        west: 102.0,   // Biên giới phía Tây
        east: 110.0    // Biên giới phía Đông
    };

    return (
        lat >= vietnamBounds.south &&
        lat <= vietnamBounds.north &&
        lng >= vietnamBounds.west &&
        lng <= vietnamBounds.east
    );
};