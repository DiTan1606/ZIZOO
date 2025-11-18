# 🗺️ Hướng Dẫn Cấu Hình Goong API Key

## ❌ Vấn Đề Hiện Tại

Bạn đang gặp lỗi:
```
rsapi.goong.io/geocode?...&api_key=undefined
Failed to load resource: the server responded with a status of 403
```

**Nguyên nhân:** Chưa có Goong API key trong file `.env`

---

## ✅ Giải Pháp

### Bước 1: Đăng Ký Goong API Key (MIỄN PHÍ)

1. Truy cập: https://account.goong.io/register
2. Đăng ký tài khoản (email + password)
3. Xác nhận email
4. Đăng nhập vào: https://account.goong.io/
5. Vào mục **"API Keys"** hoặc **"My Keys"**
6. Click **"Create New Key"** hoặc copy key có sẵn
7. Copy API key (dạng: `abcdef123456...`)

### Bước 2: Thêm Vào File `.env`

Mở file `.env` trong project và thêm dòng:

```env
REACT_APP_GOONG_API_KEY=YOUR_GOONG_API_KEY_HERE
```

**Thay `YOUR_GOONG_API_KEY_HERE` bằng key bạn vừa copy!**

Ví dụ:
```env
REACT_APP_GOONG_API_KEY=abcdef123456789xyz
```

### Bước 3: Restart Server

**QUAN TRỌNG:** Sau khi sửa `.env`, bạn PHẢI restart server:

```bash
# Stop server (Ctrl + C)
# Sau đó start lại:
npm start
```

---

## 🎯 Goong API Được Dùng Để Làm Gì?

### 1. **Geocoding** (Chuyển địa chỉ → tọa độ)
```
"Nhà Lồng Coffee, Đà Lạt" → { lat: 11.9404, lng: 108.4583 }
```

### 2. **Route Optimization** (Tối ưu lộ trình)
```
Điểm A → B → C → D
Tìm đường đi ngắn nhất, tiết kiệm thời gian
```

### 3. **Direction API** (Chỉ đường)
```
Từ điểm A đến điểm B:
- Khoảng cách: 5.2 km
- Thời gian: 15 phút
- Đường đi: [lat, lng] array
```

### 4. **Map Display** (Hiển thị bản đồ)
- Hiển thị route trên map
- Đánh dấu các điểm tham quan
- Vẽ đường đi giữa các điểm

---

## 📁 Files Sử Dụng Goong API

### 1. `src/services/routeOptimizationService.js`
```javascript
const GOONG_API_KEY = process.env.REACT_APP_GOONG_API_KEY;

// Direction API - Tính khoảng cách giữa 2 điểm
const response = await fetch(
    `https://rsapi.goong.io/Direction?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&vehicle=car&api_key=${GOONG_API_KEY}`
);
```

### 2. `src/components/DailyRouteMap.js`
```javascript
const GOONG_API_KEY = process.env.REACT_APP_GOONG_API_KEY;

// Geocoding API - Chuyển địa chỉ thành tọa độ
const response = await fetch(
    `https://rsapi.goong.io/geocode?address=${encodeURIComponent(searchQuery)}&api_key=${GOONG_API_KEY}`
);
```

---

## 🔍 Kiểm Tra Sau Khi Cấu Hình

### 1. Check Console
Mở DevTools (F12) → Console tab
- ✅ Không còn lỗi 403
- ✅ Thấy log: `✅ [location] found in [destination]`

### 2. Check Map
Vào **My Trips** → Click **"Xem chi tiết"** một chuyến đi
- ✅ Thấy bản đồ hiển thị
- ✅ Thấy route (đường đi) giữa các điểm
- ✅ Thấy markers (đánh dấu) các địa điểm

### 3. Check Route Info
Trong modal chi tiết:
- ✅ Hiển thị khoảng cách (km)
- ✅ Hiển thị thời gian di chuyển
- ✅ Có button "Tối ưu lộ trình"

---

## 🆓 Goong API - Free Tier

**Miễn phí:**
- ✅ 5,000 requests/ngày
- ✅ Geocoding API
- ✅ Direction API
- ✅ Map Display

**Đủ cho:**
- Development & Testing
- Small projects
- Personal use

**Nếu cần nhiều hơn:**
- Upgrade lên paid plan
- Hoặc dùng Google Maps API (đã có trong project)

---

## 🔄 Alternative: Dùng Google Maps API

Nếu không muốn dùng Goong, có thể chuyển sang Google Maps API:

### Ưu điểm Google Maps:
- ✅ Đã có key trong `.env`
- ✅ Data chính xác hơn
- ✅ Nhiều tính năng hơn

### Nhược điểm:
- ❌ Phải enable billing (thẻ tín dụng)
- ❌ $200 free credit/tháng (sau đó tính phí)
- ❌ Phức tạp hơn để setup

**Khuyến nghị:** Dùng Goong cho development, sau đó chuyển sang Google Maps khi production.

---

## 🐛 Troubleshooting

### Lỗi: "api_key=undefined"
**Nguyên nhân:** Chưa thêm key vào `.env` hoặc chưa restart server
**Giải pháp:** 
1. Thêm `REACT_APP_GOONG_API_KEY=...` vào `.env`
2. Restart server (Ctrl+C → npm start)

### Lỗi: "403 Forbidden"
**Nguyên nhân:** API key không hợp lệ hoặc đã hết hạn
**Giải pháp:**
1. Check key có đúng không
2. Đăng nhập https://account.goong.io/ để verify
3. Tạo key mới nếu cần

### Lỗi: "429 Too Many Requests"
**Nguyên nhân:** Vượt quá 5,000 requests/ngày
**Giải pháp:**
1. Đợi đến ngày mai (reset quota)
2. Hoặc upgrade plan
3. Hoặc optimize code để giảm số requests

### Map không hiển thị
**Nguyên nhân:** Geocoding thất bại hoặc không có tọa độ
**Giải pháp:**
1. Check console logs
2. Verify địa chỉ có đúng không
3. Thử geocode thủ công: https://rsapi.goong.io/geocode?address=Đà%20Lạt&api_key=YOUR_KEY

---

## ✅ Checklist

- [ ] Đăng ký tài khoản Goong.io
- [ ] Lấy API key
- [ ] Thêm vào `.env`: `REACT_APP_GOONG_API_KEY=...`
- [ ] Restart server
- [ ] Test: Tạo lịch trình mới
- [ ] Test: Xem chi tiết lịch trình
- [ ] Verify: Map hiển thị đúng
- [ ] Verify: Route được vẽ
- [ ] Verify: Không còn lỗi 403

---

## 📞 Support

Nếu vẫn gặp vấn đề:
1. Check Goong docs: https://docs.goong.io/
2. Check console logs (F12)
3. Verify API key tại: https://account.goong.io/

Good luck! 🚀
