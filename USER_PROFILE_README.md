# User Profile Backend - Hướng dẫn sử dụng

## ✅ Đã hoàn thành

### 1. Backend Service (`src/services/userProfileService.js`)

**Các chức năng:**

#### 📝 Quản lý Profile
- `getUserProfile(userId)` - Lấy thông tin profile người dùng
- `saveUserProfile(userId, profileData)` - Lưu/cập nhật profile
- `getUserStats(userId)` - Lấy thống kê (số chuyến đi, điểm đến)

#### 🖼️ Quản lý Avatar
- `uploadAvatar(userId, file)` - Upload ảnh đại diện
  - Hỗ trợ: JPEG, PNG, GIF, WebP
  - Giới hạn: 5MB
  - Tự động resize và optimize
- `deleteAvatar(userId)` - Xóa ảnh đại diện

#### ⚙️ Quản lý Preferences
- `updateUserPreferences(userId, preferences)` - Cập nhật sở thích
  - Interests (sở thích du lịch)
  - Travel style (phong cách)
  - Notifications (thông báo)
  - Privacy (quyền riêng tư)

#### 🔐 Bảo mật
- `changePassword(user, currentPassword, newPassword)` - Đổi mật khẩu
- `deleteUserAccount(userId, user)` - Xóa tài khoản

### 2. Cấu trúc dữ liệu Firestore

```javascript
// Collection: users/{userId}
{
  displayName: string,
  phone: string,
  bio: string,
  location: string,
  dateOfBirth: string,
  gender: string,
  avatarURL: string,
  avatarPath: string,
  interests: array,
  travelStyle: string,
  notifications: {
    email: boolean,
    push: boolean,
    sms: boolean
  },
  privacy: {
    profileVisible: boolean,
    showEmail: boolean,
    showPhone: boolean
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 3. Firebase Storage Structure

```
storage/
└── avatars/
    └── {userId}/
        └── {timestamp}_{filename}
```

## 🚀 Cách sử dụng

### Upload Avatar

```javascript
import { uploadAvatar } from '../services/userProfileService';

const handleUpload = async (file) => {
  const result = await uploadAvatar(userId, file);
  if (result.success) {
    console.log('Avatar URL:', result.avatarURL);
  }
};
```

### Lưu Profile

```javascript
import { saveUserProfile } from '../services/userProfileService';

const handleSave = async () => {
  const result = await saveUserProfile(userId, {
    displayName: 'Nguyễn Văn A',
    phone: '0123456789',
    location: 'Hồ Chí Minh',
    bio: 'Yêu thích du lịch'
  });
};
```

### Đổi mật khẩu

```javascript
import { changePassword } from '../services/userProfileService';

const handleChangePassword = async () => {
  const result = await changePassword(
    currentUser,
    'oldPassword123',
    'newPassword456'
  );
};
```

## 📋 Firestore Rules cần thiết

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🔒 Storage Rules cần thiết

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Avatar uploads
    match /avatars/{userId}/{filename} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## ✨ Tính năng đã implement trong UserProfile.js

1. ✅ Load profile tự động khi đăng nhập
2. ✅ Upload và preview ảnh đại diện
3. ✅ Xóa ảnh đại diện
4. ✅ Lưu thông tin cá nhân
5. ✅ Cập nhật sở thích và preferences
6. ✅ Đổi mật khẩu
7. ✅ Hiển thị thống kê (số chuyến đi, điểm đến)
8. ✅ Validation dữ liệu
9. ✅ Toast notifications
10. ✅ Loading states

## 🎨 UI Components

- Avatar upload với preview
- Form tabs (Profile, Preferences, Security)
- Interest selection grid
- Toggle switches cho notifications
- Password change form
- Stats display

## 🔧 Cần làm thêm (Optional)

1. Image cropping trước khi upload
2. Multiple image formats support
3. Social media integration
4. Email verification
5. Two-factor authentication
6. Export user data
7. Account recovery

## 📝 Notes

- Tất cả operations đều async và có error handling
- Toast notifications cho user feedback
- Validation ở cả client và server side
- Secure password change với re-authentication
- Avatar tự động delete khi upload mới
