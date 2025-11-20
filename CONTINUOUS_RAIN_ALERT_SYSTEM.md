# 🌧️ Hệ Thống Cảnh Báo Mưa Liên Tục - Continuous Rain Alert System

## 📋 Tổng Quan

Hệ thống cảnh báo thông minh phát hiện và cảnh báo khi có mưa liên tục trong suốt chuyến đi du lịch, giúp người dùng đưa ra quyết định tốt hơn về kế hoạch du lịch.

## ✨ Tính Năng Mới

### 1. Phân Tích Thời Tiết Toàn Chuyến Đi

Hệ thống giờ đây phân tích thời tiết cho **TẤT CẢ các ngày** trong chuyến đi (từ startDate đến endDate), không chỉ ngày đầu tiên.

```javascript
// Tự động tính số ngày của chuyến đi
const tripDuration = calculateTripDuration(trip.startDate, trip.endDate);

// Phân tích thời tiết cho từng ngày
const tripWeatherAnalysis = analyzeTripWeather(trip, weather);
```

### 2. Phát Hiện Mưa Liên Tục

Hệ thống phân loại mức độ mưa dựa trên tỷ lệ ngày có mưa:

#### 🚨 Mưa Suốt Chuyến Đi (100% ngày có mưa)
- **Điểm trừ**: -50 điểm
- **Mức độ**: CRITICAL
- **Cảnh báo**: "🌧️ MƯA SUỐT [X] NGÀY"
- **Hiển thị**: 
  - Tổng số ngày mưa
  - Lượng mưa trung bình/ngày
  - Lời khuyên: "Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng"

#### ⚠️ Mưa Hầu Hết Các Ngày (≥70% ngày có mưa)
- **Điểm trừ**: -35 điểm
- **Mức độ**: HIGH
- **Cảnh báo**: "🌧️ Mưa [X]/[Y] ngày"
- **Hiển thị**:
  - Số ngày mưa/tổng số ngày
  - Lượng mưa trung bình/ngày
  - Lời khuyên: "Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng"

#### 🌦️ Mưa Thường Xuyên (≥50% ngày có mưa)
- **Điểm trừ**: -20 điểm
- **Mức độ**: MEDIUM
- **Cảnh báo**: "Mưa [X]/[Y] ngày"

#### 🌧️ Mưa Lớn Trung Bình (>50mm/ngày)
- **Điểm trừ**: -15 điểm thêm
- **Mức độ**: HIGH
- **Cảnh báo**: "Mưa lớn trung bình [X]mm/ngày"

### 3. Widget Hiển Thị Nâng Cao

#### Cảnh Báo Đặc Biệt
Widget giờ hiển thị cảnh báo mưa liên tục với:
- **Animation pulse**: Hiệu ứng nhấp nháy để thu hút sự chú ý
- **Gradient background**: Màu nền gradient đỏ cho mưa suốt, vàng cho mưa nhiều
- **Border nổi bật**: Border dày hơn (3-6px) cho cảnh báo nghiêm trọng
- **Chi tiết đầy đủ**:
  - Số ngày mưa/tổng số ngày
  - Lượng mưa trung bình
  - Lời khuyên cụ thể

#### Ví Dụ Hiển Thị

```
┌─────────────────────────────────────────┐
│ 🚨 KHÔNG NÊN ĐI                         │
│ Cập nhật: 5 phút trước                  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🌧️🌧️🌧️ MƯA SUỐT CHUYẾN ĐI         │ │
│ │                                     │ │
│ │ • Tất cả 5 ngày đều có mưa          │ │
│ │ • Trung bình 45mm/ngày              │ │
│ │ ⚠️ Nên cân nhắc hoãn chuyến đi     │ │
│ │    hoặc chuẩn bị kỹ lưỡng          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 🌧️ MƯA SUỐT 5 NGÀY (45mm/ngày).       │
│ Rất nguy hiểm!                          │
└─────────────────────────────────────────┘
```

## 🔧 Cải Tiến Kỹ Thuật

### 1. Helper Functions Mới

#### `calculateTripDuration(startDate, endDate)`
Tính số ngày của chuyến đi, hỗ trợ nhiều format ngày tháng.

#### `parseDate(dateStr)`
Parse ngày tháng từ nhiều format:
- DD/MM/YYYY (Việt Nam)
- ISO 8601 (YYYY-MM-DD)
- Timestamp

#### `analyzeTripWeather(trip, weather)`
Phân tích thời tiết cho toàn bộ chuyến đi:
- Lọc forecast cho từng ngày trong chuyến đi
- Tổng hợp lượng mưa mỗi ngày
- Đếm số ngày có mưa
- Tính lượng mưa trung bình

**Output:**
```javascript
{
  totalDays: 5,              // Tổng số ngày
  rainyDaysCount: 5,         // Số ngày có mưa
  avgRainPerDay: 45,         // Lượng mưa TB (mm/ngày)
  dailyWeather: [...],       // Chi tiết từng ngày
  hasData: true              // Có dữ liệu forecast không
}
```

### 2. Thuật Toán Phát Hiện Mưa

Một ngày được coi là "có mưa" nếu:
1. Tổng lượng mưa > 2mm, HOẶC
2. Condition chứa "Rain", HOẶC
3. Description chứa "mưa", HOẶC
4. Probability of Precipitation (POP) > 30%

### 3. Scoring System Cải Tiến

```javascript
// Điểm ban đầu: 100
let score = 100;

// Mưa liên tục
if (rainyPercentage === 100%) score -= 50;      // Mưa suốt
else if (rainyPercentage >= 70%) score -= 35;   // Mưa hầu hết
else if (rainyPercentage >= 50%) score -= 20;   // Mưa thường xuyên

// Mưa lớn
if (avgRainPerDay > 50mm) score -= 15;          // Mưa lớn TB

// Thời tiết hiện tại
if (currentRain > 100mm) score -= 25;           // Mưa lớn hiện tại
else if (currentRain > 50mm) score -= 10;       // Mưa vừa hiện tại

// Thời tiết ngày đi
if (tripDayRain > 100mm) score -= 30;           // Mưa lớn ngày đi
else if (tripDayRain > 50mm) score -= 15;       // Mưa vừa ngày đi

// Gió mạnh
if (wind > 60km/h) score -= 25;                 // Gió rất mạnh
else if (wind > 40km/h) score -= 10;            // Gió mạnh

// Nhiệt độ cực đoan
if (temp > 38°C || temp < 5°C) score -= 15;

// Traffic issues
// ... (giữ nguyên logic cũ)

// Phân loại status
if (score >= 80) → SAFE (✅ An toàn)
else if (score >= 50) → CAUTION (⚠️ Cân nhắc)
else if (score >= 20) → WARNING (🔴 Không nên đi)
else → DANGER (🚨 Nguy hiểm)
```

## 🎨 CSS Styling

### Animation Pulse
```css
@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
  }
}
```

### Gradient Background
```css
.alert-item.rain-continuous {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border: 3px solid #dc2626;
  border-left: 6px solid #991b1b;
  animation: pulse-warning 2s ease-in-out infinite;
}
```

## 📊 Ví Dụ Thực Tế

### Trường Hợp 1: Mưa Suốt Chuyến Đi
```
Chuyến đi: Đà Lạt, 5 ngày (20-24/12/2025)
Dự báo:
- 20/12: 🌧️ 40mm
- 21/12: 🌧️ 50mm
- 22/12: 🌧️ 45mm
- 23/12: 🌧️ 38mm
- 24/12: 🌧️ 52mm

Kết quả:
- Status: 🚨 DANGER
- Score: 20/100
- Cảnh báo: "🌧️ MƯA SUỐT 5 NGÀY (45mm/ngày). Rất nguy hiểm!"
```

### Trường Hợp 2: Mưa Một Vài Ngày
```
Chuyến đi: Nha Trang, 5 ngày (20-24/12/2025)
Dự báo:
- 20/12: ☀️ 0mm
- 21/12: 🌧️ 15mm
- 22/12: ☀️ 0mm
- 23/12: 🌧️ 20mm
- 24/12: ☀️ 0mm

Kết quả:
- Status: ⚠️ CAUTION
- Score: 65/100
- Cảnh báo: "Có mưa vài ngày. Nên chuẩn bị kỹ."
```

### Trường Hợp 3: Thời Tiết Tốt
```
Chuyến đi: Phú Quốc, 5 ngày (20-24/12/2025)
Dự báo:
- 20/12: ☀️ 0mm
- 21/12: ☀️ 0mm
- 22/12: ☀️ 0mm
- 23/12: ☀️ 0mm
- 24/12: ☀️ 0mm

Kết quả:
- Status: ✅ SAFE
- Score: 100/100
- Cảnh báo: "Thời tiết tốt, yên tâm đi"
```

## 🚀 Cách Sử Dụng

### Trong Component
```javascript
import TripWeatherWidget from './components/TripWeatherWidget';

<TripWeatherWidget 
  trip={{
    destination: 'Đà Lạt',
    startDate: '20/12/2025',
    endDate: '24/12/2025'  // Quan trọng: Phải có endDate
  }} 
/>
```

### Trong Service
```javascript
import { analyzeTripSafety } from './services/weatherSafetyService';

const safetyData = await analyzeTripSafety({
  destination: 'Đà Lạt',
  startDate: '20/12/2025',
  endDate: '24/12/2025'
});

console.log(safetyData.issues);
// [
//   {
//     type: 'continuous_rain_all_days',
//     severity: 'critical',
//     rainyDays: 5,
//     totalDays: 5,
//     avgRain: 45
//   }
// ]
```

## 📝 Lưu Ý

1. **Yêu cầu endDate**: Để phân tích mưa liên tục, trip phải có `endDate`. Nếu không có, hệ thống mặc định là 1 ngày.

2. **Giới hạn forecast**: OpenWeatherMap API chỉ cung cấp forecast 5 ngày. Chuyến đi dài hơn sẽ chỉ phân tích được 5 ngày đầu.

3. **Độ chính xác**: Dự báo thời tiết có thể thay đổi. Nên kiểm tra lại gần ngày đi.

4. **Auto-refresh**: Widget tự động cập nhật mỗi 30 phút để có dữ liệu mới nhất.

## 🔄 Cập Nhật Trong Tương Lai

- [ ] Hỗ trợ nhiều điểm đến trong 1 chuyến đi
- [ ] Cảnh báo qua email/SMS khi có mưa lớn
- [ ] Gợi ý hoạt động trong nhà khi mưa
- [ ] Tích hợp dữ liệu mưa lịch sử để dự đoán chính xác hơn
- [ ] Cảnh báo lũ lụt cho vùng thấp
- [ ] Cảnh báo sạt lở cho vùng núi

## 📞 Hỗ Trợ

Nếu có vấn đề hoặc câu hỏi, vui lòng tạo issue trên GitHub hoặc liên hệ team phát triển.

---

**Phiên bản**: 2.0  
**Ngày cập nhật**: 20/11/2025  
**Tác giả**: Kiro AI Assistant
