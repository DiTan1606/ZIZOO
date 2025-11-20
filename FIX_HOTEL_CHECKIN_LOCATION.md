# 🏨 Fix: Tọa Độ Khách Sạn Trong Activity Check-in

## ❌ Vấn đề

Khi hiển thị bản đồ lộ trình trong MyTrips:
- Activity "Check-in khách sạn" không có tọa độ
- `DailyRouteMap` geocode "Check-in khách sạn" → trả về **trung tâm thành phố** ❌
- Marker khách sạn hiển thị sai vị trí

## ✅ Giải pháp

Sau khi tạo `accommodationPlan` (có tọa độ khách sạn từ Google Maps API), **cập nhật lại `dailyItinerary`** để gắn tọa độ vào activity check-in.

### Code fix - src/services/completeItineraryService.js

```javascript
// Trong createCompleteItinerary()

// 4. LƯU TRÚ (tạo trước để có giá khách sạn)
const accommodationPlan = await generateAccommodationPlan(preferences, dailyItinerary);

// ✨ CẬP NHẬT TỌA ĐỘ KHÁCH SẠN VÀO SCHEDULE
if (accommodationPlan?.selected?.lat && accommodationPlan?.selected?.lng) {
    console.log(`🏨 Updating hotel coordinates in schedule: ${accommodationPlan.selected.name}`);
    
    dailyItinerary.forEach(day => {
        if (day.schedule) {
            day.schedule.forEach(item => {
                // Tìm activity check-in khách sạn
                if (item.type === 'accommodation' || 
                    item.activity?.toLowerCase().includes('check-in') ||
                    item.activity?.toLowerCase().includes('nhận phòng')) {
                    
                    // Gắn tọa độ khách sạn
                    item.location = {
                        name: accommodationPlan.selected.name,
                        address: accommodationPlan.selected.address || accommodationPlan.selected.location,
                        lat: accommodationPlan.selected.lat,
                        lng: accommodationPlan.selected.lng
                    };
                    
                    console.log(`  ✅ Updated check-in activity on Day ${day.day} with hotel coordinates`);
                }
            });
        }
    });
}
```

## 🎯 Cách hoạt động

### Flow cũ (SAI):
```
1. Tạo dailyItinerary
   → Activity "Check-in khách sạn" (không có tọa độ)
   ↓
2. Tạo accommodationPlan
   → Khách sạn có lat, lng từ Google Maps
   ↓
3. Hiển thị bản đồ
   → Geocode "Check-in khách sạn"
   → Trả về trung tâm thành phố ❌
```

### Flow mới (ĐÚNG):
```
1. Tạo dailyItinerary
   → Activity "Check-in khách sạn" (chưa có tọa độ)
   ↓
2. Tạo accommodationPlan
   → Khách sạn có lat, lng từ Google Maps
   ↓
3. ✨ CẬP NHẬT lại dailyItinerary
   → Gắn tọa độ khách sạn vào activity check-in
   ↓
4. Hiển thị bản đồ
   → Dùng tọa độ có sẵn
   → Hiển thị đúng vị trí khách sạn ✅
```

## 📊 Kết quả

### Trước fix:
```javascript
{
  time: "12:30",
  activity: "Check-in khách sạn",
  type: "accommodation",
  // ❌ Không có location
}
```
→ Geocode "Check-in khách sạn" → Trung tâm thành phố

### Sau fix:
```javascript
{
  time: "12:30",
  activity: "Check-in khách sạn",
  type: "accommodation",
  location: {
    name: "Aloha Hotel Vũng Tàu",
    address: "12 La Văn Cầu, Phường Thắng Tam, Vũng Tàu",
    lat: 10.3456,
    lng: 107.0889
  }
}
```
→ D��ng tọa độ có sẵn → Đúng vị trí khách sạn ✅

## 💡 Lợi ích

1. **Vị trí chính xác** - Marker khách sạn hiển thị đúng địa chỉ
2. **Không cần geocode** - Dùng tọa độ có sẵn từ database
3. **Tiết kiệm API calls** - Giảm số lần gọi Geocoding API
4. **Tốc độ nhanh hơn** - Không phải đợi geocode
5. **Tránh lỗi** - Không bị geocode sai về trung tâm

## 🧪 Test

### Cách test:
1. Tạo lịch trình mới
2. Mở MyTrips → Xem chi tiết
3. Kiểm tra bản đồ:
   - ✅ Marker "Check-in khách sạn" ở đúng vị trí khách sạn
   - ✅ Không ở trung tâm thành phố
   - ✅ Có địa chỉ cụ thể

### Console logs:
```
🏨 Updating hotel coordinates in schedule: Aloha Hotel Vũng Tàu
  ✅ Updated check-in activity on Day 1 with hotel coordinates
```

## 📝 Changelog

**2024-11-21:**
- ✅ Gắn tọa độ khách sạn vào activity check-in
- ✅ Cập nhật dailyItinerary sau khi có accommodationPlan
- ✅ Tìm activity theo type='accommodation' hoặc text 'check-in'/'nhận phòng'
- ✅ Thêm console logs để debug
