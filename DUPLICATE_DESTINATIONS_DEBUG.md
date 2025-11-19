# DEBUG: Địa điểm bị trùng lặp

## Vấn đề
Lịch trình các ngày bị trùng lặp địa điểm tham quan và nhà hàng

## Các điểm cần kiểm tra

### 1. Fetch destinations
- ✅ Đã fetch tập trung ở `generateDailyItinerary` (dòng 243-283)
- ✅ Đã loại bỏ trùng lặp theo place_id và name
- ⚠️ CẦN KIỂM TRA: Có đủ destinations không?

### 2. Phân bổ destinations cho từng ngày
- ✅ Đã phân bổ bằng slice (dòng 333-337)
- ⚠️ CẦN KIỂM TRA: Logic slice có đúng không?

### 3. Sử dụng destinations trong generateSingleDayPlan
- ✅ Đã nhận preAllocatedDestinations (dòng 397)
- ⚠️ CẦN KIỂM TRA: Có chỗ nào fetch lại không?

### 4. Sử dụng destinations trong generateEnhancedHourlySchedule
- ⚠️ NGHI NGỜ: Có thể vẫn dùng hết destinations thay vì chỉ dùng một phần

### 5. Fetch restaurants
- ✅ Đã fetch tập trung cho tất cả các ngày (dòng 286-294)
- ✅ Đã truyền vào generateSingleDayPlan

## Hành động
1. Kiểm tra console log xem destinations có bị trùng không
2. Kiểm tra generateEnhancedHourlySchedule có dùng đúng destinations không
3. Thêm tracking để đảm bảo không có địa điểm nào được dùng 2 lần
