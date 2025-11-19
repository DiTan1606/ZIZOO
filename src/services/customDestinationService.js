// Service xử lý địa điểm tùy chỉnh của người dùng
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

/**
 * Lưu địa điểm custom vào Firestore
 */
export const saveCustomDestination = async (destination, userId) => {
    try {
        const customDestRef = collection(db, 'customDestinations');
        
        const docData = {
            userId,
            name: destination.name,
            address: destination.address,
            coordinates: destination.coordinates || null,
            category: destination.category || destination.type,
            city: destination.city || '',
            rating: 0,
            visitCount: 1,
            createdAt: new Date(),
            lastVisited: new Date()
        };

        const docRef = await addDoc(customDestRef, docData);
        console.log('✅ Đã lưu địa điểm custom:', docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Lỗi lưu địa điểm custom:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Lấy địa điểm custom của user theo thành phố
 */
export const getUserCustomDestinations = async (userId, city) => {
    try {
        const customDestRef = collection(db, 'customDestinations');
        const q = query(
            customDestRef,
            where('userId', '==', userId),
            where('city', '==', city),
            orderBy('visitCount', 'desc'),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        const destinations = [];
        
        snapshot.forEach(doc => {
            destinations.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return destinations;
    } catch (error) {
        console.error('Lỗi lấy địa điểm custom:', error);
        return [];
    }
};

/**
 * Insert custom destinations vào lịch trình với ưu tiên cao
 */
export const insertCustomDestinationsIntoSchedule = (schedule, customDestinations) => {
    if (!customDestinations || customDestinations.length === 0) {
        return schedule;
    }

    const newSchedule = [...schedule];
    
    customDestinations.forEach(customDest => {
        // Nếu có preferredTime, insert vào đúng thời gian đó
        if (customDest.preferredTime) {
            const insertIndex = newSchedule.findIndex(
                item => item.time >= customDest.preferredTime
            );
            
            const activity = {
                time: customDest.preferredTime,
                activity: `${customDest.categoryIcon || '📍'} ${customDest.name}`,
                type: customDest.category || 'custom',
                duration: `${customDest.duration || 2} giờ`,
                location: {
                    name: customDest.name,
                    address: customDest.address,
                    coordinates: customDest.coordinates
                },
                isCustom: true,
                priority: 'high',
                notes: ['Địa điểm do bạn chọn', 'Ưu tiên cao'],
                realData: true
            };
            
            if (insertIndex >= 0) {
                newSchedule.splice(insertIndex, 0, activity);
            } else {
                newSchedule.push(activity);
            }
        } else {
            // Nếu không có preferredTime, thêm vào cuối
            newSchedule.push({
                time: '', // Sẽ được tính sau
                activity: `${customDest.categoryIcon || '📍'} ${customDest.name}`,
                type: customDest.category || 'custom',
                duration: `${customDest.duration || 2} giờ`,
                location: {
                    name: customDest.name,
                    address: customDest.address,
                    coordinates: customDest.coordinates
                },
                isCustom: true,
                priority: 'high',
                notes: ['Địa điểm do bạn chọn'],
                realData: true
            });
        }
    });
    
    // Sort lại theo thời gian
    return newSchedule.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
    });
};

export default {
    saveCustomDestination,
    getUserCustomDestinations,
    insertCustomDestinationsIntoSchedule
};
