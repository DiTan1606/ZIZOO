# Debug Itinerary Generation

## Kiểm tra lỗi:

### 1. Mở Developer Console (F12)

### 2. Tạo lịch trình mới

### 3. Kiểm tra các log sau:

```
✅ Logs cần thấy:
📅 Generating DIVERSE day plan for Day 1 in [destination]...
🔍 Finding REAL destinations for Day 1 in [destination] (style, budget: X)...
💰 Budget per person: X, Can afford premium: true/false
✨ Premium queries for [destination]: [...]
✅ Using X destinations from Google Places API for Day 1
```

```
❌ Logs lỗi có thể gặp:
⚠️ No new destinations available for day X
📍 Using fallback destinations for Day X
❌ Error finding destinations for Day X: [error]
```

### 4. Các vấn đề thường gặp:

#### A. Không có địa điểm nào
**Nguyên nhân:**
- Google Places API không trả về kết quả
- Tất cả địa điểm bị filter out
- Tên thành phố không khớp

**Giải pháp:**
1. Kiểm tra tên thành phố có đúng không
2. Kiểm tra Google Places API key
3. Xem log để biết query nào đang chạy

#### B. Lỗi "Cannot read property"
**Nguyên nhân:**
- Thiếu tham số truyền vào hàm
- Object undefined

**Giải pháp:**
1. Kiểm tra console log
2. Xem stack trace
3. Kiểm tra tham số truyền vào

#### C. Địa điểm không phù hợp với ngân sách
**Nguyên nhân:**
- Logic premium chưa hoạt động
- Budget không được truyền đúng

**Kiểm tra:**
```javascript
// Trong console, check:
💰 Budget per person: [số tiền]
Can afford premium: [true/false]
✨ Premium queries: [array]
```

### 5. Test thủ công:

#### Test 1: Budget thấp
```
Điểm đi: Hồ Chí Minh
Điểm đến: Nha Trang
Ngân sách: 2,000,000đ (2 người)
Style: budget

Kỳ vọng:
- Biển Nha Trang (miễn phí)
- Tháp Bà (22k)
- Chợ Đầm (miễn phí)
```

#### Test 2: Budget cao
```
Điểm đi: Hồ Chí Minh
Điểm đến: Nha Trang
Ngân sách: 10,000,000đ (2 người)
Style: comfort

Kỳ vọng:
- Vinpearl Land (800k) ✨
- VinWonders (600k) ✨
- Biển Nha Trang (miễn phí)
```

### 6. Nếu vẫn lỗi:

1. **Clear cache và reload:**
   ```
   Ctrl + Shift + R (Windows)
   Cmd + Shift + R (Mac)
   ```

2. **Kiểm tra file đã được format:**
   - Kiro IDE có thể đã format lại code
   - Đọc lại file để đảm bảo code đúng

3. **Kiểm tra import:**
   ```javascript
   import transportDataService from './transportDataService';
   ```

4. **Test từng hàm riêng:**
   ```javascript
   // Trong console:
   const result = await findRealDestinationsForDay(
     1, 
     'Nha Trang', 
     {lat: 12.2388, lng: 109.1967},
     ['food', 'beach'],
     'comfort',
     10000000,
     2
   );
   console.log('Result:', result);
   ```

### 7. Các thông số quan trọng:

```javascript
// Budget per person để được premium:
budgetPerPerson > 3,000,000 VNĐ

// Hoặc:
travelStyle === 'luxury' || travelStyle === 'comfort'

// Premium destinations:
- Nha Trang: Vinpearl, VinWonders
- Đà Nẵng: Bà Nà Hills, Sun World
- Phú Quốc: Vinpearl Safari, Grand World
```

### 8. Fallback hierarchy:

```
1. Google Places API (premium queries first if budget allows)
   ↓ (nếu fail)
2. Firebase data
   ↓ (nếu fail)
3. Hardcoded fallback data
```

## Nếu cần hỗ trợ:

1. Copy toàn bộ console log
2. Screenshot lỗi
3. Cho biết:
   - Điểm đi/đến
   - Ngân sách
   - Travel style
   - Số người
