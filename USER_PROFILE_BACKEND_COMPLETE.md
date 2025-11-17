# 🎯 USER PROFILE BACKEND - HOÀN CHỈNH

## ✅ ĐÃ VIẾT LẠI HOÀN TOÀN

### Backend Service (userProfileService.js)

#### 1. **DEFAULT_PROFILE** - Cấu trúc profile chuẩn
```javascript
{
  displayName: '',
  email: '',
  phone: '',
  bio: '',
  location: '',
  dateOfBirth: '',
  gender: '',
  avatarURL: null,        // ← URL ảnh đại diện
  avatarPath: null,       // ← Path trong Storage
  interests: [],
  travelStyle: 'standard',
  budget: 'medium',
  notifications: {...},
  privacy: {...}
}
```

#### 2. **getUserProfile(userId)** - Lấy thông tin user
- Tự động merge với DEFAULT_PROFILE
- Đảm bảo luôn có đầy đủ trường
- Trả về avatarURL và avatarPath

#### 3. **saveUserProfile(userId, profileData)** - Lưu thông tin
- Không ghi đè avatarURL và avatarPath
- Tự động thêm updatedAt timestamp
- Tạo profile mới nếu chưa tồn tại

#### 4. **uploadAvatar(userId, file)** - Upload ảnh đại diện
**Quy trình:**
1. Validate file (size < 5MB, type = image)
2. Xóa ảnh cũ nếu có
3. Upload ảnh mới lên Storage
4. Lấy download URL
5. Cập nhật avatarURL và avatarPath vào Firestore

**Trả về:**
```javascript
{
  success: true,
  avatarURL: "https://...",
  message: "Cập nhật ảnh đại diện thành công!"
}
```

#### 5. **deleteAvatar(userId)** - Xóa ảnh đại diện
1. Xóa file trong Storage
2. Set avatarURL = null, avatarPath = null trong Firestore

#### 6. **ensureProfileFields(userId)** - Đảm bảo đầy đủ trường
- Tự động thêm trường thiếu
- Chạy khi user load profile lần đầu

## 📊 FIRESTORE STRUCTURE

### Collection: `users`
### Document ID: `{userId}`

```javascript
{
  // Basic Info
  displayName: "Bùi Lê Hoàng Nhẩn",
  email: "nhanbui274nb@gmail.com",
  phone: "0862736072",
  bio: "",
  location: "Hồ Chí Minh",
  dateOfBirth: "2004-04-27",
  gender: "female",
  
  // Avatar (QUAN TRỌNG!)
  avatarURL: "https://firebasestorage.googleapis.com/v0/b/zizoo-23525310.firebasestorage.app/o/avatars%2F{userId}%2F1763390973475.jpg?alt=media&token=...",
  avatarPath: "avatars/{userId}/1763390973475.jpg",
  
  // Preferences
  interests: ["food", "photography"],
  travelStyle: "standard",
  budget: "medium",
  
  // Settings
  notifications: {
    email: true,
    push: true,
    sms: false
  },
  privacy: {
    profileVisible: true,
    showEmail: false,
    showPhone: false
  },
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 🔥 FIREBASE STORAGE STRUCTURE

```
storage/
└── avatars/
    └── {userId}/
        ├── 1763390973475.jpg
        ├── 1763391234567.png
        └── ...
```

## 🚀 CÁCH SỬ DỤNG

### 1. Load Profile
```javascript
const result = await getUserProfile(userId);
if (result.success) {
  console.log(result.data.avatarURL);  // URL ảnh
  console.log(result.data.displayName); // Tên
}
```

### 2. Save Profile (không ảnh)
```javascript
const result = await saveUserProfile(userId, {
  displayName: "Tên mới",
  phone: "0123456789",
  location: "Hà Nội"
});
```

### 3. Upload Avatar
```javascript
const file = event.target.files[0];
const result = await uploadAvatar(userId, file);
if (result.success) {
  console.log('Avatar URL:', result.avatarURL);
  // Cập nhật UI với avatarURL mới
}
```

### 4. Delete Avatar
```javascript
const result = await deleteAvatar(userId);
if (result.success) {
  // Xóa ảnh khỏi UI
}
```

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. Firebase Storage Rules (BẮT BUỘC!)

**Phải publish rules này trên Firebase Console:**

```javascript
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
  }
}
```

**Link:** https://console.firebase.google.com/project/zizoo-23525310/storage/rules

### 2. Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. File Upload Limits
- Max size: 5MB
- Allowed types: JPG, PNG, GIF, WebP
- Auto delete old avatar when upload new

### 4. Error Handling
- Tất cả functions đều trả về `{ success, data/error, message }`
- Check `success` trước khi dùng data
- Hiển thị `error` hoặc `message` cho user

## 🎯 CHECKLIST

- [x] Backend service hoàn chỉnh
- [x] Có trường avatarURL và avatarPath
- [x] Upload avatar function
- [x] Delete avatar function
- [x] Auto ensure profile fields
- [x] Error handling đầy đủ
- [ ] **Publish Firebase Storage Rules** ← QUAN TRỌNG NHẤT!

## 🆘 TROUBLESHOOTING

### Lỗi: "storage/unauthorized"
→ Chưa publish Storage Rules
→ Vào Firebase Console và publish rules

### Avatar không hiển thị
→ Check avatarURL trong Firestore
→ Check file có tồn tại trong Storage không

### Upload thành công nhưng không lưu vào Firestore
→ Check Firestore Rules
→ Check userId có đúng không

---

**Backend đã hoàn chỉnh! Chỉ cần publish Storage Rules là có thể dùng ngay! 🎉**
