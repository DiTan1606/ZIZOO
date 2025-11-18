# 🗺️ Fix Lỗi Route Map - 403 Forbidden

## ❌ Lỗi Hiện Tại

```
rsapi.goong.io/geocode?...&api_key=undefined
Failed to load resource: the server responded with a status of 403
```

## ✅ Giải Pháp Nhanh (3 Bước)

### 1. Đăng ký Goong API Key (MIỄN PHÍ)
👉 https://account.goong.io/register

### 2. Thêm vào `.env`
```env
REACT_APP_GOONG_API_KEY=your_key_here
```

### 3. Restart Server
```bash
# Ctrl + C để stop
npm start
```

---

## 🎯 Tính Năng Route Map

### Đã Có Trong Code:
✅ `DailyRouteMap.js` - Component hiển thị map + route
✅ `routeOptimizationService.js` - Tối ưu lộ trình
✅ `ItineraryDetailModal.js` - Hiển thị route trong modal chi tiết

### Sẽ Hoạt Động Sau Khi Fix:
✅ Geocoding: Chuyển địa chỉ → tọa độ
✅ Route Display: Vẽ đường đi trên map
✅ Distance Calculation: Tính khoảng cách giữa các điểm
✅ Route Optimization: Tối ưu thứ tự tham quan

---

## 📍 Cách Xem Route Map

1. Vào **My Trips**
2. Click **"Xem chi tiết"** một chuyến đi
3. Trong modal → Mỗi ngày sẽ có:
   - 🗺️ Bản đồ với route
   - 📍 Markers các địa điểm
   - 📏 Khoảng cách & thời gian
   - 🔄 Button "Tối ưu lộ trình"

---

## 🔍 Verify Đã Fix

### Console (F12):
- ✅ Không còn lỗi 403
- ✅ Thấy: `✅ [location] found in [destination]`

### UI:
- ✅ Map hiển thị trong modal
- ✅ Route được vẽ giữa các điểm
- ✅ Có thông tin khoảng cách/thời gian

---

## 📖 Chi Tiết

Xem file `GOONG_API_SETUP.md` để biết thêm chi tiết!
