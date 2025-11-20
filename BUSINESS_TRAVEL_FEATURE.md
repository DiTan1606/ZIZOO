# Tính năng Công tác + Du lịch

## Tổng quan

Hệ thống đã được tách riêng thành **2 luồng độc lập**:

1. **Du lịch thuần** (Pure Travel) - Logic cũ, KHÔNG ĐƯỢC SỬA
2. **Công tác + Du lịch** (Business Travel) - Logic mới, hoàn toàn riêng biệt

## Cách hoạt động

### 1. Du lịch thuần (Pure Travel)
- Gợi ý lịch trình **cả ngày** từ sáng đến tối
- Không bị giới hạn bởi giờ làm việc
- Sử dụng logic cũ trong `completeItineraryService.js`

### 2. Công tác + Du lịch (Business Travel)

#### Ngày làm việc (Working Day)
- Chỉ gợi ý **TRƯỚC** và **SAU** giờ làm việc
- **KHÔNG** gợi ý trong khung giờ làm việc
- Hiển thị block "💼 Làm việc" trong lịch trình
- Visual indicator: background màu tím nhạt, border tím

#### Ngày không làm việc (Non-Working Day)
- Gợi ý **như du lịch thuần**
- Không bị giới hạn thời gian
- Tận hưởng cả ngày

## Cấu trúc code

### 1. Service mới: `businessTravelScheduleService.js`

```javascript
// Kiểm tra ngày làm việc
isWorkingDay(dateString, workingLocations)

// Lấy thông tin làm việc
getWorkingInfoForDay(dateString, workingLocations)

// Tạo lịch trình ngày làm việc
generateWorkingDaySchedule(...)

// Tạo lịch trình ngày không làm việc
generateNonWorkingDaySchedule(...)

// Tạo lịch trình tự động (phân biệt working/non-working)
generateBusinessTravelDaySchedule(...)
```

### 2. Tích hợp vào `completeItineraryService.js`

```javascript
const generateEnhancedHourlySchedule = (..., workingLocations = [], date = new Date()) => {
    // Nếu có working locations, dùng business travel service
    if (workingLocations && workingLocations.length > 0) {
        const businessTravelService = require('./businessTravelScheduleService').default;
        const result = businessTravelService.generateBusinessTravelDaySchedule(...);
        return result.schedule;
    }
    
    // Nếu không, dùng logic du lịch thuần (KHÔNG SỬA)
    // ... logic cũ ...
}
```

### 3. UI Component: `CompleteItineraryPlanner.js`

#### Working Location Form
- Người dùng chọn ngày làm việc
- Nhập địa điểm, giờ làm việc
- Có thể chọn "Tất cả các ngày" hoặc chọn ngày cụ thể

#### Visual Indicators
- **Day Header**: Background tím nhạt + badge "💼 Ngày làm việc"
- **Work Block**: Border tím + background gradient + icon 💼
- **Schedule Item**: Highlight cho các hoạt động trong giờ làm

## Ví dụ sử dụng

### Tạo chuyến công tác 5 ngày

```javascript
const preferences = {
    tripType: 'business-travel',
    destination: 'Đà Nẵng',
    startDate: '2024-01-15',
    duration: 5,
    workingLocations: [
        {
            name: 'Văn phòng Đà Nẵng',
            address: '123 Đường ABC',
            startTime: '08:00',
            endTime: '17:00',
            isAllDays: false,
            workingDays: ['2024-01-15', '2024-01-16', '2024-01-17'] // 3 ngày làm
        }
    ]
};
```

### Kết quả

**Ngày 1-3 (Làm việc)**:
- 06:00 - 08:00: Ăn sáng, tham quan nhanh
- 08:00 - 17:00: 💼 Làm việc (KHÔNG gợi ý du lịch)
- 17:00 - 22:00: Ăn tối, tham quan tối, tự do

**Ngày 4-5 (Không làm việc)**:
- 07:00 - 22:00: Gợi ý như du lịch thuần (cả ngày)

## Lưu ý quan trọng

### ⚠️ KHÔNG ĐƯỢC SỬA
- Logic du lịch thuần trong `generateEnhancedHourlySchedule` (phần sau `if (workingLocations)`)
- Các hàm helper cũ: `generateHourlySchedule`, `findRealDestinationsForDay`, etc.

### ✅ CÓ THỂ SỬA
- File `businessTravelScheduleService.js` (logic mới)
- Phần tích hợp trong `generateEnhancedHourlySchedule` (phần `if (workingLocations)`)
- UI components cho business travel

## Testing

### Test Case 1: Du lịch thuần
```javascript
{
    tripType: 'pure-travel',
    workingLocations: [] // Không có working locations
}
// Expected: Gợi ý cả ngày, không bị giới hạn
```

### Test Case 2: Công tác + Du lịch (Ngày làm)
```javascript
{
    tripType: 'business-travel',
    workingLocations: [{
        startTime: '08:00',
        endTime: '17:00',
        workingDays: ['2024-01-15']
    }]
}
// Expected: Chỉ gợi ý trước 08:00 và sau 17:00
```

### Test Case 3: Công tác + Du lịch (Ngày không làm)
```javascript
{
    tripType: 'business-travel',
    workingLocations: [{
        workingDays: ['2024-01-15'] // Không bao gồm ngày 16
    }]
}
// Expected: Ngày 16 gợi ý như du lịch thuần
```

## Roadmap

### Phase 1 (Hoàn thành) ✅
- Tách riêng logic business travel
- Tích hợp vào service chính
- UI indicators cho working day

### Phase 2 (Tương lai)
- Tự động tìm địa điểm gần nơi làm việc
- Gợi ý nhà hàng gần văn phòng cho bữa trưa
- Tối ưu route dựa trên vị trí văn phòng

### Phase 3 (Tương lai)
- Sync với Google Calendar
- Nhắc nhở trước giờ làm
- Export lịch trình công tác

## Tác giả

- Tạo bởi: Kiro AI Assistant
- Ngày: 2024
- Version: 1.0.0
