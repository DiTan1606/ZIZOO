# 📸 HƯỚNG DẪN HOÀN CHỈNH - UPLOAD AVATAR

## ✅ ĐÃ CẬP NHẬT

### 1. Backend Service (userProfileService.js)
- ✅ Viết lại hàm `uploadAvatar()` với logging chi tiết
- ✅ Viết lại hàm `deleteAvatar()` với error handling tốt hơn
- ✅ Cập nhật `getUserProfile()` để trả về đầy đủ trường avatar
- ✅ Cập nhật `saveUserProfile()` để không ghi đè avatar fields

### 2. Utility Functions
- ✅ Tạo `fixUserProfile.js` để tự động thêm trường thiếu
- ✅ Tạo `testFirebaseStorage.js` để test connection
- ✅ Tự động fix profile khi load trang

### 3. Frontend (UserProfile.js)
- ✅ Import các utilities mới
- ✅ Tự động fix profile fields khi mount
- ✅ Test Storage connection trong development mode
- ✅ Hiển thị avatar từ `avatarPreview` state

## 🔥 VẤN ĐỀ CHÍNH CẦN GIẢI QUYẾT

**Firebase Storage Rules chưa được publish!**

Đây là nguyên nhân duy nhất gây lỗi CORS. Code đã hoàn chỉnh, chỉ cần publish rules.

## 🚀 CÁCH SỬA - LÀM NGAY

### Bước 1: Publish Firebase Storage Rules

1. **Mở link:** https://console.firebase.google.com/project/zizoo-23525310/storage/rules

2. **Xóa rules cũ và paste rules mới:**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Avatar uploads
    match /avatars/{userId}/{filename} {
      // Cho phép đọc công khai
      allow read: if true;
      
      // Cho phép upload nếu:
      // - User đã đăng nhập
      // - userId khớp với auth.uid
      // - File < 5MB
      // - File là ảnh
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      
      // Cho phép xóa nếu là chủ sở hữu
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Test folder (cho development)
    match /test/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    // Default: chỉ cho phép đọc
    match /{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

3. **Click "PUBLISH"** (nút màu xanh)

4. **Đợi 10 giây** để rules được áp dụng

### Bước 2: Restart Server

```bash
# Dừng server (Ctrl+C)
npm start
```

### Bước 3: Kiểm tra

1. Mở http://localhost:3000/profile
2. Mở Console (F12)
3. Xem logs:
   - `✓ Profile fixed` - Profile đã được fix
   - `✓ Firebase Storage OK` - Storage hoạt động
   - `✓ User profile found` - Profile đã load

### Bước 4: Upload Avatar

1. Click nút 📷
2. Chọn ảnh (< 5MB)
3. Click "✓ Upload ảnh"
4. Xem logs trong Console:
   ```
   🔄 Starting avatar upload for user: ...
   📁 File info: ...
   ✓ File validation passed
   📤 Uploading to: ...
   ✓ Upload successful
   ✓ Download URL obtained
   ✓ User profile updated
   ✅ Avatar upload completed successfully!
   ```

## 📊 CÁCH DEBUG

### Kiểm tra Profile Fields

Mở Console và chạy:

```javascript
// Fix profile thiếu trường
window.fixUserProfile('USER_ID_HERE')

// Kiểm tra profile
firebase.firestore().collection('users').doc('USER_ID_HERE').get()
  .then(doc => console.log(doc.data()))
```

### Kiểm tra Storage Connection

```javascript
// Test upload
window.testFirebaseStorage()
```

### Xem User Document

Vào Firestore Console:
https://console.firebase.google.com/project/zizoo-23525310/firestore/data/users

Tìm user ID của bạn và xem các trường:
- ✅ `avatarURL` - URL của ảnh
- ✅ `avatarPath` - Path trong Storage
- ✅ `displayName`, `phone`, `bio`, etc.

## 🎯 KẾT QUẢ MONG ĐỢI

Sau khi publish rules và restart:

### Console Logs
```
✓ Profile fixed, fields added: ['avatarURL', 'avatarPath']
✓ Firebase Storage OK
📖 Getting user profile for: yp5F0eSbpSWgJIpInU1MfQjDymn1
✓ User profile found: { hasAvatar: false, avatarURL: null }
```

### Upload Avatar
```
🔄 Starting avatar upload for user: yp5F0eSbpSWgJIpInU1MfQjDymn1
📁 File info: { name: 'avatar.jpg', size: 123456, type: 'image/jpeg' }
✓ File validation passed
📤 Uploading to: avatars/yp5F0eSbpSWgJIpInU1MfQjDymn1/1763390433038_avatar.jpg
✓ Upload successful, getting download URL...
✓ Download URL obtained: https://firebasestorage.googleapis.com/...
✓ User profile updated
✅ Avatar upload completed successfully!
```

### Firestore Document
```javascript
{
  displayName: "Bùi Lê Hoàng Nhẩn",
  phone: "0862736072",
  bio: "",
  location: "Hồ Chí Minh",
  dateOfBirth: "2004-04-27",
  gender: "female",
  avatarURL: "https://firebasestorage.googleapis.com/v0/b/zizoo-23525310.firebasestorage.app/o/avatars%2F...jpg?alt=media&token=...",
  avatarPath: "avatars/yp5F0eSbpSWgJIpInU1MfQjDymn1/1763390433038_avatar.jpg",
  interests: [],
  travelStyle: "standard",
  budget: "medium",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## ⚠️ LƯU Ý

1. **PHẢI publish Storage Rules** - Đây là bước quan trọng nhất!
2. **PHẢI restart server** sau khi publish rules
3. **Kiểm tra Console logs** để debug
4. **Avatar URL** sẽ có format: `https://firebasestorage.googleapis.com/v0/b/zizoo-23525310.firebasestorage.app/o/...`
5. **Domain `.firebasestorage.app` là ĐÚNG** - đây là domain mới của Firebase

## 🆘 NẾU VẪN LỖI

### Lỗi: "storage/unauthorized"
→ Storage Rules chưa được publish
→ Làm lại Bước 1

### Lỗi: "User profile not found"
→ Chưa có profile trong Firestore
→ Chạy `window.fixUserProfile(userId)` trong Console

### Lỗi: CORS
→ Rules chưa được publish hoặc chưa áp dụng
→ Đợi thêm 30 giây và thử lại

### Avatar không hiển thị
→ Kiểm tra `avatarURL` trong Firestore
→ Kiểm tra `avatarPreview` state trong React DevTools
→ Refresh trang

---

**Sau khi publish rules, mọi thứ sẽ hoạt động hoàn hảo! 🎉**
