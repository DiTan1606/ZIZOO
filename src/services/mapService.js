// src/services/mapService.js
export const getDirections = async (origin, destination, waypoints = []) => {
    const service = new window.google.maps.DirectionsService();
    return new Promise((resolve, reject) => {
        service.route(
            {
                origin,
                destination,
                waypoints: waypoints.map((w) => ({ location: w, stopover: true })),
                travelMode: window.google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true,
            },
            (result, status) => {
                if (status === 'OK') {
                    resolve(result);
                } else {
                    // Trả về lỗi với thông tin chi tiết
                    reject({ status, message: getDirectionsErrorMessage(status) });
                }
            }
        );
    });
};

/**
 * Lấy thông điệp lỗi dễ hiểu cho Directions API
 */
const getDirectionsErrorMessage = (status) => {
    const messages = {
        'ZERO_RESULTS': 'Không tìm thấy đường đi (có thể cần đi tàu/phà)',
        'NOT_FOUND': 'Không tìm thấy địa điểm',
        'INVALID_REQUEST': 'Yêu cầu không hợp lệ',
        'OVER_QUERY_LIMIT': 'Vượt quá giới hạn truy vấn',
        'REQUEST_DENIED': 'Yêu cầu bị từ chối',
        'UNKNOWN_ERROR': 'Lỗi không xác định'
    };
    return messages[status] || status;
};

/**
 * Thử tìm đường đi, nếu lỗi thì trả về null thay vì throw error
 */
export const getDirectionsSafe = async (origin, destination, waypoints = []) => {
    try {
        return await getDirections(origin, destination, waypoints);
    } catch (error) {
        console.warn(`⚠️ Cannot find route: ${error.message || error.status}`);
        return null; // Trả về null thay vì throw error
    }
};