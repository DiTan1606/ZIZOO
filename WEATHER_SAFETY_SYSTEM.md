# Hệ thống Cảnh báo Thời tiết & An toàn Real-time

## Tổng quan

Hệ thống cảnh báo thời tiết và an toàn cho chuyến đi, kết hợp 2 APIs:
- **OpenWeatherMap**: Dự báo thời tiết 5 ngày
- **TomTom Traffic**: Tình hình giao thông real-time

## API Keys

```env
REACT_APP_OPM_API_KEY=a0c3bdef674df3ff86bc7ef7a834c503
REACT_APP_TOMTOM_API_KEY=lazvNskZKUnxr0XLLiEdbGW8BMbERuKan
```

## Tính năng

### 1. Weather Safety Widget (MyTrips)
- Hiển thị trong mỗi trip card
- Chỉ hiện khi trip ≤ 14 ngày
- Auto-refresh mỗi 30 phút
- 4 trạng thái: ✅ An toàn, ⚠️ Cân nhắc, 🔴 Không nên đi, 🚨 Nguy hiểm

### 2. Notification Bell (Navbar)
- Icon chuông với badge số lượng thông báo chưa đọc
- Dropdown hiển thị 20 thông báo gần nhất
- Click để đánh dấu đã đọc
- Auto-refresh mỗi 5 phút

### 3. Real-time Monitoring
- Background service check mỗi 1-2 giờ
- Tự động gửi notification khi status thay đổi xấu
- Lưu notifications vào Firestore

## Cấu trúc Files

```
src/
├── services/
│   └── weatherSafetyService.js      # Service chính
├── components/
│   ├── TripWeatherWidget.js         # Widget thời tiết
│   ├── TripWeatherWidget.css
│   ├── NotificationBell.js          # Chuông thông báo
│   └── NotificationBell.css
└── pages/
    └── MyTrips.js                   # Tích hợp widget
```

## Firestore Schema

### Collection: `notifications`
```javascript
{
  userId: string,
  tripId: string,
  type: 'weather_alert',
  status: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER',
  title: string,
  message: string,
  destination: string,
  tripDate: Date,
  read: boolean,
  createdAt: Date
}
```

## Logic Phân tích

### Tính điểm an toàn (0-100)
```javascript
score = 100

// Thời tiết hiện tại
if (rain > 100mm) score -= 25
if (rain > 50mm) score -= 10

// Thời tiết ngày đi
if (rain > 100mm) score -= 30
if (rain > 50mm) score -= 15
if (wind > 60km/h) score -= 25
if (wind > 40km/h) score -= 10
if (temp > 38°C || temp < 5°C) score -= 15

// Giao thông (chỉ check khi ≤3 ngày)
if (roadsClosed > 10) score -= 40
if (roadsClosed > 5) score -= 25
if (roadsClosed > 0) score -= 10
```

### Xác định trạng thái
```javascript
if (score >= 80) → ✅ SAFE (An toàn)
if (score >= 50) → ⚠️ CAUTION (Cân nhắc)
if (score >= 20) → 🔴 WARNING (Không nên đi)
if (score < 20)  → 🚨 DANGER (Nguy hiểm)
```

## Sử dụng

### 1. Trong MyTrips
Widget tự động hiển thị cho trips đang hoạt động (≤14 ngày):

```jsx
import TripWeatherWidget from '../components/TripWeatherWidget';

<TripWeatherWidget trip={trip} />
```

### 2. Trong Navbar
Notification bell tự động hiển thị khi user đăng nhập:

```jsx
import NotificationBell from './NotificationBell';

<NotificationBell />
```

### 3. Service Functions

```javascript
import { 
  analyzeTripSafety,
  saveNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead
} from '../services/weatherSafetyService';

// Phân tích an toàn
const safety = await analyzeTripSafety(trip);

// Lưu notification
await saveNotification(userId, tripId, {
  status: 'WARNING',
  message: 'Mưa lớn dự kiến',
  destination: 'Đà Lạt',
  tripDate: trip.startDate
});

// Lấy notifications
const notifications = await getUserNotifications(userId);

// Đếm chưa đọc
const count = await getUnreadCount(userId);

// Đánh dấu đã đọc
await markNotificationAsRead(notificationId);
```

## Background Monitoring (Future)

Để implement background monitoring, cần thêm Firebase Cloud Function:

```javascript
// functions/index.js
exports.monitorTrips = functions.pubsub
  .schedule('every 2 hours')
  .onRun(async () => {
    // Lấy tất cả trips trong 14 ngày tới
    const trips = await getUpcomingTrips();
    
    for (const trip of trips) {
      const oldStatus = trip.safetyStatus;
      const newStatus = await analyzeTripSafety(trip);
      
      // Nếu status xấu đi → gửi notification
      if (newStatus.priority > oldStatus.priority) {
        await saveNotification(trip.userId, trip.id, newStatus);
      }
      
      // Cập nhật status
      await updateTripStatus(trip.id, newStatus);
    }
  });
```

## Testing

### Test Weather API
```javascript
const safety = await analyzeTripSafety({
  id: 'test-trip',
  destination: { name: 'Đà Lạt', lat: 11.9404, lng: 108.4583 },
  startDate: '2025-12-25'
});

console.log(safety);
// {
//   status: 'CAUTION',
//   icon: '⚠️',
//   label: 'Cân nhắc',
//   message: 'Có mưa, nên chuẩn bị kỹ',
//   current: { temp: 22, rain: 0, ... },
//   tripDay: { temp: 18, rain: 40, ... }
// }
```

### Test Notifications
```javascript
// Tạo test notification
await saveNotification('user-id', 'trip-id', {
  status: 'WARNING',
  icon: '🔴',
  label: 'Không nên đi',
  message: 'Mưa lớn + 5 đường đóng',
  destination: 'Đà Lạt',
  tripDate: new Date('2025-12-25')
});

// Kiểm tra
const notifications = await getUserNotifications('user-id');
console.log(notifications);
```

## Giới hạn API

### OpenWeatherMap (Free tier)
- 1,000 calls/day
- Forecast 5 ngày
- 60 calls/minute

### TomTom (Free tier)
- 2,500 requests/day
- Traffic incidents real-time

## Tối ưu

1. **Cache**: Cache weather data 30 phút
2. **Batch**: Check nhiều trips cùng lúc
3. **Conditional**: Chỉ check traffic khi ≤3 ngày
4. **Smart refresh**: Tăng tần suất khi gần ngày đi

## Troubleshooting

### Widget không hiển thị
- Check trip.startDate có hợp lệ không
- Check trip ≤ 14 ngày
- Check API keys trong .env

### Notification không gửi
- Check Firestore rules
- Check userId có đúng không
- Check collection 'notifications' đã tạo chưa

### API errors
- Check API keys
- Check rate limits
- Check network connection

## Next Steps

1. ✅ Implement basic weather widget
2. ✅ Implement notification bell
3. ⏳ Add Firebase Cloud Functions for background monitoring
4. ⏳ Add push notifications (FCM)
5. ⏳ Add email alerts
6. ⏳ Add SMS alerts (optional)

## Support

Nếu có vấn đề, check:
1. Console logs
2. Network tab (API calls)
3. Firestore data
4. API keys validity
