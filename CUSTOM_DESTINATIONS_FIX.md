# Fix: Custom Destinations không xuất hiện trong lịch trình

## Vấn đề
- Địa điểm custom được thêm vào `selectedDestinations`
- Toast hiển thị thành công
- Nhưng không xuất hiện trong lịch trình cuối cùng
- Không được lưu vào database

## Nguyên nhân
File `completeItineraryService.js` đang có merge conflicts và không xử lý `customDestinations` đúng cách.

## Giải pháp

### Bước 1: Resolve merge conflicts trong completeItineraryService.js

```bash
# Xem status
git status

# Nếu có conflicts, chọn giữ version của bạn
git checkout --ours src/services/completeItineraryService.js
git add src/services/completeItineraryService.js

# Hoặc dùng merge tool
git mergetool
```

### Bước 2: Cập nhật hàm generateSingleDayPlan

Trong file `src/services/completeItineraryService.js`, tìm hàm `generateSingleDayPlan` và thêm:

```javascript
const generateSingleDayPlan = async (
    dayNumber, 
    date, 
    destination, 
    coord, 
    interests, 
    travelStyle, 
    dailyBudget = 500000, 
    budget = 5000000, 
    travelers = 2,
    departureTime = '06:30',
    specialActivities = {},
    workingLocations = [],
    customDestinations = [] // ← THÊM DÒNG NÀY
) => {
    // ... existing code ...
    
    // Tạo lịch trình theo giờ
    const hourlySchedule = generateEnhancedHourlySchedule(
        dayNumber, 
        destinations, 
        restaurants, 
        interests,
        departureTime,
        specialActivities,
        workingLocations,
        customDestinations // ← THÊM DÒNG NÀY
    );
    
    // ... rest of code ...
};
```

### Bước 3: Cập nhật hàm generateDailyItinerary

```javascript
const generateDailyItinerary = async (preferences) => {
    const { 
        destination, 
        startDate, 
        duration, 
        interests, 
        travelStyle, 
        budget, 
        travelers,
        departureTime = '06:30',
        specialActivities = {},
        workingLocations = [],
        customDestinations = [] // ← THÊM DÒNG NÀY
    } = preferences;
    
    // ... trong loop ...
    
    for (let day = 0; day < duration; day++) {
        // ... existing code ...
        
        const dayPlan = await generateSingleDayPlan(
            day + 1, 
            currentDate, 
            destination, 
            coord, 
            interests, 
            travelStyle, 
            dailyBudget, 
            budget, 
            travelers,
            departureTime,
            daySpecialActivities,
            dayWorkingLocations,
            customDestinations // ← THÊM DÒNG NÀY
        );
        
        dailyPlans.push(dayPlan);
    }
    
    return dailyPlans;
};
```

### Bước 4: Cập nhật hàm generateEnhancedHourlySchedule

```javascript
const generateEnhancedHourlySchedule = (
    dayNumber, 
    destinations, 
    restaurants, 
    interests,
    departureTime = '06:30',
    specialActivities = {},
    workingLocations = [],
    customDestinations = [] // ← THÊM DÒNG NÀY
) => {
    const schedule = [];
    
    // ... existing helper functions ...
    
    // ✨ THÊM: Insert custom destinations với ưu tiên cao
    if (customDestinations && customDestinations.length > 0) {
        customDestinations.forEach(customDest => {
            if (customDest.preferredTime) {
                schedule.push({
                    time: customDest.preferredTime,
                    activity: `${customDest.categoryIcon || '📍'} ${customDest.name}`,
                    type: customDest.category || 'custom',
                    duration: `${customDest.duration || 2} giờ`,
                    location: {
                        name: customDest.name,
                        address: customDest.address,
                        coordinates: customDest.coordinates,
                        rating: customDest.rating
                    },
                    isCustom: true,
                    priority: 'high',
                    isFixed: true, // Không thể di chuyển
                    notes: ['✨ Địa điểm do bạn chọn', 'Ưu tiên cao'],
                    realData: true
                });
            }
        });
    }
    
    // ... rest of existing code ...
    
    // Cuối hàm, sort lại schedule theo time
    return schedule.sort((a, b) => a.time.localeCompare(b.time));
};
```

### Bước 5: Lưu custom destinations vào database

Trong `CompleteItineraryPlanner.js`, cập nhật hàm `generateItinerary`:

```javascript
import { saveCustomDestination } from '../services/customDestinationService';

const generateItinerary = async () => {
    // ... existing validation ...
    
    setLoading(true);
    try {
        // ✨ Lưu custom destinations vào database trước
        if (preferences.customDestinations && preferences.customDestinations.length > 0) {
            const customDests = preferences.customDestinations.filter(d => d.isCustom);
            
            for (const dest of customDests) {
                await saveCustomDestination({
                    ...dest,
                    city: preferences.destination
                }, currentUser.uid);
            }
            
            console.log(`✅ Đã lưu ${customDests.length} địa điểm custom vào database`);
        }
        
        // Tạo lịch trình
        const itinerary = await createCompleteItinerary(preferences, currentUser.uid);
        
        // ... rest of code ...
    } catch (error) {
        // ... error handling ...
    }
};
```

### Bước 6: Cập nhật thời gian cố định

Trong `generateEnhancedHourlySchedule`, đảm bảo các thời gian cố định:

```javascript
// Ngày 1: Bắt đầu hành trình
if (dayNumber === 1) {
    schedule.push({
        time: departureTime, // ← Dùng startTime từ preferences
        activity: 'Bắt đầu hành trình',
        type: 'transport',
        duration: '30 phút',
        notes: ['Chuẩn bị hành lý', 'Kiểm tra giấy tờ'],
        realData: true
    });
    
    // ✨ THÊM: Activities giữa bắt đầu và nhận phòng (nếu >1h)
    const startMinutes = timeToMinutes(departureTime);
    const checkinMinutes = timeToMinutes('12:30');
    const gapHours = (checkinMinutes - startMinutes) / 60;
    
    if (gapHours > 1) {
        // Thêm 1-2 activities vào giữa
        // ... logic thêm activities ...
    }
    
    schedule.push({
        time: '12:30', // ← Cố định
        activity: 'Nhận phòng khách sạn',
        type: 'accommodation',
        duration: '45 phút',
        notes: ['Check-in', 'Nghỉ ngơi'],
        realData: true
    });
}

// Các ngày khác: Ăn sáng cố định
if (dayNumber > 1 && restaurants.breakfast) {
    schedule.push({
        time: '07:00', // ← Cố định
        activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
        // ...
    });
}

// Ăn trưa cố định
if (restaurants.lunch) {
    schedule.push({
        time: '11:00', // ← Cố định (thay vì 12:00)
        activity: `Ăn trưa tại ${restaurants.lunch.name}`,
        // ...
    });
}

// Ăn tối cố định
if (restaurants.dinner) {
    schedule.push({
        time: '19:00', // ← Cố định
        activity: `Ăn tối tại ${restaurants.dinner.name}`,
        // ...
    });
}
```

## Tóm tắt các thay đổi cần làm:

1. ✅ Đã tạo `customDestinationService.js` - service lưu/lấy custom destinations
2. ⏳ Resolve merge conflicts trong `completeItineraryService.js`
3. ⏳ Thêm `customDestinations` parameter vào các hàm
4. ⏳ Insert custom destinations vào schedule với priority cao
5. ⏳ Cập nhật thời gian cố định cho các bữa ăn
6. ⏳ Thêm logic lưu custom destinations vào database trong `generateItinerary`

Bạn muốn tôi resolve merge conflicts và implement đầy đủ không? Hoặc bạn có thể resolve conflicts trước rồi tôi sẽ thêm logic?
