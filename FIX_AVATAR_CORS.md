# Hướng dẫn sửa lỗi CORS khi upload Avatar

## Vấn đề
Lỗi CORS xảy ra khi upload/đọc ảnh avatar từ Firebase Storage do:
1. Storage bucket URL sai (`.firebasestorage.app` thay vì `.appspot.com`)
2. Firebase Storage Rules chưa được cấu hình
3. Ảnh cũ đã được lưu với URL sai

## Giải pháp đã áp dụng

### 1. Đã cập nhật .env
```
REACT_APP_FIREBASE_STORAGE_BUCKET=zizoo-23525310.appspot.com
```

### 2. Đã sửa code
- `src/firebase.js`: Khởi tạo Storage với bucket URL đúng
- `src/pages/UserProfile.js`: 
  - Dùng `avatarPreview` thay vì `currentUser.photoURL`
  - Tự động fix URL cũ khi load profile

### 3. Đã tạo CORS config
File `cors.json` đã được tạo để cấu hình CORS cho Storage

## Các bước cần làm NGAY BÂY GIỜ

### Bước 1: RESTART DEV SERVER (BẮT BUỘC)
```bash
# Nhấn Ctrl+C để dừng server hiện tại
# Sau đó chạy lại:
npm start
```

### Bước 2: CẤU HÌNH FIREBASE STORAGE RULES
1. Truy cập: https://console.firebase.google.com/project/zizoo-23525310/storage
2. Click tab **"Rules"**
3. Copy toàn bộ nội dung từ file `FIREBASE_STORAGE_RULES.txt`
4. Paste vào editor
5. Click **"Publish"**

### Bước 3: XÓA ẢNH CŨ (nếu có lỗi)
1. Vào: https://console.firebase.google.com/project/zizoo-23525310/storage/files
2. Tìm folder: `avatars/yp5F0eSbpSWgJIpInU1MfQjDymn1/`
3. Xóa toàn bộ ảnh trong folder này
4. Quay lại app và upload ảnh mới

### Bước 4: (TÙY CHỌN) Cấu hình CORS qua Google Cloud SDK
Nếu vẫn còn lỗi, chạy lệnh sau (cần cài Google Cloud SDK):
```bash
gsutil cors set cors.json gs://zizoo-23525310.appspot.com
```

Cài Google Cloud SDK:
- macOS: `brew install google-cloud-sdk`
- Hoặc: https://cloud.google.com/sdk/docs/install

## Kiểm tra

Sau khi làm xong các bước trên:
1. Refresh trang profile
2. Click nút "📷" để chọn ảnh
3. Click "✓ Upload ảnh"
4. Ảnh sẽ được upload thành công không có lỗi CORS

## Lưu ý
- Phải restart server để load .env mới
- Phải publish Storage Rules trên Firebase Console
- Nếu vẫn lỗi, xóa ảnh cũ và upload lại
