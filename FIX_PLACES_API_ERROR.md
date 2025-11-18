# ✅ FIX: Google Maps Places API Error

## 🔍 Vấn đề
Khi load trang DestinationSelector, console hiển thị lỗi:
```
Places Service not available. Make sure:
1. Google Maps API key is valid
2. Places library is loaded: &libraries=places
3. Map instance is properly initialized
```

Mặc dù:
- ✅ API key hợp lệ
- ✅ Places library đã load
- ✅ Map instance đã khởi tạo

Nhưng **Places Service chưa được khởi tạo** trước khi component sử dụng.

## 🛠️ Nguyên nhân
`DestinationSelector` component gọi `searchPlacesByText()` ngay khi mount, nhưng `initPlacesService()` chưa được gọi để khởi tạo Places Service.

## ✨ Giải pháp

### 1. Thêm state để track Places Service status
```javascript
const [placesServiceReady, setPlacesServiceReady] = useState(false);
```

### 2. Khởi tạo Places Service khi component mount
```javascript
useEffect(() => {
    const initService = async () => {
        try {
            // Đợi Google Maps API load
            await new Promise((resolve) => {
                if (window.google?.maps?.places) {
                    resolve();
                } else {
                    const checkInterval = setInterval(() => {
                        if (window.google?.maps?.places) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                    
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve();
                    }, 10000);
                }
            });

            // Tạo hidden map nếu chưa có
            if (!window.hiddenMapForPlaces) {
                const mapDiv = document.createElement('div');
                mapDiv.style.display = 'none';
                document.body.appendChild(mapDiv);
                
                window.hiddenMapForPlaces = new window.google.maps.Map(mapDiv, {
                    center: { lat: 16.047, lng: 108.220 },
                    zoom: 10
                });
            }

            // Khởi tạo Places Service
            const success = initPlacesService(window.hiddenMapForPlaces);
            setPlacesServiceReady(success);
            
            if (!success) {
                toast.warning('⚠️ Google Maps Places API không khả dụng.');
            }
        } catch (error) {
            console.error('Error initializing Places Service:', error);
            setPlacesServiceReady(false);
        }
    };

    initService();
}, []);
```

### 3. Chỉ load destinations khi Places Service ready
```javascript
useEffect(() => {
    if (placesServiceReady) {
        loadDestinations();
    }
}, [preferences.destination, placesServiceReady]);
```

### 4. Kiểm tra trong loadDestinations
```javascript
const loadDestinations = async () => {
    if (!placesServiceReady) {
        console.warn('Places Service not ready yet');
        setLoading(false);
        setDestinations([]);
        return;
    }
    // ... rest of the code
};
```

## 📋 Các thay đổi

### File: `src/components/DestinationSelector.js`

1. **Import thêm `initPlacesService`**
   ```javascript
   import { searchPlacesByText, initPlacesService } from '../services/placesService';
   ```

2. **Thêm state `placesServiceReady`**
   ```javascript
   const [placesServiceReady, setPlacesServiceReady] = useState(false);
   ```

3. **Thêm useEffect để khởi tạo Places Service**
   - Đợi Google Maps API load
   - Tạo hidden map instance
   - Gọi `initPlacesService()`
   - Set `placesServiceReady` state

4. **Update useEffect cho loadDestinations**
   - Chỉ gọi khi `placesServiceReady === true`

5. **Update loadDestinations function**
   - Kiểm tra `placesServiceReady` trước khi thực hiện

## ✅ Kết quả

- ✅ Places Service được khởi tạo đúng cách trước khi sử dụng
- ✅ Không còn lỗi "Places Service not available"
- ✅ API calls hoạt động bình thường
- ✅ Fallback gracefully nếu API không khả dụng
- ✅ User có thể thêm địa điểm tùy chỉnh nếu API fails

## 🧪 Test

1. Refresh trang và mở Console
2. Không còn thấy lỗi "Places Service not available"
3. Destinations load thành công từ Google Places API
4. Nếu API không khả dụng, hiển thị warning và cho phép thêm custom destinations

## 📝 Notes

- Hidden map được tạo một lần và reuse cho tất cả Places API calls
- Timeout 10 giây để tránh infinite waiting
- Graceful degradation: nếu API fails, user vẫn có thể thêm địa điểm tùy chỉnh
