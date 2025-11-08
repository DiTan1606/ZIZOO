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
cd ZIZOO
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

---

## 🧪 Bước 2: Chạy và Kiểm tra Dự án (Làm mỗi khi code)

Sau khi cài đặt xong, đây là cách bạn chạy dự án để code.

```bash
npm start
```
- Lệnh này sẽ khởi động một server ảo trên máy bạn.

- Trình duyệt sẽ tự động mở tab mới tại địa chỉ http://localhost:3000.

- Nếu bạn thấy trang web hiện ra -> Bạn đã chạy React thành công!

- Nếu bạn thầy "Data: Hello Zizoo" -> Bạn đã kết nối Firebase thành công!

---

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

---
## 🗺️ Giải thích Cấu trúc Dự án
Chạy xong thì đọc cái này để hiểu cấu trúc dự án.

Đây là giải thích về "bản đồ" dự án của chúng ta, để mọi người đều biết file nào làm gì và code mới nên đặt ở đâu.

### 📁 Thư mục Gốc (ZIZOO)
Đây là các file cấu hình chính.

- .firebase/: Thư mục "nháp" của Firebase, chứa thông tin cache. Bạn không cần đụng vào đây.

- build/: Thư mục "sản phẩm". Khi chạy npm run build, toàn bộ code trong src/ sẽ được dịch và nén vào đây. Chính thư mục này sẽ được deploy.

- node_modules/: "Kho" thư viện của bên thứ ba (React, Firebase...). Lệnh npm install tự động tạo ra nó. Không bao giờ push thư mục này.

- public/: Chứa file index.html gốc (khung sườn HTML của app) và các file tĩnh như favicon.ico.

- src/: "Nguyên liệu" - Nơi chúng ta sẽ code 99% thời gian (components, pages, services...).

### 📄 Tập tin Gốc
- .env: (Bí mật) File chứa API key CỦA BẠN. Không push lên Git.

- .env.example: (Công khai) File mẫu API key cho CẢ NHÓM. Phải push lên Git.

- .firebaserc: File "chỉ đường", nói cho Firebase CLI biết deploy lên project nào. Phải push lên Git.

- .gitignore: Bản danh sách "cấm" của Git (ví dụ: cấm node_modules/, cấm .env).

- firebase.json: File cấu hình Firebase Hosting. Quan trọng nhất là:

- package-lock.json: "Bản khóa" phiên bản. Ghi lại chính xác phiên bản của mọi thư viện đã cài để cả team dùng giống hệt nhau. Phải push lên Git.

- package.json: "Căn cước" của dự án. Liệt kê các thư viện cần (dependencies) và các "scripts" (như npm start).

- README.md: Chính là file này! Dùng để hướng dẫn team.

### 📂 Bên trong src/ (Nơi chúng ta code)

- index.js: Điểm bắt đầu của app. Nó "gắn" component <App /> vào file public/index.html.

- App.js: Component "cha" của toàn bộ ứng dụng. Đây là nơi chúng ta thường setup các đường dẫn (Routes) chính (ví dụ: /login thì hiện LoginPage).

- firebase.js: Sợi dây điện chính. Nơi duy nhất dùng API key để khởi tạo Firebase và "xuất" (export) ra db, auth cho các file khác dùng.

- /assets: "Nhà kho" chứa hình ảnh, icons, fonts...

- /components: "Hộp LEGO". Chứa các component UI (giao diện) nhỏ, tái sử dụng ở nhiều nơi (ví dụ: Button.js, Navbar.js).

- /pages: "Các mô hình LEGO hoàn chỉnh". Đây là các trang hoàn chỉnh, thường được ráp lại từ nhiều components (ví dụ: HomePage.js, LoginPage.js).

- /context: "Bảng thông báo toàn cầu". Nơi chứa React Context. AuthContext.js nằm ở đây, giúp mọi component biết "user đã đăng nhập hay chưa?".

- /services: "Bộ phận phục vụ". Nơi chứa logic "nói chuyện" với Firebase. Thay vì gọi CSDL trực tiếp trong pages, chúng ta viết các hàm riêng ở đây (ví dụ: firestoreService.js chứa hàm getUserProfile()).

- /hooks: (Nâng cao) Nơi chứa các "custom hooks" (use...) để tái sử dụng logic.

- /utils: "Hộp đồ nghề". Chứa các hàm tiện ích nhỏ,