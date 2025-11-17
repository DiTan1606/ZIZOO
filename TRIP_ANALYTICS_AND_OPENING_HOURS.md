# 📊 Thống kê Chuyến đi & Kiểm tra Giờ mở cửa

## Tổng quan

Hai tính năng mới được thêm vào:

### 1. **Thống kê & Phân tích Chuyến đi** (`userTripAnalytics.js`)
Phân tích dữ liệu chuyến đi của người dùng để:
- Đếm số chuyến đi, điểm đến
- Tính tổng chi tiêu và ngân sách trung bình
- Tìm điểm đến và địa điểm yêu thích
- Phân tích phong cách du lịch ưa thích
- Xác định thời gian du lịch ưa thích

### 2. **Kiểm tra Giờ mở cửa** (`customItineraryBuilder.js`)
Tự động kiểm tra và điều chỉnh thời gian tham quan để phù hợp với giờ mở cửa của địa điểm.

---

## 📊 Tính năng Thống kê Chuyến đi

### Service: `userTripAnalytics.js`

#### 1. Lấy tất cả chuyến đi
```javascript
const trips = await getUserTrips(userId);
// Trả về: Array of trip objects
```

#### 2. Phân tích thống kê
```javascript
const analytics = await analyzeUserTrips(userId);
```

**Kết quả trả về:**
```javascript
{
  totalTrips: 5,              // Tổng số chuyến đi
  totalDestinations: 15,      // Tổng số điểm đến đã ghé
  totalSpent: 25000000,       // Tổng chi tiêu (VNĐ)
  averageBudget: 5000000,     // Ngân sách TB/chuyến
  
  favoriteDestinations: [     // Top 5 điểm đến yêu thích
    { destination: 'Đà Nẵng', count: 3 },
    { destination: 'Nha Trang', count: 2 }
  ],
  
  preferredTravelStyle: 'standard',  // Phong cách ưa thích
  
  commonInterests: [          // Top 5 sở thích
    { interest: 'food', count: 4 },
    { interest: 'photography', count: 3 }
  ]
}
```

#### 3. Địa điểm yêu thích
```javascript
const places = await getUserFavoritePlaces(userId);
// Top 10 địa điểm đã ghé nhiều nhất
```

#### 4. Thời gian du lịch ưa thích
```javascript
const timePrefs = await analyzePreferredTravelTime(userId);
```

**Kết quả:**
```javascript
{
  preferredMonths: [
    { month: 7, count: 3 },   // Tháng 7 - 3 lần
    { month: 12, count: 2 }   // Tháng 12 - 2 lần
  ],
  preferredDurations: [
    { duration: 3, count: 4 }, // 3 ngày - 4 lần
    { duration: 5, count: 1 }  // 5 ngày - 1 lần
  ]
}
```

#### 5. Dashboard tổng hợp
```javascript
const dashboard = await generateUserDashboard(userId);
// Kết hợp tất cả thống kê trên
```

---

## 🕐 Tính năng Kiểm tra Giờ mở cửa

### Vấn đề cần giải quyết
Trước đây, hệ thống có thể tạo lịch trình như:
- **01:15** - Tham quan 88 Food Garden ❌ (Quá khuya!)
- **03:00** - Tham quan bảo tàng ❌ (Chưa mở cửa!)

### Giải pháp

#### 1. Giờ mở cửa mặc định theo loại địa điểm

```javascript
const defaultHours = {
  'restaurant': { open: '06:00', close: '22:00' },
  'cafe': { open: '07:00', close: '23:00' },
  'tourist_attraction': { open: '08:00', close: '18:00' },
  'museum': { open: '08:00', close: '17:00' },
  'park': { open: '05:00', close: '22:00' },
  'shopping_mall': { open: '09:00', close: '22:00' },
  'night_club': { open: '20:00', close: '02:00' }
};
```

#### 2. Kiểm tra thời gian hợp lệ

```javascript
const check = isWithinOpeningHours('01:15', destination);

// Kết quả:
{
  valid: false,
  reason: '88 Food Garden mở cửa 06:00 - 22:00',
  suggestedTime: '06:00'
}
```

#### 3. Tự động điều chỉnh

```javascript
const adjusted = adjustTimeForOpeningHours('01:15', destination);

// Kết quả:
{
  time: '06:00',              // Thời gian đã điều chỉnh
  adjusted: true,             // Có điều chỉnh
  reason: '88 Food Garden mở cửa 06:00 - 22:00'
}
```

#### 4. Cảnh báo trong lịch trình

Khi tạo lịch trình, nếu có điều chỉnh:
```javascript
{
  schedule: [...],
  warnings: [
    {
      destination: '88 Food Garden',
      originalTime: '01:15',
      adjustedTime: '06:00',
      reason: '88 Food Garden mở cửa 06:00 - 22:00'
    }
  ]
}
```

#### 5. Hiển thị trong lịch trình

```
14:00 Tham quan 88 Food Garden (2 giờ)
      • Điểm chụp ảnh đẹp
      • ⚠️ Đã điều chỉnh từ 01:15
      • 88 Food Garden mở cửa 06:00 - 22:00
```

---

## 🎨 Component UserTripDashboard

### Hiển thị thống kê trực quan

#### 1. Overview Cards
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  ✈️ 5       │  📍 15      │  💰 25M     │  📊 5M      │
│  Chuyến đi  │  Điểm đến   │  Tổng chi   │  TB/chuyến  │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### 2. Điểm đến yêu thích
```
🏆 Điểm đến yêu thích
#1  Đà Nẵng        3 chuyến đi
#2  Nha Trang      2 chuyến đi
#3  Phú Quốc       1 chuyến đi
```

#### 3. Địa điểm đã ghé
```
📸 Địa điểm đã ghé thăm nhiều nhất
┌──────────────┬──────────────┬──────────────┐
│ Bãi Trước    │ Chùa Linh Ứng│ Hội An       │
│ 3 lần        │ 2 lần        │ 2 lần        │
└──────────────┴──────────────┴──────────────┘
```

#### 4. Sở thích du lịch
```
🎯 Sở thích du lịch
Phong cách: Trung bình
Sở thích: food (4), photography (3), relaxation (2)
```

#### 5. Thời gian ưa thích
```
📅 Thời gian du lịch ưa thích
Tháng thường đi:        Độ dài chuyến đi:
• Tháng 7 - 3 lần      • 3 ngày - 4 lần
• Tháng 12 - 2 lần     • 5 ngày - 1 lần
```

---

## 🔧 Cách sử dụng

### 1. Hiển thị Dashboard trong app

```javascript
import UserTripDashboard from './components/UserTripDashboard';

// Trong component
<UserTripDashboard />
```

### 2. Sử dụng Analytics trong code

```javascript
import { analyzeUserTrips } from './services/userTripAnalytics';

// Lấy thống kê
const stats = await analyzeUserTrips(userId);

// Sử dụng để gợi ý
if (stats.preferredTravelStyle === 'luxury') {
  // Gợi ý khách sạn cao cấp
}

if (stats.favoriteDestinations[0].destination === 'Đà Nẵng') {
  // Gợi ý các địa điểm mới ở Đà Nẵng
}
```

### 3. Kiểm tra giờ mở cửa khi tạo lịch trình

Tự động được áp dụng khi:
- Người dùng chọn địa điểm với khung giờ
- Hệ thống tạo lịch trình tự động

```javascript
// Trong completeItineraryService.js
const scheduleResult = generateScheduleFromDestinations(dayPlan, preferences, day);

// Kiểm tra warnings
if (scheduleResult.warnings.length > 0) {
  console.log('Có điều chỉnh giờ mở cửa:', scheduleResult.warnings);
}
```

---

## 📈 Use Cases

### Use Case 1: Gợi ý cá nhân hóa
```javascript
const stats = await analyzeUserTrips(userId);

// Người dùng thích đi biển
if (stats.favoriteDestinations.some(d => 
  ['Nha Trang', 'Phú Quốc', 'Vũng Tàu'].includes(d.destination)
)) {
  // Gợi ý: Đà Nẵng, Quy Nhơn, Phan Thiết
}

// Người dùng thích ăn uống
if (stats.commonInterests.some(i => i.interest === 'food')) {
  // Ưu tiên thêm nhiều nhà hàng vào lịch trình
}
```

### Use Case 2: Tối ưu ngân sách
```javascript
const stats = await analyzeUserTrips(userId);

// Ngân sách trung bình của người dùng
const avgBudget = stats.averageBudget;

// Gợi ý phù hợp
if (avgBudget < 3000000) {
  // Gợi ý phong cách "budget"
} else if (avgBudget > 10000000) {
  // Gợi ý phong cách "luxury"
}
```

### Use Case 3: Tránh lặp lại
```javascript
const places = await getUserFavoritePlaces(userId);

// Lọc bỏ địa điểm đã đi nhiều lần
const newPlaces = allPlaces.filter(place => 
  !places.some(p => p.place === place.name)
);
```

### Use Case 4: Kiểm tra giờ mở cửa
```javascript
// Người dùng chọn 01:15 đi tham quan
const destination = {
  name: '88 Food Garden',
  category: 'restaurant',
  preferredTime: '01:15'
};

// Hệ thống tự động điều chỉnh sang 06:00
// Và thêm cảnh báo vào lịch trình
```

---

## 🎯 Lợi ích

### Cho người dùng
✅ Hiểu rõ thói quen du lịch của mình
✅ Nhận gợi ý phù hợp dựa trên lịch sử
✅ Tránh lặp lại địa điểm đã đi
✅ Lịch trình hợp lý với giờ mở cửa
✅ Không bị sai giờ tham quan

### Cho hệ thống
✅ Thu thập dữ liệu người dùng
✅ Cải thiện thuật toán gợi ý
✅ Tăng độ chính xác lịch trình
✅ Giảm số lần chỉnh sửa sau
✅ Tăng trải nghiệm người dùng

---

## 🚀 Cải tiến tương lai

### Phase 2
- [ ] Biểu đồ trực quan (charts)
- [ ] So sánh với người dùng khác
- [ ] Xuất báo cáo PDF
- [ ] Tích hợp Google Places API để lấy giờ mở cửa thực tế

### Phase 3
- [ ] Machine Learning dự đoán sở thích
- [ ] Gợi ý địa điểm dựa trên AI
- [ ] Phân tích sentiment từ feedback
- [ ] Tạo "Travel Profile" chi tiết

---

## 🧪 Testing

### Test Analytics
```javascript
// Test với user có nhiều chuyến đi
const stats = await analyzeUserTrips('user123');
expect(stats.totalTrips).toBeGreaterThan(0);
expect(stats.favoriteDestinations).toHaveLength(5);

// Test với user mới
const newUserStats = await analyzeUserTrips('newUser');
expect(newUserStats.totalTrips).toBe(0);
```

### Test Opening Hours
```javascript
// Test giờ hợp lệ
const check1 = isWithinOpeningHours('10:00', restaurantDest);
expect(check1.valid).toBe(true);

// Test giờ không hợp lệ
const check2 = isWithinOpeningHours('01:00', restaurantDest);
expect(check2.valid).toBe(false);
expect(check2.suggestedTime).toBe('06:00');

// Test điều chỉnh
const adjusted = adjustTimeForOpeningHours('01:00', restaurantDest);
expect(adjusted.time).toBe('06:00');
expect(adjusted.adjusted).toBe(true);
```

---

## 📝 Kết luận

Hai tính năng này giúp:
1. **Hiểu người dùng tốt hơn** qua phân tích dữ liệu
2. **Tạo lịch trình chính xác hơn** với kiểm tra giờ mở cửa
3. **Cải thiện trải nghiệm** với gợi ý cá nhân hóa
4. **Tránh lỗi** về thời gian tham quan không hợp lý
