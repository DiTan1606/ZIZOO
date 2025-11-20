# Force Clear Cache & Test Lại

## Vấn Đề
Code đã sửa nhưng vẫn thấy nhà hàng trùng → Có thể do browser cache code cũ.

## Giải Pháp: Clear Cache Hoàn Toàn

### Cách 1: Hard Reload (Nhanh)
1. Mở trang web
2. Mở DevTools (F12)
3. **Right-click vào nút Reload** (bên cạnh URL bar)
4. Chọn **"Empty Cache and Hard Reload"**
5. Đợi trang load lại
6. Tạo lịch trình mới

### Cách 2: Clear Cache Thủ Công (Chắc Chắn)
1. Mở DevTools (F12)
2. Vào tab **Application**
3. Bên trái, chọn **Storage**
4. Click **"Clear site data"**
5. Reload trang (Ctrl+F5)
6. Tạo lịch trình mới

### Cách 3: Incognito Mode (Test Nhanh)
1. Mở **Incognito/Private Window**:
   - Chrome: Ctrl+Shift+N
   - Firefox: Ctrl+Shift+P
   - Edge: Ctrl+Shift+N
2. Vào trang web
3. Tạo lịch trình mới
4. Kiểm tra có còn trùng không

### Cách 4: Clear All (Triệt Để)
1. **Chrome:**
   - Ctrl+Shift+Delete
   - Chọn "All time"
   - Check: Cookies, Cache, Site data
   - Click "Clear data"

2. **Firefox:**
   - Ctrl+Shift+Delete
   - Chọn "Everything"
   - Check: Cookies, Cache
   - Click "Clear Now"

3. **Edge:**
   - Ctrl+Shift+Delete
   - Chọn "All time"
   - Check: Cookies, Cache
   - Click "Clear now"

## Sau Khi Clear Cache

### 1. Kiểm Tra Code Mới Đã Load
Mở Console (F12) và chạy:
```javascript
// Kiểm tra version code
console.log('Testing new code...');
```

Hoặc tìm log mới:
```
🔄 Reset tracking - usedRestaurants: 0 usedDestinations: 0
🔍 LUNCH SELECTION DEBUG: {...}
```

Nếu KHÔNG thấy các log này → Code cũ vẫn đang chạy → Clear cache lại!

### 2. Tạo Lịch Trình Mới
- Chọn điểm đến: Nha Trang hoặc Vũng Tàu
- Số ngày: 3
- Travelers: 2
- Budget: 5,000,000
- Travel style: Standard

### 3. Kiểm Tra Console Logs
Phải thấy:
```
🔄 Reset tracking - usedRestaurants: 0 usedDestinations: 0
🍽️ Found X real restaurants from Google Places
🔍 Top 5 unique restaurants: [...]
🔍 LUNCH SELECTION DEBUG: {
  name: "...",
  place_id: "ChIJ...",
  hasPlaceId: true
}
✅ Added to usedRestaurants: name="...", place_id="..."
✅ Selected lunch: ... (Total used: 2)
```

### 4. Kiểm Tra Kết Quả
Xem lịch trình:
- Ngày 1: Trưa - Nhà hàng A
- Ngày 2: Trưa - Nhà hàng B ← PHẢI KHÁC!
- Ngày 3: Trưa - Nhà hàng C ← PHẢI KHÁC!

## Nếu Vẫn Trùng Sau Khi Clear Cache

Có 2 khả năng:

### Khả Năng 1: Google Places API Trả Về Ít Nhà Hàng
Kiểm tra console:
```
⚠️ WARNING: Only 2 unique restaurants found!
```

→ **Giải pháp:** Tăng số queries hoặc radius

### Khả Năng 2: Logic Filter Bị Lỗi
Kiểm tra console:
```
📋 Already used restaurants (2): ["Nhà hàng A", "ChIJ..."]
🍽️ Available lunch restaurants: 5/5  ← Không filter!
✅ Selected lunch: Nhà hàng A  ← TRÙNG!
```

→ **Giải pháp:** Debug logic filter

## Lưu Ý Quan Trọng

### ⚠️ Service Worker
Một số app dùng Service Worker để cache. Nếu vẫn lỗi:

1. Mở DevTools (F12)
2. Vào tab **Application**
3. Bên trái, chọn **Service Workers**
4. Click **"Unregister"** cho tất cả service workers
5. Reload trang

### ⚠️ Local Storage
Nếu app lưu data trong Local Storage:

1. Mở DevTools (F12)
2. Vào tab **Application**
3. Bên trái, chọn **Local Storage**
4. Right-click → **Clear**
5. Reload trang

### ⚠️ Session Storage
Tương tự với Session Storage:

1. Mở DevTools (F12)
2. Vào tab **Application**
3. Bên trái, chọn **Session Storage**
4. Right-click → **Clear**
5. Reload trang

## Test Cuối Cùng

Sau khi clear cache hoàn toàn:

1. ✅ Mở Incognito window
2. ✅ Vào trang web
3. ✅ Mở Console (F12)
4. ✅ Tạo lịch trình 3 ngày
5. ✅ Kiểm tra console logs
6. ✅ Kiểm tra 3 nhà hàng trưa có khác nhau không

Nếu vẫn trùng → Gửi console logs cho dev để debug sâu hơn!
