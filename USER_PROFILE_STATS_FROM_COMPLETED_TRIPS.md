# ✅ Thống kê User Profile từ chuyến đi đã hoàn thành

## 🎯 Mục đích
Các thống kê trong User Profile (số chuyến đi, điểm đến, tổng chi tiêu) chỉ tính từ **các chuyến đi đã hoàn thành**, không tính chuyến đi đang active.

## 📊 Các thống kê

### 1. Tham gia từ (Member Since)
- **Nguồn**: `users.createdAt` (Firebase Firestore)
- **Giá trị ban đầu**: Ngày tạo tài khoản
- **Hiển thị**: "Tham gia từ DD/MM/YYYY"

### 2. Chuyến đi (Total Trips)
- **Nguồn**: Đếm số lượng itineraries có `status === 'completed'`
- **Giá trị ban đầu**: 0
- **Cập nhật**: +1 mỗi khi user đánh dấu chuyến đi là "completed"

### 3. Điểm đến (Total Destinations)
- **Nguồn**: Đếm số lượng unique destinations từ completed trips
- **Giá trị ban đầu**: 0
- **Cập nhật**: Tự động tính từ các chuyến đi completed

### 4. Tổng chi tiêu (Total Spending)
- **Nguồn**: Tổng `budget` từ các completed trips
- **Giá trị ban đầu**: 0 VNĐ
- **Cập nhật**: Tự động cộng dồn từ các chuyến đi completed

## 🔧 Implementation

### 1. userProfileService.js - getUserStats()

```javascript
export const getUserStats = async (userId) => {
    try {
        // Get user profile for memberSince
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        let memberSince = null;
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            memberSince = userData.createdAt || userData.memberSince || null;
        }
        
        // Get itineraries
        const itinerariesRef = doc(db, 'userItineraries', userId);
        const itinerariesSnap = await getDoc(itinerariesRef);
        
        let totalTrips = 0;
        let totalDestinations = 0;
        let totalSpending = 0;
        
        if (itinerariesSnap.exists()) {
            const itineraries = itinerariesSnap.data().itineraries || [];
            
            // ✅ CHỈ đếm các chuyến đi đã hoàn thành
            const completedTrips = itineraries.filter(itinerary => 
                itinerary.status === 'completed'
            );
            
            totalTrips = completedTrips.length;
            
            // Count unique destinations từ completed trips
            const destinations = new Set();
            completedTrips.forEach(itinerary => {
                if (itinerary.destination) {
                    destinations.add(itinerary.destination);
                }
                
                // Tính tổng chi tiêu
                if (itinerary.budget) {
                    totalSpending += Number(itinerary.budget) || 0;
                }
            });
            totalDestinations = destinations.size;
        }
        
        return {
            success: true,
            stats: {
                totalTrips,
                totalDestinations,
                totalSpending,
                memberSince
            }
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return {
            success: false,
            error: error.message,
            stats: {
                totalTrips: 0,
                totalDestinations: 0,
                totalSpending: 0,
                memberSince: null
            }
        };
    }
};
```

### 2. completeItineraryService.js - Thêm status khi lưu

```javascript
const saveItineraryToFirebase = async (itinerary) => {
    try {
        const sanitizedItinerary = sanitizeForFirebase({
            ...itinerary,
            createdAt: new Date(),
            status: 'active', // ✅ Mặc định là active
            version: '1.0'
        });
        
        const docRef = await addDoc(collection(db, 'complete_itineraries'), sanitizedItinerary);
        return docRef.id;
    } catch (error) {
        console.error('❌ Lỗi lưu lịch trình:', error);
        throw error;
    }
};
```

### 3. completeItineraryService.js - Function cập nhật status

```javascript
/**
 * Cập nhật trạng thái lịch trình (active -> completed)
 */
export const updateItineraryStatus = async (itineraryId, status) => {
    try {
        const itineraryRef = doc(db, 'complete_itineraries', itineraryId);
        await updateDoc(itineraryRef, {
            status: status,
            completedAt: status === 'completed' ? new Date() : null,
            updatedAt: new Date()
        });
        
        console.log(`✅ Đã cập nhật trạng thái lịch trình thành: ${status}`);
        return { success: true };
    } catch (error) {
        console.error('Error updating itinerary status:', error);
        return { success: false, error: error.message };
    }
};
```

### 4. UserProfile.js - Hiển thị stats

```javascript
const [stats, setStats] = useState({
    totalTrips: 0,
    totalDestinations: 0,
    totalSpending: 0,
    memberSince: null
});

// UI
<div className="profile-stats">
    <div className="stat-item">
        <span className="stat-number">{stats.totalTrips || 0}</span>
        <span className="stat-label">Chuyến đi</span>
    </div>
    <div className="stat-item">
        <span className="stat-number">{stats.totalDestinations || 0}</span>
        <span className="stat-label">Điểm đến</span>
    </div>
    <div className="stat-item">
        <span className="stat-number">{formatMoney(stats.totalSpending || 0)}</span>
        <span className="stat-label">Tổng chi tiêu</span>
    </div>
</div>
```

## 📋 Flow hoạt động

### Khi user mới tạo tài khoản:
```
1. Firebase Auth tạo user
2. ensureProfileFields() tạo document trong users collection
   - createdAt: serverTimestamp() ✅
   - Các fields khác: default values
3. User Profile hiển thị:
   - Tham gia từ: [Ngày tạo tài khoản]
   - Chuyến đi: 0
   - Điểm đến: 0
   - Tổng chi tiêu: 0 VNĐ
```

### Khi user tạo lịch trình mới:
```
1. createCompleteItinerary() tạo itinerary
2. saveItineraryToFirebase() lưu với:
   - status: 'active' ✅
   - createdAt: new Date()
3. User Profile KHÔNG thay đổi (vì chưa completed)
```

### Khi user hoàn thành chuyến đi:
```
1. User click "Đánh dấu đã hoàn thành" trong MyTrips
2. updateItineraryStatus(itineraryId, 'completed') ✅
   - status: 'completed'
   - completedAt: new Date()
3. getUserStats() tính lại:
   - totalTrips: +1 ✅
   - totalDestinations: +1 (nếu là điểm đến mới) ✅
   - totalSpending: +budget ✅
4. User Profile cập nhật hiển thị
```

## 📊 Ví dụ

### User A - Mới tạo tài khoản
```
Tham gia từ: 18/11/2025
Chuyến đi: 0
Điểm đến: 0
Tổng chi tiêu: 0 VNĐ
```

### User A - Tạo 2 lịch trình (chưa đi)
```
Tham gia từ: 18/11/2025
Chuyến đi: 0 ← Vẫn là 0 vì chưa completed
Điểm đến: 0
Tổng chi tiêu: 0 VNĐ
```

### User A - Hoàn thành chuyến đi Vũng Tàu (3M VNĐ)
```
Tham gia từ: 18/11/2025
Chuyến đi: 1 ← +1
Điểm đến: 1 ← +1 (Vũng Tàu)
Tổng chi tiêu: 3,000,000 VNĐ ← +3M
```

### User A - Hoàn thành chuyến đi Đà Lạt (5M VNĐ)
```
Tham gia từ: 18/11/2025
Chuyến đi: 2 ← +1
Điểm đến: 2 ← +1 (Đà Lạt)
Tổng chi tiêu: 8,000,000 VNĐ ← +5M
```

### User A - Hoàn thành chuyến đi Vũng Tàu lần 2 (4M VNĐ)
```
Tham gia từ: 18/11/2025
Chuyến đi: 3 ← +1
Điểm đến: 2 ← Không tăng (Vũng Tàu đã đi rồi)
Tổng chi tiêu: 12,000,000 VNĐ ← +4M
```

## ✅ Lợi ích

1. ✅ **Chính xác**: Chỉ tính chuyến đi thực sự đã hoàn thành
2. ✅ **Động**: Tự động cập nhật khi user đánh dấu completed
3. ✅ **Unique destinations**: Không đếm trùng điểm đến
4. ✅ **Tổng chi tiêu thực tế**: Cộng dồn từ các chuyến đi đã đi
5. ✅ **Member since**: Hiển thị ngày tạo tài khoản chính xác

## 🔄 Cần làm thêm

### 1. UI để đánh dấu completed
Trong MyTrips component, thêm button:
```jsx
<button onClick={() => handleMarkCompleted(trip.id)}>
  ✅ Đánh dấu đã hoàn thành
</button>
```

### 2. Function trong MyTrips
```javascript
const handleMarkCompleted = async (itineraryId) => {
    const result = await updateItineraryStatus(itineraryId, 'completed');
    if (result.success) {
        toast.success('Đã đánh dấu chuyến đi hoàn thành!');
        loadTrips(); // Reload danh sách
    }
};
```

### 3. Filter trong MyTrips
```javascript
const [filter, setFilter] = useState('all'); // all, active, completed

const filteredTrips = trips.filter(trip => {
    if (filter === 'all') return true;
    return trip.status === filter;
});
```

## 📝 Notes

- Status có 2 giá trị: `'active'` và `'completed'`
- Có thể mở rộng thêm: `'cancelled'`, `'planning'`, etc.
- `completedAt` lưu thời điểm đánh dấu completed
- Stats được tính real-time mỗi khi load UserProfile
- Có thể cache stats để tối ưu performance nếu cần
