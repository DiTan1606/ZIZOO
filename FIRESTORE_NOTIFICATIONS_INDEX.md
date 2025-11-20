# Firestore Index cho Notifications

## Trạng thái hiện tại

⚠️ **Notifications đã TẠM THỜI TẮT** để tránh lỗi index.

Chuông thông báo vẫn hiển thị nhưng không có data.

---

## Để bật lại Notifications

### Bước 1: Tạo Firestore Index

#### Cách 1: Click vào link (Nhanh nhất)
Click vào link này để tự động tạo:
```
https://console.firebase.google.com/v1/r/project/zizoo-23525310/firestore/indexes?create_composite=ClRwcm9qZWN0cy96aXpvby0yMzUyNTMxMC9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbm90aWZpY2F0aW9ucy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC
```

#### Cách 2: Tạo thủ công

1. Vào Firebase Console: https://console.firebase.google.com/
2. Chọn project: `zizoo-23525310`
3. Vào **Firestore Database** → **Indexes**
4. Click **Create Index**
5. Điền:
   - Collection ID: `notifications`
   - Fields:
     - `userId` - Ascending
     - `createdAt` - Descending
6. Click **Create**
7. Đợi vài phút để index được build

### Bước 2: Enable lại code

Sau khi index đã tạo xong, uncomment code trong `weatherSafetyService.js`:

```javascript
// Lấy notifications của user
export const getUserNotifications = async (userId) => {
  try {
    // XÓA dòng này:
    // return [];
    
    // UNCOMMENT đoạn này:
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Đếm notifications chưa đọc
export const getUnreadCount = async (userId) => {
  try {
    // XÓA dòng này:
    // return 0;
    
    // UNCOMMENT đoạn này:
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};
```

### Bước 3: Test

1. Refresh trang
2. Click vào chuông thông báo
3. Không còn lỗi trong console
4. Notifications sẽ hiển thị (nếu có)

---

## Tại sao cần Index?

Firestore yêu cầu index khi query có:
- `where()` + `orderBy()` trên các fields khác nhau
- Multiple `where()` clauses

Query của chúng ta:
```javascript
where('userId', '==', userId)  // Filter by user
orderBy('createdAt', 'desc')   // Sort by date
```

→ Cần composite index: `userId` + `createdAt`

---

## Nếu không muốn dùng Notifications

Có thể bỏ hẳn NotificationBell khỏi Navbar:

```javascript
// src/components/Navbar.js
// Comment dòng này:
// <NotificationBell />
```

Hoặc giữ nguyên (chuông vẫn hiện nhưng không có data).

---

## Lưu ý

- Index mất vài phút để build
- Sau khi build xong mới enable lại code
- Nếu enable sớm vẫn sẽ bị lỗi
