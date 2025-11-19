# Tính Năng: Công Tác + Du Lịch

## Tổng Quan
Thêm chức năng cho phép người dùng chọn giữa "Công tác + Du lịch" và "Thuần Du lịch", với khả năng thêm địa điểm làm việc cố định vào lịch trình.

## Cấu Trúc Branch

```
main
├── feature/trip-type-selector (Branch 1)
├── feature/working-location-model (Branch 2)
├── feature/working-location-ui (Branch 3)
└── feature/itinerary-scheduler (Branch 4)
```

---

## Branch 1: Trip Type Selector (Developer A)

### Files Created:
- `src/components/TripTypeSelector.js`
- `src/components/TripTypeSelector.css`

### Files Modified:
- `src/components/CompleteItineraryPlanner.js` (thêm TripTypeSelector vào Step 1)

### Nhiệm vụ:
1. ✅ Tạo component UI chọn loại hình du lịch
2. ⏳ Tích hợp vào trang Lập kế hoạch (`CompleteItineraryPlanner.js`)
3. ⏳ Hiển thị ở Step 1 (trước phần chọn điểm đến)

### Git Commands:
```bash
git checkout -b feature/trip-type-selector
# Làm việc...
git add src/components/TripTypeSelector.* src/components/CompleteItineraryPlanner.js
git commit -m "feat: add trip type selector to itinerary planner"
git push origin feature/trip-type-selector
```

### Integration Point (CompleteItineraryPlanner.js):
```javascript
// 1. Import component
import TripTypeSelector from './TripTypeSelector';

// 2. Thêm vào state (sau dòng const [step, setStep] = useState(1);)
const [tripType, setTripType] = useState('pure-travel');

// 3. Thêm vào preferences state
const [preferences, setPreferences] = useState({
    tripType: 'pure-travel', // Thêm dòng này
    destination: 'Vũng Tàu',
    departureCity: 'Hồ Chí Minh',
    // ... rest of preferences
    workingLocations: [] // Thêm dòng này
});

// 4. Handler để update tripType
const handleTripTypeChange = (type) => {
    setTripType(type);
    setPreferences(prev => ({
        ...prev,
        tripType: type,
        workingLocations: type === 'pure-travel' ? [] : prev.workingLocations
    }));
};

// 5. Thêm vào render - NGAY ĐẦU Step 1, trước phần chọn điểm đến
{step === 1 && (
    <div className="planner-step">
        <h2>Bước 1: Thông tin cơ bản</h2>
        
        {/* THÊM PHẦN NÀY */}
        <TripTypeSelector 
            selectedType={tripType}
            onTypeChange={handleTripTypeChange}
        />
        
        {/* Phần chọn điểm đến hiện tại */}
        <div className="form-group">
            <label>Điểm đến</label>
            {/* ... existing code ... */}
        </div>
        
        {/* ... rest of Step 1 ... */}
    </div>
)}
```

### Vị trí hiển thị:
- **Trang:** Lập kế hoạch (`/complete-planner`)
- **Component:** `CompleteItineraryPlanner.js`
- **Step:** Step 1 - Thông tin cơ bản
- **Vị trí:** Đầu tiên, trước form chọn điểm đến

---

## Branch 2: Working Location Model (Developer B)

### Files Created:
- `src/models/workingLocation.js`
- `src/services/workingLocationService.js`

### Nhiệm vụ:
1. ✅ Tạo data model cho working location
2. ✅ Tạo service xử lý logic working location
3. ⏳ Viết unit tests

### Git Commands:
```bash
git checkout -b feature/working-location-model
# Làm việc...
git add src/models/workingLocation.js src/services/workingLocationService.js
git commit -m "feat: add working location model and service"
git push origin feature/working-location-model
```

### API:
```javascript
import { WorkingLocation } from '../models/workingLocation';
import workingLocationService from '../services/workingLocationService';

// Create working location
const workLoc = new WorkingLocation({
    name: 'Văn phòng ABC',
    address: '123 Đường XYZ',
    startTime: '09:00',
    endTime: '17:00',
    workingDays: ['2024-01-15', '2024-01-16']
});

// Validate
const validation = workLoc.validate();

// Check conflicts
const hasConflict = workingLocationService.hasTimeConflict(
    workLoc, '2024-01-15', '10:00', '12:00'
);
```

---

## Branch 3: Working Location UI (Developer C)

### Files Created:
- `src/components/WorkingLocationForm.js`
- `src/components/WorkingLocationForm.css`

### Files Modified:
- `src/components/CompleteItineraryPlanner.js` (thêm WorkingLocationForm)

### Nhiệm vụ:
1. ✅ Tạo form nhập địa điểm làm việc
2. ⏳ Tích hợp vào `CompleteItineraryPlanner.js`
3. ⏳ Hiển thị danh sách working locations đã thêm
4. ⏳ Chỉ hiển thị khi tripType === 'business-travel'

### Git Commands:
```bash
git checkout -b feature/working-location-ui
# Làm việc...
git add src/components/WorkingLocationForm.* src/components/CompleteItineraryPlanner.js
git commit -m "feat: add working location form to itinerary planner"
git push origin feature/working-location-ui
```

### Integration Point (CompleteItineraryPlanner.js):
```javascript
// 1. Import
import WorkingLocationForm from './WorkingLocationForm';
import { WorkingLocation } from '../models/workingLocation';

// 2. Thêm state
const [showWorkingForm, setShowWorkingForm] = useState(false);

// 3. Helper function để lấy danh sách ngày
const getTripDates = () => {
    const dates = [];
    const start = new Date(preferences.startDate);
    for (let i = 0; i < preferences.duration; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
};

// 4. Handler
const handleAddWorkingLocation = (formData) => {
    try {
        const newLocation = new WorkingLocation(formData);
        const validation = newLocation.validate();
        
        if (!validation.isValid) {
            toast.error(validation.errors.join(', '));
            return;
        }
        
        setPreferences(prev => ({
            ...prev,
            workingLocations: [...prev.workingLocations, newLocation.toJSON()]
        }));
        
        setShowWorkingForm(false);
        toast.success('Đã thêm địa điểm làm việc!');
    } catch (error) {
        toast.error('Lỗi: ' + error.message);
    }
};

const handleRemoveWorkingLocation = (index) => {
    setPreferences(prev => ({
        ...prev,
        workingLocations: prev.workingLocations.filter((_, i) => i !== index)
    }));
    toast.success('Đã xóa địa điểm làm việc!');
};

// 5. Render trong Step 1 (sau TripTypeSelector, trước các form khác)
{step === 1 && (
    <div className="planner-step">
        <h2>Bước 1: Thông tin cơ bản</h2>
        
        <TripTypeSelector 
            selectedType={tripType}
            onTypeChange={handleTripTypeChange}
        />
        
        {/* THÊM PHẦN NÀY - Chỉ hiện khi chọn Công tác + Du lịch */}
        {tripType === 'business-travel' && (
            <div className="working-locations-section">
                <h3>Địa điểm làm việc</h3>
                
                {/* Danh sách working locations */}
                {preferences.workingLocations.length > 0 && (
                    <div className="working-locations-list">
                        {preferences.workingLocations.map((loc, index) => (
                            <div key={index} className="working-location-item">
                                <div className="location-info">
                                    <strong>{loc.name}</strong>
                                    <span>{loc.startTime} - {loc.endTime}</span>
                                    <span>
                                        {loc.isAllDays 
                                            ? 'Tất cả các ngày' 
                                            : `${loc.workingDays.length} ngày`}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => handleRemoveWorkingLocation(index)}
                                    className="btn-remove"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Button thêm */}
                {!showWorkingForm && (
                    <button 
                        onClick={() => setShowWorkingForm(true)}
                        className="btn-add-working"
                    >
                        + Thêm địa điểm làm việc
                    </button>
                )}
                
                {/* Form */}
                {showWorkingForm && (
                    <WorkingLocationForm
                        tripDates={getTripDates()}
                        onAddWorkingLocation={handleAddWorkingLocation}
                        onCancel={() => setShowWorkingForm(false)}
                    />
                )}
            </div>
        )}
        
        {/* ... rest of Step 1 ... */}
    </div>
)}
```

### Vị trí hiển thị:
- **Trang:** Lập kế hoạch (`/complete-planner`)
- **Component:** `CompleteItineraryPlanner.js`
- **Step:** Step 1 - Thông tin cơ bản
- **Điều kiện:** Chỉ hiển thị khi `tripType === 'business-travel'`
- **Vị trí:** Sau TripTypeSelector, trước form chọn điểm đến

---

## Branch 4: Itinerary Scheduler (Developer D)

### Files Created:
- `src/utils/itineraryScheduler.js`

### Files Modified:
- `src/services/completeItineraryService.js`

### Nhiệm vụ:
1. ✅ Tạo utility xếp lịch
2. ⏳ Implement logic đẩy activities ra khỏi working hours
3. ⏳ Tích hợp vào `completeItineraryService.js`
4. ⏳ Test với nhiều scenarios

### Git Commands:
```bash
git checkout -b feature/itinerary-scheduler
# Làm việc...
git add src/utils/itineraryScheduler.js src/services/completeItineraryService.js
git commit -m "feat: add itinerary scheduler with working location support"
git push origin feature/itinerary-scheduler
```

### Integration Point:
```javascript
// Trong completeItineraryService.js
import itineraryScheduler from '../utils/itineraryScheduler';

export const createCompleteItinerary = async (preferences, userId) => {
    // ... existing code ...
    
    // Nếu có working locations
    if (preferences.workingLocations && preferences.workingLocations.length > 0) {
        const schedule = itineraryScheduler.scheduleWithWorkingLocations(
            activities,
            preferences.workingLocations,
            tripDates
        );
        
        // Use schedule instead of normal itinerary
        itinerary.schedule = schedule;
    }
    
    // ... rest of code ...
};
```

---

## Thứ Tự Merge

### Bước 1: Merge Branch 2 (Model) trước
```bash
git checkout main
git pull origin main
git merge feature/working-location-model
git push origin main
```

### Bước 2: Merge Branch 1 (Trip Type Selector)
```bash
git checkout main
git pull origin main
git merge feature/trip-type-selector
git push origin main
```

### Bước 3: Merge Branch 3 (Working Location UI)
```bash
git checkout main
git pull origin main
git merge feature/working-location-ui
# Có thể có conflict ở CompleteItineraryPlanner.js
# Resolve conflicts
git push origin main
```

### Bước 4: Merge Branch 4 (Scheduler)
```bash
git checkout main
git pull origin main
git merge feature/itinerary-scheduler
# Có thể có conflict ở completeItineraryService.js
# Resolve conflicts
git push origin main
```

---

## Testing Checklist

- [ ] Trip type selector hiển thị đúng
- [ ] Form working location validate đúng
- [ ] Working location được lưu vào state
- [ ] Lịch trình không xếp activities vào working hours
- [ ] Working location hiển thị đúng trong itinerary
- [ ] Có thể chọn nhiều ngày làm việc
- [ ] Có thể chọn "tất cả các ngày"
- [ ] Time conflict được detect đúng
- [ ] UI responsive trên mobile

---

## Notes

- Tất cả branches đều base từ `main` mới nhất
- Mỗi developer làm việc độc lập trên branch của mình
- Không modify files của branch khác
- Communicate khi cần thay đổi interface/API
- Test kỹ trước khi merge

---

## Contact

- Branch 1: Developer A
- Branch 2: Developer B  
- Branch 3: Developer C
- Branch 4: Developer D
