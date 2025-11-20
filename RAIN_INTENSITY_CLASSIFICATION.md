# 🌧️ Phân Loại Mức Độ Mưa - Rain Intensity Classification

## 📋 Tổng Quan

Hệ thống phân loại mức độ mưa chi tiết với màu sắc và lời khuyên phù hợp cho từng mức độ.

## 🎯 Phân Loại Mức Độ Mưa

### 1. 🌧️ Mưa Nhỏ (Light Rain)
**Tiêu chí:** 0-20mm/ngày

**Đặc điểm:**
- Mưa phùn, mưa rào nhẹ
- Không ảnh hưởng nhiều đến hoạt động
- Chỉ cần áo mưa đơn giản

**Màu sắc:** Xanh dương nhạt (#dbeafe)

**Lời khuyên:** "ℹ️ Mưa nhỏ không đáng kể. Nên mang áo mưa"

---

### 2. 🌧️🌧️ Mưa Vừa (Moderate Rain)
**Tiêu chí:** 20-50mm/ngày

**Đặc điểm:**
- Mưa liên tục, có thể kéo dài
- Ảnh hưởng một phần đến hoạt động ngoài trời
- Cần chuẩn bị đồ mưa tốt

**Màu sắc:** Vàng/cam (#fef3c7)

**Lời khuyên:** "⚠️ Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng"

---

### 3. 🌧️🌧️🌧️ Mưa Lớn (Heavy Rain)
**Tiêu chí:** >50mm/ngày

**Đặc điểm:**
- Mưa to, mưa rất to
- Ảnh hưởng nghiêm trọng đến hoạt động
- Có thể gây ngập lụt, sạt lở

**Màu sắc:** Đỏ (#fee2e2)

**Lời khuyên:** "🚨 Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng"

---

## 🎨 Màu Sắc & Styling

### Mưa Nhỏ (Light)
```css
.alert-item.rain-light {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border: 2px solid #3b82f6;
  border-left: 4px solid #2563eb;
}
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ 🌧️ MƯA NHỎ SUỐT CHUYẾN ĐI              │ ← Xanh dương
│                                         │
│ • Tất cả 5 ngày đều có mưa              │
│ • Trung bình 15mm/ngày                  │
│ ℹ️ Mưa nhỏ không đáng kể. Nên mang     │
│    áo mưa                                │
└─────────────────────────────────────────┘
```

---

### Mưa Vừa (Moderate)
```css
.alert-item.rain-moderate {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-left: 4px solid #d97706;
}

.alert-item.rain-continuous.rain-moderate {
  animation: pulse-warning-moderate 2s ease-in-out infinite;
}
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ 🌧️🌧️ MƯA VỪA SUỐT CHUYẾN ĐI            │ ← Vàng/cam (pulse)
│                                         │
│ • Tất cả 5 ngày đều có mưa              │
│ • Trung bình 35mm/ngày                  │
│ ⚠️ Nên mang đồ mưa và chuẩn bị kế hoạch│
│    dự phòng                              │
└─────────────────────────────────────────┘
```

---

### Mưa Lớn (Heavy)
```css
.alert-item.rain-heavy {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border: 2px solid #dc2626;
  border-left: 4px solid #991b1b;
}

.alert-item.rain-continuous.rain-heavy {
  animation: pulse-warning 2s ease-in-out infinite;
}
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ 🌧️🌧️🌧️ MƯA LỚN SUỐT CHUYẾN ĐI         │ ← Đỏ (pulse mạnh)
│                                         │
│ • Tất cả 5 ngày đều có mưa              │
│ • Trung bình 65mm/ngày                  │
│ 🚨 Nên cân nhắc hoãn chuyến đi hoặc    │
│    chuẩn bị kỹ lưỡng                    │
└─────────────────────────────────────────┘
```

---

## 🔧 Logic Phân Loại

### weatherSafetyService.js

```javascript
// Phân loại mức độ mưa dựa trên lượng mưa trung bình
let rainIntensity = 'light'; // Mặc định: mưa nhỏ

if (avgRain > 50) {
  rainIntensity = 'heavy'; // Mưa lớn
} else if (avgRain > 20) {
  rainIntensity = 'moderate'; // Mưa vừa
}

// Điều chỉnh score và severity theo mức độ
if (rainyPercentage === 100) {
  let scoreDeduction = 20; // Mặc định cho mưa nhỏ
  let severity = 'medium';
  
  if (rainIntensity === 'heavy') {
    scoreDeduction = 50;
    severity = 'critical';
  } else if (rainIntensity === 'moderate') {
    scoreDeduction = 35;
    severity = 'high';
  }
  
  score -= scoreDeduction;
  issues.push({ 
    type: 'continuous_rain_all_days', 
    severity,
    rainIntensity, // ← Thêm field này
    rainyDays,
    totalDays,
    avgRain
  });
}
```

---

## 📊 Scoring System

### Mưa Suốt Chuyến Đi (100% ngày có mưa)

| Mức độ | Lượng mưa | Score trừ | Severity | Màu sắc |
|--------|-----------|-----------|----------|---------|
| Nhỏ | 0-20mm | -20 | medium | Xanh dương |
| Vừa | 20-50mm | -35 | high | Vàng/cam |
| Lớn | >50mm | -50 | critical | Đỏ |

### Mưa Hầu Hết Các Ngày (≥70% ngày có mưa)

| Mức độ | Lượng mưa | Score trừ | Severity | Màu sắc |
|--------|-----------|-----------|----------|---------|
| Nhỏ | 0-20mm | -15 | low | Xanh dương |
| Vừa | 20-50mm | -25 | medium | Vàng/cam |
| Lớn | >50mm | -35 | high | Đỏ |

### Mưa Thường Xuyên (≥50% ngày có mưa)

| Mức độ | Lượng mưa | Score trừ | Severity | Màu sắc |
|--------|-----------|-----------|----------|---------|
| Nhỏ | 0-20mm | -10 | info | Xanh dương |
| Vừa | 20-50mm | -15 | low | Vàng/cam |
| Lớn | >50mm | -20 | medium | Đỏ |

---

## 🎨 Component Implementation

### TripWeatherWidget.js

```javascript
if (issue.type === 'continuous_rain_all_days') {
  const intensity = issue.rainIntensity || 'moderate';
  const className = `alert-item rain-continuous rain-${intensity}`;
  
  let icon = '🌧️🌧️🌧️';
  let title = 'MƯA SUỐT CHUYẾN ĐI';
  let advice = '⚠️ Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng';
  
  if (intensity === 'light') {
    icon = '🌧️';
    title = 'MƯA NHỎ SUỐT CHUYẾN ĐI';
    advice = 'ℹ️ Mưa nhỏ không đáng kể. Nên mang áo mưa';
  } else if (intensity === 'moderate') {
    icon = '🌧️🌧️';
    title = 'MƯA VỪA SUỐT CHUYẾN ĐI';
    advice = '⚠️ Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng';
  } else if (intensity === 'heavy') {
    icon = '🌧️🌧️🌧️';
    title = 'MƯA LỚN SUỐT CHUYẾN ĐI';
    advice = '🚨 Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng';
  }
  
  return (
    <div key={index} className={className}>
      <div className="alert-header">{icon} {title}</div>
      <div className="alert-details">
        <div>• Tất cả {issue.totalDays} ngày đều có mưa</div>
        <div>• Trung bình {issue.avgRain}mm/ngày</div>
        <div className="alert-advice">{advice}</div>
      </div>
    </div>
  );
}
```

---

## 📊 Ví Dụ Thực Tế

### Case 1: Mưa Nhỏ Suốt Chuyến Đi
```
Chuyến đi: Đà Lạt, 5 ngày
Dự báo:
- 20/12: 🌧️ 12mm
- 21/12: 🌧️ 15mm
- 22/12: 🌧️ 10mm
- 23/12: 🌧️ 18mm
- 24/12: 🌧️ 14mm

Kết quả:
- Lượng mưa TB: 13.8mm/ngày
- Phân loại: LIGHT
- Score: 80/100 (100 - 20 = 80)
- Status: ✅ SAFE
- Màu: Xanh dương
- Lời khuyên: "Mưa nhỏ không đáng kể. Nên mang áo mưa"
```

---

### Case 2: Mưa Vừa Suốt Chuyến Đi
```
Chuyến đi: Nha Trang, 5 ngày
Dự báo:
- 20/12: 🌧️🌧️ 28mm
- 21/12: 🌧️🌧️ 35mm
- 22/12: 🌧️🌧️ 32mm
- 23/12: 🌧️🌧️ 40mm
- 24/12: 🌧️🌧️ 30mm

Kết quả:
- Lượng mưa TB: 33mm/ngày
- Phân loại: MODERATE
- Score: 65/100 (100 - 35 = 65)
- Status: ⚠️ CAUTION
- Màu: Vàng/cam (pulse)
- Lời khuyên: "Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng"
```

---

### Case 3: Mưa Lớn Suốt Chuyến Đi
```
Chuyến đi: Phú Quốc, 5 ngày
Dự báo:
- 20/12: 🌧️🌧️🌧️ 65mm
- 21/12: 🌧️🌧️🌧️ 70mm
- 22/12: 🌧️🌧️🌧️ 55mm
- 23/12: 🌧️🌧️🌧️ 80mm
- 24/12: 🌧️🌧️🌧️ 60mm

Kết quả:
- Lượng mưa TB: 66mm/ngày
- Phân loại: HEAVY
- Score: 50/100 (100 - 50 = 50)
- Status: ⚠️ CAUTION (gần WARNING)
- Màu: Đỏ (pulse mạnh)
- Lời khuyên: "Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng"
```

---

## 🎯 Lợi Ích

### 1. Thông Tin Chính Xác Hơn
- Phân biệt rõ mưa nhỏ/vừa/lớn
- Không gây hoảng loạn với mưa nhỏ
- Cảnh báo đúng mức với mưa lớn

### 2. Màu Sắc Trực Quan
- Xanh dương = An toàn (mưa nhỏ)
- Vàng/cam = Cẩn thận (mưa vừa)
- Đỏ = Nguy hiểm (mưa lớn)

### 3. Lời Khuyên Phù Hợp
- Mưa nhỏ: Chỉ cần áo mưa
- Mưa vừa: Chuẩn bị kế hoạch dự phòng
- Mưa lớn: Cân nhắc hoãn chuyến đi

### 4. Scoring Hợp Lý
- Mưa nhỏ: Trừ ít điểm (-10 đến -20)
- Mưa vừa: Trừ vừa phải (-15 đến -35)
- Mưa lớn: Trừ nhiều (-20 đến -50)

---

## 📝 Lưu Ý

1. **Ngưỡng phân loại**: Dựa trên chuẩn khí tượng quốc tế
   - Light: 0-20mm/ngày
   - Moderate: 20-50mm/ngày
   - Heavy: >50mm/ngày

2. **Animation**: Chỉ áp dụng cho "mưa suốt chuyến đi" để thu hút sự chú ý

3. **Responsive**: Màu sắc và layout tự động điều chỉnh theo màn hình

4. **Accessibility**: Sử dụng cả màu sắc và icon để người khiếm thị cũng hiểu được

---

**Phiên bản**: 1.0  
**Ngày cập nhật**: 20/11/2025  
**Tác giả**: Kiro AI Assistant
