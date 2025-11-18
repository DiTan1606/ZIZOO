# ⏰ Hạn chế thời gian cho địa điểm văn hóa/lịch sử

## 🎯 Mục đích
Các địa điểm văn hóa/lịch sử (bảo tàng, đền thờ, di tích...) thường chỉ mở cửa trong giờ hành chính. Cần hạn chế xếp lịch các địa điểm này **chỉ trong khung giờ 07:00 - 16:30**.

## 📋 Quy tắc

### Địa điểm văn hóa/lịch sử bao gồm:
- 🏛️ Bảo tàng (Museum)
- ⛩️ Đền, chùa, miếu (Temple, Pagoda, Shrine)
- 🏰 Di tích lịch sử (Historical site, Heritage)
- 🏛️ Cung điện (Palace)
- ⛪ Nhà thờ (Church, Cathedral)
- 🗿 Tượng đài, đài tưởng niệm (Monument, Memorial)
- 🏘️ Phố cổ, thành cổ (Old town, Citadel)
- 🏛️ Lăng mộ (Tomb, Mausoleum)
- 📚 Văn miếu (Confucian temple)

### Khung giờ cho phép:
- ✅ **07:00 - 16:30**: Có thể xếp địa điểm văn hóa/lịch sử
- ❌ **Trước 07:00**: Không xếp (chưa mở cửa)
- ❌ **Sau 16:30**: Không xếp (sắp đóng cửa hoặc đã đóng)

### Địa điểm khác (không bị hạn chế):
- 🏖️ Bãi biển, công viên
- 🍜 Nhà hàng, quán ăn
- ☕ Quán cà phê
- 🛍️ Trung tâm thương mại
- 🌃 Bar, pub, nightlife
- 🏮 Chợ đêm

## 🔧 Implementation

### 1. Helper Function: Kiểm tra địa điểm văn hóa/lịch sử

```javascript
const isCulturalHistoricalSite = (destination) => {
    if (!destination) return false;
    
    const culturalKeywords = [
        'bảo tàng', 'museum', 'đền', 'chùa', 'temple', 'pagoda',
        'di tích', 'heritage', 'lịch sử', 'historical', 'historic',
        'cung điện', 'palace', 'đình', 'miếu', 'shrine',
        'tượng đài', 'monument', 'memorial', 'tưởng niệm',
        'nhà thờ', 'church', 'cathedral', 'nhà cổ', 'ancient house',
        'phố cổ', 'old quarter', 'old town', 'thành cổ', 'citadel',
        'lăng', 'tomb', 'mausoleum', 'văn miếu', 'confucian temple'
    ];
    
    const name = (destination.name || '').toLowerCase();
    const types = destination.types || [];
    const category = (destination.category || '').toLowerCase();
    
    // Check name
    const hasKeywordInName = culturalKeywords.some(keyword => name.includes(keyword));
    
    // Check types from Google Places API
    const culturalTypes = [
        'museum', 'church', 'hindu_temple', 'mosque', 
        'synagogue', 'place_of_worship', 'tourist_attraction'
    ];
    const hasCulturalType = types.some(type => culturalTypes.includes(type));
    
    // Check category
    const hasCulturalCategory = category.includes('museum') || 
                                category.includes('tourist_attraction');
    
    return hasKeywordInName || hasCulturalType || hasCulturalCategory;
};
```

### 2. Helper Function: Kiểm tra thời gian hợp lệ

```javascript
const isValidTimeForCulturalSite = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    const minTime = 7 * 60;      // 07:00
    const maxTime = 16 * 60 + 30; // 16:30
    
    return timeInMinutes >= minTime && timeInMinutes <= maxTime;
};
```

### 3. Logic trong generateEnhancedHourlySchedule

```javascript
// Phân loại địa điểm
const culturalSites = [];
const otherSites = [];

groupedDestinations.forEach(group => {
    if (isCulturalHistoricalSite(group.main)) {
        culturalSites.push(group);
    } else {
        otherSites.push(group);
    }
});

// Sắp xếp: Ưu tiên văn hóa vào buổi sáng/chiều sớm
const reorderedDestinations = [...culturalSites, ...otherSites];

// Thêm vào schedule với kiểm tra thời gian
reorderedDestinations.forEach((group, index) => {
    const mainDest = group.main;
    const isCultural = isCulturalHistoricalSite(mainDest);
    
    // Kiểm tra thời gian cho địa điểm văn hóa
    if (isCultural && !isValidTimeForCulturalSite(currentTime)) {
        console.log(`⏰ Bỏ qua ${mainDest.name} - không phù hợp với thời gian ${currentTime}`);
        return; // Skip địa điểm này
    }
    
    // Thêm note cho địa điểm văn hóa
    if (isCultural) {
        notes.push('⏰ Địa điểm văn hóa/lịch sử - mở cửa 07:00-16:30');
    }
    
    // ... thêm vào schedule
});
```

## 📊 Ví dụ

### Trước (không có hạn chế):
```
18:00 - Tham quan Bảo tàng Hồ Chí Minh ❌ (đã đóng cửa)
19:30 - Tham quan Chùa Một Cột ❌ (đã đóng cửa)
```

### Sau (có hạn chế):
```
08:00 - Tham quan Bảo tàng Hồ Chí Minh ✅
       ⏰ Địa điểm văn hóa/lịch sử - mở cửa 07:00-16:30
       
10:30 - Tham quan Chùa Một Cột ✅
       ⏰ Địa điểm văn hóa/lịch sử - mở cửa 07:00-16:30
       
18:00 - Dạo phố cổ Hà Nội ✅ (không bị hạn chế)
19:30 - Ăn tối tại nhà hàng ✅ (không bị hạn chế)
```

## ✅ Lợi ích

1. ✅ **Thực tế hơn**: Tránh xếp lịch đến bảo tàng lúc 19:00 (đã đóng cửa)
2. ✅ **Tối ưu thời gian**: Ưu tiên địa điểm văn hóa vào buổi sáng/chiều
3. ✅ **Linh hoạt**: Địa điểm khác (bãi biển, nhà hàng...) vẫn có thể đi bất kỳ lúc nào
4. ✅ **Thông tin rõ ràng**: Hiển thị note về giờ mở cửa
5. ✅ **Tự động**: Hệ thống tự động phân loại và sắp xếp

## 🧪 Test Cases

### Test 1: Bảo tàng vào buổi sáng
- Input: Bảo tàng Hồ Chí Minh, thời gian 09:00
- Expected: ✅ Được xếp vào lịch trình

### Test 2: Bảo tàng vào buổi tối
- Input: Bảo tàng Hồ Chí Minh, thời gian 18:00
- Expected: ❌ Bị bỏ qua, log warning

### Test 3: Chùa vào buổi chiều
- Input: Chùa Một Cột, thời gian 15:00
- Expected: ✅ Được xếp vào lịch trình

### Test 4: Chùa vào buổi tối muộn
- Input: Chùa Một Cột, thời gian 17:00
- Expected: ❌ Bị bỏ qua (sau 16:30)

### Test 5: Bãi biển vào buổi tối
- Input: Bãi Sau Vũng Tàu, thời gian 18:00
- Expected: ✅ Được xếp vào lịch trình (không bị hạn chế)

### Test 6: Nhà hàng vào buổi tối
- Input: Nhà hàng hải sản, thời gian 19:00
- Expected: ✅ Được xếp vào lịch trình (không bị hạn chế)

## 📝 Notes

- Hệ thống tự động phát hiện địa điểm văn hóa dựa trên:
  - Tên địa điểm (keywords)
  - Types từ Google Places API
  - Category từ database
  
- Nếu không chắc chắn, hệ thống sẽ không áp dụng hạn chế (better safe than sorry)

- Có thể mở rộng thêm keywords hoặc types nếu cần

- Thời gian 07:00-16:30 là mặc định, có thể điều chỉnh theo từng địa điểm cụ thể nếu có dữ liệu opening hours
