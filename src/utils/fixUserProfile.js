// Utility to fix user profiles missing avatar fields
import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Fix user profile by adding missing avatar fields
 */
export const fixUserProfileFields = async (userId) => {
    try {
        console.log('🔧 Fixing user profile for:', userId);
        
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            console.log('⚠️ User profile does not exist');
            return {
                success: false,
                error: 'User profile not found'
            };
        }
        
        const userData = userSnap.data();
        const updates = {};
        let needsUpdate = false;
        
        // Check and add missing fields
        if (userData.avatarURL === undefined) {
            updates.avatarURL = null;
            needsUpdate = true;
            console.log('+ Adding avatarURL field');
        }
        
        if (userData.avatarPath === undefined) {
            updates.avatarPath = null;
            needsUpdate = true;
            console.log('+ Adding avatarPath field');
        }
        
        if (userData.bio === undefined) {
            updates.bio = '';
            needsUpdate = true;
            console.log('+ Adding bio field');
        }
        
        if (userData.interests === undefined) {
            updates.interests = [];
            needsUpdate = true;
            console.log('+ Adding interests field');
        }
        
        if (userData.travelStyle === undefined) {
            updates.travelStyle = 'standard';
            needsUpdate = true;
            console.log('+ Adding travelStyle field');
        }
        
        if (userData.budget === undefined) {
            updates.budget = 'medium';
            needsUpdate = true;
            console.log('+ Adding budget field');
        }
        
        if (needsUpdate) {
            updates.updatedAt = serverTimestamp();
            await updateDoc(userRef, updates);
            console.log('✅ User profile fixed successfully!');
            
            return {
                success: true,
                message: 'Profile updated with missing fields',
                fieldsAdded: Object.keys(updates).filter(k => k !== 'updatedAt')
            };
        } else {
            console.log('✓ Profile already has all required fields');
            return {
                success: true,
                message: 'Profile is already complete'
            };
        }
    } catch (error) {
        console.error('❌ Error fixing user profile:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Check if user profile has all required fields
 */
export const checkUserProfileFields = (userData) => {
    const requiredFields = [
        'avatarURL',
        'avatarPath',
        'displayName',
        'phone',
        'bio',
        'location',
        'dateOfBirth',
        'gender',
        'interests',
        'travelStyle',
        'budget'
    ];
    
    const missingFields = requiredFields.filter(field => userData[field] === undefined);
    
    return {
        isComplete: missingFields.length === 0,
        missingFields,
        hasAvatar: !!userData.avatarURL
    };
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.fixUserProfile = fixUserProfileFields;
    window.checkUserProfile = checkUserProfileFields;
    console.log('🔧 Debug utilities available:');
    console.log('  - window.fixUserProfile(userId)');
    console.log('  - window.checkUserProfile(userData)');
}
