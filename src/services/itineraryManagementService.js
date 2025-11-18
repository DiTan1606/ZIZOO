// src/services/itineraryManagementService.js
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Lấy trạng thái hiện tại của lịch trình
 * @param {Object} itinerary - Lịch trình
 * @returns {string} - 'active' | 'ongoing' | 'completed' | 'cancelled'
 */
export const getItineraryStatus = (itinerary) => {
    // Nếu đã có status trong DB, ưu tiên status đó
    if (itinerary.status === 'completed') return 'completed';
    if (itinerary.status === 'cancelled') return 'cancelled';

    // Tự động phát hiện "ongoing" dựa trên ngày
    const now = new Date();
    const startDate = itinerary.startDate?.toDate ? itinerary.startDate.toDate() : new Date(itinerary.startDate);
    const endDate = itinerary.endDate?.toDate ? itinerary.endDate.toDate() : new Date(itinerary.endDate);

    // Nếu đang trong khoảng thời gian của chuyến đi
    if (now >= startDate && now <= endDate) {
        return 'ongoing';
    }

    // Mặc định là active (sắp tới)
    return 'active';
};

/**
 * Cập nhật trạng thái lịch trình
 * @param {string} userId - ID người dùng
 * @param {string} itineraryId - ID lịch trình
 * @param {string} status - 'active' | 'completed' | 'cancelled'
 * @param {string} reason - Lý do (nếu cancel)
 */
export const updateItineraryStatus = async (userId, itineraryId, status, reason = null) => {
    try {
        const itineraryRef = doc(db, 'users', userId, 'completeItineraries', itineraryId);
        
        const updateData = {
            status,
            updatedAt: Timestamp.now()
        };

        // Nếu là cancelled, lưu lý do
        if (status === 'cancelled' && reason) {
            updateData.cancelReason = reason;
            updateData.cancelledAt = Timestamp.now();
        }

        // Nếu là completed, lưu thời gian hoàn thành
        if (status === 'completed') {
            updateData.completedAt = Timestamp.now();
        }

        await updateDoc(itineraryRef, updateData);
        
        console.log(`✅ Updated itinerary ${itineraryId} status to ${status}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating itinerary status:', error);
        throw error;
    }
};

/**
 * Kiểm tra xem lịch trình có thể chỉnh sửa không
 * @param {Object} itinerary - Lịch trình
 * @returns {boolean}
 */
export const canEditItinerary = (itinerary) => {
    const status = getItineraryStatus(itinerary);
    // Chỉ cho phép edit nếu là active hoặc ongoing
    return status === 'active' || status === 'ongoing';
};

/**
 * Kiểm tra xem lịch trình có thể hủy không
 * @param {Object} itinerary - Lịch trình
 * @returns {boolean}
 */
export const canCancelItinerary = (itinerary) => {
    const status = getItineraryStatus(itinerary);
    // Chỉ cho phép hủy nếu là active hoặc ongoing
    return status === 'active' || status === 'ongoing';
};

/**
 * Kiểm tra xem lịch trình có thể đánh dấu hoàn thành không
 * @param {Object} itinerary - Lịch trình
 * @returns {boolean}
 */
export const canCompleteItinerary = (itinerary) => {
    const status = getItineraryStatus(itinerary);
    // Chỉ cho phép complete nếu là active hoặc ongoing
    return status === 'active' || status === 'ongoing';
};

/**
 * Lấy badge color theo status
 * @param {string} status - Status
 * @returns {Object} - { bg, text }
 */
export const getStatusBadgeColor = (status) => {
    const colors = {
        active: { bg: 'bg-gray-100', text: 'text-gray-700' },
        ongoing: { bg: 'bg-blue-100', text: 'text-blue-700' },
        completed: { bg: 'bg-green-100', text: 'text-green-700' },
        cancelled: { bg: 'bg-red-100', text: 'text-red-700' }
    };
    return colors[status] || colors.active;
};

/**
 * Lấy label theo status
 * @param {string} status - Status
 * @returns {string}
 */
export const getStatusLabel = (status) => {
    const labels = {
        active: '📅 Sắp tới',
        ongoing: '🚀 Đang đi',
        completed: '✅ Hoàn thành',
        cancelled: '❌ Đã hủy'
    };
    return labels[status] || labels.active;
};
