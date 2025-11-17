# 📍 Tính năng Chọn Địa Điểm Tùy Chỉnh

## Tổng quan

Tính năng mới cho phép người dùng:
1. **Xem danh sách địa điểm** có thể đi tại điểm đến
2. **Chọn địa điểm** từ danh sách hoặc thêm địa điểm tùy chỉnh
3. **Chỉ định khung giờ** muốn đi cho từng địa điểm
4. **Tạo lịch trình** dựa trên các địa điểm và khung giờ đã chọn

## Flow người dùng

### Bước 1: Nhập thông tin cơ bản
- Điểm khởi hành
- Điểm đến
- Ngày khởi hành
- Số ngày, số người
- Ngân sách
- Phong cách du lịch
- Sở thích

### Bước 2: Chọn địa điểm (MỚI)
Người dùng sẽ thấy:

#### A. Danh sách địa điểm gợi ý
- Phân loại theo danh mục:
  - 🗺️ Tất cả
  - 🏛️ Tham quan
  - 🍽️ Nhà hàng
  - ☕ Cà phê
  - 🌳 Công viên
  - 🎨 Bảo tàng
  - 🛍️ Mua sắm
  - 🎉 Giải trí

- Mỗi địa điểm hiển thị:
  - Tên và địa chỉ
  - Rating và số đánh giá
  - Mức giá
  - Trạng thái mở cửa

#### B. Thêm địa điểm tùy chỉnh
Người dùng có thể thêm địa điểm không có trong danh sách:
- Tên địa điểm (bắt buộc)
- Địa chỉ (tùy chọn)
- Khung giờ mong muốn (tùy chọn)
- Thời gian tham quan (30 phút - 4 giờ)

#### C. Chỉ định khung giờ
Sau khi chọn địa điểm, người dùng có thể:
- Chọn khung giờ cụ thể (VD: 09:00, 14:30)
- Chọn thời gian tham quan (30 phút, 1h, 2h, 3h, 4h)
- Bỏ trống để hệ thống tự động sắp xếp

#### D. Panel địa điểm đã chọn
Hiển thị danh sách địa điểm đã chọn với:
- Số thứ tự
- Tên địa điểm
- Badge "Tùy chỉnh" nếu là địa điểm tự thêm
- Khung giờ và thời gian tham quan
- Nút xóa

### Bước 3: Xác nhận thông tin
Xem lại:
- Thông tin chuyến đi
- Danh sách địa điểm đã chọn với khung giờ
- Các tính năng lịch trình sẽ có

### Bước 4: Xem lịch trình hoàn chỉnh
Lịch trình được tạo dựa trên:
- Địa điểm người dùng đã chọn
- Khung giờ đã chỉ định
- Tối ưu hóa lộ trình di chuyển

## Cách hoạt động

### 1. Tìm kiếm địa điểm
```javascript
// Sử dụng Google Places API
- Tìm theo danh mục (restaurant, cafe, tourist_attraction...)
- Lọc theo rating >= 4.0
- Giới hạn bán kính 20km từ trung tâm
- Hiển thị tối đa 10 địa điểm/danh mục
```

### 2. Sắp xếp địa điểm theo thời gian
```javascript
// Logic trong customItineraryBuilder.js
1. Phân loại địa điểm:
   - Có khung giờ cố định
   - Không có khung giờ (linh hoạt)

2. Sắp xếp địa điểm có khung giờ theo thời gian

3. Phân bổ vào các ngày:
   - Tính toán thời gian khả dụng mỗi ngày (12 giờ)
   - Gán địa điểm có khung giờ trước
   - Điền địa điểm linh hoạt vào khoảng trống

4. Tối ưu hóa:
   - Sắp xếp lại theo thời gian trong ngày
   - Thêm thời gian di chuyển giữa các điểm
   - Thêm bữa ăn và thời gian nghỉ
```

### 3. Tạo lịch trình theo giờ
```javascript
// Mỗi ngày bao gồm:
- Ngày 1:
  * 06:30 - Khởi hành
  * 12:00 - Ăn trưa
  * 12:30 - Check-in khách sạn
  * 14:00 - Bắt đầu tham quan địa điểm đã chọn
  
- Ngày 2-N:
  * 07:00 - Ăn sáng
  * 08:00 - Tham quan địa điểm đã chọn
  * 18:30 - Ăn tối
  * 20:00 - Hoạt động tự do
```

### 4. Xử lý xung đột thời gian
```javascript
// Nếu có địa điểm trùng khung giờ:
- Hiển thị cảnh báo cho người dùng
- Hệ thống tự động điều chỉnh
- Ưu tiên địa điểm được chọn trước
```

## Components

### 1. DestinationSelector.js
Component chính cho việc chọn địa điểm:
- Hiển thị danh sách địa điểm theo danh mục
- Form thêm địa điểm tùy chỉnh
- Panel quản lý địa điểm đã chọn
- Chỉ định khung giờ và thời gian

### 2. CompleteItineraryPlanner.js
Cập nhật để tích hợp DestinationSelector:
- Thêm step 2: Chọn địa điểm
- Lưu danh sách địa điểm đã chọn
- Truyền vào service tạo lịch trình

### 3. customItineraryBuilder.js
Service xử lý logic:
- `organizeDestinationsByTime()` - Sắp xếp địa điểm theo thời gian
- `generateScheduleFromDestinations()` - Tạo lịch trình theo giờ
- `calculateCostFromDestinations()` - Tính chi phí
- `generateDayNotes()` - Tạo ghi chú đặc biệt

### 4. completeItineraryService.js
Cập nhật để hỗ trợ địa điểm tùy chỉnh:
- Kiểm tra `customDestinations` trong preferences
- Sử dụng logic mới nếu có địa điểm tùy chỉnh
- Fallback về logic cũ nếu không có

## Ví dụ sử dụng

### Scenario 1: Chọn từ danh sách gợi ý
```
1. Người dùng chọn "Vũng Tàu" làm điểm đến
2. Hệ thống hiển thị 50+ địa điểm
3. Người dùng chọn:
   - Bãi Trước (không chọn giờ)
   - Tượng Chúa Kitô (09:00, 2 giờ)
   - Nhà hàng Ganh Hao (12:00, 1 giờ)
   - Bãi Sau (15:00, 2 giờ)
4. Hệ thống tạo lịch trình tối ưu
```

### Scenario 2: Thêm địa điểm tùy chỉnh
```
1. Người dùng click "Thêm địa điểm tùy chỉnh"
2. Nhập:
   - Tên: "Quán cà phê yêu thích"
   - Địa chỉ: "123 Đường ABC"
   - Khung giờ: 16:00
   - Thời gian: 1 giờ
3. Địa điểm được thêm vào danh sách
4. Hệ thống tích hợp vào lịch trình
```

### Scenario 3: Không chọn khung giờ
```
1. Người dùng chọn 5 địa điểm
2. Không chỉ định khung giờ cho bất kỳ địa điểm nào
3. Hệ thống tự động:
   - Phân bổ đều vào các ngày
   - Sắp xếp theo thứ tự hợp lý
   - Tối ưu khoảng cách di chuyển
```

## Lợi ích

### Cho người dùng
✅ Kiểm soát hoàn toàn lịch trình
✅ Linh hoạt chọn địa điểm và thời gian
✅ Thêm địa điểm riêng không có trong hệ thống
✅ Xem trước và điều chỉnh dễ dàng

### Cho hệ thống
✅ Tăng độ chính xác của lịch trình
✅ Giảm số lần người dùng phải chỉnh sửa sau
✅ Thu thập dữ liệu về sở thích người dùng
✅ Cải thiện trải nghiệm người dùng

## Cải tiến trong tương lai

### Phase 2
- [ ] Kéo thả để sắp xếp lại địa điểm
- [ ] Hiển thị bản đồ với các địa điểm đã chọn
- [ ] Tính toán khoảng cách và thời gian di chuyển thực tế
- [ ] Gợi ý địa điểm dựa trên AI

### Phase 3
- [ ] Chia sẻ danh sách địa điểm với bạn bè
- [ ] Lưu template địa điểm yêu thích
- [ ] Đồng bộ với Google Maps
- [ ] Nhập lịch trình từ file Excel/CSV

## Testing

### Test cases
1. ✅ Chọn địa điểm từ danh sách
2. ✅ Thêm địa điểm tùy chỉnh
3. ✅ Chỉ định khung giờ
4. ✅ Xóa địa điểm đã chọn
5. ✅ Chọn tất cả / Bỏ chọn tất cả
6. ✅ Lọc theo danh mục
7. ✅ Xử lý xung đột thời gian
8. ✅ Tạo lịch trình với địa điểm đã chọn

### Edge cases
- Không chọn địa điểm nào → Hiển thị cảnh báo
- Chọn quá nhiều địa điểm cho số ngày → Cảnh báo lịch trình dày
- Địa điểm trùng khung giờ → Tự động điều chỉnh
- Địa điểm tùy chỉnh không có tọa độ → Sử dụng tọa độ trung tâm

## Kết luận

Tính năng này mang lại sự linh hoạt và kiểm soát cao cho người dùng trong việc tạo lịch trình du lịch, đồng thời vẫn giữ được sự tiện lợi của việc tự động hóa.
