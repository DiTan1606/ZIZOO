# Fix Invalid Date Issue

## Vấn đề:

Khi hiển thị lịch trình trong MyTrips, ngày tháng bị hiển thị là **"Invalid Date"** do:

1. **Format không nhất quán**: 
   - Lưu vào Firebase: `startDate: "15/12/2024"` (format vi-VN)
   - Đọc ra và parse: `new Date("15/12/2024")` → **Invalid Date** ❌

2. **Firestore Timestamp không được xử lý đúng**:
   - `createdAt` là Firestore Timestamp object
   - Cần gọi `.toDate()` để convert sang Date object

## Giải pháp đã áp dụng:

### 1. Sửa hàm `formatDate()` trong `src/pages/MyTrips.js`

**Trước:**
```javascript
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
};
```

**Sau:**
```javascript
const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    
    try {
        let date;
        
        // Xử lý Firestore Timestamp
        if (dateInput.toDate && typeof dateInput.toDate === 'function') {
            date = dateInput.toDate();
        }
        // Xử lý Date object
        else if (dateInput instanceof Date) {
            date = dateInput;
        }
        // Xử lý string hoặc number
        else {
            date = new Date(dateInput);
        }
        
        // Kiểm tra date hợp lệ
        if (isNaN(date.getTime())) {
            console.warn('Invalid date:', dateInput);
            return 'N/A';
        }
        
        return date.toLocaleDateString('vi-VN');
    } catch (error) {
        console.error('Error formatting date:', error, dateInput);
        return 'N/A';
    }
};
```

### 2. Sửa hàm `formatDate()` trong `src/pages/UserProfile.js`

Áp dụng cùng logic như trên.

### 3. Sửa `getUserItineraries()` trong `src/services/completeItineraryService.js`

**Trước:**
```javascript
startDate: data.header?.duration?.startDate, // "15/12/2024" - format vi-VN
```

**Sau:**
```javascript
startDate: data.header?.duration?.startDateISO || data.header?.duration?.startDate, 
// Ưu tiên ISO format: "2024-12-15T00:00:00.000Z"
```

## Cách hoạt động:

### Ví dụ 1: Xử lý startDate

```javascript
// Dữ liệu trong Firebase:
{
  header: {
    duration: {
      startDate: "15/12/2024",        // Format vi-VN (không parse được)
      startDateISO: "2024-12-15T00:00:00.000Z"  // ISO format (parse được)
    }
  }
}

// Code mới:
startDate: data.header?.duration?.startDateISO  // ✅ Lấy ISO format
// → new Date("2024-12-15T00:00:00.000Z") → Valid Date ✅
```

### Ví dụ 2: Xử lý createdAt (Firestore Timestamp)

```javascript
// Dữ liệu từ Firebase:
createdAt: Timestamp { seconds: 1702627200, nanoseconds: 0 }

// Code mới:
formatDate(trip.createdAt)
// → Phát hiện có method .toDate()
// → Gọi trip.createdAt.toDate()
// → Trả về Date object
// → Format thành "15/12/2024" ✅
```

### Ví dụ 3: Xử lý Date object

```javascript
// Dữ liệu:
startDate: new Date("2024-12-15")

// Code mới:
formatDate(trip.startDate)
// → Phát hiện là Date object
// → Kiểm tra valid
// → Format thành "15/12/2024" ✅
```

## Các trường hợp được xử lý:

✅ **Firestore Timestamp**: `{ seconds: ..., nanoseconds: ... }`
✅ **Date object**: `new Date(...)`
✅ **ISO string**: `"2024-12-15T00:00:00.000Z"`
✅ **Timestamp number**: `1702627200000`
✅ **Invalid date**: Trả về "N/A" thay vì crash

## Test:

1. Tạo lịch trình mới
2. Vào trang **My Trips**
3. Kiểm tra:
   - ✅ "Bắt đầu: 15/12/2024" (không còn Invalid Date)
   - ✅ "Tạo lúc: 15/12/2024 10:30" (không còn Invalid Date)

## Lưu ý:

- Luôn lưu **cả 2 format** trong Firebase:
  - `startDate`: Format vi-VN cho hiển thị trực tiếp
  - `startDateISO`: ISO format cho parse và tính toán
  
- Hàm `formatDate()` giờ đây **an toàn** với mọi loại input
- Có error handling và logging để debug dễ dàng
