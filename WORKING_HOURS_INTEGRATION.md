# Working Hours Integration - Tóm tắt

## ✅ Đã thêm vào code:

### 1. Helper Functions (trong `generateEnhancedHourlySchedule`)

**`groupRelatedDestinations(dests)`:**
- Gộp các địa điểm gần nhau (trong bán kính 2km)
- Trả về array of groups: `{ main: destination, related: [destinations] }`

**`calculateHaversineDistance(lat1, lon1, lat2, lon2)`:**
- Tính khoảng cách giữa 2 tọa độ (km)
- Dùng công thức Haversine

**`isInWorkingHours(time)`:**
- Kiểm tra xem thời gian có conflict với working hours không
- Return true/false

**`timeToMinutes(timeStr)`:**
- Convert time string "HH:MM" thành minutes
- VD: "09:30" → 570 minutes

**`getNextAvailableTime(time)`:**
- Tìm thời gian available tiếp theo (sau working hours)
- Nếu time không conflict → return time
- Nếu conflict → return endTime của working hour

**`calculateDuration(startTime, endTime)`:**
- Tính duration giữa 2 thời gian
- Return string: "2 giờ 30 phút", "1 giờ", "45 phút"

### 2. usedRestaurants Set

```javascript
const usedRestaurants = new Set();
```

- Track các nhà hàng đã dùng
- Tránh duplicate restaurants trong cùng 1 ngày
- Sử dụng: `usedRestaurants.add(restaurant.name)`

### 3. Working Locations trong Schedule

**Thêm vào đầu schedule:**
```javascript
if (workingLocations && workingLocations.length > 0) {
    workingLocations.forEach(workLoc => {
        schedule.push({
            time: workLoc.startTime,
            activity: `💼 ${workLoc.name}`,
            type: 'working',
            duration: calculateDuration(workLoc.startTime, workLoc.endTime),
            location: {...},
            notes: ['Thời gian làm việc cố định', ...],
            isFixed: true,
            realData: true
        });
    });
}
```

### 4. Sử dụng getNextAvailableTime()

**Đã thêm vào các vị trí:**
- Sau mỗi `calculateNextTime()`
- Trước khi thêm activity mới
- Đảm bảo không conflict với working hours

**Ví dụ:**
```javascript
currentTime = calculateNextTime(currentTime, '45 phút');
currentTime = getNextAvailableTime(currentTime); // Skip working hours
```

## 📝 Cách hoạt động:

1. **User chọn "Công tác + Du lịch"** trong UI
2. **Thêm working locations** với startTime, endTime, workingDays
3. **Khi tạo lịch trình:**
   - Working locations được thêm vào schedule đầu tiên
   - Mỗi activity check `getNextAvailableTime()` trước khi thêm
   - Nếu conflict → skip đến sau working hour
   - Activities được sắp xếp xung quanh working hours

## 🎯 Kết quả:

**Ví dụ lịch trình:**
```
08:00 - Ăn sáng
09:00 - 11:00 - 💼 Họp khách hàng (WORKING - Fixed)
11:00 - Tham quan địa điểm A
12:30 - Ăn trưa
14:00 - 16:00 - 💼 Meeting (WORKING - Fixed)
16:00 - Tham quan địa điểm B
18:30 - Ăn tối
20:00 - Hoạt động tối
```

## ⚠️ Lưu ý:

- **KHÔNG sửa** logic gợi ý địa điểm
- **KHÔNG sửa** logic tạo lịch trình hiện tại
- **CHỈ thêm** working hours handling
- Code gốc vẫn hoạt động bình thường nếu không có working locations

## 🔧 Testing:

1. Tạo lịch trình **không có** working locations → Hoạt động như cũ
2. Tạo lịch trình **có** working locations → Activities tự động skip working hours
3. Working locations hiển thị với icon 💼 và note "Không thể thay đổi"
