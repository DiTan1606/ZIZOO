// src/services/aiTrainingService.js
import { collection, getDocs, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { trainCollaborativeFiltering } from '../ml/collaborativeFiltering';
import { retrainAllModels } from '../ml/trainer';

/**
 * Service để training và quản lý các AI models
 */
class AITrainingService {
    constructor() {
        this.isTraining = false;
        this.lastTrainingTime = null;
        this.trainingSchedule = null;
    }

    // Kiểm tra xem có cần retrain không
    async shouldRetrain() {
        try {
            // Kiểm tra thời gian training cuối
            if (this.lastTrainingTime) {
                const hoursSinceLastTraining = (Date.now() - this.lastTrainingTime) / (1000 * 60 * 60);
                if (hoursSinceLastTraining < 24) {
                    return false; // Chưa đủ 24h
                }
            }

            // Kiểm tra số lượng feedback mới
            const recentFeedbackSnap = await getDocs(
                query(
                    collection(db, 'feedbacks'),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                )
            );

            const recentFeedbacks = recentFeedbackSnap.docs.map(doc => doc.data());
            
            // Nếu có ít nhất 10 feedback mới trong 24h qua
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const newFeedbacks = recentFeedbacks.filter(f => 
                f.timestamp && f.timestamp.toDate() > oneDayAgo
            );

            return newFeedbacks.length >= 10;

        } catch (error) {
            console.error('Error checking retrain condition:', error);
            return false;
        }
    }

    // Training tất cả models
    async trainAllModels() {
        if (this.isTraining) {
            console.log('Training already in progress...');
            return;
        }

        this.isTraining = true;
        console.log('🤖 Starting AI models training...');

        try {
            // 1. Train Collaborative Filtering
            console.log('Training Collaborative Filtering...');
            await trainCollaborativeFiltering();

            // 2. Train User Preference Model và Risk Model
            console.log('Training User Preference and Risk Models...');
            await retrainAllModels();

            // 3. Log training completion
            await this.logTrainingSession();

            this.lastTrainingTime = Date.now();
            console.log('✅ All AI models trained successfully!');

            return {
                success: true,
                timestamp: new Date(),
                models: ['collaborative_filtering', 'user_preference', 'risk_model']
            };

        } catch (error) {
            console.error('❌ Error training models:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
        } finally {
            this.isTraining = false;
        }
    }

    // Log training session
    async logTrainingSession() {
        try {
            await addDoc(collection(db, 'training_logs'), {
                timestamp: new Date(),
                models: ['collaborative_filtering', 'user_preference', 'risk_model'],
                status: 'completed',
                dataStats: await this.getTrainingDataStats()
            });
        } catch (error) {
            console.warn('Failed to log training session:', error);
        }
    }

    // Lấy thống kê dữ liệu training
    async getTrainingDataStats() {
        try {
            const [feedbackSnap, tripsSnap, usersSnap] = await Promise.all([
                getDocs(collection(db, 'feedbacks')),
                getDocs(collection(db, 'trips')),
                getDocs(collection(db, 'users'))
            ]);

            return {
                totalFeedbacks: feedbackSnap.size,
                totalTrips: tripsSnap.size,
                totalUsers: usersSnap.size,
                dataQuality: this.assessDataQuality(feedbackSnap.docs, tripsSnap.docs)
            };
        } catch (error) {
            console.error('Error getting training data stats:', error);
            return {};
        }
    }

    // Đánh giá chất lượng dữ liệu
    assessDataQuality(feedbacks, trips) {
        let qualityScore = 0;
        let factors = 0;

        // Feedback quality
        if (feedbacks.length > 0) {
            const validFeedbacks = feedbacks.filter(doc => {
                const data = doc.data();
                return data.rating && data.userId && data.destinationId;
            });
            qualityScore += (validFeedbacks.length / feedbacks.length) * 0.4;
            factors += 0.4;
        }

        // Trip data quality
        if (trips.length > 0) {
            const validTrips = trips.filter(doc => {
                const data = doc.data();
                return data.userId && data.destinations && data.destinations.length > 0;
            });
            qualityScore += (validTrips.length / trips.length) * 0.3;
            factors += 0.3;
        }

        // User diversity
        const uniqueUsers = new Set([
            ...feedbacks.map(doc => doc.data().userId),
            ...trips.map(doc => doc.data().userId)
        ]);
        
        if (uniqueUsers.size >= 10) {
            qualityScore += 0.3;
        } else if (uniqueUsers.size >= 5) {
            qualityScore += 0.15;
        }
        factors += 0.3;

        return factors > 0 ? qualityScore / factors : 0;
    }

    // Tự động training theo lịch
    startAutoTraining() {
        if (this.trainingSchedule) {
            clearInterval(this.trainingSchedule);
        }

        // Check mỗi 6 tiếng
        this.trainingSchedule = setInterval(async () => {
            const shouldTrain = await this.shouldRetrain();
            if (shouldTrain) {
                console.log('🔄 Auto-training triggered');
                await this.trainAllModels();
            }
        }, 6 * 60 * 60 * 1000); // 6 hours

        console.log('🕐 Auto-training scheduler started (checks every 6 hours)');
    }

    // Dừng auto training
    stopAutoTraining() {
        if (this.trainingSchedule) {
            clearInterval(this.trainingSchedule);
            this.trainingSchedule = null;
            console.log('⏹️ Auto-training scheduler stopped');
        }
    }

    // Tạo synthetic data để test (development only)
    async generateSyntheticData(numUsers = 20, numFeedbacks = 100) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('Synthetic data generation is disabled in production');
            return;
        }

        console.log('🧪 Generating synthetic training data...');

        const provinces = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Quảng Ninh', 'Lào Cai'];
        const destinations = [
            'Hồ Gươm', 'Chùa Một Cột', 'Bến Thành Market', 'Cầu Rồng', 
            'Vịnh Hạ Long', 'Sa Pa', 'Hội An', 'Huế Imperial City'
        ];
        const types = ['Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực'];

        try {
            // Generate synthetic feedbacks
            for (let i = 0; i < numFeedbacks; i++) {
                const userId = `synthetic_user_${Math.floor(Math.random() * numUsers)}`;
                const destinationId = destinations[Math.floor(Math.random() * destinations.length)];
                const rating = Math.floor(Math.random() * 5) + 1;
                
                await addDoc(collection(db, 'feedbacks'), {
                    userId,
                    destinationId,
                    rating,
                    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
                    userPref: {
                        month: Math.floor(Math.random() * 12) + 1,
                        budget: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                        type: types[Math.floor(Math.random() * types.length)],
                        adventure: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                        eco: Math.random() > 0.5
                    },
                    synthetic: true
                });
            }

            // Generate synthetic trips
            for (let i = 0; i < numUsers; i++) {
                const userId = `synthetic_user_${i}`;
                const numTrips = Math.floor(Math.random() * 5) + 1;

                for (let j = 0; j < numTrips; j++) {
                    const numDestinations = Math.floor(Math.random() * 3) + 1;
                    const tripDestinations = [];

                    for (let k = 0; k < numDestinations; k++) {
                        tripDestinations.push({
                            MainDestination: destinations[Math.floor(Math.random() * destinations.length)],
                            Province: provinces[Math.floor(Math.random() * provinces.length)],
                            rating: Math.random() * 2 + 3, // 3-5 rating
                            id: `dest_${Math.random().toString(36).substr(2, 9)}`
                        });
                    }

                    await addDoc(collection(db, 'trips'), {
                        userId,
                        destinations: tripDestinations,
                        createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000), // Last 60 days
                        synthetic: true
                    });
                }
            }

            console.log(`✅ Generated ${numFeedbacks} synthetic feedbacks and trips for ${numUsers} users`);

        } catch (error) {
            console.error('Error generating synthetic data:', error);
        }
    }

    // Xóa synthetic data
    async cleanSyntheticData() {
        try {
            const [feedbackSnap, tripsSnap] = await Promise.all([
                getDocs(query(collection(db, 'feedbacks'), where('synthetic', '==', true))),
                getDocs(query(collection(db, 'trips'), where('synthetic', '==', true)))
            ]);

            const deletePromises = [
                ...feedbackSnap.docs.map(doc => doc.ref.delete()),
                ...tripsSnap.docs.map(doc => doc.ref.delete())
            ];

            await Promise.all(deletePromises);
            console.log(`🧹 Cleaned ${deletePromises.length} synthetic records`);

        } catch (error) {
            console.error('Error cleaning synthetic data:', error);
        }
    }

    // Lấy training metrics
    async getTrainingMetrics() {
        try {
            const logsSnap = await getDocs(
                query(
                    collection(db, 'training_logs'),
                    orderBy('timestamp', 'desc'),
                    limit(10)
                )
            );

            return logsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting training metrics:', error);
            return [];
        }
    }
}

// Singleton instance
export const aiTrainingService = new AITrainingService();

// Export functions
export const trainAllAIModels = () => aiTrainingService.trainAllModels();
export const startAutoTraining = () => aiTrainingService.startAutoTraining();
export const stopAutoTraining = () => aiTrainingService.stopAutoTraining();
export const generateSyntheticData = (numUsers, numFeedbacks) => aiTrainingService.generateSyntheticData(numUsers, numFeedbacks);
export const cleanSyntheticData = () => aiTrainingService.cleanSyntheticData();
export const getTrainingMetrics = () => aiTrainingService.getTrainingMetrics();
export const shouldRetrain = () => aiTrainingService.shouldRetrain();