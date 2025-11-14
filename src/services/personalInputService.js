// src/services/personalInputService.js
// Các options cho input
export const TRAVEL_STYLES = [
    { value: 'budget', label: '💰 Tiết kiệm', description: 'Tối ưu chi phí' },
    { value: 'standard', label: '💸 Trung bình', description: 'Cân bằng chi phí và trải nghiệm' },
    { value: 'comfort', label: '🎯 Thoải mái', description: 'Trải nghiệm tốt hơn' },
    { value: 'luxury', label: '⭐ Sang trọng', description: 'Trải nghiệm cao cấp' }
];
export const INTERESTS = [
    { value: 'history', label: '🏛️ Lịch sử', icon: '🏛️' },
    { value: 'nature', label: '🌳 Thiên nhiên', icon: '🌳' },
    { value: 'beach', label: '🏖️ Biển', icon: '🏖️' },
    { value: 'mountain', label: '⛰️ Núi', icon: '⛰️' },
    { value: 'culture', label: '🎎 Văn hóa', icon: '🎎' },
    { value: 'food', label: '🍜 Ẩm thực', icon: '🍜' },
    { value: 'shopping', label: '🛍️ Mua sắm', icon: '🛍️' },
    { value: 'adventure', label: '🧗 Mạo hiểm', icon: '🧗' },
    { value: 'photography', label: '📸 Chụp ảnh', icon: '📸' }, // ADDED
    { value: 'relaxation', label: '💆 Thư giãn', icon: '💆' }
];

export const ACTIVITY_TYPES = [
    { value: 'sightseeing', label: '🏛️ Tham quan', icon: '🏛️' },
    { value: 'adventure', label: '🧗 Mạo hiểm', icon: '🧗' },
    { value: 'relaxation', label: '💆 Thư giãn', icon: '💆' },
    { value: 'shopping', label: '🛍️ Mua sắm', icon: '🛍️' },
    { value: 'food', label: '🍜 Ẩm thực', icon: '🍜' },
    { value: 'culture', label: '🎎 Văn hóa', icon: '🎎' },
    { value: 'nature', label: '🌳 Thiên nhiên', icon: '🌳' },
    { value: 'nightlife', label: '🌃 Đêm', icon: '🌃' },
    { value: 'photography', label: '📸 Chụp ảnh', icon: '📸' } // ADDED
];
export const TRAVEL_GROUPS = [
    { value: 'solo', label: '🚶 Một mình', description: 'Du lịch solo' },
    { value: 'couple', label: '💑 Cặp đôi', description: 'Du lịch với người yêu/vợ chồng' },
    { value: 'family', label: '👨‍👩‍👧‍👦 Gia đình', description: 'Có trẻ em hoặc người lớn tuổi' },
    { value: 'friends', label: '👯 Nhóm bạn', description: 'Đi cùng bạn bè' },
    { value: 'business', label: '💼 Công tác', description: 'Kết hợp công tác và du lịch' }
];

export const AGE_GROUPS = [
    { value: 'student', label: '🎓 18-25 tuổi', description: 'Sinh viên/người trẻ' },
    { value: 'young_adult', label: '💼 26-35 tuổi', description: 'Người trẻ đi làm' },
    { value: 'adult', label: '👨‍💼 36-50 tuổi', description: 'Trung niên' },
    { value: 'senior', label: '👵 Trên 50 tuổi', description: 'Người lớn tuổi' }
];

export const TRAVEL_PACES = [
    { value: 'relaxed', label: '🚶 Thư giãn', description: 'Ít điểm, nhiều thời gian nghỉ' },
    { value: 'balanced', label: '🚶‍♀️ Cân bằng', description: 'Kết hợp tham quan và nghỉ ngơi' },
    { value: 'active', label: '🏃 Năng động', description: 'Nhiều điểm, khám phá tích cực' },
    { value: 'adventure', label: '🧗 Mạo hiểm', description: 'Nhiều hoạt động thể chất' }
];

export const ACCOMMODATION_TYPES = [
    { value: 'hotel', label: '🏨 Khách sạn', description: 'Khách sạn tiêu chuẩn' },
    { value: 'resort', label: '🌴 Resort', description: 'Khu nghỉ dưỡng' },
    { value: 'homestay', label: '🏡 Homestay', description: 'Nhà dân, trải nghiệm địa phương' },
    { value: 'villa', label: '🏠 Villa', description: 'Biệt thự riêng tư' },
    { value: 'hostel', label: '🛌 Hostel', description: 'Nhà nghỉ giá rẻ' }
];

export const TRANSPORTATION_OPTIONS = [
    { value: 'motorbike', label: '🏍️ Xe máy', description: 'Tự lái xe máy' },
    { value: 'car', label: '🚗 Ô tô', description: 'Tự lái hoặc thuê xe' },
    { value: 'taxi', label: '🚕 Taxi/Grab', description: 'Di chuyển bằng taxi' },
    { value: 'bus', label: '🚌 Xe bus', description: 'Phương tiện công cộng' },
    { value: 'bicycle', label: '🚴 Xe đạp', description: 'Khám phá bằng xe đạp' },
    { value: 'walking', label: '🚶 Đi bộ', description: 'Đi bộ là chính' }
];


export const DIET_PREFERENCES = [
    { value: 'normal', label: '🍜 Bình thường', description: 'Không yêu cầu đặc biệt' },
    { value: 'vegetarian', label: '🥗 Ăn chay', description: 'Chỉ ăn thực vật' },
    { value: 'seafood', label: '🦞 Hải sản', description: 'Ưu tiên hải sản' },
    { value: 'local', label: '🍲 Địa phương', description: 'Trải nghiệm ẩm thực địa phương' },
    { value: 'international', label: '🌍 Quốc tế', description: 'Ẩm thực đa dạng' }
];



// Hàm validate input
export const validatePersonalInput = (prefs, currentUser) => {
    const errors = [];

    if (!currentUser) {
        errors.push('🔐 Vui lòng đăng nhập để tạo lịch trình!');
    }

    if (!prefs.departureDate) {
        errors.push('📅 Vui lòng chọn ngày khởi hành!');
    }

    if (!prefs.duration || prefs.duration < 1) {
        errors.push('⏱️ Vui lòng nhập số ngày du lịch (ít nhất 1 ngày)!');
    }

    if (!prefs.departureLocation) {
        errors.push('📍 Vui lòng chọn địa điểm xuất phát!');
    }

    if (!prefs.destination) {
        errors.push('🎯 Vui lòng chọn điểm đến!');
    }

    if (!prefs.travelers || prefs.travelers < 1) {
        errors.push('👥 Vui lòng nhập số người (ít nhất 1 người)!');
    }

    if (!prefs.budget || prefs.budget < 500000) {
        errors.push('💰 Ngân sách tối thiểu là 500,000 VNĐ!');
    }

    if (!prefs.travelStyle) {
        errors.push('💼 Vui lòng chọn phong cách du lịch!');
    }

    if (!prefs.travelGroup) {
        errors.push('👨‍👩‍👧‍👦 Vui lòng chọn nhóm du lịch!');
    }

    return errors;
};

// Hàm tính toán thông tin dự kiến
export const calculatePersonalSummary = (prefs) => {
    const { departureDate, duration, travelers, budget, travelStyle } = prefs;

    // Tính toán ngày về
    const endDate = new Date(departureDate);
    endDate.setDate(endDate.getDate() + duration - 1);

    // Tính toán chi phí theo phong cách
    const styleMultipliers = {
        'budget': 0.8,
        'standard': 1.0,
        'comfort': 1.3,
        'luxury': 2.0
    };

    const multiplier = styleMultipliers[travelStyle] || 1.0;
    const adjustedBudget = budget * multiplier;

    return {
        startDate: new Date(departureDate).toLocaleDateString('vi-VN'),
        endDate: endDate.toLocaleDateString('vi-VN'),
        totalDays: duration,
        totalTravelers: travelers,
        totalBudget: new Intl.NumberFormat('vi-VN').format(budget),
        adjustedBudget: new Intl.NumberFormat('vi-VN').format(Math.round(adjustedBudget)),
        budgetPerDay: new Intl.NumberFormat('vi-VN').format(Math.round(adjustedBudget / duration)),
        budgetPerPerson: new Intl.NumberFormat('vi-VN').format(Math.round(adjustedBudget / travelers)),
        budgetPerPersonPerDay: new Intl.NumberFormat('vi-VN').format(Math.round(adjustedBudget / travelers / duration))
    };
};

// Hàm đề xuất tự động
export const generateSmartSuggestions = (prefs) => {
    const suggestions = [];
    const { travelGroup, ageGroup, interests, travelStyle } = prefs;

    // Đề xuất dựa trên nhóm
    if (travelGroup === 'family') {
        suggestions.push(
            '🏞️ Công viên giải trí gia đình',
            '👶 Địa điểm thân thiện với trẻ em',
            '🛌 Khách sạn có phòng gia đình'
        );
    }

    if (travelGroup === 'couple') {
        suggestions.push(
            '💖 Địa điểm lãng mạn',
            '🍷 Nhà hàng view đẹp',
            '🏨 Resort sang trọng'
        );
    }

    if (travelGroup === 'solo') {
        suggestions.push(
            '🚶 Địa điểm dễ di chuyển một mình',
            '☕ Quán cafe đẹp',
            '🏨 Hostel để kết bạn'
        );
    }

    // Đề xuất dựa trên độ tuổi
    if (ageGroup === 'senior') {
        suggestions.push(
            '🚶 Địa điểm ít di chuyển',
            '🏛️ Di tích lịch sử',
            '💆 Spa thư giãn'
        );
    }

    if (ageGroup === 'student') {
        suggestions.push(
            '💰 Địa điểm giá rẻ',
            '🎉 Khu vui chơi về đêm',
            '📸 Điểm check-in sống ảo'
        );
    }

    // Đề xuất dựa trên interests
    if (interests?.includes('food')) {
        suggestions.push(
            '🍜 Tour ẩm thực đường phố',
            '🛵 Chợ đêm địa phương',
            '👨‍🍳 Lớp học nấu ăn'
        );
    }

    if (interests?.includes('adventure')) {
        suggestions.push(
            '🧗 Trekking leo núi',
            '🚣 Chèo thuyền kayak',
            '🪂 Hoạt động thể thao mạo hiểm'
        );
    }

    return suggestions.slice(0, 5);
};

// Hàm xử lý thêm/xóa địa điểm
export const handleLocationUpdate = async (action, locationInput, currentLocations) => {
    if (action === 'add' && !locationInput.trim()) {
        throw new Error('📍 Vui lòng nhập địa điểm!');
    }

    // Giả lập geocoding
    const mockGeocoding = {
        'Hà Nội': { name: 'Hà Nội', province: 'Hà Nội', center: { lat: 21.0278, lng: 105.8342 } },
        'Đà Nẵng': { name: 'Đà Nẵng', province: 'Đà Nẵng', center: { lat: 16.0544, lng: 108.2022 } },
        'TP. Hồ Chí Minh': { name: 'TP. Hồ Chí Minh', province: 'TP. Hồ Chí Minh', center: { lat: 10.8231, lng: 106.6297 } }
    };

    const locationData = mockGeocoding[locationInput];

    if (!locationData) {
        throw new Error('❌ Không tìm thấy địa điểm này!');
    }

    if (action === 'add') {
        if (currentLocations.some(loc => loc.province === locationData.province)) {
            throw new Error(`📍 ${locationData.province} đã được thêm!`);
        }

        return {
            locations: [...currentLocations, locationData],
            message: `✅ Đã thêm "${locationData.name}" vào lịch trình`
        };
    }

    return {
        locations: currentLocations.filter((_, i) => i !== action.index),
        message: '🗑️ Đã xóa địa điểm khỏi lịch trình'
    };
};