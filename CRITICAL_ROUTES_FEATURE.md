# Tính năng Kiểm tra Tuyến đường Quan trọng

## Tổng quan

Nâng cấp hệ thống cảnh báo để **kiểm tra cụ thể các tuyến đường quan trọng** (đèo, cầu chính) thay vì chỉ check tổng quát.

## Vấn đề

Trước đây:
- TomTom chỉ trả về incidents trong khu vực chung
- Không biết đường NÀO bị đóng
- Không phân biệt đường chính vs đường phụ

**Ví dụ:** Đà Lạt có thể không ngập, nhưng nếu **cả 2 đèo chính** (Prenn + Mimosa) đều đóng → **KHÔNG THỂ VÀO**!

## Giải pháp

### 1. Định nghĩa Critical Routes

```javascript
const CRITICAL_ROUTES = {
  'Đà Lạt': {
    routes: [
      { 
        name: 'Đèo Prenn',
        coords: { lat: 11.8833, lng: 108.4333 },
        importance: 'critical'  // ← Đường CHÍNH
      },
      { 
        name: 'Đèo Mimosa',
        coords: { lat: 11.5500, lng: 107.8000 },
        importance: 'critical'  // ← Đường CHÍNH
      }
    ]
  },
  'Sapa': {
    routes: [
      { name: 'Đèo Ô Quy Hồ', importance: 'critical' }
    ]
  }
  // ... thêm địa điểm khác
};
```

### 2. Check từng tuyến đường

```javascript
export const checkCriticalRoutes = async (destinationName) => {
  const routes = CRITICAL_ROUTES[destinationName];
  
  // Check traffic cho TỪNG tuyến đường
  const routeStatus = await Promise.all(
    routes.map(async (route) => {
      const bbox = getBoundingBox(route.coords, 10); // 10km radius
      const incidents = await tomtomAPI.getIncidents(bbox);
      
      return {
        name: route.name,
        isOpen: incidents.length === 0,
        importance: route.importance
      };
    })
  );
  
  // Phân tích
  const criticalClosed = routeStatus.filter(r => 
    !r.isOpen && r.importance === 'critical'
  );
  
  return {
    allCriticalClosed: criticalClosed.length === routes.length,
    criticalRoutesClosed: criticalClosed.length,
    routes: routeStatus
  };
};
```

### 3. Logic cảnh báo thông minh

```javascript
if (criticalRoutes.allCriticalClosed) {
  // TẤT CẢ đường chính đều đóng
  score -= 60;  // Trừ điểm NẶNG
  status = 'DANGER';
  message = '🚫 KHÔNG THỂ VÀO: Tất cả đường chính đều đóng';
}
else if (criticalRoutes.criticalRoutesClosed > 0) {
  // MỘT SỐ đường chính đóng
  score -= 35;
  status = 'WARNING';
  message = '⚠️ Một số đường chính bị đóng, rất khó khăn';
}
else if (criticalRoutes.closedRoutes > 0) {
  // Chỉ đường phụ đóng
  score -= 15;
  status = 'CAUTION';
  message = 'Một số đường phụ bị đóng';
}
```

## UI Hiển thị

### Widget trong MyTrips:

```
┌─────────────────────────────────┐
│ 🏔️ Đà Lạt • 25-27/12          │
│                                 │
│ 🚫 KHÔNG THỂ VÀO               │
│ ☀️ 18°C • Cập nhật 1h trước    │
│                                 │
│ ⚠️ Tuyến đường quan trọng:     │
│                                 │
│ 🚫 Đèo Prenn: BỊ ĐÓNG         │
│    Lý do: Sạt lở đất           │
│                                 │
│ 🚫 Đèo Mimosa: BỊ ĐÓNG        │
│    Lý do: Mưa lớn              │
│                                 │
│ 🚫 Tất cả đường chính đều đóng │
│    KHÔNG THỂ VÀO được!         │
│                                 │
│ [Xem chi tiết] [Đổi lịch]     │
└─────────────────────────────────┘
```

### Modal chi tiết:

```
┌─────────────────────────────────┐
│ TUYẾN ĐƯỜNG QUAN TRỌNG         │
│                                 │
│ ┌─────────────────────────┐   │
│ │ 🚫 Đèo Prenn [Quan trọng]│   │
│ │ Tuyến đường chính từ     │   │
│ │ TP.HCM/Phan Thiết        │   │
│ │                          │   │
│ │ ❌ BỊ ĐÓNG              │   │
│ │ • Sạt lở đất            │   │
│ │ • Dự kiến mở: 2-3 ngày  │   │
│ └─────────────────────────┘   │
│                                 │
│ ┌─────────────────────────┐   │
│ │ 🚫 Đèo Mimosa [Quan trọng]│  │
│ │ Tuyến đường chính từ     │   │
│ │ TP.HCM                   │   │
│ │                          │   │
│ │ ❌ BỊ ĐÓNG              │   │
│ │ • Mưa lớn + sương mù    │   │
│ │ • Dự kiến mở: 1-2 ngày  │   │
│ └─────────────────────────┘   │
│                                 │
│ ⚠️ Tất cả đường chính đều đóng │
│    KHÔNG THỂ VÀO được!         │
└─────────────────────────────────┘
```

## Địa điểm đã định nghĩa

### ✅ Đà Lạt
- Đèo Prenn (critical)
- Đèo Mimosa/Bảo Lộc (critical)
- Đường Hồ Xuân Hương (high)

### ✅ Sapa
- Đèo Ô Quy Hồ (critical)

### ✅ Hà Giang
- Đèo Mã Pì Lèng (critical)

### ✅ Đà Nẵng
- Đèo Hải Vân (high)

## Thêm địa điểm mới

Để thêm địa điểm mới, edit `weatherSafetyService.js`:

```javascript
const CRITICAL_ROUTES = {
  // ... existing routes ...
  
  'Phú Quốc': {
    name: 'Phú Quốc',
    routes: [
      { 
        name: 'Cầu Phú Quốc',
        coords: { lat: 10.2167, lng: 103.9667 },
        type: 'bridge',
        importance: 'critical',
        description: 'Cầu duy nhất nối đất liền'
      }
    ]
  }
};
```

## Testing

### Test trong browser:

1. Mở `test-weather-api.html`
2. Click "Test Critical Routes"
3. Xem kết quả cho Đà Lạt

### Test trong app:

1. Tạo trip đi Đà Lạt trong 7 ngày tới
2. Vào MyTrips
3. Xem weather widget
4. Click "Chi tiết" để xem tuyến đường

## Logic Timeline

```
Khi tạo trip đi Đà Lạt 25/12:

18/12 (7 ngày trước):
→ Check critical routes
→ Nếu có đường đóng → Cảnh báo sớm

20/12 (5 ngày trước):
→ Check lại
→ Nếu tất cả đường đóng → Cảnh báo MẠNH

23/12 (2 ngày trước):
→ Check lại + check traffic tổng quát
→ Nếu vẫn đóng → Khuyến cáo HỦY

25/12 (ngày đi):
→ Check real-time
→ Hiển thị tình hình thực tế
```

## Ưu điểm

### So với cách cũ:
❌ Cũ: "Có 5 đường bị đóng" (không biết đường nào)
✅ Mới: "Đèo Prenn và Đèo Mimosa đều đóng → KHÔNG THỂ VÀO"

### Cụ thể hơn:
- Biết chính xác đường NÀO bị đóng
- Phân biệt đường chính vs đường phụ
- Cảnh báo khi KHÔNG CÓ ĐƯỜNG VÀO

### Thông minh hơn:
- Đà Lạt nắng đẹp NHƯNG đường đóng → Vẫn cảnh báo
- Có mưa nhỏ NHƯNG đường thông → Không cảnh báo quá mức

## API Usage

### Trước (1 call):
```
GET /traffic/incidentDetails?bbox=dalat_area
→ Trả về: "5 incidents"
```

### Sau (3 calls cho Đà Lạt):
```
GET /traffic/incidentDetails?bbox=prenn_pass
GET /traffic/incidentDetails?bbox=mimosa_pass  
GET /traffic/incidentDetails?bbox=dalat_center
→ Trả về: Chi tiết từng tuyến
```

**Trade-off:** Nhiều API calls hơn NHƯNG chính xác hơn nhiều!

## Giới hạn

- Chỉ check khi trip ≤ 7 ngày (để tiết kiệm API calls)
- Chỉ check cho địa điểm đã định nghĩa
- TomTom free tier: 2,500 calls/day (đủ cho ~800 trips/day)

## Next Steps

1. ✅ Implement critical routes checking
2. ✅ Add UI display
3. ⏳ Add more destinations
4. ⏳ Add historical data (đường nào hay bị đóng)
5. ⏳ Add alternative route suggestions
6. ⏳ Add estimated recovery time

## Kết luận

Tính năng này giải quyết vấn đề **"Đà Lạt đẹp nhưng không vào được"** bằng cách:
- Check cụ thể từng tuyến đường quan trọng
- Cảnh báo khi TẤT CẢ đường chính đều đóng
- Đưa ra khuyến nghị chính xác hơn

Giờ đây hệ thống có thể phát hiện case: **"Thời tiết tốt NHƯNG không có đường vào"**! 🎯
