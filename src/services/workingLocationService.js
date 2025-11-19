// Branch 2: feature/working-location-model
// Developer B - Service xử lý working locations

import { WorkingLocation } from '../models/workingLocation';

/**
 * Working Location Service
 * Xử lý logic liên quan đến địa điểm làm việc
 */

export const workingLocationService = {
    /**
     * Create a new working location
     */
    createWorkingLocation(data) {
        const workingLocation = new WorkingLocation(data);
        const validation = workingLocation.validate();
        
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }
        
        return workingLocation;
    },

    /**
     * Get working locations for a specific date
     */
    getWorkingLocationsForDate(workingLocations, dateString) {
        return workingLocations.filter(location => 
            location.isWorkingOnDate(dateString)
        );
    },

    /**
     * Check if a time slot conflicts with working hours
     */
    hasTimeConflict(workingLocation, dateString, startTime, endTime) {
        if (!workingLocation.isWorkingOnDate(dateString)) {
            return false;
        }

        // Convert times to minutes for comparison
        const toMinutes = (time) => {
            const [hours, mins] = time.split(':').map(Number);
            return hours * 60 + mins;
        };

        const workStart = toMinutes(workingLocation.startTime);
        const workEnd = toMinutes(workingLocation.endTime);
        const activityStart = toMinutes(startTime);
        const activityEnd = toMinutes(endTime);

        // Check if there's any overlap
        return !(activityEnd <= workStart || activityStart >= workEnd);
    },

    /**
     * Get available time slots for a date (excluding working hours)
     */
    getAvailableTimeSlots(workingLocations, dateString, dayStartTime = '06:00', dayEndTime = '23:00') {
        const workingOnDate = this.getWorkingLocationsForDate(workingLocations, dateString);
        
        if (workingOnDate.length === 0) {
            return [{ start: dayStartTime, end: dayEndTime }];
        }

        // Sort working locations by start time
        const sortedWork = workingOnDate.sort((a, b) => 
            a.startTime.localeCompare(b.startTime)
        );

        const availableSlots = [];
        let currentTime = dayStartTime;

        sortedWork.forEach(work => {
            if (currentTime < work.startTime) {
                availableSlots.push({
                    start: currentTime,
                    end: work.startTime
                });
            }
            currentTime = work.endTime > currentTime ? work.endTime : currentTime;
        });

        // Add remaining time after last work session
        if (currentTime < dayEndTime) {
            availableSlots.push({
                start: currentTime,
                end: dayEndTime
            });
        }

        return availableSlots;
    },

    /**
     * Calculate total working hours in the trip
     */
    getTotalWorkingHours(workingLocations) {
        return workingLocations.reduce((total, location) => {
            const hours = location.getDurationHours();
            const days = location.isAllDays ? 1 : location.workingDays.length;
            return total + (hours * days);
        }, 0);
    },

    /**
     * Validate working locations don't overlap
     */
    validateNoOverlap(workingLocations) {
        for (let i = 0; i < workingLocations.length; i++) {
            for (let j = i + 1; j < workingLocations.length; j++) {
                const loc1 = workingLocations[i];
                const loc2 = workingLocations[j];

                // Find common working days
                const commonDays = loc1.isAllDays || loc2.isAllDays
                    ? ['all']
                    : loc1.workingDays.filter(day => loc2.workingDays.includes(day));

                if (commonDays.length > 0) {
                    // Check time overlap
                    if (this.hasTimeConflict(loc1, commonDays[0], loc2.startTime, loc2.endTime)) {
                        return {
                            isValid: false,
                            error: `Địa điểm "${loc1.name}" và "${loc2.name}" có thời gian làm việc trùng nhau`
                        };
                    }
                }
            }
        }

        return { isValid: true };
    }
};

export default workingLocationService;
