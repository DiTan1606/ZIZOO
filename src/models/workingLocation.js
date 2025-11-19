// Branch 2: feature/working-location-model
// Developer B - Data model cho địa điểm làm việc

/**
 * Working Location Model
 * Định nghĩa cấu trúc dữ liệu cho địa điểm làm việc
 */

export class WorkingLocation {
    constructor(data = {}) {
        this.id = data.id || `work_${Date.now()}`;
        this.name = data.name || '';
        this.address = data.address || '';
        this.coordinates = data.coordinates || { lat: null, lng: null };
        this.type = 'working'; // Fixed type
        this.startTime = data.startTime || '09:00';
        this.endTime = data.endTime || '17:00';
        this.workingDays = data.workingDays || []; // Array of date strings ['2024-01-15', '2024-01-16']
        this.description = data.description || '';
        this.isAllDays = data.isAllDays || false; // Áp dụng cho tất cả các ngày
        this.priority = 'fixed'; // Fixed priority - không thể di chuyển
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    // Validate working location data
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim() === '') {
            errors.push('Tên địa điểm làm việc không được để trống');
        }
        
        if (!this.address || this.address.trim() === '') {
            errors.push('Địa chỉ không được để trống');
        }
        
        if (!this.coordinates.lat || !this.coordinates.lng) {
            errors.push('Tọa độ địa điểm không hợp lệ');
        }
        
        if (!this.isAllDays && (!this.workingDays || this.workingDays.length === 0)) {
            errors.push('Vui lòng chọn ít nhất một ngày làm việc');
        }
        
        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(this.startTime)) {
            errors.push('Giờ bắt đầu không hợp lệ');
        }
        if (!timeRegex.test(this.endTime)) {
            errors.push('Giờ kết thúc không hợp lệ');
        }
        
        // Validate end time is after start time
        if (this.startTime >= this.endTime) {
            errors.push('Giờ kết thúc phải sau giờ bắt đầu');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Convert to plain object for storage
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            address: this.address,
            coordinates: this.coordinates,
            type: this.type,
            startTime: this.startTime,
            endTime: this.endTime,
            workingDays: this.workingDays,
            description: this.description,
            isAllDays: this.isAllDays,
            priority: this.priority,
            createdAt: this.createdAt
        };
    }

    // Check if working on a specific date
    isWorkingOnDate(dateString) {
        if (this.isAllDays) return true;
        return this.workingDays.includes(dateString);
    }

    // Get duration in hours
    getDurationHours() {
        const [startHour, startMin] = this.startTime.split(':').map(Number);
        const [endHour, endMin] = this.endTime.split(':').map(Number);
        return (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
    }
}

export default WorkingLocation;
