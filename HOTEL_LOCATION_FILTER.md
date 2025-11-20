# 🏨 Lọc Khách Sạn Gần Trung Tâm Thành Phố

## ✅ Đã hoàn thành

### Vấn đề cũ:
- Tìm khách sạn trong bán kính 10km → quá rộng
- Gợi ý khách sạn xa xôi, không tiện đi lại
- Không ưu tiên khách sạn gần trung tâm

### Giải pháp:

1. **Giảm radius tìm kiếm**: 10km → **5km**
2. **Thêm keyword "downtown" và "city center"** vào query
3. **Tính khoảng cách** từ khách sạn đến trung tâm
4. **Lọc khách sạn quá xa**: > 3km từ trung tâm
5. **Ưu tiên khách sạn gần** trong sort logic

## 🎯 Logic mới

### 1. Tìm kiếm khách sạn

```javascript
const hotels = await searchPlacesByText(
    `hotels in downtown ${destination} city center`, // ✅ Thêm "downtown" và "city center"
    coord,
    5000, // ✅ 5km radius (giảm từ 10km)
    destination
);
```

### 2. Tính khoảng cách đến trung tâm

```javascript
const distanceFromCenter = calculateDistanceBetweenPoints(
    coord.lat,      // Tọa độ trung tâm thành phố
    coord.lng,
    hotelLat,       // Tọa độ khách sạn
    hotelLng
);
```

### 3. Lọc khách sạn quá xa

```javascript
.filter(hotel => {
    // Lọc theo budget
    if (hotel.pricePerNight > budgetPerNight * travelers * 1.5) return false;
    
    // ✅ Lọc khách sạn quá xa (> 3km từ trung tâm)
    if (hotel.distanceFromCenter > 3) {
        console.log(`⚠️ ${hotel.name} too far: ${hotel.distanceFromCenter.toFixed(1)}km`);
        return false;
    }
    
    return true;
})
```

### 4. Sort ưu tiên khách sạn gần

```javascript
.sort((a, b) => {
    // 1. Ưu tiên price_level phù hợp với budget
    const aDiff = Math.abs((a.priceLevel || 2) - targetPriceLevel);
    const bDiff = Math.abs((b.priceLevel || 2) - targetPriceLevel);
    if (aDiff !== bDiff) return aDiff - bDiff;
    
    // 2. ✅ Ưu tiên khách sạn gần trung tâm hơn
    const distanceDiff = a.distanceFromCenter - b.distanceFromCenter;
    if (Math.abs(distanceDiff) > 0.5) return distanceDiff; // Chênh lệch > 0.5km
    
    // 3. Sau đó sort theo rating
    return b.rating - a.rating;
})
```

## 📊 Kết quả

### Trước:
```
Tìm kiếm: "hotels in Vũng Tàu"
Radius: 10km
Kết quả:
- Hotel A (trung tâm) - 0.5km ✅
- Hotel B (xa) - 8km ❌
- Hotel C (xa) - 12km ❌
```

### Sau:
```
Tìm kiếm: "hotels in downtown Vũng Tàu city center"
Radius: 5km
Lọc: < 3km từ trung tâm
Kết quả:
- Hotel A (trung tâm) - 0.5km ✅
- Hotel D (gần trung tâm) - 1.2km ✅
- Hotel E (gần trung tâm) - 2.1km ✅
```

## 💡 Lợi ích

1. **Tiện đi lại** - Khách sạn gần trung tâm, dễ di chuyển
2. **Tiết kiệm thời gian** - Không mất thời gian đi xa
3. **Gần địa điểm tham quan** - Dễ khám phá thành phố
4. **Phù hợp du lịch** - Khách sạn ở khu vực sầm uất
5. **Tối ưu trải nghiệm** - User hài lòng hơn

## 🧪 Test

### Console logs:
```
🏨 Finding real hotels in Vũng Tàu...
📍 Searching hotels within 5km of city center (10.3456, 107.0842)
💰 Budget per night per person: 262,500 VNĐ
🎯 Target price level: 1 (based on budget 262,500 VNĐ/night/person)
  ⚠️ Hotel X too far from center: 4.2km
  ⚠️ Hotel Y too far from center: 5.8km
✅ Found 3 hotels in Vũng Tàu
  - Aloha Hotel: 640,000 VNĐ/đêm (price_level: 2, distance: 0.8km)
  - Fusion Suites: 590,000 VNĐ/đêm (price_level: 2, distance: 1.2km)
  - Hôtel D'Melin: 630,000 VNĐ/đêm (price_level: 2, distance: 1.5km)
```

## 🔧 Hàm helper

### calculateDistanceBetweenPoints()

```javascript
const calculateDistanceBetweenPoints = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 999;
    
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};
```

## 📝 Changelog

**2024-11-21:**
- ✅ Giảm radius tìm kiếm: 10km → 5km
- ✅ Thêm keyword "downtown" và "city center"
- ✅ Tính khoảng cách từ khách sạn đến trung tâm
- ✅ Lọc khách sạn > 3km từ trung tâm
- ✅ Ưu tiên khách sạn gần trong sort logic
- ✅ Thêm hàm `calculateDistanceBetweenPoints()`
- ✅ Log khoảng cách để debug
