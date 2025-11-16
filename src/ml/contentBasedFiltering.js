// src/ml/contentBasedFiltering.js
import * as tf from '@tensorflow/tfjs';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Content-Based Filtering Model
 * Gợi ý destinations dựa trên đặc điểm của destinations và sở thích user
 */
class ContentBasedFilteringModel {
    constructor() {
        this.model = null;
        this.destinationFeatures = new Map();
        this.userProfiles = new Map();
        this.featureScaler = null;
    }

    // Trích xuất features từ destination
    extractDestinationFeatures(destination) {
        const features = {
            // Location features
            latitude: destination.lat || 0,
            longitude: destination.lng || 0,
            
            // Rating features
            rating: destination.rating || 4.0,
            priceLevel: destination.priceLevel || 2,
            
            // Type features (one-hot encoding)
            isBeach: this.hasKeyword(destination, ['beach', 'biển', 'bãi tắm']),
            isMountain: this.hasKeyword(destination, ['mountain', 'núi', 'đồi']),
            isHistorical: this.hasKeyword(destination, ['historical', 'lịch sử', 'cổ', 'đền', 'chùa']),
            isNature: this.hasKeyword(destination, ['park', 'nature', 'tự nhiên', 'rừng']),
            isUrban: this.hasKeyword(destination, ['city', 'thành phố', 'urban']),
            isCultural: this.hasKeyword(destination, ['museum', 'cultural', 'văn hóa', 'bảo tàng']),
            isAdventure: this.hasKeyword(destination, ['adventure', 'mạo hiểm', 'thể thao']),
            isFood: this.hasKeyword(destination, ['restaurant', 'food', 'ẩm thực', 'quán']),
            
            // Seasonal features
            bestInSummer: this.hasKeyword(destination, ['summer', 'hè', 'beach']),
            bestInWinter: this.hasKeyword(destination, ['winter', 'đông', 'festival']),
            
            // Crowd level (estimated)
            crowdLevel: destination.user_ratings_total ? 
                Math.min(destination.user_ratings_total / 1000, 5) : 2,
            
            // Accessibility
            hasParking: destination.types?.includes('parking') || false,
            
            // Festival/Event features
            hasFestival: destination.festival ? 1 : 0,
            festivalCount: destination.festival || 0
        };

        return Object.values(features);
    }

    // Kiểm tra keyword trong destination
    hasKeyword(destination, keywords) {
        const text = `${destination.MainDestination || ''} ${destination.description || ''} ${(destination.types || []).join(' ')}`.toLowerCase();
        return keywords.some(keyword => text.includes(keyword.toLowerCase())) ? 1 : 0;
    }

    // Tạo user profile từ lịch sử
    async createUserProfile(userId) {
        try {
            // Lấy feedback history
            const feedbackSnap = await getDocs(collection(db, 'feedbacks'));
            const userFeedbacks = feedbackSnap.docs
                .map(doc => doc.data())
                .filter(feedback => feedback.userId === userId);

            // Lấy trip history
            const tripsSnap = await getDocs(collection(db, 'trips'));
            const userTrips = tripsSnap.docs
                .map(doc => doc.data())
                .filter(trip => trip.userId === userId);

            // Tính weighted preferences
            const profile = {
                preferredRating: 4.0,
                preferredPriceLevel: 2,
                beachPreference: 0,
                mountainPreference: 0,
                historicalPreference: 0,
                naturePreference: 0,
                urbanPreference: 0,
                culturalPreference: 0,
                adventurePreference: 0,
                foodPreference: 0,
                summerPreference: 0,
                winterPreference: 0,
                crowdTolerance: 3,
                budgetSensitivity: 0.5,
                ecoFriendliness: 0
            };

            let totalWeight = 0;

            // Từ feedbacks (explicit preferences)
            userFeedbacks.forEach(feedback => {
                const weight = feedback.rating / 5.0;
                totalWeight += weight;

                if (feedback.destinationFeatures) {
                    Object.keys(profile).forEach(key => {
                        if (feedback.destinationFeatures[key] !== undefined) {
                            profile[key] += feedback.destinationFeatures[key] * weight;
                        }
                    });
                }
            });

            // Từ trips (implicit preferences)
            userTrips.forEach(trip => {
                const weight = 0.6; // Lower weight for implicit feedback
                totalWeight += weight;

                if (trip.destinations) {
                    trip.destinations.forEach(dest => {
                        const features = this.extractDestinationFeatures(dest);
                        // Map features to profile (simplified)
                        profile.preferredRating += (dest.rating || 4.0) * weight;
                        profile.preferredPriceLevel += (dest.priceLevel || 2) * weight;
                    });
                }
            });

            // Normalize
            if (totalWeight > 0) {
                Object.keys(profile).forEach(key => {
                    profile[key] /= totalWeight;
                });
            }

            this.userProfiles.set(userId, profile);
            return profile;

        } catch (error) {
            console.error('Error creating user profile:', error);
            return null;
        }
    }

    // Tính similarity giữa user profile và destination
    calculateSimilarity(userProfile, destinationFeatures) {
        if (!userProfile || !destinationFeatures) return 0;

        // Weighted cosine similarity
        const weights = {
            rating: 0.2,
            priceLevel: 0.15,
            typeMatch: 0.4,
            seasonal: 0.1,
            crowd: 0.1,
            other: 0.05
        };

        let similarity = 0;

        // Rating similarity
        const ratingDiff = Math.abs(userProfile.preferredRating - destinationFeatures[2]);
        similarity += weights.rating * (1 - ratingDiff / 5);

        // Price level similarity
        const priceDiff = Math.abs(userProfile.preferredPriceLevel - destinationFeatures[3]);
        similarity += weights.priceLevel * (1 - priceDiff / 4);

        // Type preferences (features 4-11)
        const typePrefs = [
            userProfile.beachPreference,
            userProfile.mountainPreference,
            userProfile.historicalPreference,
            userProfile.naturePreference,
            userProfile.urbanPreference,
            userProfile.culturalPreference,
            userProfile.adventurePreference,
            userProfile.foodPreference
        ];

        const typeFeatures = destinationFeatures.slice(4, 12);
        let typeMatch = 0;
        for (let i = 0; i < typePrefs.length; i++) {
            typeMatch += typePrefs[i] * typeFeatures[i];
        }
        similarity += weights.typeMatch * typeMatch / typePrefs.length;

        // Seasonal preferences
        const currentMonth = new Date().getMonth() + 1;
        const isSummer = currentMonth >= 5 && currentMonth <= 9;
        const seasonalMatch = isSummer ? 
            userProfile.summerPreference * destinationFeatures[12] :
            userProfile.winterPreference * destinationFeatures[13];
        similarity += weights.seasonal * seasonalMatch;

        // Crowd tolerance
        const crowdMatch = 1 - Math.abs(userProfile.crowdTolerance - destinationFeatures[14]) / 5;
        similarity += weights.crowd * crowdMatch;

        return Math.max(0, Math.min(1, similarity));
    }

    // Gợi ý destinations cho user
    async recommendForUser(userId, destinations, topK = 10) {
        try {
            // Tạo hoặc lấy user profile
            let userProfile = this.userProfiles.get(userId);
            if (!userProfile) {
                userProfile = await this.createUserProfile(userId);
            }

            if (!userProfile) {
                console.warn('Could not create user profile');
                return [];
            }

            const recommendations = [];

            // Tính similarity cho mỗi destination
            destinations.forEach(destination => {
                const features = this.extractDestinationFeatures(destination);
                const similarity = this.calculateSimilarity(userProfile, features);

                recommendations.push({
                    destination,
                    similarity,
                    features,
                    source: 'content_based_filtering'
                });
            });

            // Sort và return top K
            return recommendations
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);

        } catch (error) {
            console.error('Error in content-based recommendation:', error);
            return [];
        }
    }

    // Update user profile với feedback mới
    async updateUserProfile(userId, destination, rating, feedback = {}) {
        try {
            let userProfile = this.userProfiles.get(userId);
            if (!userProfile) {
                userProfile = await this.createUserProfile(userId);
            }

            if (!userProfile) return;

            // Learning rate
            const alpha = 0.1;
            const normalizedRating = rating / 5.0;

            // Update preferences based on rating
            const destFeatures = this.extractDestinationFeatures(destination);
            
            // Positive feedback - increase preferences
            if (normalizedRating > 0.6) {
                userProfile.preferredRating += alpha * (destination.rating - userProfile.preferredRating);
                userProfile.preferredPriceLevel += alpha * ((destination.priceLevel || 2) - userProfile.preferredPriceLevel);
                
                // Update type preferences
                if (destFeatures[4]) userProfile.beachPreference += alpha * (1 - userProfile.beachPreference);
                if (destFeatures[5]) userProfile.mountainPreference += alpha * (1 - userProfile.mountainPreference);
                // ... similar for other types
            }
            
            // Negative feedback - decrease preferences
            else if (normalizedRating < 0.4) {
                if (destFeatures[4]) userProfile.beachPreference -= alpha * userProfile.beachPreference;
                if (destFeatures[5]) userProfile.mountainPreference -= alpha * userProfile.mountainPreference;
                // ... similar for other types
            }

            // Clamp values
            Object.keys(userProfile).forEach(key => {
                userProfile[key] = Math.max(0, Math.min(1, userProfile[key]));
            });

            this.userProfiles.set(userId, userProfile);

        } catch (error) {
            console.error('Error updating user profile:', error);
        }
    }

    // Explain recommendation
    explainRecommendation(userId, destination) {
        const userProfile = this.userProfiles.get(userId);
        if (!userProfile) return "Gợi ý dựa trên phân tích chung";

        const features = this.extractDestinationFeatures(destination);
        const explanations = [];

        // Check strong matches
        if (features[4] && userProfile.beachPreference > 0.7) {
            explanations.push("Bạn thích các điểm đến gần biển");
        }
        if (features[5] && userProfile.mountainPreference > 0.7) {
            explanations.push("Phù hợp với sở thích núi non của bạn");
        }
        if (features[6] && userProfile.historicalPreference > 0.7) {
            explanations.push("Khớp với sở thích lịch sử văn hóa");
        }
        if (features[2] >= userProfile.preferredRating) {
            explanations.push("Đánh giá cao phù hợp với tiêu chuẩn của bạn");
        }

        return explanations.length > 0 ? 
            explanations.join(", ") : 
            "Gợi ý dựa trên phân tích sở thích tổng hợp";
    }
}

// Singleton instance
export const contentBasedFilteringModel = new ContentBasedFilteringModel();

// Export functions
export const recommendByContent = (userId, destinations, topK = 10) => 
    contentBasedFilteringModel.recommendForUser(userId, destinations, topK);

export const updateUserPreferences = (userId, destination, rating, feedback) => 
    contentBasedFilteringModel.updateUserProfile(userId, destination, rating, feedback);

export const explainRecommendation = (userId, destination) => 
    contentBasedFilteringModel.explainRecommendation(userId, destination);

export const createUserProfile = (userId) => 
    contentBasedFilteringModel.createUserProfile(userId);