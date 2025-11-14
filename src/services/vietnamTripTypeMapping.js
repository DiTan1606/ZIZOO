// src/services/vietnamTripTypeMapping.js
export const VIETNAM_TRIP_TYPE_MAPPING = {
    // Miền Bắc
    'Du lịch văn hóa lịch sử': ['museum', 'art_gallery', 'hindu_temple', 'church', 'tourist_attraction', 'point_of_interest'],
    'Du lịch đô thị hiện đại': ['shopping_mall', 'cafe', 'restaurant', 'bar', 'night_club'],
    'Du lịch ẩm thực': ['restaurant', 'cafe', 'food', 'bakery', 'meal_takeaway'],
    'Du lịch tâm linh': ['hindu_temple', 'church', 'mosque', 'synagogue', 'place_of_worship'],
    'Du lịch biển': ['beach', 'marina', 'aquarium', 'natural_feature'],
    'Du lịch sinh thái đảo': ['park', 'campground', 'natural_feature', 'tourist_attraction'],
    'Du lịch biển đảo': ['beach', 'park', 'tourist_attraction', 'natural_feature'],
    'Du lịch mạo hiểm': ['park', 'campground', 'hiking_area', 'amusement_park', 'natural_feature'],
    'Du lịch nghỉ dưỡng': ['spa', 'beauty_salon', 'health_spa', 'resort', 'lodging'],
    'Du lịch làng nghề': ['art_gallery', 'museum', 'point_of_interest', 'tourist_attraction'],
    'Du lịch âm nhạc dân gian': ['museum', 'art_gallery', 'performing_arts_theater'],
    'Du lịch sinh thái sông nước': ['park', 'marina', 'natural_feature', 'tourist_attraction'],
    'Du lịch nghỉ dưỡng núi': ['park', 'campground', 'lodging', 'natural_feature'],
    'Du lịch nông nghiệp': ['farm', 'park', 'point_of_interest', 'tourist_attraction'],
    'Du lịch văn hóa dân tộc': ['museum', 'art_gallery', 'tourist_attraction', 'point_of_interest'],
    'Du lịch sinh thái núi': ['park', 'campground', 'hiking_area', 'natural_feature'],

    // Miền Trung
    'Du lịch biển & nghỉ dưỡng': ['beach', 'resort', 'spa', 'lodging', 'natural_feature'],
    'Du lịch sinh thái núi rừng': ['park', 'campground', 'hiking_area', 'natural_feature'],
    'Du lịch hang động & mạo hiểm': ['natural_feature', 'park', 'hiking_area', 'tourist_attraction'],
    'Du lịch lịch sử chiến tranh': ['museum', 'point_of_interest', 'tourist_attraction'],
    'Du lịch văn hóa di sản': ['museum', 'art_gallery', 'tourist_attraction', 'point_of_interest'],
    'Du lịch sông nước & ẩm thực': ['restaurant', 'food', 'point_of_interest', 'tourist_attraction'],
    'Du lịch mạo hiểm & giải trí': ['amusement_park', 'park', 'hiking_area', 'tourist_attraction'],
    'Du lịch lịch sử văn hóa': ['museum', 'art_gallery', 'tourist_attraction', 'point_of_interest'],
    'Du lịch võ thuật & lịch sử': ['museum', 'point_of_interest', 'tourist_attraction'],
    'Du lịch văn hóa Chăm': ['museum', 'art_gallery', 'place_of_worship', 'tourist_attraction'],
    'Du lịch biển & phim trường': ['beach', 'tourist_attraction', 'point_of_interest'],
    'Du lịch sinh thái kỳ quan': ['natural_feature', 'park', 'tourist_attraction'],
    'Du lịch biển đảo nghỉ dưỡng': ['beach', 'resort', 'lodging', 'natural_feature'],
    'Du lịch mạo hiểm lặn biển': ['natural_feature', 'tourist_attraction', 'point_of_interest'],
    'Du lịch sa mạc & biển': ['natural_feature', 'beach', 'tourist_attraction'],
    'Du lịch nghỉ dưỡng resort': ['resort', 'spa', 'lodging', 'beach'],

    // Miền Nam & Tây Nguyên
    'Du lịch sinh thái miệt vườn': ['park', 'garden', 'campground', 'farm'],
    'Làng quê cổ': ['museum', 'point_of_interest', 'tourist_attraction'],
    'Ẩm thực sông nước': ['restaurant', 'food', 'point_of_interest'],
    'Du lịch sông nước & chợ nổi': ['point_of_interest', 'tourist_attraction', 'market'],
    'Văn hóa Nam Bộ': ['museum', 'art_gallery', 'tourist_attraction'],
    'Trải nghiệm nông thôn': ['farm', 'park', 'point_of_interest'],
    'Du lịch miệt vườn & sông nước': ['park', 'garden', 'tourist_attraction'],
    'Văn hóa dân dã': ['museum', 'art_gallery', 'tourist_attraction'],
    'Chợ nổi & văn hóa': ['point_of_interest', 'market', 'tourist_attraction'],
    'Ẩm thực trái cây': ['restaurant', 'food', 'market'],
    'Du lịch văn hóa Khmer': ['museum', 'place_of_worship', 'tourist_attraction'],
    'Chùa chiền & lễ hội': ['place_of_worship', 'tourist_attraction'],
    'Ẩm thực dân tộc': ['restaurant', 'food', 'point_of_interest'],
    'Du lịch văn hóa & lịch sử': ['museum', 'art_gallery', 'tourist_attraction'],
    'Cánh đồng muối & điện gió': ['point_of_interest', 'tourist_attraction'],
    'Du lịch sinh thái rừng ngập mặn': ['park', 'natural_feature', 'tourist_attraction'],
    'Mũi đất cực Nam': ['point_of_interest', 'tourist_attraction'],
    'Ẩm thực hải sản': ['restaurant', 'food', 'point_of_interest'],
    'Du lịch biển đảo & sinh thái': ['beach', 'park', 'natural_feature'],
    'Núi non & hang động': ['park', 'natural_feature', 'tourist_attraction'],
    'Du lịch núi non & văn hóa': ['park', 'museum', 'tourist_attraction'],
    'Miếu Bà & chợ biên giới': ['place_of_worship', 'point_of_interest', 'market'],
    'Du lịch sinh thái hoa sen & chim': ['park', 'garden', 'tourist_attraction'],

    // Tây Nguyên & Đông Nam Bộ
    'Đô thị': ['shopping_mall', 'cafe', 'restaurant', 'point_of_interest'],
    'Lịch sử': ['museum', 'point_of_interest', 'tourist_attraction'],
    'Mua sắm': ['shopping_mall', 'market', 'point_of_interest'],
    'Công nghiệp': ['point_of_interest', 'tourist_attraction'],
    'Làng nghề': ['art_gallery', 'museum', 'point_of_interest'],
    'Sinh thái': ['park', 'natural_feature', 'tourist_attraction'],
    'Vui chơi': ['amusement_park', 'park', 'tourist_attraction'],
    'Công viên': ['park', 'amusement_park', 'tourist_attraction'],
    'Biển': ['beach', 'natural_feature', 'tourist_attraction'],
    'Nghỉ dưỡng': ['resort', 'spa', 'lodging'],
    'Đảo': ['natural_feature', 'tourist_attraction', 'beach'],
    'Hoang sơ': ['park', 'natural_feature', 'tourist_attraction'],
    'Trekking': ['park', 'hiking_area', 'natural_feature'],
    'Rừng': ['park', 'natural_feature', 'tourist_attraction'],
    'Tâm linh': ['place_of_worship', 'tourist_attraction'],
    'Núi': ['natural_feature', 'park', 'tourist_attraction'],
    'Biên giới': ['point_of_interest', 'tourist_attraction'],
    'Văn hóa dân tộc': ['museum', 'art_gallery', 'tourist_attraction'],
    'Thiên nhiên': ['park', 'natural_feature', 'tourist_attraction'],
    'Hồ': ['natural_feature', 'park', 'tourist_attraction'],
    'Cà phê': ['cafe', 'point_of_interest', 'tourist_attraction'],
    'Voi': ['zoo', 'tourist_attraction', 'point_of_interest'],
    'Thác nước': ['natural_feature', 'park', 'tourist_attraction'],
    'Thác': ['natural_feature', 'park', 'tourist_attraction'],
    'Hang động': ['natural_feature', 'tourist_attraction'],
    'Hoa': ['garden', 'park', 'tourist_attraction']
};

// Hàm lấy tất cả Google Types từ loại hình
export const getAllGoogleTypesFromTripTypes = (tripTypes) => {
    const allTypes = new Set();

    tripTypes.forEach(tripType => {
        const googleTypes = VIETNAM_TRIP_TYPE_MAPPING[tripType] || ['tourist_attraction'];
        googleTypes.forEach(type => allTypes.add(type));
    });

    return Array.from(allTypes);
};

// Hàm đề xuất loại hình bổ sung dựa trên tỉnh
export const suggestAdditionalTripTypes = (province, selectedTypes) => {
    const provinceSuggestions = {
        'Hà Nội': ['Du lịch ẩm thực', 'Du lịch văn hóa lịch sử', 'Du lịch đô thị hiện đại'],
        'Đà Nẵng': ['Du lịch biển & nghỉ dưỡng', 'Du lịch mạo hiểm & giải trí'],
        'TP. Hồ Chí Minh': ['Đô thị', 'Mua sắm', 'Ẩm thực'],
        'Quảng Bình': ['Du lịch hang động & mạo hiểm', 'Du lịch sinh thái'],
        'Lâm Đồng': ['Nghỉ dưỡng', 'Hoa', 'Thiên nhiên'],
        'Khánh Hòa': ['Du lịch biển đảo nghỉ dưỡng', 'Du lịch mạo hiểm lặn biển'],
        'Quảng Ninh': ['Du lịch biển đảo', 'Du lịch nghỉ dưỡng'],
        'Thừa Thiên Huế': ['Du lịch văn hóa di sản', 'Du lịch ẩm thực'],
        'Ninh Bình': ['Du lịch văn hóa di sản', 'Du lịch sinh thái sông nước']
    };

    return provinceSuggestions[province] || ['Du lịch văn hóa lịch sử', 'Du lịch ẩm thực'];
};