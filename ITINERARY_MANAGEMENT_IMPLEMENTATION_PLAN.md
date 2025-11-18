# 🚀 Implementation Plan - Itinerary Management Features

## ✅ Phase 1: Service Layer (COMPLETED)

### Files Created:
- ✅ `src/services/itineraryManagementService.js`

### Functions Implemented:
- ✅ `getItineraryStatus()` - Tự động phát hiện trạng thái
- ✅ `markItineraryCompleted()` - Đánh dấu hoàn thành
- ✅ `cancelItinerary()` - Hủy với lý do
- ✅ `updateItineraryBasicInfo()` - Cập nhật thông tin cơ bản
- ✅ `updateDayTimeline()` - Cập nhật timeline
- ✅ `addActivityToTimeline()` - Thêm hoạt động
- ✅ `removeActivityFromTimeline()` - Xóa hoạt động
- ✅ `getCurrentDayOfTrip()` - Tính ngày hiện tại
- ✅ Helper functions: `getStatusText()`, `getStatusColor()`, `getStatusIcon()`

## 📋 Phase 2: UI Components (TODO)

### 2.1. TripStatusBadge Component
**File**: `src/components/TripManagement/TripStatusBadge.js`

```jsx
import React from 'react';
import { getStatusText, getStatusColor, getStatusIcon } from '../../services/itineraryManagementService';
import './TripStatusBadge.css';

const TripStatusBadge = ({ status, currentDay, totalDays }) => {
    return (
        <div 
            className={`trip-status-badge status-${status}`}
            style={{ backgroundColor: getStatusColor(status) }}
        >
            <span className="status-icon">{getStatusIcon(status)}</span>
            <span className="status-text">{getStatusText(status)}</span>
            {status === 'ongoing' && currentDay && (
                <span className="status-detail">Ngày {currentDay}/{totalDays}</span>
            )}
        </div>
    );
};

export default TripStatusBadge;
```

**CSS**: `src/components/TripManagement/TripStatusBadge.css`
```css
.trip-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    color: white;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-icon {
    font-size: 16px;
}

.status-detail {
    margin-left: 4px;
    opacity: 0.9;
    font-size: 12px;
}
```

### 2.2. CancelTripModal Component
**File**: `src/components/TripManagement/CancelTripModal.js`

```jsx
import React, { useState } from 'react';
import { cancelItinerary } from '../../services/itineraryManagementService';
import { toast } from 'react-toastify';
import './CancelTripModal.css';

const CancelTripModal = ({ trip, onClose, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    
    const predefinedReasons = [
        'Thay đổi kế hoạch công việc',
        'Vấn đề sức khỏe',
        'Thời tiết xấu',
        'Vấn đề tài chính',
        'Lý do cá nhân khác'
    ];
    
    const handleCancel = async () => {
        if (!reason.trim()) {
            toast.warning('Vui lòng nhập lý do hủy');
            return;
        }
        
        setLoading(true);
        const result = await cancelItinerary(trip.id, reason);
        setLoading(false);
        
        if (result.success) {
            toast.success('Đã hủy lịch trình');
            onSuccess();
            onClose();
        } else {
            toast.error('Lỗi: ' + result.error);
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="cancel-trip-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>❌ Hủy lịch trình</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <p className="trip-name">{trip.tripName || trip.destination}</p>
                    
                    <div className="reason-section">
                        <label>Lý do hủy:</label>
                        <div className="predefined-reasons">
                            {predefinedReasons.map((r, index) => (
                                <button
                                    key={index}
                                    className={`reason-btn ${reason === r ? 'active' : ''}`}
                                    onClick={() => setReason(r)}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Hoặc nhập lý do khác..."
                            rows="3"
                        />
                    </div>
                </div>
                
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Đóng
                    </button>
                    <button 
                        className="btn-danger" 
                        onClick={handleCancel}
                        disabled={loading}
                    >
                        {loading ? 'Đang xử lý...' : 'Xác nhận hủy'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancelTripModal;
```

### 2.3. Update MyTrips Component
**File**: `src/pages/MyTrips.js` (Update existing)

**Changes needed:**
1. Add tab navigation (Active / Completed)
2. Use `getItineraryStatus()` to determine status
3. Filter trips by status
4. Add action buttons (Edit, Complete, Cancel)
5. Show TripStatusBadge

**Key code snippets:**
```jsx
// Add state for tab
const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'

// Process trips with status
const processedTrips = trips.map(trip => ({
    ...trip,
    computedStatus: getItineraryStatus(trip),
    currentDay: getCurrentDayOfTrip(trip)
}));

// Filter by tab
const filteredTrips = processedTrips.filter(trip => {
    if (activeTab === 'active') {
        return trip.computedStatus === 'active' || trip.computedStatus === 'ongoing';
    } else {
        return trip.computedStatus === 'completed' || trip.computedStatus === 'cancelled';
    }
});

// Action handlers
const handleMarkCompleted = async (tripId) => {
    const result = await markItineraryCompleted(tripId);
    if (result.success) {
        toast.success('Đã đánh dấu hoàn thành!');
        loadTrips();
    }
};

const handleCancelTrip = (trip) => {
    setTripToCancel(trip);
    setShowCancelModal(true);
};
```

## 📦 Phase 3: Advanced Features (TODO)

### 3.1. EditTripModal Component
**Features:**
- Edit start date (date picker)
- Edit number of travelers
- Edit budget
- Edit notes

### 3.2. TimelineEditor Component
**Features:**
- Display daily schedule
- Drag & drop to reorder activities
- Edit activity time
- Add new activity
- Remove activity
- Auto-recalculate times

**Dependencies:**
```bash
npm install react-beautiful-dnd date-fns
```

### 3.3. Drag & Drop Implementation
```jsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const TimelineEditor = ({ daySchedule, onUpdate }) => {
    const handleDragEnd = (result) => {
        if (!result.destination) return;
        
        const items = Array.from(daySchedule);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        
        // Recalculate times
        const updatedSchedule = recalculateTimes(items);
        onUpdate(updatedSchedule);
    };
    
    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="schedule">
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                        {daySchedule.map((activity, index) => (
                            <Draggable 
                                key={activity.id || index} 
                                draggableId={String(index)} 
                                index={index}
                            >
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                    >
                                        <ActivityCard activity={activity} />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
};
```

## 🎨 CSS Styling Guide

### Color Scheme:
- Active: `#2196F3` (Blue)
- Ongoing: `#4CAF50` (Green)
- Completed: `#9E9E9E` (Gray)
- Cancelled: `#F44336` (Red)

### Button Styles:
```css
.btn-primary { background: #2196F3; }
.btn-success { background: #4CAF50; }
.btn-danger { background: #F44336; }
.btn-secondary { background: #757575; }
```

## 📝 Testing Checklist

### Status Detection:
- [ ] Active trip shows correct status
- [ ] Ongoing trip (today is within trip dates) shows "Đang đi"
- [ ] Completed trip shows correct status
- [ ] Cancelled trip shows correct status
- [ ] Auto-complete after trip ends + 1 day

### Actions:
- [ ] Mark as completed works
- [ ] Cancel with reason works
- [ ] Edit basic info works
- [ ] Edit timeline works
- [ ] Drag & drop reorder works

### UI:
- [ ] Tab navigation works
- [ ] Status badges display correctly
- [ ] Modals open/close properly
- [ ] Loading states show
- [ ] Error messages display

### Data:
- [ ] Stats update after marking completed
- [ ] Cancelled trips don't count in stats
- [ ] Timeline changes save to Firebase
- [ ] All updates have updatedAt timestamp

## 🚀 Deployment Steps

1. **Install dependencies:**
```bash
npm install react-beautiful-dnd date-fns
```

2. **Create components in order:**
   - TripStatusBadge
   - CancelTripModal
   - Update MyTrips
   - EditTripModal
   - TimelineEditor

3. **Test each feature:**
   - Test status detection
   - Test mark completed
   - Test cancel
   - Test edit
   - Test drag & drop

4. **Deploy to production**

## 📚 Documentation

- Update USER_PROFILE_STATS_FROM_COMPLETED_TRIPS.md
- Create ITINERARY_EDITING_GUIDE.md
- Update HUONG_DAN_SU_DUNG.md

## 🎯 Success Criteria

- ✅ Users can see trip status automatically
- ✅ Users can mark trips as completed
- ✅ Users can cancel trips with reason
- ✅ Users can edit trip basic info
- ✅ Users can reorder activities with drag & drop
- ✅ Stats only count completed trips
- ✅ UI is intuitive and responsive
