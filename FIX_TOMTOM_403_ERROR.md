# 🔧 Fix TomTom API 403 Error

## ❌ Lỗi

```
Failed to load resource: the server responded with a status of 403
```

## 🔍 Nguyên Nhân

Lỗi 403 (Forbidden) có thể do:

1. **API key không hợp lệ**
2. **API key chưa được kích hoạt Traffic API**
3. **Đã hết quota**
4. **CORS issue** (domain không được whitelist)
5. **API key bị vô hiệu hóa**

---

## ✅ Giải Pháp

### 1. Kiểm Tra API Key

#### Bước 1: Đăng nhập TomTom Dashboard
Truy cập: https://developer.tomtom.com/user/me/apps

#### Bước 2: Kiểm tra App
- Xem app có tồn tại không
- Kiểm tra API key: `lazvNskZKUnxr0XLLiEdbGW8BMbERuKan`

#### Bước 3: Kiểm tra APIs được enable
Đảm bảo các API sau được enable:
- ✅ **Traffic API** (quan trọng nhất)
- ✅ Search API
- ✅ Routing API

---

### 2. Kiểm Tra Quota

#### Free Tier Limits
- Traffic API: **2,500 requests/day**
- Search API: **2,500 requests/day**
- Routing API: **2,500 requests/day**

#### Cách kiểm tra:
1. Vào TomTom Dashboard
2. Chọn app
3. Xem tab "Usage" hoặc "Statistics"
4. Kiểm tra số requests đã dùng hôm nay

---

### 3. Test API Key

#### Option 1: Test bằng Browser
Mở file: `test-tomtom-simple.html`

```bash
# Mở trong browser
open test-tomtom-simple.html
```

Click các nút để test:
- 🚗 Test Traffic API
- 🔍 Test Search API
- 🗺️ Test Routing API

#### Option 2: Test bằng cURL

```bash
# Test Traffic API
curl "https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=108.2583,11.7404,108.6583,12.1404&key=lazvNskZKUnxr0XLLiEdbGW8BMbERuKan&fields={incidents{type}}&language=vi-VN"

# Test Search API
curl "https://api.tomtom.com/search/2/search/Đà%20Lạt.json?key=lazvNskZKUnxr0XLLiEdbGW8BMbERuKan&language=vi-VN"

# Test Routing API
curl "https://api.tomtom.com/routing/1/calculateRoute/10.8231,106.6297:11.9404,108.4583/json?key=lazvNskZKUnxr0XLLiEdbGW8BMbERuKan"
```

#### Option 3: Test bằng Postman
1. Import collection từ TomTom docs
2. Thay API key
3. Send request

---

### 4. Tạo API Key Mới

Nếu API key cũ không hoạt động:

#### Bước 1: Tạo App Mới
1. Vào https://developer.tomtom.com/user/me/apps
2. Click "Create a new app"
3. Điền thông tin:
   - Name: `Travel App`
   - Description: `Travel planning with traffic monitoring`

#### Bước 2: Enable APIs
Chọn các APIs cần dùng:
- ✅ Traffic API
- ✅ Search API
- ✅ Routing API
- ✅ Maps SDK

#### Bước 3: Copy API Key
1. Click vào app vừa tạo
2. Copy "Consumer API Key"
3. Lưu vào `.env`:

```env
REACT_APP_TOMTOM_API_KEY=your_new_api_key_here
```

#### Bước 4: Restart App
```bash
npm start
```

---

### 5. Fix CORS Issue

Nếu lỗi CORS (chỉ xảy ra khi test từ browser):

#### Option 1: Whitelist Domain
1. Vào TomTom Dashboard
2. Chọn app
3. Vào tab "Settings" hoặc "Allowed Origins"
4. Thêm domain:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - Domain production của bạn

#### Option 2: Dùng Proxy (Development)
Thêm proxy trong `package.json`:

```json
{
  "proxy": "https://api.tomtom.com"
}
```

Hoặc dùng CORS proxy:
```javascript
const PROXY = 'https://cors-anywhere.herokuapp.com/';
const url = `${PROXY}https://api.tomtom.com/traffic/...`;
```

#### Option 3: Call từ Backend
Tạo API endpoint trong backend để gọi TomTom:

```javascript
// server.js
app.get('/api/traffic', async (req, res) => {
  const { bbox } = req.query;
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&key=${TOMTOM_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
});
```

---

### 6. Kiểm Tra Response Headers

Nếu vẫn lỗi, kiểm tra response headers:

```javascript
const response = await fetch(url);
console.log('Status:', response.status);
console.log('Headers:', [...response.headers.entries()]);

if (!response.ok) {
  const errorText = await response.text();
  console.log('Error body:', errorText);
}
```

Các headers quan trọng:
- `X-RateLimit-Remaining`: Số requests còn lại
- `X-RateLimit-Reset`: Thời gian reset quota
- `Access-Control-Allow-Origin`: CORS config

---

## 🧪 Test Checklist

- [ ] API key đúng format (không có khoảng trắng)
- [ ] API key được copy đầy đủ
- [ ] Traffic API được enable trong dashboard
- [ ] Quota còn lại > 0
- [ ] Domain được whitelist (nếu cần)
- [ ] Test với cURL thành công
- [ ] Test với browser thành công
- [ ] Test với Postman thành công

---

## 📞 Liên Hệ TomTom Support

Nếu vẫn không fix được:

1. **Email**: support@tomtom.com
2. **Forum**: https://developer.tomtom.com/forum
3. **Documentation**: https://developer.tomtom.com/traffic-api/documentation

Cung cấp thông tin:
- API key (4 ký tự đầu và cuối)
- Request URL
- Response status code
- Response body
- Timestamp

---

## 🔄 Alternative: Dùng API Khác

Nếu TomTom không hoạt động, có thể dùng:

### 1. HERE Traffic API
```javascript
const HERE_API_KEY = 'your_here_api_key';
const url = `https://traffic.ls.hereapi.com/traffic/6.3/incidents.json?bbox=${bbox}&apiKey=${HERE_API_KEY}`;
```

### 2. MapBox Traffic API
```javascript
const MAPBOX_TOKEN = 'your_mapbox_token';
const url = `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/...`;
```

### 3. Google Maps Traffic Layer
```javascript
const trafficLayer = new google.maps.TrafficLayer();
trafficLayer.setMap(map);
```

---

## ✅ Kết Luận

Sau khi fix:
1. Test lại với `test-tomtom-simple.html`
2. Nếu thành công → Update code
3. Nếu vẫn lỗi → Tạo API key mới
4. Nếu vẫn không được → Dùng alternative API

---

**Cập nhật**: 20/11/2025  
**Tác giả**: Kiro AI Assistant
