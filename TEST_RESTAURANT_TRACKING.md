# Test Restaurant Tracking

## Vấn Đề
Nhà hàng trưa vẫn bị trùng ở cả 3 ngày mặc dù đã sửa code.

## Các Bước Debug

### 1. Mở Console (F12)
Khi tạo lịch trình mới, tìm các log sau:

#### A. Reset Tracking
```
🔄 Reset tracking - usedRestaurants: 0 usedDestinations: 0
```
→ Phải là 0 khi bắt đầu

#### B. Tìm Nhà Hàng
```
🍽️ Found X real restaurants from Google Places
🍽️ Unique restaurants: Y/X (removed Z duplicates)
🔍 Top 5 unique restaurants: [...]
🔍 Top 5 after shuffle: [...]
```
→ Kiểm tra có đủ nhà hàng không (tối thiểu 9 cho 3 ngày)

#### C. Chọn Lunch (Ngày 1)
```
🍽️ Available lunch restaurants: X/Y
🔍 LUNCH SELECTION DEBUG: {
  name: "Nhà hàng A",
  place_id: "ChIJ...",
  hasPlaceId: true,
  usedRestaurantsSize: 1,
  usedRestaurantsList: ["Quán ăn sáng B"]
}
✅ Added to usedRestaurants: name="Nhà hàng A", place_id="ChIJ..."
✅ Selected lunch: Nhà hàng A (Total used: 2)
```

#### D. Chọn Lunch (Ngày 2)
```
📋 Already used restaurants (2): ["Quán ăn sáng B", "Nhà hàng A"]
🍽️ Available lunch restaurants: X/Y
⚠️ Skipping Nhà hàng A - already used
🔍 LUNCH SELECTION DEBUG: {
  name: "Nhà hàng C",  ← PHẢI KHÁC!
  place_id: "ChIJ...",
  hasPlaceId: true,
  usedRestaurantsSize: 4,
  usedRestaurantsList: [...]
}
✅ Selected lunch: Nhà hàng C (Total used: 5)
```

#### E. Chọn Lunch (Ngày 3)
```
📋 Already used restaurants (5): [...]
🍽️ Available lunch restaurants: X/Y
⚠️ Skipping Nhà hàng A - already used
⚠️ Skipping Nhà hàng C - already used
🔍 LUNCH SELECTION DEBUG: {
  name: "Nhà hàng D",  ← PHẢI KHÁC!
  place_id: "ChIJ...",
  hasPlaceId: true,
  usedRestaurantsSize: 7,
  usedRestaurantsList: [...]
}
✅ Selected lunch: Nhà hàng D (Total used: 8)
```

## Các Trường Hợp Lỗi

### Lỗi 1: `place_id` là `undefined`
```
⚠️ WARNING: No place_id for "Nhà hàng A"!
```
→ **Nguyên nhân:** Google Places API không trả về `place_id`
→ **Giải pháp:** Kiểm tra API response

### Lỗi 2: Không đủ nhà hàng
```
⚠️ WARNING: Only 2 unique restaurants found! May have duplicates across days.
🍽️ Available lunch restaurants: 0/2
⚠️ No available lunch restaurants, using fallback
```
→ **Nguyên nhân:** Google Places API trả về quá ít nhà hàng
→ **Giải pháp:** Tăng radius hoặc thêm queries

### Lỗi 3: `usedRestaurants` không được reset
```
🔄 Reset tracking - usedRestaurants: 5 usedDestinations: 10
```
→ **Nguyên nhân:** `resetDestinationTracking()` không hoạt động
→ **Giải pháp:** Kiểm tra hàm reset

### Lỗi 4: Filter không hoạt động
```
📋 Already used restaurants (2): ["Nhà hàng A", "ChIJ..."]
🍽️ Available lunch restaurants: 5/5  ← Không filter!
✅ Selected lunch: Nhà hàng A  ← TRÙNG!
```
→ **Nguyên nhân:** Logic filter bị lỗi
→ **Giải pháp:** Kiểm tra điều kiện filter

## Cách Test

### Test 1: Kiểm tra Console Logs
1. Xóa cache browser (Ctrl+Shift+Delete)
2. Reload trang (Ctrl+F5)
3. Tạo lịch trình mới
4. Mở Console (F12)
5. Copy toàn bộ logs và gửi cho dev

### Test 2: Kiểm tra Network
1. Mở Network tab (F12)
2. Filter: `places`
3. Tạo lịch trình mới
4. Kiểm tra response từ Google Places API:
   - Có `place_id` không?
   - Có bao nhiêu nhà hàng?
   - Rating của các nhà hàng?

### Test 3: Kiểm tra Database
1. Mở Firebase Console
2. Vào Firestore
3. Kiểm tra collection `itineraries`
4. Xem lịch trình vừa tạo:
   - `dailyItinerary[0].meals.lunch.name`
   - `dailyItinerary[1].meals.lunch.name`
   - `dailyItinerary[2].meals.lunch.name`
   - Có khác nhau không?

## Kết Quả Mong Đợi

### ✅ Thành Công
```
Ngày 1: Trưa - Nhà hàng A
Ngày 2: Trưa - Nhà hàng B (KHÁC!)
Ngày 3: Trưa - Nhà hàng C (KHÁC!)
```

Console logs:
```
✅ Selected lunch: Nhà hàng A (Total used: 2)
✅ Selected lunch: Nhà hàng B (Total used: 5)
✅ Selected lunch: Nhà hàng C (Total used: 8)
```

### ❌ Thất Bại
```
Ngày 1: Trưa - Nhà hàng A
Ngày 2: Trưa - Nhà hàng A (TRÙNG!)
Ngày 3: Trưa - Nhà hàng A (TRÙNG!)
```

Console logs:
```
✅ Selected lunch: Nhà hàng A (Total used: 2)
✅ Selected lunch: Nhà hàng A (Total used: 2)  ← usedRestaurants không tăng!
✅ Selected lunch: Nhà hàng A (Total used: 2)  ← usedRestaurants không tăng!
```

## Checklist Debug

- [ ] Console có log `🔄 Reset tracking` không?
- [ ] `usedRestaurants.size` bắt đầu từ 0?
- [ ] `🍽️ Found X real restaurants` - X > 9?
- [ ] `🍽️ Unique restaurants` - có loại bỏ duplicate?
- [ ] `🔍 LUNCH SELECTION DEBUG` - có `place_id`?
- [ ] `⚠️ WARNING: No place_id` - có xuất hiện không?
- [ ] `✅ Added to usedRestaurants` - có log này không?
- [ ] `Total used` có tăng sau mỗi ngày không?
- [ ] Ngày 2 có log `⚠️ Skipping [Nhà hàng ngày 1]` không?
- [ ] 3 ngày có 3 tên nhà hàng trưa khác nhau không?

## Nếu Vẫn Lỗi

Gửi cho dev:
1. Toàn bộ Console logs (copy từ đầu đến cuối)
2. Screenshot lịch trình (3 ngày)
3. Thông tin:
   - Điểm đến: ?
   - Số ngày: ?
   - Travel style: ?
   - Browser: ?
