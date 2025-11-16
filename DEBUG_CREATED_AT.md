# Debug "Tạo lúc: N/A" Issue

## Các thay đổi đã thực hiện:

### 1. Sửa hàm `sanitizeForFirebase()` trong `completeItineraryService.js`

**Vấn đề**: Hàm này đang convert Date object thành plain object, khiến Firebase không nhận diện được.

**Trước:**
```javascript
const sanitizeForFirebase = (obj) => {
    // ...
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Date object bị convert thành {...}
            sanitized[key] = sanitizeForFirebase(value);
        }
        return sanitized;
    }
    // ...
};
```

**Sau:**
```javascript
const sanitizeForFirebase = (obj) => {
    // ...
    // Giữ nguyên Date object để Firebase tự convert thành Timestamp
    if (obj instanceof Date) {
        return obj;
    }
    
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeForFirebase(value);
        }
        return sanitized;
    }
    // ...
};
```

### 2. Sửa cách hiển thị trong `MyTrips.js`

**Trước:**
```javascript
<div>Tạo lúc: {formatDate(trip.createdAt?.toDate?.() || trip.createdAt)}</div>
```

**Sau:**
```javascript
<div>Tạo lúc: {formatDate(trip.createdAt)}</div>
```

**Lý do**: Hàm `formatDate()` đã có logic xử lý Timestamp rồi, không cần gọi `.toDate()` trước.

### 3. Thêm logging để debug

**Trong `getUserItineraries()`:**
```javascript
console.log('📅 Trip createdAt:', data.createdAt, 'Type:', typeof data.createdAt, 'Has toDate:', !!data.createdAt?.toDate);
```

**Trong `formatDate()`:**
```javascript
console.log('📅 formatDate input:', dateInput, 'Type:', typeof dateInput, 'Has toDate:', !!dateInput?.toDate);
```

## Cách kiểm tra:

### Bước 1: Tạo lịch trình mới

1. Vào trang **Complete Itinerary Planner**
2. Tạo một lịch trình mới
3. Mở Console (F12)

### Bước 2: Kiểm tra console logs

Khi lưu lịch trình, bạn sẽ thấy:
```
💾 Saving sanitized itinerary to Firebase...
✅ Lịch trình đã lưu với ID: abc123
```

### Bước 3: Vào trang My Trips

Mở Console và xem logs:

**Nếu thành công:**
```
📅 Trip createdAt: Timestamp { seconds: 1702627200, nanoseconds: 0 } Type: object Has toDate: true
📅 formatDate input: Timestamp { ... } Type: object Has toDate: true
✅ Using Firestore Timestamp.toDate()
✅ Formatted date: 15/12/2024
```

**Nếu vẫn lỗi:**
```
📅 Trip createdAt: undefined Type: undefined Has toDate: false
⚠️ formatDate: dateInput is null/undefined
```

## Các trường hợp có thể xảy ra:

### Case 1: `createdAt` là `undefined`

**Nguyên nhân**: Lịch trình cũ không có field `createdAt`

**Giải pháp**: 
```javascript
// Trong getUserItineraries, thêm fallback:
createdAt: data.createdAt || data.lastUpdated || new Date()
```

### Case 2: `createdAt` là plain object `{}`

**Nguyên nhân**: Hàm `sanitizeForFirebase` đã convert Date thành object

**Giải pháp**: ✅ Đã sửa ở trên (thêm check `instanceof Date`)

### Case 3: `createdAt` là string

**Nguyên nhân**: Lưu nhầm dạng string thay vì Date

**Giải pháp**: Hàm `formatDate()` đã xử lý case này:
```javascript
else {
    date = new Date(dateInput); // Parse string
}
```

## Nếu vẫn còn lỗi:

### Kiểm tra dữ liệu trong Firebase Console:

1. Vào Firebase Console
2. Mở Firestore Database
3. Vào collection `complete_itineraries`
4. Chọn một document
5. Kiểm tra field `createdAt`:
   - ✅ **Đúng**: `timestamp` (December 15, 2024 at 10:30:00 AM UTC+7)
   - ❌ **Sai**: `string` ("2024-12-15") hoặc `map` ({...})

### Nếu dữ liệu sai trong Firebase:

**Cách 1: Xóa và tạo lại lịch trình**

**Cách 2: Sửa thủ công trong Firebase Console**
- Click vào field `createdAt`
- Chọn type: `timestamp`
- Nhập giá trị: `now` hoặc chọn ngày cụ thể

**Cách 3: Migration script** (nếu có nhiều documents):
```javascript
// Chạy trong Firebase Console hoặc Cloud Functions
const batch = db.batch();
const snapshot = await db.collection('complete_itineraries').get();

snapshot.docs.forEach(doc => {
    if (!doc.data().createdAt || typeof doc.data().createdAt !== 'object') {
        batch.update(doc.ref, {
            createdAt: new Date() // Hoặc doc.data().lastUpdated
        });
    }
});

await batch.commit();
```

## Sau khi sửa:

1. Xóa tất cả console.log (hoặc giữ lại để debug sau)
2. Test lại với lịch trình mới
3. Kiểm tra "Tạo lúc" hiển thị đúng

## Expected result:

```
Tạo lúc: 15/12/2024  ✅
```

Thay vì:

```
Tạo lúc: N/A  ❌
```
