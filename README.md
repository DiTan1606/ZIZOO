# ZIZOO - A Travel Itinerary Design and Optimization Application Based on Real-Time Data

Đây là file hướng dẫn chính thức cho dự án của chúng ta.

Mình đã setup xong sườn dự án bao gồm **React**, **React Router**, và **Firebase** (Auth, Firestore, Hosting).

Mọi người chỉ cần làm theo **chính xác** các bước dưới đây để cài đặt môi trường và chạy dự án trên máy của mình. Gặp lỗi ở đâu cứ chụp màn hình và ping mình nhé!

## ⚙️ Công nghệ sử dụng

* **Frontend:** React.js
* **Routing:** React Router DOM
* **Backend & DB:** Firebase (Authentication, Cloud Firestore, Storage)
* **Hosting:** Firebase Hosting

---

## 🚀 Bước 1: Cài đặt Môi trường (Chỉ làm 1 lần)

### 1. Clone code về máy

Mở terminal của bạn và chạy lệnh sau:

```bash
git clone https://github.com/DiTan1606/ZIZOO.git
```
```bash
cd [Tên-thư-mục-dự-án]
```

### 2. Cài đặt thư viện

Bạn cần có Node.js (phiên bản 16 trở lên) đã cài trên máy.

```bash
npm install
```

### 3. Kết nối API Key 

Dự án cần "chìa khóa" (API keys) để biết phải kết nối đến project Firebase nào. Vì lý do bảo mật, chúng ta không đẩy key lên GitHub.

1. Tại thư mục gốc của dự án, tạo một file mới tên là .env (chỉ .env, không có gì ở trước).

2. Mở file .env.example (đã có sẵn trong code).

3. Copy toàn bộ nội dung của .env.example và dán vào file .env bạn vừa tạo.

4. Liên hệ với tui để lấy các API keys và điền vào các giá trị còn trống trong file .env.

TUYỆT ĐỐI KHÔNG push file .env lên GitHub. (Mình đã setup .gitignore để tự động chặn file này, nhưng vẫn phải cẩn thận).

## 🧪 Bước 2: Chạy và Kiểm tra Dự án (Làm mỗi khi code)

Sau khi cài đặt xong, đây là cách bạn chạy dự án để code.

```bash
npm start
```
- Lệnh này sẽ khởi động một server ảo trên máy bạn.

- Trình duyệt sẽ tự động mở tab mới tại địa chỉ http://localhost:3000.

- Nếu bạn thấy trang web hiện ra -> Bạn đã chạy React thành công!

- Nếu bạn thầy "Data: Hello Zizoo" -> Bạn đã kết nối Firebase thành công!

## 🌎 Bước 3: Triển khai (Deploy) Website

Khi chúng ta hoàn thành một tính năng và muốn cập nhật web cho mọi người xem, chúng ta sẽ deploy lên link chính thức của Firebase.

(Chỉ làm 1 lần) Cài đặt Firebase Tools:

```bash
npm install -g firebase-tools
```
```bash
firebase login
```
(Lệnh này sẽ mở trình duyệt để bạn đăng nhập vào tài khoản Google chứa project Firebase).

Quy trình Deploy (Làm mỗi khi muốn cập nhật):

1. Build Project: Dịch code React thành file HTML/CSS/JS tĩnh.
```bash
npm run build
```
(Lệnh này sẽ tạo ra thư mục build/)

2. Deploy: Đẩy thư mục build/ lên Firebase.
```bash
firebase deploy --only hosting
```

Sau khi chạy xong, terminal sẽ trả về một Hosting URL. Đó chính là link website của nhóm mình (ví dụ: https://zizoo-23525310.web.app).
