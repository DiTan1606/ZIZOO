// src/services/businessTravelScheduleService.js
/**
 * Service xử lý lịch trình CÔNG TÁC + DU LỊCH
 * Tách riêng hoàn toàn khỏi logic du lịch thuần
 * 
 * Logic:
 * - Ngày làm việc: chỉ gợi ý TRƯỚC và SAU giờ làm
 * - Ngày không làm việc: gợi ý như du lịch thuần
 */

/**
 * Kiểm tra xem một ngày có phải là ngày làm việc không
 */
export const isWorkingDay = (dateString, workingLocations) => {
    if (!workingLocations || workingLocations.length === 0) {
        return false;
    }
    
    // Kiểm tra xem có working location nào áp dụng cho ngày này không
    const hasWorkingLocation = workingLocations.some(loc => {
        if (loc.isAllDays) return true;
        if (loc.workingDays && loc.workingDays.includes(dateString)) return true;
        return false;
    });
    
    return hasWorkingLocation;
};

/**
 * Lấy thông tin làm việc cho một ngày cụ thể
 */
export const getWorkingInfoForDay = (dateString, workingLocations) => {
    if (!workingLocations || workingLocations.length === 0) {
        return null;
    }
    
    // Tìm working location áp dụng cho ngày này
    const workingLocation = workingLocations.find(loc => {
        if (loc.isAllDays) return true;
        if (loc.workingDays && loc.workingDays.includes(dateString)) return true;
        return false;
    });
    
    if (!workingLocation) return null;
    
    return {
        name: workingLocation.name,
        address: workingLocation.address,
        startTime: workingLocation.startTime,
        endTime: workingLocation.endTime,
        lat: workingLocation.lat,
        lng: workingLocation.lng,
        notes: workingLocation.notes
    };
};

/**
 * Tính thời gian tiếp theo dựa trên thời gian hiện tại + duration
 */
const calculateNextTime = (currentTime, durationStr) => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    
    // Parse duration (ví dụ: "45 phút", "1-2 giờ", "1.5 giờ")
    let durationMinutes = 60; // default
    
    if (durationStr.includes('phút')) {
        const match = durationStr.match(/(\d+)\s*phút/);
        if (match) durationMinutes = parseInt(match[1]);
    } else if (durationStr.includes('giờ')) {
        const match = durationStr.match(/([\d.]+)(?:-[\d.]+)?\s*giờ/);
        if (match) {
            const hourValue = parseFloat(match[1]);
            durationMinutes = hourValue * 60;
        }
    }
    
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
};

/**
 * Tạo lịch trình cho ngày LÀM VIỆC - THÔNG MINH
 * Gợi ý dựa vào giờ làm việc cụ thể
 */
export const generateWorkingDaySchedule = (
    dayNumber,
    destinations,
    restaurants,
    interests,
    departureTime,
    workingInfo
) => {
    const schedule = [];
    const { startTime: workStartTime, endTime: workEndTime, name: workplaceName, address: workplaceAddress } = workingInfo;
    
    console.log(`💼 Generating SMART WORKING DAY schedule for Day ${dayNumber}`);
    console.log(`⏰ Work hours: ${workStartTime} - ${workEndTime} at ${workplaceName}`);
    
    // Parse work hours
    const [workStartHour, workStartMin] = workStartTime.split(':').map(Number);
    const [workEndHour, workEndMin] = workEndTime.split(':').map(Number);
    const [departHour, departMin] = departureTime.split(':').map(Number);
    
    // Tính số giờ có thể tham quan
    const morningHours = workStartHour - departHour - (workStartMin - departMin) / 60;
    const eveningHours = 22 - workEndHour - (0 - workEndMin) / 60; // Giả định kết thúc lúc 22:00
    
    console.log(`📊 Available time: Morning ${morningHours.toFixed(1)}h, Evening ${eveningHours.toFixed(1)}h`);
    
    // ===== BUỔI SÁNG (Trước giờ làm) =====
    let currentTime = departureTime;
    let morningDestCount = 0;
    
    // Nếu có >= 3 giờ buổi sáng → Gợi ý đầy đủ (ăn sáng + 2 địa điểm)
    if (morningHours >= 3) {
        // Ăn sáng
        if (departHour < 9 && restaurants.breakfast) {
            schedule.push({
                time: currentTime,
                activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
                type: 'meal',
                duration: '45 phút',
                location: restaurants.breakfast,
                notes: ['Bắt đầu ngày mới với bữa sáng ngon']
            });
            currentTime = calculateNextTime(currentTime, '45 phút');
        }
        
        // Tham quan 2 địa điểm
        const morningDests = destinations.slice(0, 2);
        morningDests.forEach((dest, idx) => {
            schedule.push({
                time: currentTime,
                activity: `Tham quan ${dest.name}`,
                type: 'sightseeing',
                duration: dest.estimatedDuration || '1-1.5 giờ',
                location: dest,
                notes: ['Tham quan trước giờ làm', idx === 0 ? 'Nên chọn địa điểm gần nơi làm việc' : '']
            });
            currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
            morningDestCount++;
        });
    } 
    // Nếu có 2-3 giờ → Ăn sáng + 1 địa điểm
    else if (morningHours >= 2) {
        if (departHour < 9 && restaurants.breakfast) {
            schedule.push({
                time: currentTime,
                activity: `Ăn sáng tại ${restaurants.breakfast.name}`,
                type: 'meal',
                duration: '45 phút',
                location: restaurants.breakfast,
                notes: ['Ăn sáng nhẹ trước khi đi làm']
            });
            currentTime = calculateNextTime(currentTime, '45 phút');
        }
        
        // 1 địa điểm
        if (destinations.length > 0) {
            const morningDest = destinations[0];
            schedule.push({
                time: currentTime,
                activity: `Tham quan nhanh ${morningDest.name}`,
                type: 'sightseeing',
                duration: '1 giờ',
                location: morningDest,
                notes: ['Tham quan nhanh trước giờ làm', 'Nên chọn địa điểm gần nơi làm việc']
            });
            currentTime = calculateNextTime(currentTime, '1 giờ');
            morningDestCount++;
        }
    }
    // Nếu < 2 giờ → Chỉ ăn sáng hoặc không gợi ý
    else if (morningHours >= 1 && departHour < 9 && restaurants.breakfast) {
        schedule.push({
            time: currentTime,
            activity: `Ăn sáng nhanh tại ${restaurants.breakfast.name}`,
            type: 'meal',
            duration: '30 phút',
            location: restaurants.breakfast,
            notes: ['Ăn sáng nhanh trước giờ làm']
        });
        currentTime = calculateNextTime(currentTime, '30 phút');
    }
    
    // ===== GIỜ LÀM VIỆC (Work block) =====
    const workDuration = workEndHour - workStartHour + (workEndMin - workStartMin) / 60;
    schedule.push({
        time: workStartTime,
        activity: `💼 Làm việc tại ${workplaceName}`,
        type: 'work',
        duration: `${workDuration.toFixed(1)} giờ`,
        location: {
            name: workplaceName,
            address: workplaceAddress,
            lat: workingInfo.lat,
            lng: workingInfo.lng
        },
        notes: [
            '⚠️ Thời gian làm việc - KHÔNG có gợi ý du lịch',
            'Tập trung công việc',
            workingInfo.notes || 'Nhớ mang theo tài liệu làm việc'
        ],
        isWorkTime: true
    });
    
    // ===== BUỔI TỐI (Sau giờ làm) =====
    currentTime = workEndTime;
    
    // Nếu có >= 4 giờ buổi tối → Gợi ý đầy đủ
    if (eveningHours >= 4) {
        // Nghỉ ngơi
        schedule.push({
            time: currentTime,
            activity: 'Nghỉ ngơi, thư giãn sau giờ làm',
            type: 'free_time',
            duration: '30 phút',
            notes: ['Thư giãn, chuẩn bị cho hoạt động tối']
        });
        currentTime = calculateNextTime(currentTime, '30 phút');
        
        // Ăn tối
        schedule.push({
            time: currentTime,
            activity: `Ăn tối tại ${restaurants.dinner?.name || 'nhà hàng địa phương'}`,
            type: 'meal',
            duration: '1-1.5 giờ',
            location: restaurants.dinner,
            specialDish: restaurants.dinner?.specialty || 'Đặc sản địa phương',
            notes: ['Thưởng thức ẩm thực sau ngày làm việc']
        });
        currentTime = calculateNextTime(currentTime, '1.5 giờ');
        
        // Tham quan tối (1-2 địa điểm còn lại)
        const remainingDests = destinations.slice(morningDestCount, morningDestCount + 2);
        remainingDests.forEach((dest, idx) => {
            const [currentHourCheck] = currentTime.split(':').map(Number);
            if (currentHourCheck < 21) {
                schedule.push({
                    time: currentTime,
                    activity: `Tham quan ${dest.name}`,
                    type: 'sightseeing',
                    duration: dest.estimatedDuration || '1-1.5 giờ',
                    location: dest,
                    notes: ['Hoạt động tối sau giờ làm', idx === 0 ? 'Có thể điều chỉnh tùy mức độ mệt mỏi' : '']
                });
                currentTime = calculateNextTime(currentTime, dest.estimatedDuration || '1.5 giờ');
            }
        });
        
        // Hoạt động tự do
        schedule.push({
            time: currentTime,
            activity: 'Tự do khám phá, dạo phố, mua sắm',
            type: 'free_time',
            duration: '1-2 giờ',
            suggestions: ['Dạo chợ đêm', 'Uống cà phê', 'Chụp ảnh đêm', 'Mua sắm đồ lưu niệm'],
            notes: ['Thời gian tự do sau ngày làm việc']
        });
    }
    // Nếu có 2-4 giờ → Ăn tối + 1 địa điểm
    else if (eveningHours >= 2) {
        schedule.push({
            time: currentTime,
            activity: `Ăn tối tại ${restaurants.dinner?.name || 'nhà hàng địa phương'}`,
            type: 'meal',
            duration: '1 giờ',
            location: restaurants.dinner,
            specialDish: restaurants.dinner?.specialty || 'Đặc sản địa phương'
        });
        currentTime = calculateNextTime(currentTime, '1 giờ');
        
        // 1 địa điểm
        const remainingDests = destinations.slice(morningDestCount);
        if (remainingDests.length > 0) {
            const eveningDest = remainingDests[0];
            schedule.push({
                time: currentTime,
                activity: `Tham quan ${eveningDest.name}`,
                type: 'sightseeing',
                duration: '1 giờ',
                location: eveningDest,
                notes: ['Tham quan nhanh buổi tối']
            });
            currentTime = calculateNextTime(currentTime, '1 giờ');
        }
        
        schedule.push({
            time: currentTime,
            activity: 'Tự do dạo phố, thư giãn',
            type: 'free_time',
            duration: '1 giờ',
            suggestions: ['Dạo phố', 'Uống cà phê']
        });
    }
    // Nếu < 2 giờ → Chỉ ăn tối
    else {
        schedule.push({
            time: currentTime,
            activity: `Ăn tối tại ${restaurants.dinner?.name || 'nhà hàng địa phương'}`,
            type: 'meal',
            duration: '1 giờ',
            location: restaurants.dinner,
            notes: ['Nghỉ ngơi sau ngày làm việc dài']
        });
    }
    
    return schedule.sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Tạo lịch trình cho ngày KHÔNG LÀM VIỆC
 * Gợi ý như du lịch thuần (sử dụng logic cũ)
 */
export const generateNonWorkingDaySchedule = (
    dayNumber,
    destinations,
    restaurants,
    interests,
    departureTime,
    specialActivities = {}
) => {
    const schedule = [];
    
    console.log(`🏖️ Generating NON-WORKING DAY schedule for Day ${dayNumber} (like pure travel)`);
    
    // Ngày đầu tiên có thể có di chuyển
    if (dayNumber === 1) {
        schedule.push({
            time: '06:30',
            activity: 'Khởi hành từ điểm xuất phát',
            type: 'transport',
            duration: '30 phút',
            notes: ['Chuẩn bị hành lý', 'Kiểm tra giấy tờ']
        });
        
        schedule.push({
            time: '12:30',
            activity: `Đến ${destinations[0]?.name || 'điểm đến'}, nhận phòng`,
            type: 'accommodation',
            duration: '30 phút',
            notes: ['Check-in khách sạn', 'Nghỉ ngơi']
        });
    } else {
        // Ăn sáng
        schedule.push({
            time: '07:00',
            activity: 'Ăn sáng tại khách sạn',
            type: 'meal',
            duration: '45 phút'
        });
    }
    
    // Thời gian bắt đầu tham quan
    let currentTime = dayNumber === 1 ? '14:00' : departureTime;
    
    // Thêm các hoạt động tham quan (LOGIC CŨ - DU LỊCH THUẦN)
    destinations.forEach((dest, index) => {
        // Kiểm tra special activities
        const hasSpecialActivity = specialActivities[`day${dayNumber}`];
        
        schedule.push({
            time: currentTime,
            activity: `Tham quan ${dest.name}`,
            type: 'sightseeing',
            duration: dest.recommendedTime || dest.estimatedDuration || '1-2 giờ',
            location: dest,
            notes: dest.specialNotes || [],
            entryFee: dest.entryFee,
            rating: dest.rating
        });
        
        // Tính thời gian tiếp theo
        currentTime = calculateNextTime(currentTime, dest.recommendedTime || '1.5 giờ');
        
        // Thêm bữa trưa nếu đến giờ ăn
        const [hours] = currentTime.split(':').map(Number);
        if (hours >= 12 && hours <= 13 && index === Math.floor(destinations.length / 2)) {
            schedule.push({
                time: currentTime,
                activity: `Ăn trưa tại ${restaurants.lunch?.name || 'nhà hàng địa phương'}`,
                type: 'meal',
                duration: '1 giờ',
                location: restaurants.lunch,
                specialDish: restaurants.lunch?.specialty || 'Món đặc sản'
            });
            currentTime = calculateNextTime(currentTime, '1 giờ');
        }
    });
    
    // Ăn tối
    schedule.push({
        time: '18:00',
        activity: `Ăn tối tại ${restaurants.dinner?.name || 'nhà hàng địa phương'}`,
        type: 'meal',
        duration: '1-1.5 giờ',
        location: restaurants.dinner,
        specialDish: restaurants.dinner?.specialty || 'Đặc sản địa phương'
    });
    
    // Hoạt động tối
    schedule.push({
        time: '20:00',
        activity: 'Tự do khám phá, dạo phố, mua sắm',
        type: 'free_time',
        duration: '2-3 giờ',
        suggestions: ['Dạo chợ đêm', 'Uống cà phê', 'Chụp ảnh đêm', 'Mua sắm']
    });
    
    return schedule.sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Tạo lịch trình cho ngày CÔNG TÁC + DU LỊCH
 * Tự động phân biệt ngày làm việc và ngày không làm việc
 */
export const generateBusinessTravelDaySchedule = (
    dayNumber,
    date,
    destinations,
    restaurants,
    interests,
    departureTime,
    specialActivities,
    workingLocations
) => {
    const dateString = date.toISOString().split('T')[0];
    
    // Kiểm tra xem ngày này có phải ngày làm việc không
    const isWorking = isWorkingDay(dateString, workingLocations);
    
    if (isWorking) {
        // Ngày làm việc: chỉ gợi ý trước và sau giờ làm
        const workingInfo = getWorkingInfoForDay(dateString, workingLocations);
        return {
            schedule: generateWorkingDaySchedule(
                dayNumber,
                destinations,
                restaurants,
                interests,
                departureTime,
                workingInfo
            ),
            isWorkingDay: true,
            workingInfo
        };
    } else {
        // Ngày không làm việc: gợi ý như du lịch thuần
        return {
            schedule: generateNonWorkingDaySchedule(
                dayNumber,
                destinations,
                restaurants,
                interests,
                departureTime,
                specialActivities
            ),
            isWorkingDay: false,
            workingInfo: null
        };
    }
};

/**
 * Tạo ghi chú đặc biệt cho ngày công tác
 */
export const generateBusinessTravelNotes = (isWorkingDay, workingInfo) => {
    if (!isWorkingDay) {
        return [
            '🏖️ Ngày nghỉ - Tận hưởng như du lịch thuần',
            'Có thể tham quan thoải mái cả ngày',
            'Không bị giới hạn bởi giờ làm việc'
        ];
    }
    
    return [
        `💼 Ngày làm việc tại ${workingInfo.name}`,
        `⏰ Giờ làm: ${workingInfo.startTime} - ${workingInfo.endTime}`,
        '⚠️ Chỉ có thể tham quan TRƯỚC và SAU giờ làm',
        'Nên chọn địa điểm gần nơi làm việc để tiết kiệm thời gian',
        'Chuẩn bị tài liệu làm việc từ tối hôm trước',
        'Kiểm tra lịch họp và công việc cần hoàn thành'
    ];
};

export default {
    isWorkingDay,
    getWorkingInfoForDay,
    generateWorkingDaySchedule,
    generateNonWorkingDaySchedule,
    generateBusinessTravelDaySchedule,
    generateBusinessTravelNotes
};
