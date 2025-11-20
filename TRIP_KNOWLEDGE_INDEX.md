# Firestore Index cho Trip Knowledge

## Vấn đề
Query `complete_itineraries` collection với `userId + createdAt` cần composite index.

## Giải pháp

### Cách 1: Tạo qua Firebase Console
1. Vào Firebase Console: https://console.firebase.google.com/project/zizoo-23525310/firestore/indexes
2. Click "Create Index"
3. Chọn collection: `complete_itineraries`
4. Thêm fields:
   - `userId` - Ascending
   - `createdAt` - Descending
5. Click "Create"

### Cách 2: Thêm vào firestore.indexes.json
```json
{
  "indexes": [
    {
      "collectionGroup": "complete_itineraries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Sau đó deploy:
```bash
firebase deploy --only firestore:indexes
```

## Thời gian
Index sẽ mất 1-2 phút để build xong.
