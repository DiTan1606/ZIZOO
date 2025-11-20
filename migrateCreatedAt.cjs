// migrateCreatedAt.cjs
// Script để migrate createdAt từ Date object sang Firestore Timestamp

const admin = require('firebase-admin');
const serviceAccount = require('./zizoo-23525310-firebase-adminsdk-fbsvc-dc4cb7ea68.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateCreatedAt() {
    try {
        console.log('🔄 Starting migration of createdAt fields...');
        
        // Get all complete_itineraries
        const snapshot = await db.collection('complete_itineraries').get();
        
        console.log(`📊 Found ${snapshot.size} itineraries to check`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Check if createdAt needs migration
            if (data.createdAt && !(data.createdAt instanceof admin.firestore.Timestamp)) {
                console.log(`🔧 Migrating ${doc.id}...`);
                
                // Convert to Timestamp
                let timestamp;
                if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
                    // Already a Timestamp
                    timestamp = data.createdAt;
                } else if (data.createdAt instanceof Date) {
                    // JavaScript Date
                    timestamp = admin.firestore.Timestamp.fromDate(data.createdAt);
                } else if (typeof data.createdAt === 'string') {
                    // String date
                    timestamp = admin.firestore.Timestamp.fromDate(new Date(data.createdAt));
                } else if (typeof data.createdAt === 'number') {
                    // Unix timestamp
                    timestamp = admin.firestore.Timestamp.fromMillis(data.createdAt);
                } else {
                    console.warn(`⚠️ Unknown createdAt format for ${doc.id}:`, typeof data.createdAt);
                    timestamp = admin.firestore.Timestamp.now();
                }
                
                // Update document
                await doc.ref.update({
                    createdAt: timestamp,
                    lastUpdated: admin.firestore.Timestamp.now()
                });
                
                updatedCount++;
                console.log(`✅ Updated ${doc.id}`);
            } else {
                skippedCount++;
            }
        }
        
        console.log('\n✅ Migration complete!');
        console.log(`📊 Updated: ${updatedCount}`);
        console.log(`📊 Skipped: ${skippedCount}`);
        console.log(`📊 Total: ${snapshot.size}`);
        
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit(0);
    }
}

migrateCreatedAt();
