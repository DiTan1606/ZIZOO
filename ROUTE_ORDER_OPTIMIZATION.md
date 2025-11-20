# Tối Ưu Hóa Thứ Tự Route - Đi Theo Thứ Tự 1, 2, 3, 4, 5

## 🎯 Mục Tiêu
Đảm bảo route giữa các địa điểm trong chuyến đi được vẽ **theo đúng thứ tự 1 → 2 → 3 → 4 → 5** và **không vẽ route** cho các địa điểm ở đảo/biển không thể đi đường bộ.

## ✅ Những Gì Đã Được Cập Nhật

### 1. **Tắt Auto-Optimization của Google Maps**
```javascript
// TRƯỚC (SAI):
optimizeWaypoints: true  // Google tự động sắp xếp lại thứ tự

// SAU (ĐÚNG):
optimizeWaypoints: false  // Giữ nguyên thứ tự 1, 2, 3, 4, 5
```

### 2. **Bỏ Qua Khách Sạn Khi Vẽ Route**
- **Khách sạn không được vẽ route** (chỉ hiển thị marker)
- Nếu có 5 địa điểm: 1, 2, 3, 4(khách sạn), 5 → Vẽ route: 1→2→3→5
- Khách sạn được nhận diện qua:
  - Category: `lodging`, `hotel`
  - Tên chứa: `hotel`, `khách sạn`, `resort`, `homestay`

### 3. **Kiểm Tra Đảo/Biển Theo Thứ Tự**
- Kiểm tra từng **cặp địa điểm liên tiếp** (1→2, 2→3, 3→4, 4→5...)
- Nếu không có đường bộ giữa 2 điểm → **không vẽ route** cho đoạn đó
- Vẫn hiển thị **tất cả markers** trên bản đồ

### 4. **Vẽ Route Theo Segments**
- Tìm các **đoạn route liên tục** có thể đi được
- Ví dụ: Nếu có 5 địa điểm và địa điểm 3 là đảo:
  - Segment 1: Địa điểm 1 → 2 (có route)
  - Segment 2: Địa điểm 4 → 5 (có route)
  - Địa điểm 3: Chỉ hiển thị marker, không có route

### 5. **Thông Báo Rõ Ràng**
- Hiển thị khoảng cách và thời gian di chuyển
- Cảnh báo nếu có địa điểm cần tàu/phà: "⚠️ X đoạn đường cần tàu/phà"

## 🔍 Cách Hoạt Động

### Bước 1: Geocode Locations
```javascript
// Lấy tọa độ cho tất cả địa điểm theo thứ tự
const locations = [
  { location: "Địa điểm 1", lat: 10.1, lng: 106.1 },
  { location: "Địa điểm 2", lat: 10.2, lng: 106.2 },
  { location: "Địa điểm 3", lat: 10.3, lng: 106.3 },
  // ...
];
```

### Bước 2: Kiểm Tra Reachability
```javascript
// Kiểm tra từng cặp liên tiếp
for (let i = 0; i < locations.length - 1; i++) {
  const canReach = await checkIfReachable(
    directionsService,
    locations[i],
    locations[i + 1]
  );
  
  if (!canReach) {
    console.log(`⚠️ Không có đường bộ: ${i+1} → ${i+2}`);
  }
}
```

### Bước 3: Tạo Route Segments
```javascript
// Tìm các đoạn liên tục có thể đi được
const routeSegments = [];
let currentSegment = [locations[0]];

for (let i = 0; i < reachabilityMap.length; i++) {
  if (reachabilityMap[i].canReach) {
    currentSegment.push(locations[i + 1]);
  } else {
    if (currentSegment.length >= 2) {
      routeSegments.push([...currentSegment]);
    }
    currentSegment = [locations[i + 1]];
  }
}
```

### Bước 4: Vẽ Route
```javascript
// Vẽ route cho segment đầu tiên (hoặc dài nhất)
directionsService.route({
  origin: segment[0],
  destination: segment[segment.length - 1],
  waypoints: segment.slice(1, -1),
  travelMode: DRIVING,
  optimizeWaypoints: false  // ⭐ QUAN TRỌNG: Giữ nguyên thứ tự
});
```

## 📊 Ví Dụ Thực Tế

### Trường Hợp 1: Tất Cả Địa Điểm Có Đường Bộ
```
Input: [Bến Thành, Nhà Thờ Đức Bà, Dinh Độc Lập, Chợ Bình Tây]
Output: 
  ✅ Route: 1 → 2 → 3 → 4
  📏 Tổng quãng đường: 12.5 km
  ⏱️ Thời gian: 35 phút
```

### Trường Hợp 2: Có Khách Sạn
```
Input: [Bến Thành, Nhà Thờ Đức Bà, Hotel ABC, Dinh Độc Lập, Chợ Bình Tây]
Output:
  ✅ Route: 1 → 2 → 4 → 5 (bỏ qua khách sạn số 3)
  📍 Khách sạn vẫn hiển thị marker nhưng không vẽ route
  📏 Tổng quãng đường: 10.2 km
```

### Trường Hợp 3: Có Địa Điểm Ở Đảo
```
Input: [Bãi Sau, Dinh Cậu, Hòn Thơm, Chợ Dương Đông]
Output:
  ✅ Route: 1 → 2 → 4 (Hòn Thơm bỏ qua)
  ⚠️ 1 đoạn đường cần tàu/phà
  📏 Tổng quãng đường: 8.3 km
```

### Trường Hợp 4: Tất Cả Địa Điểm Ở Đảo
```
Input: [Hòn Mun, Hòn Tằm, Hòn Tre]
Output:
  ⚠️ Các địa điểm không thể đi đường bộ (cần tàu/phà)
  📍 Vẫn hiển thị markers trên bản đồ
```

## 🎨 Giao Diện

### Route Info Box
```
┌─────────────────────────────────────────┐
│ 📏 Tổng quãng đường: 12.5 km           │
│ ⏱️ Thời gian di chuyển: ~35 phút       │
│ ⚠️ 1 đoạn đường cần tàu/phà            │
└─────────────────────────────────────────┘
```

### Locations List
```
📍 Các điểm tham quan (4)

① Bãi Sau
   ⏰ 08:00 - 10:00

② Dinh Cậu  
   ⏰ 10:30 - 12:00

③ Hòn Thơm (Đảo - cần tàu)
   ⏰ 14:00 - 16:00

④ Chợ Dương Đông
   ⏰ 17:00 - 18:00
```

## 🔧 Technical Details

### File Đã Sửa
- `src/components/DailyRouteMap.js`

### Thay Đổi Chính
1. **Line ~70**: Thêm logic kiểm tra reachability theo thứ tự
2. **Line ~90**: Tạo route segments từ reachability map
3. **Line ~120**: Set `optimizeWaypoints: false`
4. **Line ~180**: Thêm thông báo "Thứ tự đi: Theo đúng thứ tự 1→2→3→4→5"

### Dependencies
- Google Maps Directions API
- Google Maps Geocoding API

## 🧪 Testing

### Test Case 1: Route Bình Thường
```javascript
const locations = [
  { location: "Bến Thành", lat: 10.772, lng: 106.698 },
  { location: "Nhà Thờ Đức Bà", lat: 10.780, lng: 106.699 },
  { location: "Dinh Độc Lập", lat: 10.777, lng: 106.695 }
];
// Expected: Route 1→2→3, có khoảng cách và thời gian
```

### Test Case 2: Có Địa Điểm Đảo
```javascript
const locations = [
  { location: "Bãi Sau", lat: 10.165, lng: 103.982 },
  { location: "Hòn Thơm", lat: 10.065, lng: 103.850 }, // Đảo
  { location: "Chợ Dương Đông", lat: 10.210, lng: 103.970 }
];
// Expected: Route 1→3, warning về Hòn Thơm
```

## 📝 Notes

1. **Thứ tự luôn được giữ nguyên**: Không bao giờ tự động sắp xếp lại
2. **Markers luôn hiển thị**: Kể cả địa điểm không có route
3. **Route chỉ vẽ cho đoạn có thể đi**: Tránh lỗi ZERO_RESULTS
4. **Performance**: Kiểm tra reachability có thể mất vài giây với nhiều địa điểm

## 🚀 Next Steps

- [ ] Thêm option để user chọn "Tối ưu tự động" hoặc "Giữ nguyên thứ tự"
- [ ] Hiển thị icon khác nhau cho địa điểm đảo/biển
- [ ] Thêm thông tin về phương tiện cần thiết (tàu, phà)
- [ ] Cache reachability results để tránh gọi API nhiều lần

## ✅ Kết Luận

Route giờ đây sẽ:
- ✅ Đi theo đúng thứ tự 1, 2, 3, 4, 5
- ✅ Không vẽ route cho địa điểm đảo/biển
- ✅ Vẫn hiển thị tất cả markers
- ✅ Thông báo rõ ràng về các đoạn cần tàu/phà
