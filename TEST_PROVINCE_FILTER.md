# Test Giới Hạn Tìm Kiếm Theo Tỉnh Thành

## Thay đổi đã thực hiện:

### 1. File `src/services/placesService.js`

✅ **Thêm tham số `provinceName`** vào hàm `searchPlacesByText`:
```javascript
export const searchPlacesByText = async (query, location, radius = 50000, provinceName = '')
```

✅ **Thêm hàm filter kết quả**:
- `filterResultsByCountryAndProvince()` - Lọc chỉ lấy địa điểm ở Việt Nam và trong tỉnh
- `getProvinceVariants()` - Lấy các biến thể tên tỉnh (có dấu, không dấu, viết tắt)

✅ **Kiểm tra địa chỉ**:
- Loại bỏ địa điểm ở Cambodia, Laos, China, Thailand
- Chỉ giữ địa điểm có địa chỉ chứa tên tỉnh

### 2. File `src/services/completeItineraryService.js`

✅ **Cập nhật tất cả các lời gọi `searchPlacesByText`** để truyền thêm `destination`:
- Tìm địa điểm du lịch: `searchPlacesByText(query, coord, 20000, destination)`
- Tìm nhà hàng dinner: `searchPlacesByText(query, coord, 15000, destination)`
- Tìm street food: `searchPlacesByText(query, coord, 10000, destination)`
- Tìm cafe: `searchPlacesByText(query, coord, 10000, destination)`
- Tìm nhà hàng khác: `searchPlacesByText(query, coord, 10000, destination)`

## Cách hoạt động:

### Ví dụ: Tìm kiếm ở Vũng Tàu

**Trước khi sửa:**
```
Query: "tourist attractions Vũng Tàu"
→ Có thể trả về: Địa điểm ở Bà Rịa, Long Hải, hoặc thậm chí Cambodia
```

**Sau khi sửa:**
```
Query: "tourist attractions Vũng Tàu"
Location: {lat: 10.3460, lng: 107.0843}
Radius: 20000 (20km)
Province: "Vũng Tàu"

→ Filter:
  1. Kiểm tra địa chỉ có chứa "Việt Nam" hoặc không chứa "Cambodia", "Laos", etc.
  2. Kiểm tra địa chỉ có chứa "Vũng Tàu" hoặc "Bà Rịa - Vũng Tàu" hoặc "BRVT"
  
→ Chỉ trả về: Địa điểm trong Vũng Tàu, Việt Nam
```

## Các tỉnh biên giới được bảo vệ:

- **Lào Cai** (biên giới Trung Quốc) - Không lấy địa điểm ở Trung Quốc
- **Cao Bằng** (biên giới Trung Quốc) - Không lấy địa điểm ở Trung Quốc
- **Quảng Ninh** (biên giới Trung Quốc) - Không lấy địa điểm ở Trung Quốc
- **Điện Biên** (biên giới Laos) - Không lấy địa điểm ở Laos
- **An Giang** (biên giới Cambodia) - Không lấy địa điểm ở Cambodia
- **Kiên Giang** (biên giới Cambodia) - Không lấy địa điểm ở Cambodia

## Cách test:

1. Tạo lịch trình cho **Vũng Tàu**
2. Kiểm tra console log:
   - `✅ Filtered to X results in Vietnam (Vũng Tàu)`
   - `❌ Filtered out (not in Vietnam): ...`
   - `❌ Filtered out (not in Vũng Tàu): ...`

3. Kiểm tra kết quả:
   - Tất cả địa điểm phải có địa chỉ chứa "Vũng Tàu" hoặc "Bà Rịa - Vũng Tàu"
   - Không có địa điểm nào ở nước ngoài

## Biến thể tên tỉnh được hỗ trợ:

```javascript
'Vũng Tàu' → ['vũng tàu', 'vung tau', 'bà rịa - vũng tàu', 'ba ria - vung tau', 'brvt']
'Hà Nội' → ['hà nội', 'ha noi', 'hanoi']
'TP. Hồ Chí Minh' → ['hồ chí minh', 'ho chi minh', 'tp.hcm', 'tphcm', 'sài gòn', 'saigon']
'Đà Nẵng' → ['đà nẵng', 'da nang', 'danang']
'Đà Lạt' → ['đà lạt', 'da lat', 'dalat', 'lâm đồng', 'lam dong']
... và nhiều tỉnh khác
```

## Lưu ý:

- Filter chạy **sau khi** nhận kết quả từ Google Places API
- Không ảnh hưởng đến performance vì chỉ filter trên client
- Có thể mở rộng thêm các biến thể tên tỉnh nếu cần
