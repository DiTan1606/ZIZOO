# 🛣️ Hệ Thống Thông Tin Đường Đóng - Road Closure Info System

## 📋 Tổng Quan

Hệ thống kiểm tra và hiển thị thông tin về đường đóng (đèo, đường chính) như một **cảnh báo thông tin** thay vì cảnh báo nghiêm trọng, giúp người dùng biết tình trạng đường mà không gây hoảng loạn.

## 🎯 Triết Lý Thiết Kế

### Trước Đây ❌
- Đường đóng = Cảnh báo nghiêm trọng (đỏ)
- Trừ điểm nhiều (-30 đến -40 điểm)
- Gây hoảng loạn cho người dùng
- Không phân biệt "tất cả đường đóng" vs "một số đường đóng"

### Bây Giờ ✅
- Đường đóng = Thông tin hữu ích (xanh dương)
- Trừ điểm rất ít (-3 đến -5 điểm)
- Chỉ cảnh báo nghiêm trọng khi **TẤT CẢ đường chính đều đóng**
- Hiển thị rõ "còn đường khác để vào"

## 🔍 Phân Loại Tình Huống

### 1. 🚫 TẤT CẢ Đường Chính Đều Đóng (CRITICAL)

**Điều kiện**: `allCriticalClosed === true`

**Điểm trừ**: -50 điểm

**Hiển thị**:
```
┌─────────────────────────────────────────┐
│ 🚫 TẤT CẢ ĐƯỜNG CHÍNH ĐỀU ĐÓNG         │
│    KHÔNG THỂ VÀO                        │
│                                         │
│ • Đèo Prenn (QL20): Tuyến đường chính  │
│   từ TP.HCM/Phan Thiết                 │
│   → Đóng do sạt lở                     │
│                                         │
│ • Đèo Mimosa (Bảo Lộc): Tuyến đường    │
│   chính từ TP.HCM qua Bảo Lộc          │
│   → Đóng do thi công                   │
└─────────────────────────────────────────┘
```

**Ví dụ**: Đà Lạt khi cả Đèo Prenn VÀ Đèo Mimosa đều đóng → Không thể vào bằng đường bộ

---

### 2. ℹ️ Một Số Đường Chính Bị Đóng (INFO)

**Điều kiện**: `criticalRoutesClosed > 0` nhưng `allCriticalClosed === false`

**Điểm trừ**: -5 điểm (rất nhẹ)

**Hiển thị**:
```
┌─────────────────────────────────────────┐
│ ℹ️ Thông tin đường đi                   │
│                                         │
│ • Đèo Prenn đang đóng (2 sự cố)        │
│   → Tắc đường nghiêm trọng             │
│   → Thi công                           │
│                                         │
│ 💡 Còn đường khác để vào.              │
│    Nên kiểm tra trước khi đi.          │
└─────────────────────────────────────────┘
```

**Ví dụ**: Đà Lạt khi Đèo Prenn đóng nhưng Đèo Mimosa còn mở → Vẫn vào được

---

### 3. ℹ️ Đường Phụ Bị Đóng (INFO)

**Điều kiện**: `closedRoutes > 0` nhưng không phải critical routes

**Điểm trừ**: -3 điểm (rất nhẹ)

**Hiển thị**:
```
┌─────────────────────────────────────────┐
│ ℹ️ Một số đường phụ bị đóng             │
│                                         │
│ • Đường tỉnh lộ 725                    │
│ • Đường huyện 12                       │
└─────────────────────────────────────────┘
```

---

## 🎨 Thiết Kế UI

### Màu Sắc

#### Critical (Đỏ)
```css
.alert-item.critical {
  background: #fee2e2;
  color: #991b1b;
  border-left: 4px solid #dc2626;
}
```

#### Info (Xanh Dương)
```css
.alert-item.info {
  background: #dbeafe;
  color: #1e40af;
  border-left: 4px solid #3b82f6;
}
```

### Layout

```
┌─────────────────────────────────────────┐
│ [Icon] [Tiêu đề]                        │ ← Header
├─────────────────────────────────────────┤
│ • [Tên đường]: [Mô tả]                  │ ← Route details
│   → [Sự cố 1]                           │ ← Incidents
│   → [Sự cố 2]                           │
│                                         │
│ 💡 [Lời khuyên]                         │ ← Advice
└─────────────────────────────────────────┘
```

---

## 🔧 Cải Tiến Kỹ Thuật

### 1. Kiểm Tra Critical Routes

```javascript
// Kiểm tra critical routes (đèo, đường chính)
const criticalRoutesCheck = await checkCriticalRoutes(destinationName);

if (criticalRoutesCheck.hasCriticalRoutes) {
  // CHỈ cảnh báo nghiêm trọng khi TẤT CẢ đường chính đều đóng
  if (criticalRoutesCheck.allCriticalClosed) {
    score -= 50;
    issues.push({
      type: 'all_critical_routes_closed',
      severity: 'critical',
      routes: criticalRoutesCheck.routes.filter(r => !r.isOpen && r.importance === 'critical')
    });
  } 
  // Một số đường chính bị đóng → Cảnh báo THÔNG TIN
  else if (criticalRoutesCheck.criticalRoutesClosed > 0) {
    score -= 5; // Chỉ trừ 5 điểm
    issues.push({
      type: 'some_critical_routes_closed',
      severity: 'info',
      routes: criticalRoutesCheck.routes.filter(r => !r.isOpen && r.importance === 'critical')
    });
  }
}
```

### 2. Scoring System

```javascript
// Điểm ban đầu: 100

// Critical routes
if (allCriticalClosed) score -= 50;           // TẤT CẢ đường chính đóng
else if (someCriticalClosed) score -= 5;      // Một số đường chính đóng (INFO)
else if (secondaryRoutesClosed) score -= 3;   // Đường phụ đóng (INFO)

// Mưa liên tục
if (rainyPercentage === 100%) score -= 50;    // Mưa suốt
else if (rainyPercentage >= 70%) score -= 35; // Mưa hầu hết
else if (rainyPercentage >= 50%) score -= 20; // Mưa thường xuyên

// Thời tiết hiện tại & ngày đi
// ... (giữ nguyên)

// Phân loại status
if (score >= 80) → SAFE (✅ An toàn)
else if (score >= 50) → CAUTION (⚠️ Cân nhắc)
else if (score >= 20) → WARNING (🔴 Không nên đi)
else → DANGER (🚨 Nguy hiểm)
```

### 3. Message Generation

```javascript
case 'all_critical_routes_closed':
  messages.push(`🚫 TẤT CẢ đường chính đều đóng`);
  break;

case 'some_critical_routes_closed':
  const routeNames = issue.routes.map(r => r.name).join(', ');
  messages.push(`ℹ️ ${routeNames} đang đóng (còn đường khác)`);
  break;

case 'secondary_routes_closed':
  // Không thêm vào message chính (chỉ hiển thị trong widget)
  break;
```

---

## 📊 Ví Dụ Thực Tế

### Trường Hợp 1: Đà Lạt - Cả 2 Đèo Đều Đóng

```
Destination: Đà Lạt
Critical Routes:
- Đèo Prenn: ❌ CLOSED (sạt lở)
- Đèo Mimosa: ❌ CLOSED (thi công)

Result:
- Status: 🚨 DANGER
- Score: 50/100 (100 - 50 = 50)
- Message: "🚫 TẤT CẢ đường chính đều đóng. Rất nguy hiểm!"
- Widget: Hiển thị cảnh báo đỏ CRITICAL
```

### Trường Hợp 2: Đà Lạt - Chỉ Đèo Prenn Đóng

```
Destination: Đà Lạt
Critical Routes:
- Đèo Prenn: ❌ CLOSED (tắc đường)
- Đèo Mimosa: ✅ OPEN

Result:
- Status: ✅ SAFE hoặc ⚠️ CAUTION (tùy thời tiết)
- Score: 95/100 (100 - 5 = 95)
- Message: "ℹ️ Đèo Prenn đang đóng (còn đường khác). Thời tiết tốt, yên tâm đi"
- Widget: Hiển thị thông tin xanh dương INFO với lời khuyên
```

### Trường Hợp 3: Đà Lạt - Tất Cả Đường Mở

```
Destination: Đà Lạt
Critical Routes:
- Đèo Prenn: ✅ OPEN
- Đèo Mimosa: ✅ OPEN

Result:
- Status: ✅ SAFE
- Score: 100/100
- Message: "Thời tiết tốt, yên tâm đi"
- Widget: Không hiển thị cảnh báo đường đóng
```

---

## 🎯 Lợi Ích

### 1. Giảm Hoảng Loạn
- Người dùng không bị sợ khi thấy "đường đóng"
- Hiểu rõ còn đường khác để vào

### 2. Thông Tin Chính Xác
- Phân biệt rõ "tất cả đóng" vs "một số đóng"
- Hiển thị chi tiết sự cố trên từng đường

### 3. Quyết Định Thông Minh
- Người dùng tự đánh giá có nên đi hay không
- Có thông tin để chọn đường khác

### 4. Scoring Hợp Lý
- Không trừ điểm quá nặng cho thông tin
- Chỉ trừ điểm nhiều khi thực sự nguy hiểm

---

## 🔄 So Sánh Trước/Sau

### Trước Đây
```
Đà Lạt - Đèo Prenn đóng
├─ Score: 70/100 (-30 điểm)
├─ Status: ⚠️ CAUTION
├─ Widget: 🔴 Cảnh báo đỏ
└─ Message: "30 đường bị đóng. Nên chuẩn bị kỹ."
   → Người dùng hoảng sợ, không dám đi
```

### Bây Giờ
```
Đà Lạt - Đèo Prenn đóng
├─ Score: 95/100 (-5 điểm)
├─ Status: ✅ SAFE
├─ Widget: ℹ️ Thông tin xanh dương
├─ Message: "ℹ️ Đèo Prenn đang đóng (còn đường khác). Thời tiết tốt, yên tâm đi"
└─ Advice: "💡 Còn đường khác để vào. Nên kiểm tra trước khi đi."
   → Người dùng yên tâm, biết còn đường khác
```

---

## 📝 Lưu Ý

1. **Critical Routes**: Chỉ áp dụng cho các điểm đến có định nghĩa trong `CRITICAL_ROUTES` (Đà Lạt, Sapa, Hà Giang, Đà Nẵng)

2. **TomTom API**: Sử dụng TomTom Traffic API để kiểm tra tình trạng đường thời gian thực

3. **Auto-refresh**: Widget tự động cập nhật mỗi 30 phút

4. **Fallback**: Nếu API lỗi, mặc định là "đường mở" để không gây hoảng loạn

---

## 🚀 Cách Sử Dụng

### Trong Component
```javascript
import TripWeatherWidget from './components/TripWeatherWidget';

<TripWeatherWidget 
  trip={{
    destination: 'Đà Lạt',
    startDate: '20/12/2025',
    endDate: '24/12/2025'
  }} 
/>
```

### Kiểm Tra Thủ Công
```javascript
import { checkCriticalRoutes } from './services/weatherSafetyService';

const routeStatus = await checkCriticalRoutes('Đà Lạt');

console.log(routeStatus);
// {
//   hasCriticalRoutes: true,
//   totalRoutes: 2,
//   openRoutes: 1,
//   closedRoutes: 1,
//   criticalRoutesClosed: 1,
//   routes: [...],
//   allCriticalClosed: false
// }
```

---

## 🔮 Tương Lai

- [ ] Thêm nhiều điểm đến với critical routes
- [ ] Tích hợp Google Maps để kiểm tra route alternatives
- [ ] Gợi ý đường thay thế khi đường chính đóng
- [ ] Cảnh báo thời gian đóng đường dự kiến
- [ ] Lịch sử đóng đường để dự đoán

---

**Phiên bản**: 2.1  
**Ngày cập nhật**: 20/11/2025  
**Tác giả**: Kiro AI Assistant
