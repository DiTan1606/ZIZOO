// src/constants/index.js
// Tập trung tất cả constants để tránh trùng lặp

// Travel Styles
export const TRAVEL_STYLES = {
    budget: { name: 'Tiết kiệm', multiplier: 0.7 },
    standard: { name: 'Trung bình', multiplier: 1.0 },
    comfort: { name: 'Thoải mái', multiplier: 1.4 },
    luxury: { name: 'Sang trọng', multiplier: 2.2 }
};

// Accommodation Types - Điều chỉnh giá hợp lý hơn
export const ACCOMMODATION_TYPES = {
    budget: { type: 'Nhà nghỉ/Hostel', pricePerNight: 150000 },
    standard: { type: 'Khách sạn 3 sao', pricePerNight: 300000 },
    comfort: { type: 'Khách sạn 4 sao', pricePerNight: 600000 },
    luxury: { type: 'Resort 5 sao', pricePerNight: 1500000 }
};

// Transport Options
export const TRANSPORT_OPTIONS = {
    local: {
        budget: { type: 'Xe buýt/Xe ôm', costPerDay: 50000 },
        standard: { type: 'Grab/Taxi', costPerDay: 150000 },
        comfort: { type: 'Thuê xe máy', costPerDay: 200000 },
        luxury: { type: 'Thuê xe riêng + tài xế', costPerDay: 800000 }
    },
    intercity: {
        budget: { type: 'Xe khách', cost: 200000 },
        standard: { type: 'Tàu hỏa/Xe limousine', cost: 400000 },
        comfort: { type: 'Máy bay', cost: 1200000 },
        luxury: { type: 'Máy bay hạng thương gia', cost: 3000000 }
    }
};

// Travel Groups
export const TRAVEL_GROUPS = [
    { value: 'solo', label: '🚶 Một mình', icon: '🚶' },
    { value: 'couple', label: '💑 Cặp đôi', icon: '💑' },
    { value: 'family', label: '👨‍👩‍👧‍👦 Gia đình', icon: '👨‍👩‍👧‍👦' },
    { value: 'friends', label: '👥 Bạn bè', icon: '👥' },
    { value: 'business', label: '💼 Công tác', icon: '💼' }
];

// Interests
export const INTERESTS = [
    { value: 'photography', label: 'Chụp ảnh', icon: '📸' },
    { value: 'food', label: 'Ẩm thực', icon: '🍜' },
    { value: 'culture', label: 'Văn hóa', icon: '🏛️' },
    { value: 'nature', label: 'Thiên nhiên', icon: '🌿' },
    { value: 'adventure', label: 'Mạo hiểm', icon: '🏔️' },
    { value: 'relaxation', label: 'Thư giãn', icon: '🏖️' },
    { value: 'shopping', label: 'Mua sắm', icon: '🛍️' },
    { value: 'nightlife', label: 'Cuộc sống đêm', icon: '🌃' },
    { value: 'history', label: 'Lịch sử', icon: '🏺' },
    { value: 'art', label: 'Nghệ thuật', icon: '🎨' }
];

// Vietnam Cities
export const VIETNAM_CITIES = [
    'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
    'Nha Trang', 'Đà Lạt', 'Phú Quốc', 'Hội An', 'Huế', 'Sapa',
    'Vũng Tàu', 'Quảng Ninh', 'Ninh Bình', 'Quy Nhon', 'Phan Thiết',
    'Cà Mau', 'Hạ Long', 'Mũi Né', 'Tam Cốc', 'Bắc Hà', 'Mộc Châu'
];

// Trip Types
export const TRIP_TYPES = [
    'Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực', 'Gia đình', 'Một mình'
];

// Photography Keywords
export const PHOTOGRAPHY_KEYWORDS = {
    vietnamese: [
        'cảnh đẹp', 'view đẹp', 'chụp ảnh', 'sống ảo', 'checkin', 'landmark',
        'hoàng hôn', 'bình minh', 'view thành phố', 'panorama', 'vista',
        'thác nước', 'hồ', 'núi', 'biển', 'đồi', 'cánh đồng', 'ruộng bậc thang',
        'kiến trúc', 'cổ kính', 'truyền thống', 'di sản', 'di tích',
        'cầu', 'chùa', 'nhà thờ', 'đền', 'miếu', 'lăng',
        'phố cổ', 'con đường', 'ngõ hẹp', 'bức tường', 'graffiti',
        'vườn hoa', 'công viên', 'khu bảo tồn', 'thiên nhiên'
    ],
    english: [
        'viewpoint', 'scenic', 'landscape', 'photography', 'photo spot', 'instagram',
        'sunset', 'sunrise', 'city view', 'panoramic', 'vista point',
        'waterfall', 'lake', 'mountain', 'beach', 'hill', 'rice terrace',
        'architecture', 'ancient', 'traditional', 'heritage', 'historical',
        'bridge', 'temple', 'pagoda', 'church', 'cathedral', 'shrine',
        'old quarter', 'alley', 'street art', 'mural', 'graffiti',
        'garden', 'park', 'nature reserve', 'natural'
    ]
};

// Location Aliases
export const LOCATION_ALIASES = {
    'lam dong': 'Lâm Đồng',
    'ho chi minh': 'Hồ Chí Minh',
    'hanoi': 'Hà Nội',
    'danang': 'Đà Nẵng',
    'da lat': 'Lâm Đồng',
    'phu quoc': 'Kiên Giang',
    'ho chi minh city': 'Hồ Chí Minh',
    'tphcm': 'Hồ Chí Minh',
    'vung tau': 'Bà Rịa - Vũng Tàu',
    'nha trang': 'Khánh Hòa',
    'da nang': 'Đà Nẵng',
    'hue': 'Thừa Thiên Huế',
    'hoi an': 'Quảng Nam',
    'sapa': 'Lào Cai',
    'halong': 'Quảng Ninh',
    'ha long': 'Quảng Ninh',
    'quang ninh': 'Quảng Ninh',
    'can tho': 'Cần Thơ',
    'cantho': 'Cần Thơ',
    'buon ma thuot': 'Đắk Lắk',
    'buôn ma thuột': 'Đắk Lắk',
    'vinh': 'Nghệ An',
    'thanh hoa': 'Thanh Hóa',
    'quang binh': 'Quảng Bình',
    'quang tri': 'Quảng Trị',
    'thua thien hue': 'Thừa Thiên Huế'
};

// Scenic Spot Types - Các loại địa điểm tham quan cảnh đẹp
export const SCENIC_SPOT_TYPES = [
    'tourist_attraction',
    'natural_feature',
    'park',
    'point_of_interest',
    'scenic_viewpoint',
    'mountain',
    'beach',
    'waterfall',
    'lake',
    'hiking_area',
    'historical_landmark',
    'cultural_landmark',
    'monument',
    'museum',
    'art_gallery',
    'temple',
    'church',
    'pagoda',
    'shrine',
    'garden',
    'botanical_garden',
    'zoo',
    'aquarium',
    'amusement_park',
    'theme_park'
];

// Type to Places Mapping
export const TYPE_TO_PLACES = {
    'Nghỉ dưỡng': ['tourist_attraction', 'beach', 'spa'],
    'Mạo hiểm': ['park', 'hiking_area'],
    'Văn hóa': ['museum', 'historical_landmark'],
    'Ẩm thực': ['restaurant'],
    'Gia đình': ['amusement_park', 'zoo'],
    'Một mình': ['cafe', 'library']
};

// Cache Duration
export const CACHE_DURATION = {
    PLACES: 60 * 60 * 1000, // 1 hour
    WEATHER: 10 * 60 * 1000, // 10 minutes
    TRAFFIC: 5 * 60 * 1000, // 5 minutes
    EVENTS: 60 * 60 * 1000, // 1 hour
    PRICING: 60 * 60 * 1000 // 1 hour
};

// API Endpoints
export const API_ENDPOINTS = {
    GOOGLE_PLACES: 'https://maps.googleapis.com/maps/api/place',
    OPENWEATHER: 'https://api.openweathermap.org/data/2.5',
    GOOGLE_DIRECTIONS: 'https://maps.googleapis.com/maps/api/directions'
};

// Default Values
export const DEFAULTS = {
    DURATION: 3,
    TRAVELERS: 2,
    BUDGET: 5000000,
    TRAVEL_STYLE: 'standard',
    RADIUS: 30000, // 30km
    MAX_DESTINATIONS: 10
};

// Meal Costs by Travel Style
export const MEAL_COSTS = {
    budget: {
        breakfast: { min: 20000, avg: 30000, max: 40000 },
        lunch: { min: 30000, avg: 50000, max: 70000 },
        dinner: { min: 40000, avg: 60000, max: 80000 },
        streetFood: { min: 15000, avg: 25000, max: 35000 },
        cafe: { min: 20000, avg: 30000, max: 40000 }
    },
    standard: {
        breakfast: { min: 40000, avg: 60000, max: 80000 },
        lunch: { min: 60000, avg: 100000, max: 150000 },
        dinner: { min: 100000, avg: 150000, max: 200000 },
        streetFood: { min: 25000, avg: 40000, max: 60000 },
        cafe: { min: 30000, avg: 50000, max: 70000 }
    },
    comfort: {
        breakfast: { min: 80000, avg: 120000, max: 180000 },
        lunch: { min: 150000, avg: 250000, max: 400000 },
        dinner: { min: 250000, avg: 400000, max: 600000 },
        streetFood: { min: 40000, avg: 60000, max: 80000 },
        cafe: { min: 50000, avg: 80000, max: 120000 }
    },
    luxury: {
        breakfast: { min: 200000, avg: 350000, max: 500000 },
        lunch: { min: 400000, avg: 700000, max: 1000000 },
        dinner: { min: 800000, avg: 1200000, max: 2000000 },
        streetFood: { min: 60000, avg: 100000, max: 150000 },
        cafe: { min: 100000, avg: 150000, max: 250000 }
    }
};
