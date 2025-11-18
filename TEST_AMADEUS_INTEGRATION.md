# ✈️ TÍCH HỢP AMADEUS API - VÉ MÁY BAY THỰC TẾ

## 🎯 Đã hoàn thành

### 1. Tạo Amadeus Service (`src/services/amadeusService.js`)
- ✅ Xác thực OAuth2 với Amadeus API
- ✅ Cache token để tránh request liên tục
- ✅ Map 20+ sân bay Việt Nam (HAN, SGN, DAD, PQC, CXR, DLI, v.v.)
- ✅ Tìm chuyến bay thực tế với giá, giờ bay, hãng hàng không
- ✅ Fallback ước tính giá nếu API fail
- ✅ Format duration từ ISO 8601 sang text dễ đọc

### 2. Cập nhật Complete Itinerary Service
- ✅ Import `amadeusService`
- ✅ Thêm hàm `calculateDistanceBetweenCities()` - tính khoảng cách Haversine
- ✅ Cập nhật `generateTransportPlan()` - gọi async để lấy vé máy bay
- ✅ Cập nhật `getIntercityTransportOptions()`:
  - Luôn lấy vé xe khách từ CSV
  - Nếu khoảng cách >= 300km → tìm vé máy bay từ Amadeus
  - Trả về cả 2 options cho khách chọn
- ✅ Thêm `getRecommendedTransport()` - logic gợi ý thông minh:
  - **< 300km**: Xe khách (rẻ hơn, tiện lợi)
  - **300-500km**: Gợi ý cả 2, ưu tiên xe khách
  - **> 500km**: Gợi ý cả 2, ưu tiên máy bay
- ✅ Cập nhật `calculateTransportCost()` - tính cả giá máy bay

### 3. API Keys đã thêm vào `.env`
```
REACT_APP_AMADEUS_API_KEY=pG4FCCej0bkL1YctO2YEqqXT5CEY8JdPU0cUD0aF
REACT_APP_AMADEUS_API_SECRET=ObHaq9U2kiểu
```

## 🔄 Logic hoạt động

### Khi tạo lịch trình:
1. Tính khoảng cách giữa 2 thành phố (Haversine formula)
2. Lấy vé xe khách từ CSV (luôn có)
3. Nếu khoảng cách >= 300km:
   - Gọi Amadeus API tìm vé máy bay
   - Lấy 2 chuyến rẻ nhất
   - Nếu API fail → dùng giá ước tính
4. Trả về tất cả options với thông tin:
   - Type (bus/flight)
   - Provider (công ty/hãng bay)
   - Price (tổng + per person)
   - Duration
   - Departure/Arrival time
   - Recommended flag

### Gợi ý thông minh:
- **Hà Nội → Hạ Long (150km)**: Xe khách ✅
- **Hà Nội → Đà Nẵng (600km)**: Máy bay ✅ (nhưng vẫn có xe khách)
- **Hà Nội → TP.HCM (1200km)**: Máy bay ✅✅

## 📊 Dữ liệu trả về

```javascript
{
  intercity: {
    distance: 600, // km
    departure: {
      from: "Hà Nội",
      to: "Đà Nẵng",
      date: "18/11/2025",
      options: [
        {
          type: "bus",
          name: "Xe khách",
          provider: "Phương Trang",
          price: 500000,
          pricePerPerson: 250000,
          duration: "12h",
          departure: "06:00",
          arrival: "18:00",
          recommended: false
        },
        {
          type: "flight",
          name: "Máy bay (Rẻ nhất)",
          provider: "VJ",
          flightNumber: "VJ123",
          price: 1600000,
          pricePerPerson: 800000,
          duration: "1h 20m",
          departure: "08:30",
          arrival: "09:50",
          comfort: "Economy",
          recommended: true // ✅ Đề xuất cho 600km
        }
      ],
      recommended: { /* máy bay */ }
    },
    return: { /* tương tự */ }
  }
}
```

## 🧪 Test

### Test thủ công:
1. Tạo lịch trình mới
2. Chọn điểm xuất phát: Hà Nội
3. Chọn điểm đến: Đà Nẵng (600km)
4. Kiểm tra console logs:
   - `✈️ Distance 600km >= 300km, searching flights...`
   - `✅ Amadeus token obtained`
   - `✅ Found X flights`
5. Xem kết quả trong `transport.intercity.departure.options`

### Các tuyến test:
- ✅ Hà Nội → Hạ Long (150km) - chỉ xe khách
- ✅ Hà Nội → Đà Nẵng (600km) - xe + máy bay
- ✅ Hà Nội → TP.HCM (1200km) - xe + máy bay
- ✅ TP.HCM → Phú Quốc (400km) - xe + máy bay

## ⚠️ Lưu ý

1. **Amadeus Test API**: Đang dùng test environment
   - URL: `https://test.api.amadeus.com`
   - Có thể có ít dữ liệu hơn production
   - Giá có thể không chính xác 100%

2. **Fallback**: Nếu API fail, vẫn có:
   - Vé xe khách từ CSV
   - Giá máy bay ước tính

3. **CORS**: Nếu gặp lỗi CORS, cần:
   - Gọi API từ backend (Node.js)
   - Hoặc dùng proxy

4. **Rate Limit**: Amadeus có giới hạn requests
   - Token được cache 30 phút
   - Tránh gọi quá nhiều lần

## 🚀 Tiếp theo

- [ ] Hiển thị options trong UI (modal chọn phương tiện)
- [ ] Lưu lựa chọn của user
- [ ] Tích hợp booking links
- [ ] Thêm filters (giá, thời gian, hãng)
- [ ] So sánh chi tiết (bảng so sánh)

## 📝 Code changes

- `src/services/amadeusService.js` - NEW
- `src/services/completeItineraryService.js` - UPDATED
- `.env` - UPDATED (API keys)
