# 🏨 Test Khách Sạn Phù Hợp Với Budget

## ✅ Đã hoàn thành

### 1. Logic gợi ý khách sạn theo budget
- Budget cao → Gợi ý khách sạn cao cấp (price_level 3-4)
- Budget trung bình → Gợi ý khách sạn 3 sao (price_level 2)
- Budget thấp → Gợi ý nhà nghỉ, khách sạn 2 sao (price_level 0-1)

### 2. Hiển thị đơn giản
- Thay "Khách sạn 3 sao" → "Khách sạn"
- Giá lấy từ Google Maps API (price_level) + tính toán thực tế

## 🎯 Công thức xác định price_level

```javascript
Budget/đêm/người → Target Price Level

< 250,000 VNĐ    → Level 0 (Nhà nghỉ, hostel)
250k - 400k VNĐ  → Level 1 (Khách sạn 2 sao)
400k - 700k VNĐ  → Level 2 (Khách sạn 3 sao)
700k - 1.5M VNĐ  → Level 3 (Khách sạn 4 sao)
> 1.5M VNĐ       → Level 4 (Khách sạn 5 sao, resort)
```

### Điều chỉnh theo Travel Style:
- **Budget**: -0.5 level (ưu tiên rẻ hơn)
- **Standard**: 0 level (trung bình)
- **Comfort**: +0.5 level (tốt hơn)
- **Luxury**: +1 level (cao cấp nhất)

## 📊 Ví dụ thực tế

### Case 1: Budget thấp (3M VNĐ, 2 người, 3 ngày)
```
Budget total: 3,000,000 VNĐ
Accommodation budget (35%): 1,050,000 VNĐ
Nights: 2
Budget/night: 525,000 VNĐ
Budget/night/person: 262,500 VNĐ

→ Target price_level: 1 (Khách sạn 2 sao)
→ Gợi ý: Khách sạn price_level 0-2
→ Giá dự kiến: 300k-400k VNĐ/đêm
```

### Case 2: Budget trung bình (10M VNĐ, 2 người, 3 ngày)
```
Budget total: 10,000,000 VNĐ
Accommodation budget (35%): 3,500,000 VNĐ
Nights: 2
Budget/night: 1,750,000 VNĐ
Budget/night/person: 875,000 VNĐ

→ Target price_level: 3 (Khách sạn 4 sao)
→ Gợi ý: Khách sạn price_level 2-4
→ Giá dự kiến: 1.2M-1.8M VNĐ/đêm
```

### Case 3: Budget cao (20M VNĐ, 2 người, 3 ngày, Luxury)
```
Budget total: 20,000,000 VNĐ
Accommodation budget (35%): 7,000,000 VNĐ
Nights: 2
Budget/night: 3,500,000 VNĐ
Budget/night/person: 1,750,000 VNĐ
Travel style: Luxury (+1 level)

→ Target price_level: 4 (Resort 5 sao)
→ Gợi ý: Khách sạn price_level 3-4
→ Giá dự kiến: 2.5M-3.5M VNĐ/đêm
```

## 🔧 Code chính

### determinePriceLevelByBudget()
```javascript
const determinePriceLevelByBudget = (budgetPerNightPerPerson, travelStyle) => {
    // Xác định level dựa trên budget
    let targetLevel;
    if (budgetPerNightPerPerson < 250000) targetLevel = 0;
    else if (budgetPerNightPerPerson < 400000) targetLevel = 1;
    else if (budgetPerNightPerPerson < 700000) targetLevel = 2;
    else if (budgetPerNightPerPerson < 1500000) targetLevel = 3;
    else targetLevel = 4;
    
    // Điều chỉnh theo style
    const styleAdjustment = {
        budget: -0.5,
        standard: 0,
        comfort: 0.5,
        luxury: 1
    }[travelStyle] || 0;
    
    targetLevel = Math.round(targetLevel + styleAdjustment);
    return Math.max(0, Math.min(4, targetLevel));
};
```

### Lọc khách sạn phù hợp
```javascript
.filter(hotel => {
    const hotelPriceLevel = hotel.price_level !== undefined ? hotel.price_level : 2;
    // Chấp nhận khách sạn trong khoảng ±1 level
    if (Math.abs(hotelPriceLevel - targetPriceLevel) > 1) {
        return false;
    }
    return true;
})
```

## 💡 Lợi ích

1. **Gợi ý chính xác hơn** - Khách sạn phù hợp với budget user
2. **Không lãng phí** - Không gợi ý resort 5 sao cho budget thấp
3. **Không thiếu hụt** - Không gợi ý nhà nghỉ cho budget cao
4. **Linh hoạt** - Chấp nhận ±1 level để có đủ lựa chọn
5. **Hiển thị đơn giản** - "Khách sạn" thay vì "Khách sạn 3 sao"

## 📝 Changelog

**2024-11-21:**
- ✅ Thêm hàm `determinePriceLevelByBudget()`
- ✅ Lọc khách sạn theo price_level phù hợp với budget
- ✅ Ưu tiên khách sạn gần target price_level
- ✅ Sửa hiển thị "Khách sạn" thay vì "Khách sạn 3 sao"
- ✅ Tính budget per person để chính xác hơn
