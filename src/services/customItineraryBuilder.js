// src/services/customItineraryBuilder.js
/**
 * Service xử lý tạo lịch trình dựa trên địa điểm và khung giờ do người dùng chọn
 */

/**
 * Sắp xếp địa điểm theo khung giờ và tối ưu hóa lộ trình
 */
export const organizeDestinationsByTime = (selectedDestinations, preferences) => {
    const { duration, startTime = '08:00' } = preferences; // Đổi từ departureTime sang startTime
    
    // Phân loại địa điểm
    const withTime = selectedDestinations.filter(d => d.preferredTime);
    const withoutTime = selectedDestinations.filter(d => !d.preferredTime);
    
    // Sắp xếp địa điểm có khung giờ theo thời gian
    withTime.sort((a, b) => a.preferredTime.localeCompare(b.preferredTime));
    
    // Phân bổ địa điểm vào các ngày
    const dailyPlans = [];
    const hoursPerDay = 12; // Giả sử mỗi ngày có 12 giờ hoạt động
    
    for (let day = 0; day < duration; day++) {
        dailyPlans.push({
            day: day + 1,
            destinations: [],
            availableHours: hoursPerDay
        });
    }
    
    // Thêm địa điểm có khung giờ cố định trước
    withTime.forEach(dest => {
        const dayIndex = assignDestinationToDay(dest, dailyPlans, preferences);
        if (dayIndex !== -1) {
            dailyPlans[dayIndex].destinations.push(dest);
            dailyPlans[dayIndex].availableHours -= parseFloat(dest.duration || 2);
        }
    });
    
    // Phân bổ địa điểm không có khung giờ vào các khoảng trống
    withoutTime.forEach(dest => {
        const dayIndex = findBestDayForDestination(dest, dailyPlans);
        if (dayIndex !== -1) {
            dailyPlans[dayIndex].destinations.push(dest);
            dailyPlans[dayIndex].availableHours -= parseFloat(dest.duration || 2);
        }
    });
    
    // Sắp xếp lại địa điểm trong mỗi ngày theo thời gian
    dailyPlans.forEach(plan => {
        plan.destinations.sort((a, b) => {
            if (a.preferredTime && b.preferredTime) {
                return a.preferredTime.localeCompare(b.preferredTime);
            }
            if (a.preferredTime) return -1;
            if (b.preferredTime) return 1;
            return 0;
        });
    });
    
    return dailyPlans;
};

/**
 * Gán địa điểm vào ngày phù hợp dựa trên khung giờ
 */
const assignDestinationToDay = (destination, dailyPlans, preferences) => {
    const time = destination.preferredTime;
    const [hours] = time.split(':').map(Number);
    
    // Xác định buổi: sáng (6-12), chiều (12-18), tối (18-24)
    let preferredDay = 0;
    
    if (hours >= 6 && hours < 12) {
        // Sáng - ưu tiên ngày đầu tiên có chỗ
        preferredDay = dailyPlans.findIndex(p => p.availableHours >= parseFloat(destination.duration || 2));
    } else if (hours >= 12 && hours < 18) {
        // Chiều - ưu tiên ngày giữa
        preferredDay = dailyPlans.findIndex(p => p.availableHours >= parseFloat(destination.duration || 2));
    } else {
        // Tối - ưu tiên ngày cuối
        preferredDay = dailyPlans.findIndex(p => p.availableHours >= parseFloat(destination.duration || 2));
    }
    
    return preferredDay;
};

/**
 * Tìm ngày tốt nhất cho địa điểm không có khung giờ cố định
 */
const findBestDayForDestination = (destination, dailyPlans) => {
    // Tìm ngày có nhiều thời gian rảnh nhất
    let bestDay = -1;
    let maxAvailableHours = 0;
    
    dailyPlans.forEach((plan, index) => {
        const requiredHours = parseFloat(destination.duration || 2);
        if (plan.availableHours >= requiredHours && plan.availableHours > maxAvailableHours) {
            maxAvailableHours = plan.availableHours;
            bestDay = index;
        }
    });
    
    return bestDay;
};

/**
 * Kiểm tra xem thời gian có nằm trong giờ mở cửa không
 */
const isWithinOpeningHours = (time, destination) => {
    // Nếu không có thông tin giờ mở cửa, cho phép
    if (!destination.openingHours) {
        return { valid: true, reason: null };
    }
    
    const [hours, minutes] = time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    // Giờ mở cửa thông thường cho các loại địa điểm
    const defaultHours = {
        'restaurant': { open: 6 * 60, close: 22 * 60 }, // 6:00 - 22:00
        'cafe': { open: 7 * 60, close: 21 * 60 }, // 7:00 - 23:00
        'tourist_attraction': { open: 8 * 60, close: 16 * 60 }, // 8:00 - 18:00
        'museum': { open: 8 * 60, close: 17 * 60 }, // 8:00 - 17:00
        'park': { open: 5 * 60, close: 22 * 60 }, // 5:00 - 22:00
        'shopping_mall': { open: 9 * 60, close: 22 * 60 }, // 9:00 - 22:00
        'night_club': { open: 20 * 60, close: 2 * 60 + 24 * 60 } // 20:00 - 02:00
    };
    
    const category = destination.category || 'tourist_attraction';
    const hours_range = defaultHours[category] || defaultHours['tourist_attraction'];
    
    // Kiểm tra giờ đóng cửa qua nửa đêm
    if (hours_range.close > 24 * 60) {
        // Địa điểm mở cửa qua nửa đêm (như night club)
        if (timeInMinutes >= hours_range.open || timeInMinutes <= hours_range.close - 24 * 60) {
            return { valid: true, reason: null };
        }
    } else {
        // Địa điểm thông thường
        if (timeInMinutes >= hours_range.open && timeInMinutes <= hours_range.close) {
            return { valid: true, reason: null };
        }
    }
    
    // Không hợp lệ
    const openTime = `${Math.floor(hours_range.open / 60)}:${String(hours_range.open % 60).padStart(2, '0')}`;
    const closeTime = `${Math.floor(hours_range.close / 60) % 24}:${String(hours_range.close % 60).padStart(2, '0')}`;
    
    return {
        valid: false,
        reason: `${destination.name} mở cửa ${openTime} - ${closeTime}`,
        suggestedTime: openTime
    };
};

/**
 * Điều chỉnh thời gian để phù hợp với giờ mở cửa
 */
const adjustTimeForOpeningHours = (time, destination) => {
    const check = isWithinOpeningHours(time, destination);
    
    if (check.valid) {
        return { time, adjusted: false, reason: null };
    }
    
    // Điều chỉnh sang giờ mở cửa
    return {
        time: check.suggestedTime,
        adjusted: true,
        reason: check.reason
    };
};

/**
 * Tạo lịch trình theo giờ chi tiết từ danh sách địa điểm
 */
export const generateScheduleFromDestinations = (dailyPlan, preferences, dayNumber) => {
    const { startTime = '08:00' } = preferences; // Đổi từ departureTime sang startTime
    const schedule = [];
    const warnings = []; // Lưu các cảnh báo về giờ mở cửa
    
    // Thời gian bắt đầu = startTime (giờ bắt đầu hành trình du lịch)
    let currentTime = startTime;
    
    // Không thêm "Khởi hành từ điểm xuất phát" nữa
    // Bắt đầu trực tiếp với hoạt động tham quan hoặc ăn uống
    
    // Thêm các địa điểm đã chọn với kiểm tra giờ mở cửa
    dailyPlan.destinations.forEach((dest, index) => {
        // Sử dụng khung giờ người dùng chọn hoặc thời gian hiện tại
        let activityTime = dest.preferredTime || currentTime;
        
        // Kiểm tra và điều chỉnh giờ mở cửa
        const timeCheck = adjustTimeForOpeningHours(activityTime, dest);
        
        if (timeCheck.adjusted) {
            warnings.push({
                destination: dest.name,
                originalTime: activityTime,
                adjustedTime: timeCheck.time,
                reason: timeCheck.reason
            });
            activityTime = timeCheck.time;
        }
        
        const notes = dest.isCustom 
            ? ['Địa điểm tùy chỉnh', 'Kiểm tra giờ mở cửa']
            : ['Điểm chụp ảnh đẹp'];
        
        // Thêm cảnh báo nếu có điều chỉnh
        if (timeCheck.adjusted) {
            notes.push(`⚠️ Đã điều chỉnh từ ${timeCheck.originalTime || activityTime}`);
            notes.push(timeCheck.reason);
        }
        
        schedule.push({
            time: activityTime,
            activity: `Tham quan ${dest.name}`,
            type: 'sightseeing',
            duration: `${dest.duration || 2} giờ`,
            location: dest,
            notes,
            adjusted: timeCheck.adjusted
        });
        
        // Cập nhật thời gian cho địa điểm tiếp theo
        const durationInMinutes = parseFloat(dest.duration || 2) * 60;
        currentTime = addMinutes(activityTime, durationInMinutes + 15); // +15 phút di chuyển
    });
    
    // Thêm bữa ăn vào các thời điểm phù hợp
    // Ăn sáng (nếu bắt đầu sớm, trước 10:00)
    const [startHour] = startTime.split(':').map(Number);
    if (startHour < 10) {
        schedule.push({
            time: startTime,
            activity: `Ăn sáng tại nhà hàng địa phương`,
            type: 'meal',
            duration: '45 phút',
            notes: ['Phở bò/gà', 'Bánh mì', 'Cà phê sữa đá'],
            location: { name: 'Quán ăn sáng địa phương', category: 'restaurant' }
        });
        currentTime = addMinutes(startTime, 45);
    }
    
    // Ăn trưa (khoảng 12:00)
    const lunchTime = '12:00';
    schedule.push({
        time: lunchTime,
        activity: `Ăn trưa tại nhà hàng địa phương`,
        type: 'meal',
        duration: '1 giờ',
        notes: ['Cơm/Bún/Phở', 'Món đặc sản', 'Nghỉ ngơi'],
        location: { name: 'Nhà hàng trưa', category: 'restaurant' }
    });
    
    // Ăn tối (khoảng 18:30, không quá muộn)
    let dinnerTime = currentTime;
    if (currentTime < '18:00') {
        dinnerTime = '18:30';
    } else if (currentTime > '21:00') {
        dinnerTime = '19:00';
        warnings.push({
            destination: 'Bữa tối',
            reason: 'Điều chỉnh giờ ăn tối để phù hợp (không quá muộn)'
        });
    }
    
    schedule.push({
        time: dinnerTime,
        activity: `Ăn tối tại nhà hàng địa phương`,
        type: 'meal',
        duration: '1.5 giờ',
        notes: ['Bữa tối thịnh soạn', 'Đặc sản địa phương', 'Hải sản tươi sống'],
        location: { name: 'Nhà hàng tối', category: 'restaurant' }
    });
    
    // Hoạt động tối
    const eveningTime = addMinutes(dinnerTime, 90);
    schedule.push({
        time: eveningTime,
        activity: 'Thư giãn, dạo phố',
        type: 'free_time',
        duration: '1-2 giờ',
        notes: ['Thưởng thức cà phê địa phương', 'Ngắm cảnh đêm']
    });
    
    // Sắp xếp lại theo thời gian
    const sortedSchedule = schedule.sort((a, b) => a.time.localeCompare(b.time));
    
    // Trả về cả schedule và warnings
    return {
        schedule: sortedSchedule,
        warnings
    };
};

/**
 * Thêm phút vào thời gian (format HH:MM)
 */
const addMinutes = (time, minutes) => {
    // Validation: nếu time undefined hoặc không hợp lệ, return default
    if (!time || typeof time !== 'string') {
        console.warn('addMinutes: Invalid time parameter:', time);
        return '08:00'; // Default fallback
    }
    
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
};

/**
 * Tính toán chi phí dựa trên địa điểm đã chọn
 */
export const calculateCostFromDestinations = (selectedDestinations, preferences) => {
    const { travelers, travelStyle } = preferences;
    
    let totalCost = 0;
    
    selectedDestinations.forEach(dest => {
        // Ước tính chi phí vào cửa
        const entryFee = dest.entryFee || estimateEntryFee(dest);
        totalCost += entryFee * travelers;
    });
    
    return totalCost;
};

/**
 * Ước tính phí vào cửa dựa trên loại địa điểm
 */
const estimateEntryFee = (destination) => {
    const category = destination.category || 'tourist_attraction';
    
    const fees = {
        'tourist_attraction': 50000,
        'museum': 30000,
        'park': 20000,
        'restaurant': 150000,
        'cafe': 50000,
        'shopping_mall': 0,
        'night_club': 200000,
        'custom': 50000
    };
    
    return fees[category] || 50000;
};

/**
 * Tạo ghi chú đặc biệt cho ngày dựa trên địa điểm
 */
export const generateDayNotes = (dailyPlan, dayNumber) => {
    const notes = [];
    
    if (dayNumber === 1) {
        notes.push('Ngày đầu tiên - đừng lên lịch quá dày');
        notes.push('Check-in khách sạn và nghỉ ngơi');
    }
    
    // Kiểm tra nếu có bảo tàng
    const hasMuseum = dailyPlan.destinations.some(d => 
        d.types?.includes('museum') || d.category === 'museum'
    );
    if (hasMuseum) {
        notes.push('Bảo tàng thường đóng cửa thứ 2');
    }
    
    // Kiểm tra địa điểm tùy chỉnh
    const hasCustom = dailyPlan.destinations.some(d => d.isCustom);
    if (hasCustom) {
        notes.push('Kiểm tra giờ mở cửa của địa điểm tùy chỉnh');
    }
    
    return notes;
};
