# ⚠️ LỖI CORS VẪN CÒN - KIỂM TRA NGAY

## Vấn đề hiện tại
URL vẫn dùng `.firebasestorage.app` là **ĐÚNG** - đây là domain mới của Firebase.
Lỗi CORS xảy ra vì **Storage Rules chưa được cấu hình đúng**.

## ✅ GIẢI PHÁP CHÍNH - LÀM NGAY

### 1. VÀO FIREBASE CONSOLE VÀ PUBLISH RULES
**Link trực tiếp:** https://console.firebase.google.com/project/zizoo-23525310/storage/rules

**Các bước:**
1. Click vào link trên
2. Xóa toàn bộ rules hiện tại
3. Copy và paste rules sau:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{filename} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    match /{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

4. Click nút **"Publish"** (màu xanh)
5. Đợi vài giây để rules được áp dụng

### 2. KIỂM TRA AUTHENTICATION
Đảm bảo bạn đã đăng nhập:
- Mở Console của browser (F12)
- Chạy: `firebase.auth().currentUser`
- Phải thấy user object, không phải null

### 3. RESTART SERVER (nếu chưa làm)
```bash
# Dừng server (Ctrl+C)
npm start
```

### 4. THỬ LẠI
1. Refresh trang profile
2. Chọn ảnh mới
3. Click "✓ Upload ảnh"

## 🔍 Debug thêm

Nếu vẫn lỗi, kiểm tra:

### A. Xem Storage Rules hiện tại
1. Vào: https://console.firebase.google.com/project/zizoo-23525310/storage/rules
2. Xem rules có giống như trên không?
3. Có thông báo lỗi gì không?

### B. Kiểm tra Authentication
1. Vào: https://console.firebase.google.com/project/zizoo-23525310/authentication/users
2. Tìm user ID: `yp5F0eSbpSWgJIpInU1MfQjDymn1`
3. User có tồn tại không?

### C. Xem Console Logs
Mở DevTools (F12) → Console, xem có lỗi gì khác không?

## 📝 Lưu ý quan trọng

1. **`.firebasestorage.app` là domain MỚI và ĐÚNG** của Firebase Storage
2. **Không cần đổi sang `.appspot.com`** nữa
3. **Vấn đề chính là Storage Rules**
4. Rules phải cho phép `read: if true` để đọc ảnh công khai
5. Rules phải cho phép `write` khi user đã đăng nhập và đúng userId

## 🚨 Nếu vẫn không được

Thử rules đơn giản hơn (CHỈ ĐỂ TEST):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

**LƯU Ý:** Rules này cho phép mọi người đọc/ghi - CHỈ DÙNG ĐỂ TEST!
Sau khi test xong, đổi lại rules an toàn ở trên.
