# 🚀 Hướng dẫn Sử dụng Hệ thống Zizoo

## 🎯 **Tổng quan**

Zizoo là hệ thống lịch trình du lịch thông minh với AI, cung cấp 3 chức năng chính:

1. **🤖 AI Gợi ý Cá nhân hóa** - Recommendations dựa trên ML
2. **📋 Lịch trình Hoàn chỉnh** - 8 phần chuẩn với dữ liệu thật
3. **⚠️ Cảnh báo Thời gian thực** - Monitoring và auto-adjustments

---

## 🏃‍♂️ **Bắt đầu nhanh**

### **1. Khởi động ứng dụng:**
```bash
npm start
```

### **2. Truy cập các tính năng:**
- **Trang chủ**: `http://localhost:3000/`
- **AI Gợi ý**: `http://localhost:3000/ai-recommendations`
- **Lịch trình Hoàn chỉnh**: `http://localhost:3000/complete-planner`
- **Demo**: `http://localhost:3000/demo`

---

## 📋 **1. Lịch trình Hoàn chỉnh** (`/complete-planner`)

### **Cách sử dụng:**

#### **Bước 1: Thiết lập thông tin cơ bản**
```
📍 Điểm khởi hành: Hà Nội, TP.HCM, Đà Nẵng...
📍 Điểm đến: Chọn từ danh sách 60+ thành phố VN
📅 Ngày khởi hành: Chọn ngày cụ thể
⏱️ Số ngày: 2-14 ngày
👥 Số người: 1-10 người
💰 Ngân sách: Nhập số tiền hoặc chọn gợi ý
```

#### **Bước 2: Chọn phong cách du lịch**
- **🎒 Tiết kiệm**: Tối ưu chi phí, trải nghiệm cơ bản
- **⭐ Trung bình**: Cân bằng chất lượng và giá cả  
- **🏨 Thoải mái**: Tiện nghi tốt, dịch vụ chất lượng
- **💎 Sang trọng**: Dịch vụ cao cấp, trải nghiệm đẳng cấp

#### **Bước 3: Chọn sở thích**
```
🏛️ Văn hóa    🌿 Thiên nhiên    🍜 Ẩm thực    📸 Chụp ảnh
🏔️ Mạo hiểm   🏖️ Thư giãn      🛍️ Mua sắm    🌃 Cuộc sống đêm
```

#### **Bước 4: Xem trước và tạo**
- Kiểm tra thông tin
- Nhấn **"Tạo lịch trình hoàn chỉnh"**
- Chờ 30-60 giây để AI xử lý

### **Kết quả nhận được:**

#### **📋 8 phần hoàn chỉnh:**
1. **Thông tin cơ bản**: Tên trip, thời gian, ngân sách
2. **Lịch trình chi tiết**: Giờ giấc cụ thể từng ngày
3. **Chi phí dự kiến**: Breakdown chi tiết từng khoản
4. **Phương tiện**: Khứ hồi + di chuyển tại địa phương
5. **Lưu trú**: Gợi ý khách sạn + links đặt phòng
6. **Packing list**: Đồ cần mang theo thời tiết
7. **Lưu ý quan trọng**: Thời tiết, văn hóa, an toàn
8. **Bản đồ & lộ trình**: Tối ưu di chuyển

#### **🔍 Monitoring thời gian thực:**
- Cảnh báo thời tiết xấu
- Thông báo đóng cửa điểm đến
- Alerts giao thông ùn tắc
- Đề xuất điều chỉnh tự động

---

## 🤖 **2. AI Gợi ý Cá nhân hóa** (`/ai-recommendations`)

### **Cách sử dụng:**

#### **Thiết lập sở thích chi tiết:**
```
📅 Tháng du lịch: 1-12
💰 Ngân sách: Slider hoặc nhập số
🎯 Loại hình: Nghỉ dưỡng, Mạo hiểm, Văn hóa...
⚡ Mức mạo hiểm: Cấp độ 1-5
🌱 Du lịch xanh: Bật/tắt
📍 Tỉnh thành: Chọn nhiều tỉnh
```

#### **Nhận gợi ý AI:**
- **Hybrid AI**: Kết hợp 3 thuật toán ML
- **Confidence Score**: Độ tin cậy của AI (%)
- **Explanations**: Giải thích tại sao gợi ý
- **Diversity**: Đảm bảo gợi ý đa dạng

#### **Đánh giá feedback:**
- Rate 1-5 sao cho mỗi gợi ý
- AI học hỏi và cải thiện
- Gợi ý ngày càng chính xác hơn

### **Tính năng nâng cao:**
- **Chế độ đánh giá**: Bật để rate các gợi ý
- **Hiển thị giải thích**: Xem lý do AI gợi ý
- **Real-time learning**: AI học từ feedback ngay lập tức

---

## 🧪 **3. Demo Hệ thống** (`/demo`)

### **3 loại demo:**

#### **📋 Complete Itinerary Demo**
- Test tạo lịch trình hoàn chỉnh
- Sử dụng dữ liệu mẫu: Hà Nội → Đà Nẵng 4N3Đ
- Xem kết quả JSON chi tiết

#### **🤖 AI Recommendations Demo**  
- Test hệ thống gợi ý AI
- Hiển thị confidence scores
- Xem explanations của AI

#### **🎯 AI Training Demo**
- Tạo synthetic data để test
- Training các ML models
- Xem kết quả training

---

## ⚠️ **4. Hệ thống Cảnh báo**

### **Tự động theo dõi:**
- **Thời tiết**: Mưa lớn, bão, nhiệt độ cực đoan
- **Địa điểm**: Đóng cửa, thay đổi giờ mở
- **Giao thông**: Ùn tắc, tai nạn
- **Giá cả**: Tăng giá vé, khuyến mãi

### **Cách xử lý alerts:**
1. Nhận notification trong app
2. Xem suggested actions
3. Chấp nhận hoặc từ chối đề xuất
4. AI tự động điều chỉnh lịch trình

---

## 🔧 **5. Cài đặt & Cấu hình**

### **Environment Variables (.env):**
```env
# Firebase
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id

# Google Maps
REACT_APP_GOOGLE_MAPS_API_KEY=your_maps_key

# Weather API
REACT_APP_WEATHER_API_KEY=your_weather_key
```

### **Cài đặt dependencies:**
```bash
npm install
```

### **Khởi động development:**
```bash
npm start
```

---

## 📱 **6. Giao diện & Tính năng**

### **Navigation:**
- **Trang chủ**: Overview và giới thiệu
- **Lên kế hoạch**: Basic planner (legacy)
- **📋 Lịch trình hoàn chỉnh**: Main feature
- **🤖 AI Gợi ý**: Personalized recommendations
- **Chuyến đi**: Quản lý trips đã tạo

### **Responsive Design:**
- ✅ Desktop: Full features
- ✅ Tablet: Optimized layout  
- ✅ Mobile: Touch-friendly

### **Print & Export:**
- 🖨️ In lịch trình (print-friendly)
- 💾 Tải xuống JSON
- 📧 Chia sẻ qua email (future)

---

## 🎯 **7. Tips & Best Practices**

### **Để có kết quả tốt nhất:**

#### **Khi tạo lịch trình:**
- Chọn ngày cụ thể (không phải quá xa)
- Nhập ngân sách thực tế
- Chọn đúng phong cách du lịch
- Tick đủ sở thích quan tâm

#### **Khi sử dụng AI:**
- Đánh giá feedback thường xuyên
- Thử nhiều combination khác nhau
- Đọc explanations để hiểu AI
- Sử dụng chế độ đánh giá

#### **Khi nhận alerts:**
- Đọc kỹ suggested actions
- Chấp nhận đề xuất hợp lý
- Theo dõi weather updates
- Check status địa điểm trước khi đi

---

## 🚨 **8. Troubleshooting**

### **Lỗi thường gặp:**

#### **"Không tìm thấy địa điểm"**
- Kiểm tra Google Maps API key
- Thử tên địa điểm khác
- Chọn tỉnh thành từ dropdown

#### **"Lỗi tạo lịch trình"**
- Kiểm tra internet connection
- Thử lại sau vài phút
- Giảm số ngày hoặc địa điểm

#### **"AI không hoạt động"**
- Cần ít nhất 10 feedback để train
- Chạy demo để tạo synthetic data
- Kiểm tra Firebase connection

#### **"Alerts không hiển thị"**
- Đăng nhập để sử dụng monitoring
- Tạo ít nhất 1 lịch trình
- Kiểm tra notification permissions

### **Debug mode:**
```javascript
// Trong browser console
localStorage.setItem('ZIZOO_DEBUG', 'true');
```

---

## 📞 **9. Hỗ trợ**

### **Tài liệu:**
- `AI_RECOMMENDATIONS_README.md` - Chi tiết về AI
- `COMPLETE_SYSTEM_README.md` - Tổng quan hệ thống
- `SYSTEM_OPTIMIZATION_SUMMARY.md` - Tối ưu hóa

### **Liên hệ:**
- GitHub Issues cho bugs
- GitHub Discussions cho questions
- Email: support@zizoo.travel (placeholder)

---

## 🎉 **Kết luận**

Zizoo cung cấp trải nghiệm lập lịch trình du lịch hoàn toàn mới với:

- ✅ **Dữ liệu thật 100%** từ Google Places, Weather APIs
- ✅ **AI cá nhân hóa** với 3 thuật toán ML
- ✅ **Monitoring thời gian thực** 24/7
- ✅ **Lịch trình hoàn chỉnh** 8 phần chuẩn
- ✅ **Auto-adjustments** khi có thay đổi

**Hãy bắt đầu tạo chuyến đi hoàn hảo của bạn! 🚀**