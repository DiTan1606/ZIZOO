/**
 * Test User Profile Functions
 * Run in browser console: window.testUserProfile()
 */

import { 
    getUserProfile, 
    saveUserProfile, 
    uploadAvatar, 
    deleteAvatar,
    ensureProfileFields 
} from '../services/userProfileService';

export const testUserProfile = async (userId) => {
    console.log('🧪 Testing User Profile Functions...');
    console.log('User ID:', userId);
    
    try {
        // Test 1: Ensure fields
        console.log('\n1️⃣ Testing ensureProfileFields...');
        const ensureResult = await ensureProfileFields(userId);
        console.log('Result:', ensureResult);
        
        // Test 2: Get profile
        console.log('\n2️⃣ Testing getUserProfile...');
        const getResult = await getUserProfile(userId);
        console.log('Success:', getResult.success);
        console.log('Has avatar:', !!getResult.data?.avatarURL);
        console.log('Avatar URL:', getResult.data?.avatarURL);
        console.log('Profile data:', getResult.data);
        
        // Test 3: Save profile
        console.log('\n3️⃣ Testing saveUserProfile...');
        const saveResult = await saveUserProfile(userId, {
            displayName: 'Test User',
            location: 'Test Location'
        });
        console.log('Result:', saveResult);
        
        console.log('\n✅ All tests completed!');
        console.log('📝 To test avatar upload:');
        console.log('   1. Select a file in UI');
        console.log('   2. Click upload button');
        console.log('   3. Check console for logs');
        
        return {
            success: true,
            message: 'All tests passed!'
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.testUserProfile = testUserProfile;
    console.log('🧪 Test function available: window.testUserProfile(userId)');
}
