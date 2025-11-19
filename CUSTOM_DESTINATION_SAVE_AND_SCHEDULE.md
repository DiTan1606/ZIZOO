# Tính năng Lưu và Lên lịch Địa điểm Tùy chỉnh

## 📋 Tổng quan

Đã cập nhật hệ thống để:
1. **Lưu địa điểm tùy chỉnh vào database** để sử dụng lại sau
2. **Đưa địa điểm tùy chỉnh vào lịch trình** với đúng khung giờ người dùng đã chọn

## ✨ Tính năng mới

### 1. Lưu vào Database
- Khi người dùng thêm địa điểm tùy chỉnh ở trang **DestinationSelector**, địa điểm sẽ được lưu vào Firestore collection `customDestinations`
- Thông tin lưu trữ:
  - `userId`: ID người dùng
  - `name`: Tên địa điểm
  - `address`: Địa chỉ
  - `coordinates`: Tọa độ (lat, lng)
  - `category`: Loại địa điểm
  - `city`: Thành phố
  - `visitCount`: Số lần ghé thăm
  - `createdAt`: Thời gian tạo
  - `lastVisited`: Lần ghé thăm cuối

### 2. Ưu tiên trong Lịch trình
- Địa điểm tùy chỉnh được đánh dấu với:
  - `priority: 'high'` - Ưu tiên cao
  - `isCustom: true` - Đánh dấu là địa điểm tùy chỉnh
  - `userSelected: true` - Người dùng đã chọn

### 3. Khung giờ Yêu cầu
- Nếu người dùng chọn `preferredTime`, địa điểm sẽ được đưa vào lịch trình **đúng khung giờ đó**
- Hiển thị trong lịch trình với note: `⏰ Khung giờ yêu cầu: HH:MM`
- Các địa điểm khác sẽ được sắp xếp xung quanh

## 🔧 Các file đã cập nhật

### 1. `src/components/DestinationSelector.js`
```javascript
// Import service
import { saveCustomDestination } from '../services/customDestinationService';
import { useAuth } from '../context/AuthContext';

// Trong component
const { currentUser } = useAuth();

// Hàm addCustomDestination
const addCustomDestination = async () => {
    // ... tạo newDestination
    
    // 💾 LƯU VÀO DATABASE
    try {
        if (currentUser) {
            await saveCustomDestination(newDestination, currentUser.uid);
            console.log('✅ Đã lưu địa điểm tùy chỉnh vào database');
        }
    } catch (error) {
        console.warn('⚠️ Không thể lưu vào database:', error);
    }
    
    // Thêm vào danh sách đã chọn
    setSelectedDestinations(prev => [...prev, newDestination]);
    toast.success(`✅ Đã thêm "${customDestination.name}" vào lịch trình${currentUser ? ' và lưu vào database' : ''}!`);
};
```

### 2. `src/services/completeItineraryService.js`

#### a. Hàm `generateDailyItinerary`
```javascript
const generateDailyItinerary = async (preferences) => {
    const { 
        customDestinations = [] // ✨ Địa điểm tùy chỉnh từ người dùng
    } = preferences;
    
    console.log(`✨ Có ${customDestinations.length} địa điểm tùy chỉnh từ người dùng`);
    
    // Truyền customDestinations cho mỗi ngày
    const dayPlan = await generateSingleDayPlan(
        // ... các params khác
        customDestinations, // ✨ Truyền custom destinations
        // ...
    );
};
```

#### b. Hàm `generateSingleDayPlan`
```javascript
const generateSingleDayPlan = async (
    // ... params
    customDestinations = [],
    // ...
) => {
    // Tìm địa điểm tham quan
    let destinations = await findRealDestinationsForDay(...);
    
    // ✨ THÊM CUSTOM DESTINATIONS với ưu tiên cao
    if (customDestinations && customDestinations.length > 0) {
        console.log(`✨ Thêm ${customDestinations.length} địa điểm tùy chỉnh vào lịch trình`);
        
        // Phân bổ đều qua các ngày
        const customPerDay = Math.ceil(customDestinations.length / duration);
        const startIdx = (dayNumber - 1) * customPerDay;
        const endIdx = Math.min(startIdx + customPerDay, customDestinations.length);
        const dayCustomDestinations = customDestinations.slice(startIdx, endIdx);
        
        // Thêm vào đầu danh sách với priority cao
        dayCustomDestinations.forEach(customDest => {
            destinations.unshift({
                ...customDest,
                priority: 'high',
                isCustom: true,
                userSelected: true,
                estimatedDuration: `${customDest.duration || 2} giờ`,
                lat: customDest.lat || customDest.coordinates?.lat,
                lng: customDest.lng || customDest.coordinates?.lng
            });
        });
    }
    
    // Tối ưu route NHƯNG giữ nguyên thứ tự các địa điểm có preferredTime
    const withTime = destinations.filter(d => d.preferredTime);
    const withoutTime = destinations.filter(d => !d.preferredTime);
    const optimizedWithoutTime = withoutTime.length > 1 ? optimizeDayRoute(withoutTime) : withoutTime;
    destinations = [...withTime, ...optimizedWithoutTime];
};
```

#### c. Hàm `generateEnhancedHourlySchedule`
```javascript
// Xử lý từng destination
destinations.forEach((dest, index) => {
    // ✨ Ưu tiên preferredTime nếu có
    const activityTime = dest.preferredTime || currentTime;
    
    schedule.push({
        time: activityTime,
        activity: `${dest.categoryIcon || '📍'} Tham quan ${dest.name}`,
        type: 'sightseeing',
        duration: dest.estimatedDuration || dest.duration ? `${dest.duration} giờ` : '1-2 giờ',
        location: dest,
        notes: dest.isCustom ? [
            '✨ Địa điểm bạn chọn', 
            'Ưu tiên cao',
            dest.preferredTime ? `⏰ Khung giờ yêu cầu: ${dest.preferredTime}` : ''
        ].filter(Boolean) : [],
        isCustom: dest.isCustom || false,
        priority: dest.priority || 'normal',
        preferredTime: dest.preferredTime,
        realData: true
    });
    
    // Chỉ tính currentTime nếu không có preferredTime
    if (!dest.preferredTime) {
        currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
    } else {
        // Nếu có preferredTime, cập nhật currentTime sau hoạt động này
        currentTime = calculateNextTime(activityTime, dest.estimatedDuration || '1.5 giờ');
    }
});

// Sắp xếp lại theo thời gian
return schedule.sort((a, b) => a.time.localeCompare(b.time));
```

### 3. `src/services/customDestinationService.js`
Service đã có sẵn các hàm:
- `saveCustomDestination(destination, userId)` - Lưu địa điểm
- `getUserCustomDestinations(userId, city)` - Lấy địa điểm đã lưu
- `insertCustomDestinationsIntoSchedule(schedule, customDestinations)` - Insert vào schedule

## 📊 Cấu trúc Dữ liệu

### Custom Destination Object
```javascript
{
    id: 'custom_1234567890',
    place_id: 'custom_1234567890',
    name: 'Nhà hàng ABC',
    address: '123 Đường XYZ',
    coordinates: { lat: 10.123, lng: 106.456 },
    category: 'restaurant',
    categoryName: 'Nhà hàng',
    categoryIcon: '🍽️',
    preferredTime: '12:00',      // ✨ Khung giờ yêu cầu
    duration: '2',                // ✨ Thời gian tham quan (giờ)
    isCustom: true,
    priority: 'high',             // ✨ Ưu tiên cao
    userSelected: true,           // ✨ Người dùng chọn
    price: 100000,
    priceLevel: 2,
    city: 'Vũng Tàu'
}
```

### Firestore Document
```javascript
{
    userId: 'user123',
    name: 'Nhà hàng ABC',
    address: '123 Đường XYZ',
    coordinates: { lat: 10.123, lng: 106.456 },
    category: 'restaurant',
    city: 'Vũng Tàu',
    rating: 0,
    visitCount: 1,
    createdAt: Timestamp,
    lastVisited: Timestamp
}
```

## 🎯 Luồng hoạt động

1. **Người dùng thêm địa điểm tùy chỉnh**
   - Nhập tên, địa chỉ, loại, giá, khung giờ, thời gian
   - Click "Thêm địa điểm"

2. **Hệ thống xử lý**
   - Lưu vào Firestore (nếu đã đăng nhập)
   - Thêm vào `selectedDestinations` với priority cao
   - Hiển thị toast thông báo

3. **Tạo lịch trình**
   - Custom destinations được truyền qua `preferences.customDestinations`
   - Phân bổ đều qua các ngày
   - Thêm vào đầu danh sách destinations mỗi ngày

4. **Tạo schedule theo giờ**
   - Nếu có `preferredTime`: Đưa vào đúng khung giờ đó
   - Nếu không có: Sắp xếp tự động
   - Hiển thị với icon ✨ và note "Địa điểm bạn chọn"

5. **Hiển thị trong lịch trình**
   - Có badge "Tùy chỉnh"
   - Có note "⏰ Khung giờ yêu cầu: HH:MM" (nếu có)
   - Có note "✨ Địa điểm bạn chọn"
   - Có note "Ưu tiên cao"

## 🔍 Ví dụ

### Input
```javascript
customDestination = {
    name: 'Chùa Núi Bà',
    address: 'Núi Bà, Vũng Tàu',
    type: 'temple',
    preferredTime: '09:00',
    duration: '2',
    price: '0'
}
```

### Output trong Schedule
```javascript
{
    time: '09:00',                    // ✨ Đúng khung giờ yêu cầu
    activity: '🏯 Tham quan Chùa Núi Bà',
    type: 'sightseeing',
    duration: '2 giờ',
    location: { name: 'Chùa Núi Bà', ... },
    notes: [
        '✨ Địa điểm bạn chọn',
        'Ưu tiên cao',
        '⏰ Khung giờ yêu cầu: 09:00'
    ],
    isCustom: true,
    priority: 'high',
    preferredTime: '09:00',
    realData: true
}
```

## ✅ Lợi ích

1. **Cá nhân hóa cao**: Người dùng tự chọn địa điểm yêu thích
2. **Linh hoạt thời gian**: Chọn đúng khung giờ mong muốn
3. **Tái sử dụng**: Địa điểm được lưu để dùng lại
4. **Ưu tiên rõ ràng**: Địa điểm tùy chỉnh luôn được ưu tiên
5. **Trải nghiệm tốt**: Lịch trình phù hợp với mong muốn cá nhân

## 🚀 Cách sử dụng

1. Vào trang **Tạo lịch trình**
2. Điền thông tin cơ bản
3. Click **"Tiếp theo: Chọn địa điểm"**
4. Click **"Thêm địa điểm tùy chỉnh"**
5. Điền thông tin:
   - Tên địa điểm (bắt buộc)
   - Địa chỉ (tùy chọn, có autocomplete)
   - Loại địa điểm
   - Giá (tùy chọn)
   - **Khung giờ mong muốn** (tùy chọn)
   - **Thời gian tham quan** (mặc định 2 giờ)
6. Click **"Thêm địa điểm"**
7. Địa điểm sẽ được:
   - Lưu vào database (nếu đã đăng nhập)
   - Thêm vào danh sách đã chọn
   - Hiển thị với badge "Tùy chỉnh"
8. Click **"Tiếp tục"** để tạo lịch trình
9. Lịch trình sẽ có địa điểm tùy chỉnh với:
   - Đúng khung giờ đã chọn
   - Icon ✨ và note đặc biệt
   - Ưu tiên cao trong danh sách

## 📝 Lưu ý

- Nếu chưa đăng nhập, địa điểm vẫn được thêm vào lịch trình nhưng không lưu vào database
- Nếu nhiều địa điểm có cùng preferredTime, hệ thống sẽ tự động điều chỉnh
- Địa điểm tùy chỉnh được phân bổ đều qua các ngày trong chuyến đi
- Có thể thêm nhiều địa điểm tùy chỉnh cho một chuyến đi

## 🎉 Hoàn thành!

Hệ thống đã sẵn sàng để:
- ✅ Lưu địa điểm tùy chỉnh vào database
- ✅ Đưa địa điểm vào lịch trình với đúng khung giờ
- ✅ Ưu tiên địa điểm tùy chỉnh
- ✅ Hiển thị rõ ràng trong lịch trình
