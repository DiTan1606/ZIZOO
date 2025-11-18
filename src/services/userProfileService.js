/**
 * User Profile Service - Complete Backend for User Profile Management
 * Handles: Profile CRUD, Avatar Upload/Delete, Preferences, Stats
 */

import { db, storage } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * DEFAULT PROFILE STRUCTURE
 */
const DEFAULT_PROFILE = {
    displayName: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    dateOfBirth: '',
    gender: '',
    avatarURL: null,
    avatarPath: null,
    interests: [],
    travelStyle: 'standard',
    budget: 'medium',
    notifications: {
        email: true,
        push: true,
        sms: false
    },
    privacy: {
        profileVisible: true,
        showEmail: false,
        showPhone: false
    },
    emailNotifications: true,
    pushNotifications: true,
    weatherAlerts: true,
    dataSharing: false
};

/**
 * Get user profile data
 */
export const getUserProfile = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Merge with default to ensure all fields exist
            const profile = {
                ...DEFAULT_PROFILE,
                ...userData,
                createdAt: userData.createdAt || new Date(),
                updatedAt: userData.updatedAt || new Date()
            };
            
            return {
                success: true,
                data: profile
            };
        } else {
            // Return default profile
            return {
                success: true,
                data: {
                    ...DEFAULT_PROFILE,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            };
        }
    } catch (error) {
        console.error('Error getting user profile:', error);
        return {
            success: false,
            error: error.message,
            data: DEFAULT_PROFILE
        };
    }
};

/**
 * Create or update user profile (excluding avatar)
 */
export const saveUserProfile = async (userId, profileData) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        // Remove fields that shouldn't be updated here
        const { avatarURL, avatarPath, createdAt, updatedAt, ...cleanData } = profileData;
        
        // Add timestamp
        cleanData.updatedAt = serverTimestamp();
        
        if (userSnap.exists()) {
            // Update existing profile (preserve avatar and createdAt)
            await updateDoc(userRef, cleanData);
        } else {
            // Create new profile with all default fields
            await setDoc(userRef, {
                ...DEFAULT_PROFILE,
                ...cleanData,
                createdAt: serverTimestamp()
            });
        }
        
        return {
            success: true,
            message: 'Lưu thông tin thành công!'
        };
    } catch (error) {
        console.error('Error saving profile:', error);
        return {
            success: false,
            error: 'Lỗi khi lưu thông tin: ' + error.message
        };
    }
};

/**
 * Upload user avatar to Firebase Storage
 */
export const uploadAvatar = async (userId, file) => {
    try {
        // 1. Validate file
        if (!file) {
            throw new Error('Vui lòng chọn file ảnh');
        }
        
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error('File phải nhỏ hơn 5MB');
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WebP)');
        }
        
        // 2. Delete old avatar if exists
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().avatarPath) {
            try {
                const oldAvatarRef = ref(storage, userSnap.data().avatarPath);
                await deleteObject(oldAvatarRef);
            } catch (err) {
                console.log('Old avatar already deleted or not found');
            }
        }
        
        // 3. Upload new avatar
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `avatars/${userId}/${timestamp}.${ext}`;
        const storageRef = ref(storage, path);
        
        await uploadBytes(storageRef, file, {
            contentType: file.type
        });
        
        // 4. Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        
        // 5. Update Firestore
        const avatarData = {
            avatarURL: downloadURL,
            avatarPath: path,
            updatedAt: serverTimestamp()
        };
        
        if (userSnap.exists()) {
            await updateDoc(userRef, avatarData);
        } else {
            await setDoc(userRef, {
                ...DEFAULT_PROFILE,
                ...avatarData,
                createdAt: serverTimestamp()
            });
        }
        
        return {
            success: true,
            avatarURL: downloadURL,
            message: 'Cập nhật ảnh đại diện thành công!'
        };
        
    } catch (error) {
        console.error('Upload avatar error:', error);
        
        let errorMsg = 'Lỗi khi upload ảnh';
        
        if (error.code === 'storage/unauthorized') {
            errorMsg = 'Không có quyền upload. Vui lòng cấu hình Firebase Storage Rules.';
        } else if (error.message) {
            errorMsg = error.message;
        }
        
        return {
            success: false,
            error: errorMsg
        };
    }
};

/**
 * Delete user avatar
 */
export const deleteAvatar = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            throw new Error('Không tìm thấy profile');
        }
        
        const userData = userSnap.data();
        
        // Delete from Storage if exists
        if (userData.avatarPath) {
            try {
                const storageRef = ref(storage, userData.avatarPath);
                await deleteObject(storageRef);
            } catch (err) {
                console.log('Avatar file not found in storage');
            }
        }
        
        // Update Firestore
        await updateDoc(userRef, {
            avatarURL: null,
            avatarPath: null,
            updatedAt: serverTimestamp()
        });
        
        return {
            success: true,
            message: 'Đã xóa ảnh đại diện'
        };
        
    } catch (error) {
        console.error('Delete avatar error:', error);
        return {
            success: false,
            error: 'Lỗi khi xóa ảnh: ' + error.message
        };
    }
};

/**
 * Ensure user profile has all required fields
 */
export const ensureProfileFields = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // Create profile with all default fields
            await setDoc(userRef, {
                ...DEFAULT_PROFILE,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, created: true };
        }
        
        const userData = userSnap.data();
        const updates = {};
        let needsUpdate = false;
        
        // Check for missing fields
        Object.keys(DEFAULT_PROFILE).forEach(key => {
            if (userData[key] === undefined) {
                updates[key] = DEFAULT_PROFILE[key];
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            updates.updatedAt = serverTimestamp();
            await updateDoc(userRef, updates);
            return { success: true, updated: true, fields: Object.keys(updates) };
        }
        
        return { success: true, complete: true };
        
    } catch (error) {
        console.error('Error ensuring profile fields:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update user preferences
 */
export const updateUserPreferences = async (userId, preferences) => {
    try {
        const userRef = doc(db, 'users', userId);
        
        await updateDoc(userRef, {
            interests: preferences.interests || [],
            travelStyle: preferences.travelStyle || 'standard',
            notifications: preferences.notifications || {},
            privacy: preferences.privacy || {},
            updatedAt: serverTimestamp()
        });
        
        return {
            success: true,
            message: 'Preferences updated successfully'
        };
    } catch (error) {
        console.error('Error updating preferences:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get user statistics (chỉ tính các chuyến đi đã hoàn thành)
 */
export const getUserStats = async (userId) => {
    try {
        // Get user profile for memberSince
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        let memberSince = null;
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            memberSince = userData.createdAt || userData.memberSince || null;
        }
        
        // Get itineraries
        const itinerariesRef = doc(db, 'userItineraries', userId);
        const itinerariesSnap = await getDoc(itinerariesRef);
        
        let totalTrips = 0;
        let totalDestinations = 0;
        let totalSpending = 0;
        
        if (itinerariesSnap.exists()) {
            const itineraries = itinerariesSnap.data().itineraries || [];
            
            // Chỉ đếm các chuyến đi đã hoàn thành
            const completedTrips = itineraries.filter(itinerary => 
                itinerary.status === 'completed'
            );
            
            totalTrips = completedTrips.length;
            
            // Count unique destinations từ chuyến đi đã hoàn thành
            const destinations = new Set();
            completedTrips.forEach(itinerary => {
                if (itinerary.destination) {
                    destinations.add(itinerary.destination);
                }
                
                // Tính tổng chi tiêu
                if (itinerary.budget) {
                    totalSpending += Number(itinerary.budget) || 0;
                }
            });
            totalDestinations = destinations.size;
        }
        
        return {
            success: true,
            stats: {
                totalTrips,
                totalDestinations,
                totalSpending,
                memberSince
            }
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return {
            success: false,
            error: error.message,
            stats: {
                totalTrips: 0,
                totalDestinations: 0,
                totalSpending: 0,
                memberSince: null
            }
        };
    }
};

/**
 * Change password (requires re-authentication)
 */
export const changePassword = async (user, currentPassword, newPassword) => {
    try {
        const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
        
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update password
        await updatePassword(user, newPassword);
        
        return {
            success: true,
            message: 'Password changed successfully'
        };
    } catch (error) {
        console.error('Error changing password:', error);
        
        let errorMessage = 'Failed to change password';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Current password is incorrect';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'New password is too weak';
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
};

/**
 * Delete user account
 */
export const deleteUserAccount = async (userId, user) => {
    try {
        // Delete user data from Firestore
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
        
        // Delete user itineraries
        const itinerariesRef = doc(db, 'userItineraries', userId);
        await deleteDoc(itinerariesRef);
        
        // Delete avatar if exists
        await deleteAvatar(userId);
        
        // Delete Firebase Auth account
        await user.delete();
        
        return {
            success: true,
            message: 'Account deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting account:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
