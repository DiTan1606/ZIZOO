# Hướng dẫn loại bỏ icon trong ItineraryDetailModal

## Cách nhanh nhất:
Sử dụng Find & Replace trong VS Code:

1. Mở file `src/components/ItineraryDetailModal.js`
2. Nhấn `Ctrl+H` (Find & Replace)
3. Bật chế độ Regex (icon `.*` bên phải)
4. Tìm: `[📍📅👥💰🎯✅⚠️🍽️🚗✈️🚌⏱️📝💡🏨⭐🎒🌤️🌧️☀️⛅🌦️]\s*`
5. Thay thế: `` (để trống)
6. Nhấn "Replace All"

## Hoặc thủ công:
Loại bỏ các icon sau:
- 📍 (địa điểm)
- 📅 (ngày tháng)
- 👥 (người)
- 💰 (tiền)
- 🎯 (mục tiêu)
- ✅ (hoàn thành)
- ⚠️ (cảnh báo)
- 🍽️ (ăn uống)
- 🚗 (xe)
- ✈️ (máy bay)
- 🚌 (xe buýt)
- ⏱️ (thời gian)
- 📝 (ghi chú)
- 💡 (lưu ý)
- 🏨 (khách sạn)
- ⭐ (đánh giá)
- 🎒 (hành lý)
- 🌤️🌧️☀️⛅🌦️ (thời tiết)

## Đã sửa:
✅ Header (dòng 71-74)
✅ Tổng quan chi phí (dòng 83)
