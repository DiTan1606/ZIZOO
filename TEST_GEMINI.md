# Test Gemini AI Integration

## ✅ Checklist:

### 1. Kiểm tra API Key
- [x] API key đã được thêm vào `.env`
- [x] Format: `REACT_APP_GEMINI_API_KEY=AIzaSy...`

### 2. Kiểm tra Code
- [x] `src/services/geminiService.js` - Service đã tạo
- [x] `src/pages/GeminiDemo.js` - Demo page đã tạo
- [x] `src/App.js` - Route đã thêm
- [x] `src/components/Navbar.js` - Link đã thêm

### 3. Kiểm tra Syntax
- [x] Không có lỗi syntax
- [x] Không cần cài thêm package

## 🚀 Cách test:

### Bước 1: Restart server
```bash
# Dừng server hiện tại (Ctrl+C)
# Khởi động lại
npm start
```

**Lý do**: React cần restart để load biến môi trường mới từ `.env`

### Bước 2: Truy cập Demo Page
```
http://localhost:3000/gemini-demo
```

### Bước 3: Test từng chức năng

#### Test 1: Mô tả địa điểm
1. Click vào "📝 Mô tả địa điểm"
2. Click "🚀 Chạy"
3. Đợi 2-5 giây
4. **Kết quả mong đợi**: Hiển thị đoạn mô tả về Vũng Tàu

#### Test 2: Gợi ý hoạt động
1. Click vào "🎯 Gợi ý hoạt động"
2. Click "🚀 Chạy"
3. **Kết quả mong đợi**: Hiển thị JSON array với 5 hoạt động

#### Test 3: Lời khuyên du lịch
1. Click vào "💡 Lời khuyên du lịch"
2. Click "🚀 Chạy"
3. **Kết quả mong đợi**: Hiển thị list 5 lời khuyên

## 🐛 Nếu gặp lỗi:

### Lỗi 1: "API key not found"
**Nguyên nhân**: Server chưa restart sau khi thêm API key

**Giải pháp**:
```bash
# Dừng server (Ctrl+C)
npm start
```

### Lỗi 2: "Invalid API key" hoặc 400 Bad Request
**Nguyên nhân**: API key không đúng hoặc đã hết hạn

**Giải pháp**:
1. Kiểm tra API key trong `.env`
2. Vào [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Tạo API key mới
4. Thay thế trong `.env`
5. Restart server

### Lỗi 3: "Rate limit exceeded" hoặc 429
**Nguyên nhân**: Đã vượt quá giới hạn 60 requests/minute

**Giải pháp**:
- Chờ 1 phút rồi thử lại
- Hoặc tạo API key mới

### Lỗi 4: CORS Error
**Nguyên nhân**: Browser block request đến Gemini API

**Giải pháp**:
- Gemini API hỗ trợ CORS, không nên gặp lỗi này
- Nếu vẫn gặp, kiểm tra browser console để xem chi tiết

### Lỗi 5: "Invalid JSON response"
**Nguyên nhân**: Gemini trả về text thay vì JSON

**Giải pháp**:
- Đây là lỗi bình thường, AI đôi khi không follow format
- Code đã có error handling
- Thử chạy lại hoặc test chức năng khác

## 📊 Kiểm tra trong Console:

Mở Browser Console (F12) và xem logs:

**Khi gọi API thành công:**
```
🔍 Calling Gemini API...
✅ Gemini response received
```

**Khi có lỗi:**
```
❌ Error calling Gemini API: [error message]
```

## 🎯 Test nhanh bằng Console:

Mở Browser Console (F12) và chạy:

```javascript
// Test 1: Import service
const { generateDestinationDescription } = await import('./services/geminiService.js');

// Test 2: Gọi API
const result = await generateDestinationDescription('Vũng Tàu', 'Bà Rịa - Vũng Tàu');

// Test 3: Xem kết quả
console.log(result);
```

**Kết quả mong đợi**: Hiển thị đoạn mô tả về Vũng Tàu

## ✅ Xác nhận hoạt động:

Nếu thấy:
- ✅ Demo page hiển thị đúng
- ✅ Click "Chạy" thấy loading spinner
- ✅ Sau 2-5 giây hiển thị kết quả
- ✅ Kết quả có nội dung liên quan đến địa điểm

→ **Gemini AI đã hoạt động thành công!** 🎉

## 📝 Ghi chú:

### API Key đã cung cấp:
```
AIzaSyDgVjLkshu4Jf24Pzv2JVnjC9MpE7POTic
```

### Giới hạn Free Tier:
- 60 requests/minute
- 1,500 requests/day
- 1 million tokens/month

### Thời gian response:
- Trung bình: 2-5 giây
- Tối đa: 10 giây
- Nếu quá 10 giây → Có thể API đang quá tải

## 🔧 Debug Steps:

### 1. Kiểm tra API key có load không:
```javascript
console.log('API Key:', process.env.REACT_APP_GEMINI_API_KEY);
// Nên hiển thị: AIzaSy...
```

### 2. Kiểm tra network request:
- Mở DevTools → Network tab
- Click "Chạy" trong demo
- Tìm request đến `generativelanguage.googleapis.com`
- Xem status code:
  - 200 = Thành công ✅
  - 400 = API key sai ❌
  - 429 = Rate limit ❌

### 3. Kiểm tra response:
- Click vào request trong Network tab
- Xem Response tab
- Nên thấy JSON với `candidates` array

## 🎉 Kết luận:

Nếu tất cả các bước trên đều OK:
→ **Gemini AI đã sẵn sàng sử dụng!**

Bạn có thể:
1. Test trên demo page
2. Tích hợp vào các tính năng hiện tại
3. Tùy chỉnh prompts để phù hợp với nhu cầu

---

**Lưu ý quan trọng**: 
- Luôn restart server sau khi thay đổi `.env`
- Không commit file `.env` lên Git
- Giữ API key bí mật
