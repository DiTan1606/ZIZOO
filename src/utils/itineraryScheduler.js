// Branch 4: feature/itinerary-scheduler
// Developer D - Logic xếp lịch với working locations

import workingLocationService from '../services/workingLocationService';

/**
 * Itinerary Scheduler
 * Xử lý logic xếp lịch hoạt động, tránh conflict với working hours
 */

export const itineraryScheduler = {
    /**
     * Schedule activities around working locations
     * @param {Array} activities - Danh sách hoạt động cần xếp lịch
     * @param {Array} workingLocations - Danh sách địa điểm làm việc
     * @param {Array} tripDates - Danh sách ngày trong chuyến đi
     * @returns {Object} Lịch trình đã được xếp
     */
    scheduleWithWorkingLocations(activities, workingLocations, tripDates) {
        const schedule = {};

        tripDates.forEach(date => {
            schedule[date] = {
                date,
                workingLocations: [],
                activities: [],
                availableSlots: []
            };

            // Add working locations for this date
            const workingOnDate = workingLocationService.getWorkingLocationsForDate(
                workingLocations,
                date
            );
            schedule[date].workingLocations = workingOnDate;

            // Get available time slots
            const availableSlots = workingLocationService.getAvailableTimeSlots(
                workingLocations,
                date
            );
            schedule[date].availableSlots = availableSlots;
        });

        // TODO: Developer D - Implement activity scheduling logic
        // Distribute activities into available time slots

        return schedule;
    }
};

export default itineraryScheduler;
