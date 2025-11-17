// Test Firebase Storage connection
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const testStorageConnection = async () => {
    console.log('=== TESTING FIREBASE STORAGE ===');
    
    try {
        // Test 1: Check storage instance
        console.log('✓ Storage instance:', storage);
        console.log('✓ Storage bucket:', storage.app.options.storageBucket);
        
        // Test 2: Create a test file
        const testBlob = new Blob(['Hello Firebase Storage!'], { type: 'text/plain' });
        const testRef = ref(storage, 'test/test.txt');
        
        console.log('Uploading test file...');
        await uploadBytes(testRef, testBlob);
        console.log('✓ Upload successful!');
        
        // Test 3: Get download URL
        const url = await getDownloadURL(testRef);
        console.log('✓ Download URL:', url);
        
        return {
            success: true,
            message: 'Firebase Storage is working correctly!',
            url
        };
    } catch (error) {
        console.error('✗ Storage test failed:', error);
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }
};

// Run test if called directly
if (typeof window !== 'undefined') {
    window.testFirebaseStorage = testStorageConnection;
    console.log('Run window.testFirebaseStorage() to test Firebase Storage');
}
