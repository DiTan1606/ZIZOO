# 🚀 Quick Start - AI Chatbot

## ✅ Đã sửa lỗi API:

**Model name đã đổi:**
```javascript
// Trước: gemini-1.5-flash (lỗi 404)
// Sau: gemini-pro (hoạt động)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
```

## 💬 Chatbot đã sẵn sàng!

### Cách sử dụng:

#### Bước 1: Restart server
```bash
# Dừng server (Ctrl+C)
npm start
```

#### Bước 2: Mở app
```
http://localhost:3000
```

#### Bước 3: Tìm nút chatbot
- Nhìn xuống **góc dưới bên phải** màn hình
- Thấy nút tròn màu tím với icon 💬
- **Click vào nút đó**

#### Bước 4: Chat với AI!

**Cửa sổ chat sẽ mở ra với:**
- Lời chào từ AI
- 5 câu hỏi gợi ý (click để hỏi nhanh)
- Ô nhập text ở dưới cùng

### 📝 Ví dụ câu hỏi:

#### 1. Gợi ý điểm đến:
```
"Gợi ý điểm đến biển đẹp cho gia đình"
"Tôi muốn đi núi, có khí hậu mát mẻ"
"Nơi nào phù hợp cho người thích chụp ảnh?"
"Tìm điểm đến lãng mạn cho cặp đôi"
```

**AI sẽ trả về:**
- 3 điểm đến phù hợp
- Lý do tại sao phù hợp
- Điểm nổi bật
- Chi phí ước tính
- Thời điểm đẹp nhất

#### 2. Hỏi về địa điểm cụ thể:
```
"Đà Nẵng có gì chơi?"
"Vũng Tàu có món gì ngon?"
"Nên đi đâu ở Hà Nội?"
"Phú Quốc có bãi biển nào đẹp?"
```

#### 3. Hỏi về chi phí:
```
"Du lịch Đà Lạt 3 ngày hết bao nhiêu?"
"Chi phí đi Nha Trang 2 người?"
"Ngân sách 5 triệu nên đi đâu?"
```

#### 4. Hỏi về thời điểm:
```
"Tháng 12 nên đi đâu?"
"Mùa nào đẹp nhất ở Sapa?"
"Khi nào thời tiết Vũng Tàu đẹp?"
```

## 🎯 Hướng dẫn chi tiết:

### Giao diện Chatbot:

```
┌─────────────────────────────────┐
│ 🤖 Trợ lý Du lịch AI      [X]  │ ← Header
├─────────────────────────────────┤
│                                 │
│  Bot: Xin chào! 👋             │ ← Tin nhắn bot
│                                 │
│           User: Xin chào! 👋   │ ← Tin nhắn user
│                                 │
├─────────────────────────────────┤
│ Câu hỏi gợi ý:                 │ ← Quick questions
│ [🏖️ Gợi ý điểm đến biển đẹp]  │
│ [🏔️ Nơi nào có núi non...]     │
├─────────────────────────────────┤
│ [Nhập câu hỏi...]         [📤] │ ← Input
└─────────────────────────────────┘
```

### Cách nhập câu hỏi:

1. **Click vào ô input** (ô trắng ở dưới cùng)
2. **Gõ câu hỏi** của bạn
3. **Nhấn Enter** hoặc click nút 📤
4. **Đợi 2-5 giây** (sẽ thấy 3 chấm nhảy)
5. **Xem câu trả lời** từ AI

### Tips:

✅ **Hỏi cụ thể:**
- "Gợi ý điểm đến biển đẹp cho gia đình, ngân sách 10 triệu"
- Thay vì: "Tôi muốn đi du lịch"

✅ **Sử dụng câu hỏi gợi ý:**
- Click vào câu hỏi có sẵn
- Tiết kiệm thời gian

✅ **Hỏi từng bước:**
```
1. "Gợi ý điểm đến biển đẹp"
2. "Vũng Tàu có gì chơi?"
3. "Chi phí đi Vũng Tàu 2 người?"
```

## 🐛 Nếu không thấy chatbot:

### 1. Kiểm tra nút floating:
- Nhìn xuống **góc dưới bên phải**
- Có nút tròn màu tím không?
- Nếu không → Restart server

### 2. Kiểm tra console:
- Mở DevTools (F12)
- Xem tab Console
- Có lỗi gì không?

### 3. Clear cache:
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

### 4. Restart server:
```bash
# Dừng server (Ctrl+C)
npm start
```

## 📱 Trên Mobile:

- Chatbot vẫn hoạt động
- Nút ở góc dưới phải
- Cửa sổ chat full screen
- Touch-friendly

## 🎉 Demo nhanh:

### Test 1: Click câu hỏi gợi ý
1. Mở chatbot
2. Click "🏖️ Gợi ý điểm đến biển đẹp"
3. Đợi 3-5 giây
4. Xem kết quả

### Test 2: Nhập câu hỏi tự do
1. Click vào ô input
2. Gõ: "Đà Nẵng có món gì ngon?"
3. Nhấn Enter
4. Đợi 2-3 giây
5. Xem câu trả lời

### Test 3: Hỏi tiếp
1. Sau khi có câu trả lời
2. Hỏi tiếp: "Quán nào ngon nhất?"
3. AI sẽ trả lời dựa trên context

## ✨ Tính năng đặc biệt:

### 1. Phát hiện intent:
- Nếu hỏi "Gợi ý..." → Trả về 3 điểm đến
- Nếu hỏi thông thường → Trả lời chi tiết

### 2. Format đẹp:
- **Bold** cho tên địa điểm
- Emoji phù hợp
- Danh sách có số thứ tự

### 3. Typing indicator:
- 3 chấm nhảy khi AI đang suy nghĩ
- Biết AI đang xử lý

### 4. Timestamp:
- Mỗi tin nhắn có giờ gửi
- Dễ theo dõi cuộc hội thoại

## 🎯 Kết luận:

**Chatbot đã sẵn sàng 100%!**

Chỉ cần:
1. ✅ Restart server
2. ✅ Mở app
3. ✅ Click nút 💬 ở góc dưới phải
4. ✅ Bắt đầu chat!

**Không cần làm gì thêm!** 🚀

---

**Lưu ý:**
- Chatbot hiển thị ở **mọi trang**
- Có thể đóng/mở bất cứ lúc nào
- Lịch sử chat được giữ trong session
- Refresh page sẽ reset chat
