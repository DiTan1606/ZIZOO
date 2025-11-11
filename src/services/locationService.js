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

        // Fallback: dùng Google Geocoding
        const searchQuery = locationName.includes('Việt Nam') ? locationName : `${locationName}, Việt Nam`;

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
        );

        const data = await response.json();

        if (data.results?.[0]) {
            const { lat, lng } = data.results[0].geometry.location;
            const address = data.results[0].formatted_address;

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