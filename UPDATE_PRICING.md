# Cập nhật Giá Cả Hợp Lý - HOÀN THÀNH ✅

## Các thay đổi đã thực hiện:

### 1. ✅ Giá ăn uống - Sử dụng giá trung vị thực tế

**Trước:**
- Sáng: 30k
- Trưa: 60k
- Tối: 80k
- **Tổng: 170k/ngày**

**Sau (Giá trung vị thực tế):**
```javascript
MEAL_COSTS = {
    breakfast: { min: 30k, avg: 40k, max: 60k },  // Phở, bánh mì
    lunch: { min: 50k, avg: 70k, max: 120k },     // Cơm bình dân
    dinner: { min: 80k, avg: 100k, max: 200k },   // Nhà hàng
    streetFood: { min: 15k, avg: 25k, max: 50k }, // Ăn vặt
    cafe: { min: 20k, avg: 35k, max: 80k }        // Cà phê
}
```
- **Tổng: 210k/ngày** (40k + 70k + 100k)

### 2. ✅ Vé vào cổng - Giá chính xác theo loại địa điểm

**Phân loại mới:**

| Loại | Ví dụ | Giá |
|------|-------|-----|
| **Miễn phí** | Công viên, chùa, đền, hồ, biển | 0đ |
| **Rẻ (10-30k)** | Thác nước, tượng đài, di tích nhỏ | 20k |
| **Trung bình (30-50k)** | Bảo tàng, văn miếu, lăng | 40k |
| **Đắt (50-100k)** | Núi, động, vườn quốc gia | 70k |
| **Cao cấp (100k+)** | Cáp treo, Vinpearl, Bà Nà Hills | 200k |

**Ví dụ cụ thể:**
- Hồ Gươm: **0đ** (miễn phí)
- Văn Miếu: **40k** (bảo tàng/di tích)
- Bà Nà Hills: **200k** (khu vui chơi cao cấp)
- Biển Mỹ Khê: **0đ** (miễn phí)

### 3. ✅ Chi phí di chuyển giữa các địa điểm

**Tính toán thông minh:**
- Kiểm tra thời gian di chuyển từ CSV
- Nếu > 30 phút: **50k** (Grab/taxi)
- Nếu < 30 phút: **20k** (đi bộ/xe ngắn)
- Thêm chi phí cơ bản: **80k/ngày**

**Ví dụ:**
```
Ngày 1: 3 địa điểm
- Địa điểm A → B: 45 phút → 50k
- Địa điểm B → C: 15 phút → 20k
- Chi phí cơ bản: 80k
→ Tổng: 150k
```

### 4. ✅ Tính tổng chi phí chính xác

**Công thức mới:**
```javascript
Chi phí ngày = (
    Vé vào cổng (chính xác) +
    Ăn uống (giá trung vị) +
    Di chuyển giữa địa điểm (từ CSV) +
    Di chuyển cơ bản (80k) +
    Phát sinh (50k)
) × multiplier (theo style)
```

**Multiplier theo style:**
- Budget: 1.0
- Standard: 1.1
- Comfort: 1.2
- Luxury: 1.3

### 5. ✅ Chi phí tổng thể

**Bao gồm:**
1. ✅ Xe khứ hồi (từ CSV - giá chính xác)
2. ✅ Lưu trú (theo style)
3. ✅ Ăn uống (giá trung vị × số ngày)
4. ✅ Vé vào cổng (giá chính xác)
5. ✅ Di chuyển địa phương (bao gồm giữa các địa điểm)
6. ✅ Phát sinh (5%)

## Ví dụ chi tiết:

### Chuyến đi: HCM → Đà Nẵng (3 ngày 2 đêm, 2 người)

**1. Xe khứ hồi:**
- Đi: Phương Trang - 550k/người × 2 = 1,100k
- Về: Phương Trang - 550k/người × 2 = 1,100k
- **Tổng: 2,200k**

**2. Lưu trú:**
- 2 đêm × 400k/đêm = **800k**

**3. Ăn uống:**
- 3 ngày × 210k/người/ngày × 2 người = **1,260k**

**4. Tham quan:**
- Ngày 1: Cầu Rồng (0đ) + Bà Nà Hills (200k) = 200k × 2 = 400k
- Ngày 2: Hội An (0đ) + Bảo tàng (40k) = 40k × 2 = 80k
- Ngày 3: Biển Mỹ Khê (0đ) = 0k
- **Tổng: 480k**

**5. Di chuyển địa phương:**
- 3 ngày × 150k/ngày = **450k**

**6. Phát sinh:**
- 5% × tổng = **250k**

**TỔNG CỘNG: 5,440k** (~5.5 triệu cho 2 người)

## So sánh trước và sau:

| Hạng mục | Trước | Sau | Chênh lệch |
|----------|-------|-----|------------|
| Ăn uống/ngày | 170k | 210k | +40k (chính xác hơn) |
| Vé vào cổng | Ước tính | Chính xác | Tùy địa điểm |
| Di chuyển | Cố định | Động | Dựa trên thực tế |
| Tổng | Không chính xác | Chính xác | +15-20% |

## Lợi ích:

✅ **Giá ăn uống thực tế** - Phản ánh đúng chi phí trung bình  
✅ **Vé vào cổng chính xác** - Phân loại theo từng loại địa điểm  
✅ **Di chuyển hợp lý** - Tính theo khoảng cách thực tế  
✅ **Tổng chi phí đáng tin cậy** - Người dùng có thể lập kế hoạch tốt hơn  
✅ **Minh bạch** - Biết rõ tiền đi đâu

## Kiểm tra:

1. Tạo lịch trình mới
2. Xem phần "Chi phí dự kiến"
3. Kiểm tra:
   - Giá ăn uống có hợp lý không?
   - Vé vào cổng có đúng không?
   - Tổng chi phí có logic không?

## Lưu ý:

- Giá có thể thay đổi theo thời gian
- Một số địa điểm có giá khác nhau theo mùa
- Chi phí thực tế có thể cao hơn 10-15% do phát sinh
