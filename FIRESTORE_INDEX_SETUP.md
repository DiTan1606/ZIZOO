# Firestore Index Setup

## Vấn đề:
Chatbot cần query `complete_itineraries` với `userId` và `createdAt` nhưng Firestore yêu cầu composite index.

## Cách tạo Index:

### Option 1: Tự động (Khuyến nghị)
1. Chạy app và trigger lỗi index
2. Click vào link trong console error:
   ```
   https://console.firebase.google.com/v1/r/project/zizoo-23525310/firestore/indexes?create_composite=...
   ```
3. Firebase Console sẽ tự động điền thông tin
4. Click "Create Index"
5. Đợi 2-5 phút để index được tạo

### Option 2: Thủ công
1. Vào Firebase Console: https://console.firebase.google.com
2. Chọn project "zizoo-23525310"
3. Vào **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Điền thông tin:
   - **Collection ID:** `complete_itineraries`
   - **Fields to index:**
     - Field: `userId`, Order: `Ascending`
     - Field: `createdAt`, Order: `Descending`
   - **Query scope:** Collection
6. Click **Create**

### Option 3: Dùng Firebase CLI
Thêm vào file `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "complete_itineraries",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

Sau đó deploy:
```bash
firebase deploy --only firestore:indexes
```

## Kiểm tra Index đã hoạt động:
1. Vào Firebase Console → Firestore → Indexes
2. Kiểm tra status = "Enabled" (màu xanh)
3. Test chatbot với câu hỏi: "Lịch trình của tôi thế nào?"

## Lưu ý:
- Index có thể mất 2-5 phút để build
- Nếu vẫn lỗi, đợi thêm vài phút
- App vẫn hoạt động với fallback query (không sort theo createdAt)
