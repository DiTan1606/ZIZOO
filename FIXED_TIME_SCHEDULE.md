# Cải Tiến Logic Lập Lịch Trình - Thời Gian Cố Định & Custom Destinations

## 📋 Tổng Quan

Đã cập nhật logic lập lịch trình với các cải tiến:

1. **Thời gian cố định** cho các hoạt động chính
2. **Xử lý địa điểm custom** với ưu tiên cao
3. **Lưu địa điểm vào database** để làm phong phú dữ liệu
4. **Xử lý giờ sớm hơn** giờ bắt đầu hành trình

---

## ⏰ Thời Gian Cố Định

### Ngày 1 (Ngày đầu tiên)

```javascript
// Giờ bắt đầu hành trình = startTime (từ UI)
currentTime = startTime; // VD: 08:00

// Logic:
if (startTime → 12:30 > 1h) {
    // Thêm hoạt động trước check-in
    - Ăn sáng (nếu < 10:00): startTime
    - Tham quan 1-2 địa điểm
}

// Thời gian CỐ ĐỊNH:
- Check-in khách sạn: 12:30 (cố định)
- Ăn trưa: 13:00 (cố định)
- Tham quan buổi chiều: 14:00 trở đi
- Ăn tối: 19:00 (cố định)
```

### Ngày 2+ (Các ngày tiếp theo)

```javascript
// Thời gian CỐ ĐỊNH:
- Ăn sáng: 07:00 (cố định)
- Tham quan buổi sáng: 08:00 - 11:00
- Ăn trưa: 11:00 (cố định)
- Tham quan buổi chiều: 12:00 - 19:00
- Ăn tối: 19:00 (cố định)
- Hoạt động tối: 20:30 trở đi
```

---

## ✨ Xử Lý Địa Điểm Custom

### 1. Ưu Tiên Cao

Địa điểm custom từ `DestinationSelector` được:
- ✅ **Ưu tiên cao**: Bắt buộc phải có trong lịch trình
- ✅ **Xếp theo khung giờ**: Nếu có `preferredTime`
- ✅ **Phân loại theo type**: Tự động phân loại hoạt động
- ✅ **Lưu vào database**: Để làm phong phú dữ liệu

### 2. Logic Xử Lý

```javascript
// Trong generateSingleDayPlan:

if (customDestinations && customDestinations.length > 0) {
    // Lọc custom destinations cho ngày này
    const customForThisDay = customDestinations.filter(dest => {
        // Nếu giờ sớm hơn giờ bắt đầu → chuyển sang ngày sau
        if (dest.preferredTime) {
            const [prefHour] = dest.preferredTime.split(':').map(Number);
            
            if (dayNumber === 1 && prefHour < parseInt(departureTime.split(':')[0])) {
                return dayNumber === 2; // Chuyển sang ngày 2
            }
        }
        
        // Phân bổ đều cho các ngày
        const destIndex = customDestinations.indexOf(dest);
        const assignedDay = (destIndex % duration) + 1;
        return assignedDay === dayNumber;
    });
    
    // Thêm vào đầu danh sách với ưu tiên cao
    customForThisDay.forEach(customDest => {
        // Lưu vào database
        saveCustomDestinationToDatabase(customDest, userId, destination);
        
        // Thêm vào destinations
        destinations.unshift({
            ...customDest,
            isCustom: true,
            priority: 'high',
            userSelected: true,
            notes: ['✨ Địa điểm bạn chọn', 'Ưu tiên cao']
        });
    });
}
```

### 3. Xử Lý Giờ Sớm Hơn

```javascript
// Ví dụ:
// - Giờ bắt đầu hành trình: 10:00
// - Địa điểm custom có preferredTime: 08:00

// Logic:
if (preferredTime < startTime && dayNumber === 1) {
    // Chuyển địa điểm này sang ngày 2
    assignedDay = 2;
}
```

---

## 💾 Lưu Vào Database

### Hàm `saveCustomDestinationToDatabase`

```javascript
const saveCustomDestinationToDatabase = async (customDest, userId, city) => {
    const destData = {
        name: customDest.name,
        address: customDest.address || '',
        coordinates: customDest.coordinates || null,
        category: customDest.category || customDest.type,
        city: city,
        type: customDest.type || 'tourist_attraction',
        price: customDest.price || null,
        duration: customDest.duration || 2,
        preferredTime: customDest.preferredTime || null
    };
    
    const result = await saveCustomDestination(destData, userId);
    return result;
};
```

### Lợi Ích

1. **Làm phong phú dữ liệu**: Địa điểm custom được lưu lại
2. **Gợi ý cho người khác**: Người dùng khác có thể thấy địa điểm này
3. **Cải thiện chất lượng**: Địa điểm được đánh giá và xếp hạng
4. **Tăng độ đa dạng**: Nhiều địa điểm hơn cho cùng một thành phố

---

## 🗺️ Tối Ưu Route

### Logic Mới

```javascript
// Tách destinations có preferredTime và không có
const withTime = destinations.filter(d => d.preferredTime);
const withoutTime = destinations.filter(d => !d.preferredTime);

// Optimize route cho destinations không có preferredTime
const optimizedWithoutTime = optimizeDayRoute(withoutTime);

// Merge lại: giữ destinations có preferredTime ở đúng vị trí
destinations = [...withTime, ...optimizedWithoutTime].sort((a, b) => {
    if (a.preferredTime && b.preferredTime) {
        return a.preferredTime.localeCompare(b.preferredTime);
    }
    if (a.preferredTime) return -1;
    if (b.preferredTime) return 1;
    return 0;
});
```

### Ưu Điểm

- ✅ Giữ địa điểm có `preferredTime` ở đúng khung giờ
- ✅ Tối ưu route cho các địa điểm còn lại
- ✅ Giảm thời gian di chuyển
- ✅ Tăng trải nghiệm người dùng

---

## 📊 Ví Dụ Thực Tế

### Scenario 1: Ngày 1 - Bắt đầu 08:00

```
08:00 - 🍳 Ăn sáng tại Phở Hà Nội
08:45 - 📍 Tham quan Chùa Linh Ứng (Custom - Ưu tiên cao)
10:30 - 📍 Tham quan Bà Nà Hills
12:30 - 🏨 Check-in khách sạn (CỐ ĐỊNH)
13:00 - 🍽️ Ăn trưa tại Nhà hàng Hải Sản (CỐ ĐỊNH)
14:00 - 📍 Tham quan Cầu Vàng
16:00 - 📍 Tham quan Bãi biển Mỹ Khê (Custom - Ưu tiên cao)
19:00 - 🍽️ Ăn tối tại Nhà hàng Đặc Sản (CỐ ĐỊNH)
20:30 - 🌃 Khám phá cuộc sống đêm
```

### Scenario 2: Custom Destination với giờ sớm

```
User input:
- Địa điểm: Chợ Hàn
- Khung giờ: 06:00
- Giờ bắt đầu hành trình: 10:00

Logic:
- 06:00 < 10:00 → Chuyển sang ngày 2
- Ngày 2: 06:00 - Tham quan Chợ Hàn
```

---

## 🔧 Files Đã Cập Nhật

### 1. `src/services/completeItineraryService.js`

**Thay đổi:**
- ✅ Cập nhật `generateEnhancedHourlySchedule` với thời gian cố định
- ✅ Thêm logic xử lý custom destinations
- ✅ Thêm hàm `saveCustomDestinationToDatabase`
- ✅ Cập nhật `generateDailyItinerary` nhận `userId` parameter
- ✅ Cập nhật `generateSingleDayPlan` nhận `userId` và `customDestinations`
- ✅ Cải thiện route optimization

**Thời gian cố định:**
```javascript
// Ngày 1
- Check-in: 12:30
- Ăn trưa: 13:00
- Ăn tối: 19:00

// Ngày 2+
- Ăn sáng: 07:00
- Ăn trưa: 11:00
- Ăn tối: 19:00
```

### 2. `src/services/customDestinationService.js`

**Đã có sẵn:**
- ✅ `saveCustomDestination`: Lưu địa điểm vào Firestore
- ✅ `getUserCustomDestinations`: Lấy địa điểm của user
- ✅ `insertCustomDestinationsIntoSchedule`: Insert vào lịch trình

---

## 🎯 Kết Quả

### Trước Khi Cập Nhật

```
❌ Thời gian không cố định, khó dự đoán
❌ Địa điểm custom không được ưu tiên
❌ Không lưu địa điểm vào database
❌ Giờ sớm hơn không được xử lý
```

### Sau Khi Cập Nhật

```
✅ Thời gian cố định: 7:00, 11:00, 12:30, 19:00
✅ Địa điểm custom ưu tiên cao, bắt buộc có
✅ Lưu vào database để làm phong phú dữ liệu
✅ Xử lý giờ sớm hơn → chuyển sang ngày sau
✅ Tối ưu route giữ địa điểm có preferredTime
```

---

## 🚀 Cách Sử Dụng

### 1. Từ UI (CompleteItineraryPlanner)

```javascript
const preferences = {
    destination: 'Đà Nẵng',
    startDate: '2024-12-01',
    duration: 3,
    travelers: 2,
    budget: 5000000,
    startTime: '08:00', // Giờ bắt đầu hành trình
    customDestinations: [
        {
            name: 'Chùa Linh Ứng',
            address: 'Bán đảo Sơn Trà',
            preferredTime: '09:00',
            duration: 2,
            type: 'temple',
            price: 0,
            coordinates: { lat: 16.1, lng: 108.3 }
        }
    ]
};

const itinerary = await createCompleteItinerary(preferences, userId);
```

### 2. Kết Quả

```javascript
{
    dailyItinerary: [
        {
            day: 1,
            schedule: [
                {
                    time: '08:00',
                    activity: '🍳 Ăn sáng...',
                    isFixed: true
                },
                {
                    time: '09:00',
                    activity: '📍 Tham quan Chùa Linh Ứng',
                    isCustom: true,
                    priority: 'high',
                    notes: ['✨ Địa điểm bạn chọn', 'Ưu tiên cao']
                },
                {
                    time: '12:30',
                    activity: '🏨 Check-in khách sạn',
                    isFixed: true
                },
                {
                    time: '19:00',
                    activity: '🍽️ Ăn tối...',
                    isFixed: true
                }
            ]
        }
    ]
}
```

---

## 📝 Lưu Ý

1. **Thời gian cố định** không thể thay đổi (có flag `isFixed: true`)
2. **Địa điểm custom** luôn được ưu tiên cao
3. **Giờ sớm hơn** giờ bắt đầu sẽ tự động chuyển sang ngày sau
4. **Database** tự động lưu địa điểm custom để làm phong phú dữ liệu
5. **Route optimization** vẫn hoạt động nhưng giữ địa điểm có `preferredTime`

---

## ✅ Hoàn Thành

Đã cập nhật thành công logic lập lịch trình với:
- ⏰ Thời gian cố định cho các hoạt động chính
- ✨ Xử lý địa điểm custom với ưu tiên cao
- 💾 Lưu vào database để làm phong phú dữ liệu
- 🔄 Xử lý giờ sớm hơn giờ bắt đầu hành trình
- 🗺️ Tối ưu route giữ địa điểm có preferredTime
