# Sửa Lỗi Trùng Nhà Hàng Giữa Các Ngày

## Vấn Đề
Khi tạo lịch trình 3 ngày, nhà hàng trưa (1h chiều) ở các ngày khác nhau bị trùng lặp. Ví dụ:
- Ngày 1: Ăn trưa tại nhà hàng A
- Ngày 2: Ăn trưa tại nhà hàng A (TRÙNG!)
- Ngày 3: Ăn trưa tại nhà hàng A (TRÙNG!)

## Nguyên Nhân

### 1. **BUG CHÍNH #1: Thiếu `place_id` trong map()**
```javascript
// ❌ BUG: Không có place_id
.map(place => ({
    name: place.name,
    address: place.vicinity,
    // THIẾU: place_id
}))
```

Khi check `usedRestaurants.has(r.place_id)`, nó luôn trả về `false` vì `r.place_id = undefined`!

### 2. **BUG CHÍNH #2: Ưu tiên `localFood[0]` thay vì `restaurants.lunch`**
```javascript
// ❌ BUG: Luôn chọn localFood[0] (cùng 1 nhà hàng cho tất cả các ngày)
const lunchVenue = (restaurants.localFood && restaurants.localFood.length > 0) 
    ? restaurants.localFood[0]  // ← Luôn chọn phần tử đầu tiên!
    : restaurants.lunch;
```

**Vấn đề:**
- `restaurants.localFood` được tạo MỖI NGÀY từ `findLocalFoodVenues()`
- Hàm này trả về **CÙNG 1 DANH SÁCH** cho tất cả các ngày
- Code luôn chọn `localFood[0]` → **Cùng 1 nhà hàng cho tất cả các ngày!**
- `restaurants.lunch` đã được track đúng trong `findRealRestaurantsForDay()`, nhưng bị bỏ qua!

### 3. Duplicate Restaurants Không Được Loại Bỏ
Danh sách `realRestaurants` từ Google Places API có thể chứa duplicate (cùng tên hoặc place_id). Khi shuffle, các duplicate này vẫn còn trong danh sách.

### 4. Logic Filter Không Đầy Đủ
```javascript
// Code CŨ - Chỉ check usedRestaurants (các ngày trước)
const availableForLunch = shuffledRestaurants.filter(r => {
    if (usedRestaurants.has(r.name)) return false;
    // ...
});
```

**Vấn đề:** Không check nhà hàng đã dùng **trong cùng ngày** (breakfast, lunch, dinner).

### 3. Không Track place_id
Code chỉ track `r.name` nhưng không track `r.place_id`, dẫn đến có thể chọn cùng nhà hàng với tên khác nhau.

### 4. Shuffle Chỉ 1 Lần
```javascript
// Shuffle 1 lần cho cả 3 ngày
const shuffledRestaurants = [...realRestaurants].sort(() => 0.5 - Math.random());
```

Nếu có ít nhà hàng (5-10), sau 2-3 ngày sẽ hết nhà hàng mới.

## Giải Pháp

### 1. **SỬA BUG CHÍNH: Thêm place_id vào map()**
```javascript
// ✅ FIX: Thêm place_id
.map(place => ({
    name: place.name,
    place_id: place.place_id, // ✅ Thêm dòng này
    address: place.vicinity,
    rating: place.rating,
    // ...
}))
```

### 2. **SỬA BUG CHÍNH #2: Dùng `restaurants.lunch` thay vì `localFood[0]`**
```javascript
// ✅ FIX: Dùng restaurants.lunch đã được track đúng
const lunchVenue = restaurants.lunch;  // Không dùng localFood nữa!

if (lunchVenue) {
    schedule.push({
        time: currentTime,
        activity: `Ăn trưa tại ${lunchVenue.name}`,
        // ...
    });
    // Không cần add vào usedRestaurants vì đã add trong findRealRestaurantsForDay
}
```

**Lý do:**
- `restaurants.lunch` đã được chọn và track đúng trong `findRealRestaurantsForDay()`
- Mỗi ngày có nhà hàng lunch khác nhau
- `localFood` không được track → Luôn trùng

### 3. Loại Bỏ Duplicate Restaurants
```javascript
// ✅ FIX: Loại bỏ duplicate restaurants trước khi shuffle
const uniqueRestaurants = [];
const seenNames = new Set();
const seenIds = new Set();

for (const r of realRestaurants) {
    // Skip nếu đã thấy name hoặc place_id
    if (seenNames.has(r.name) || (r.place_id && seenIds.has(r.place_id))) {
        continue;
    }
    
    // Skip nếu tên quá giống với nhà hàng đã có (85% similarity)
    const isDuplicate = uniqueRestaurants.some(existing => {
        const similarity = calculateSimilarity(existing.name.toLowerCase(), r.name.toLowerCase());
        return similarity > 0.85;
    });
    
    if (!isDuplicate) {
        uniqueRestaurants.push(r);
        seenNames.add(r.name);
        if (r.place_id) seenIds.add(r.place_id);
    }
}
```

### 2. Track Nhà Hàng Trong Ngày
```javascript
// Track nhà hàng đã dùng TRONG NGÀY này
const usedInThisDay = new Set();

// Khi chọn breakfast
usedRestaurants.add(selected.name);
if (selected.place_id) usedRestaurants.add(selected.place_id);
usedInThisDay.add(selected.name); // ✅ Track trong ngày

// Khi filter lunch
const availableForLunch = shuffledRestaurants.filter(r => {
    // ✅ Check cả usedRestaurants VÀ usedInThisDay
    if (usedRestaurants.has(r.name) || 
        usedRestaurants.has(r.place_id) || 
        usedInThisDay.has(r.name)) {
        return false;
    }
    // ...
});
```

### 3. Track Cả Name và place_id
```javascript
// ✅ Add vào cả 2 Set
usedRestaurants.add(selected.name);
if (selected.place_id) usedRestaurants.add(selected.place_id);
```

### 4. Thêm Logging Chi Tiết
```javascript
console.log(`🍽️ Unique restaurants: ${uniqueRestaurants.length}/${realRestaurants.length}`);
console.log(`🍽️ Available lunch restaurants: ${availableForLunch.length}/${shuffledRestaurants.length}`);
console.log(`✅ Selected lunch: ${selected.name}`);
console.warn(`⚠️ No available lunch restaurants, using fallback`);
```

## Kết Quả Mong Đợi

### Trước Khi Sửa
```
Ngày 1: Trưa - Nhà hàng Gành Hào 1
Ngày 2: Trưa - Nhà hàng Gành Hào 1 (TRÙNG!)
Ngày 3: Trưa - Nhà hàng Gành Hào 1 (TRÙNG!)
```

### Sau Khi Sửa
```
Ngày 1: Trưa - Nhà hàng Gành Hào 1
Ngày 2: Trưa - Quach's Seafood Restaurant (KHÁC!)
Ngày 3: Trưa - 342 Lagoon - Vựa Hải Sản (KHÁC!)
```

### Nếu Không Đủ Nhà Hàng (Fallback)
```
Ngày 1: Trưa - Nhà hàng A
Ngày 2: Trưa - Nhà hàng B
Ngày 3: Trưa - Nhà hàng cơm Trung Tâm - Vũng Tàu (Fallback với random suffix)
```

## Các Trường Hợp Đặc Biệt

### 1. Không Đủ Nhà Hàng
Nếu số nhà hàng < số ngày × 3 (breakfast, lunch, dinner), hệ thống sẽ:
- Ưu tiên không trùng trong cùng ngày
- Ưu tiên không trùng chuỗi nhà hàng (KFC, Lotteria, etc.)
- Fallback về nhà hàng generic nếu hết

### 2. Chuỗi Nhà Hàng
Hàm `isSameRestaurantChain()` đảm bảo không chọn:
- KFC Nguyễn Huệ và KFC Lê Lợi
- Lotteria Q1 và Lotteria Q3
- Highlands Coffee A và Highlands Coffee B

### 3. Similarity Check
Hàm `calculateSimilarity()` (Levenshtein distance) đảm bảo không chọn:
- "Nhà hàng Hải Sản Biển Đông" và "Nhà Hàng Hải Sản Biển Đông"
- "Phở Hà Nội" và "Pho Ha Noi"

## Testing

### Test Case 1: Lịch Trình 3 Ngày
```javascript
const preferences = {
    destination: 'Vũng Tàu',
    duration: 3,
    travelers: 2,
    budget: 5000000,
    travelStyle: 'standard'
};

// Kiểm tra console logs:
// - "🍽️ Unique restaurants: X/Y"
// - "✅ Selected lunch: [Tên nhà hàng]"
// - Đảm bảo 3 ngày có 3 nhà hàng trưa khác nhau
```

### Test Case 2: Lịch Trình 7 Ngày
```javascript
const preferences = {
    destination: 'Đà Nẵng',
    duration: 7,
    travelers: 4,
    budget: 15000000,
    travelStyle: 'comfort'
};

// Kiểm tra:
// - 7 ngày có 7 nhà hàng trưa khác nhau
// - Không có chuỗi nhà hàng trùng
// - Fallback chỉ xảy ra khi thực sự hết nhà hàng
```

## Files Đã Sửa
- `src/services/completeItineraryService.js`
  - Hàm `findRealRestaurantsForDay()` (dòng ~3546-3900)
  - Thêm logic loại bỏ duplicate (similarity check 85%)
  - Thêm tracking trong ngày (`usedInThisDay`)
  - Thêm logging chi tiết (available count, selected name, warnings)
  - Tăng target từ 30 → 50 nhà hàng để đủ cho nhiều ngày
  - Thêm random suffix cho fallback restaurants để tránh trùng tên

## Lưu Ý
- Biến `usedRestaurants` là **global** và được reset khi tạo lịch trình mới
- Hàm `resetDestinationTracking()` được gọi ở đầu `createCompleteItinerary()`
- Nếu muốn test, có thể log `usedRestaurants` để xem danh sách nhà hàng đã dùng

## Cách Kiểm Tra
1. Tạo lịch trình 3 ngày
2. Mở Console (F12)
3. Tìm các log:
   - `🍽️ Finding DIVERSE restaurants`
   - `✅ Selected lunch: [Tên]`
4. Kiểm tra 3 ngày có 3 tên khác nhau

## Kết Luận
Lỗi đã được sửa bằng cách:
1. ✅ **SỬA BUG CHÍNH #1: Thêm `place_id` vào map()**
2. ✅ **SỬA BUG CHÍNH #2: Dùng `restaurants.lunch` thay vì `localFood[0]`** - Đây là nguyên nhân chính gây trùng!
3. ✅ Loại bỏ duplicate restaurants (similarity 85%)
4. ✅ Track nhà hàng trong ngày (`usedInThisDay`)
5. ✅ Track cả name và place_id
6. ✅ Thêm logging chi tiết (warnings, counts, selections)
7. ✅ Kiểm tra chuỗi nhà hàng và similarity
8. ✅ Tăng target lên 50 nhà hàng để đủ cho nhiều ngày
9. ✅ Thêm random suffix cho fallback restaurants

Giờ đây, mỗi ngày sẽ có nhà hàng trưa khác nhau, không còn trùng lặp!

## ⚠️ LƯU Ý QUAN TRỌNG
**Bạn cần TẠO LẠI lịch trình mới** để thấy thay đổi. Lịch trình cũ đã được lưu trong database với dữ liệu cũ.

### Cách Test:
1. Xóa lịch trình cũ (hoặc tạo lịch trình mới)
2. Mở Console (F12)
3. Tìm các log:
   - `🍽️ Unique restaurants: X/Y`
   - `✅ Selected lunch: [Tên nhà hàng]`
   - `⚠️ Skipping [Tên] - already used`
4. Kiểm tra 3 ngày có 3 nhà hàng trưa khác nhau
