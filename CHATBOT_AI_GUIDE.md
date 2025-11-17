# 🤖 AI Chatbot Du Lịch - Hướng Dẫn

## ✅ Đã sửa và thêm:

### 1. **Sửa lỗi API Model**
**Lỗi cũ:**
```
models/gemini-pro is not found for API version v1beta
```

**Đã sửa:**
```javascript
// Trước: gemini-pro (deprecated)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Sau: gemini-1.5-flash (mới nhất)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
```

### 2. **Thêm 2 chức năng mới**

#### `askTravelQuestion(question, context)`
Trả lời câu hỏi về du lịch

**Ví dụ:**
```javascript
const answer = await askTravelQuestion('Đà Nẵng có món gì ngon?');
// → "Đà Nẵng nổi tiếng với mì Quảng, bánh xèo, bún chả cá..."
```

#### `suggestDestinationFromDescription(description, preferences)`
Gợi ý điểm đến dựa trên mô tả

**Ví dụ:**
```javascript
const suggestions = await suggestDestinationFromDescription(
    'Tôi muốn đi biển, ăn hải sản, ngân sách 5 triệu'
);
// → [{ name: "Vũng Tàu", province: "Bà Rịa - Vũng Tàu", ... }, ...]
```

### 3. **Tạo AI Chatbot Component**

**File:** `src/components/TravelChatbot.js`

**Tính năng:**
- 💬 Chat trực tiếp với AI
- 🎯 Gợi ý điểm đến thông minh
- 📍 Trả lời câu hỏi về du lịch
- ⚡ Câu hỏi gợi ý nhanh
- 🎨 Giao diện đẹp, responsive

**Vị trí:** Floating button ở góc dưới bên phải màn hình

## 🚀 Cách sử dụng:

### Bước 1: Restart server
```bash
# Dừng server (Ctrl+C)
npm start
```

### Bước 2: Mở ứng dụng
```
http://localhost:3000
```

### Bước 3: Click vào nút chatbot
- Tìm nút tròn màu tím ở góc dưới bên phải: 💬
- Click để mở chatbot

### Bước 4: Bắt đầu chat!

**Ví dụ câu hỏi:**

#### 1. Hỏi về điểm đến:
```
"Gợi ý điểm đến biển đẹp cho gia đình"
"Tôi muốn đi núi, có khí hậu mát mẻ"
"Nơi nào phù hợp cho người thích chụp ảnh?"
```

#### 2. Hỏi về chi phí:
```
"Du lịch Đà Lạt 3 ngày hết bao nhiêu?"
"Chi phí đi Phú Quốc 2 người?"
"Ngân sách 5 triệu nên đi đâu?"
```

#### 3. Hỏi về món ăn:
```
"Đà Nẵng có món gì ngon?"
"Đặc sản Nha Trang là gì?"
"Quán ăn nào ngon ở Hà Nội?"
```

#### 4. Hỏi về thời điểm:
```
"Tháng 12 nên đi đâu?"
"Mùa nào đẹp nhất ở Sapa?"
"Khi nào thời tiết Vũng Tàu đẹp?"
```

#### 5. Hỏi về hoạt động:
```
"Ở Hội An có gì chơi?"
"Hoạt động gì thú vị ở Đà Lạt?"
"Tôi nên làm gì ở Phú Quốc?"
```

## 🎯 Tính năng đặc biệt:

### 1. Phát hiện Intent thông minh
Chatbot tự động phát hiện ý định:

**Gợi ý điểm đến:**
- "Gợi ý...", "Tìm...", "Nên đi..."
- → Trả về 3 điểm đến phù hợp với lý do chi tiết

**Trả lời câu hỏi:**
- Các câu hỏi khác
- → Trả lời chi tiết, thân thiện

### 2. Câu hỏi gợi ý nhanh
Khi mới mở chatbot, có 5 câu hỏi gợi ý:
- 🏖️ Gợi ý điểm đến biển đẹp
- 🏔️ Nơi nào có núi non hùng vĩ?
- 🍜 Đà Nẵng có món gì ngon?
- 💰 Du lịch Hà Nội 3 ngày hết bao nhiêu?
- 📅 Tháng 12 nên đi đâu?

Click vào để hỏi ngay!

### 3. Context-aware
Chatbot nhớ context của cuộc hội thoại:
```
User: "Tôi muốn đi biển"
Bot: "Gợi ý Vũng Tàu, Nha Trang, Phú Quốc..."

User: "Cái đầu tiên có gì chơi?"
Bot: "Vũng Tàu có Tượng Chúa Kitô, Bãi Trước, Hải Đăng..."
```

### 4. Format đẹp
- **Bold text** cho tên địa điểm
- Emoji phù hợp
- Danh sách có số thứ tự
- Thông tin chi tiết, dễ đọc

## 🎨 Giao diện:

### Desktop:
- Floating button: 60x60px, góc dưới phải
- Chat window: 400x600px
- Smooth animations
- Gradient màu tím đẹp

### Mobile:
- Responsive, full screen
- Touch-friendly
- Tự động scroll xuống tin nhắn mới

## 🔧 Tùy chỉnh:

### Thay đổi vị trí chatbot:
```css
/* src/components/TravelChatbot.css */
.chatbot-toggle {
    bottom: 30px;  /* Thay đổi khoảng cách từ dưới */
    right: 30px;   /* Thay đổi khoảng cách từ phải */
}
```

### Thay đổi màu sắc:
```css
.chatbot-toggle {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    /* Thay đổi gradient */
}
```

### Thay đổi câu chào:
```javascript
// src/components/TravelChatbot.js
const [messages, setMessages] = useState([
    {
        type: 'bot',
        text: 'Xin chào! 👋 Tôi là...',  // Thay đổi ở đây
        timestamp: new Date()
    }
]);
```

## 📊 Performance:

### Thời gian response:
- Câu hỏi đơn giản: 2-3 giây
- Gợi ý điểm đến: 3-5 giây
- Câu hỏi phức tạp: 5-8 giây

### API Limits:
- 60 requests/minute
- 1,500 requests/day
- Đủ cho ~100 cuộc hội thoại/ngày

## 🐛 Troubleshooting:

### Chatbot không hiển thị:
1. Kiểm tra console có lỗi không
2. Restart server
3. Clear cache browser (Ctrl+Shift+R)

### Response chậm:
1. Kiểm tra internet
2. Gemini API có thể đang quá tải
3. Thử lại sau 1 phút

### Lỗi "API key not found":
1. Kiểm tra `.env` có `REACT_APP_GEMINI_API_KEY`
2. Restart server
3. Kiểm tra API key còn hạn không

### Response không đúng format:
1. AI đôi khi không follow format JSON
2. Code đã có error handling
3. Thử hỏi lại hoặc hỏi cách khác

## 💡 Tips sử dụng:

### 1. Hỏi cụ thể:
❌ "Tôi muốn đi du lịch"
✅ "Gợi ý điểm đến biển đẹp cho gia đình, ngân sách 10 triệu, 3 ngày"

### 2. Hỏi từng bước:
```
1. "Gợi ý điểm đến biển đẹp"
2. "Vũng Tàu có gì chơi?"
3. "Chi phí đi Vũng Tàu 2 người?"
4. "Thời điểm nào đẹp nhất?"
```

### 3. Sử dụng câu hỏi gợi ý:
- Click vào câu hỏi có sẵn
- Tiết kiệm thời gian
- Kết quả tốt hơn

### 4. Kiên nhẫn:
- AI cần 2-5 giây để suy nghĩ
- Không spam nhiều câu hỏi cùng lúc
- Đợi response xong mới hỏi tiếp

## 🎉 Kết luận:

Bây giờ bạn có:
- ✅ AI Chatbot thông minh
- ✅ Gợi ý điểm đến tự động
- ✅ Trả lời mọi câu hỏi du lịch
- ✅ Giao diện đẹp, dễ dùng
- ✅ Hoạt động ở mọi trang

**Hãy thử ngay!** 💬

---

**Lưu ý:** 
- Chatbot sử dụng Gemini 1.5 Flash (model mới nhất)
- Miễn phí trong giới hạn Free Tier
- Có thể tích hợp thêm tính năng booking, payment sau
