// src/ml/hybridRecommendationEngine.js
import { collaborativeFilteringModel, recommendDestinations as cfRecommend } from './collaborativeFiltering';
import { contentBasedFilteringModel, recommendByContent } from './contentBasedFiltering';
import { predictUserPreference } from './userPreferenceModel';
import { collection, getDocs, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Hybrid Recommendation Engine
 * Kết hợp Collaborative Filtering + Content-Based Filtering + Deep Learning
 */
class HybridRecommendationEngine {
    constructor() {
        this.weights = {
            collaborative: 0.4,
            contentBased: 0.4,
            deepLearning: 0.2
        };
        this.diversityWeight = 0.15;
        this.noveltyWeight = 0.1;
    }

    // Lấy tất cả destinations từ database
    async getAllDestinations() {
        try {
            const destinationsSnap = await getDocs(collection(db, 'destinations'));
            return destinationsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching destinations:', error);
            return [];
        }
    }

    // Lấy user context (sở thích hiện tại, ngữ cảnh)
    async getUserContext(userId) {
        try {
            // Lấy user preferences
            const userSnap = await getDocs(
                query(collection(db, 'users'), where('uid', '==', userId), limit(1))
            );
            
            const userPrefs = userSnap.docs.length > 0 ? userSnap.docs[0].data() : {};

            // Lấy recent activities
            const recentTripsSnap = await getDocs(
                query(
                    collection(db, 'trips'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc'),
                    limit(5)
                )
            );

            const recentTrips = recentTripsSnap.docs.map(doc => doc.data());

            // Lấy recent feedbacks
            const recentFeedbackSnap = await getDocs(
                query(
                    collection(db, 'feedbacks'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                )
            );

            const recentFeedbacks = recentFeedbackSnap.docs.map(doc => doc.data());

            return {
                preferences: userPrefs,
                recentTrips,
                recentFeedbacks,
                currentMonth: new Date().getMonth() + 1,
                currentSeason: this.getCurrentSeason()
            };

        } catch (error) {
            console.error('Error getting user context:', error);
            return {
                preferences: {},
                recentTrips: [],
                recentFeedbacks: [],
                currentMonth: new Date().getMonth() + 1,
                currentSeason: this.getCurrentSeason()
            };
        }
    }

    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    }

    // Tính diversity score
    calculateDiversity(recommendations) {
        if (recommendations.length <= 1) return 0;

        let diversityScore = 0;
        const features = ['Province', 'type', 'priceLevel', 'rating'];

        for (let i = 0; i < recommendations.length; i++) {
            for (let j = i + 1; j < recommendations.length; j++) {
                let similarity = 0;
                features.forEach(feature => {
                    const val1 = recommendations[i].destination[feature];
                    const val2 = recommendations[j].destination[feature];
                    if (val1 === val2) similarity += 0.25;
                });
                diversityScore += (1 - similarity);
            }
        }

        return diversityScore / (recommendations.length * (recommendations.length - 1) / 2);
    }

    // Tính novelty score (độ mới lạ)
    calculateNovelty(destination, userContext) {
        const visitedProvinces = new Set();
        const visitedTypes = new Set();

        userContext.recentTrips.forEach(trip => {
            if (trip.destinations) {
                trip.destinations.forEach(dest => {
                    visitedProvinces.add(dest.Province);
                    visitedTypes.add(dest.type);
                });
            }
        });

        let noveltyScore = 0;
        
        // Province novelty
        if (!visitedProvinces.has(destination.Province)) {
            noveltyScore += 0.5;
        }

        // Type novelty
        if (!visitedTypes.has(destination.type)) {
            noveltyScore += 0.3;
        }

        // Rating novelty (khuyến khích thử places có rating khác)
        const avgRating = userContext.recentFeedbacks.reduce((sum, f) => sum + (f.rating || 4), 0) / 
                         Math.max(userContext.recentFeedbacks.length, 1);
        const ratingDiff = Math.abs((destination.rating || 4) - avgRating);
        if (ratingDiff > 0.5) noveltyScore += 0.2;

        return Math.min(1, noveltyScore);
    }

    // Main recommendation function
    async generateRecommendations(userId, preferences = {}, options = {}) {
        const {
            topK = 10,
            includeExplanations = true,
            diversityBoost = true,
            noveltyBoost = true,
            excludeVisited = true
        } = options;

        try {
            console.log(`Generating hybrid recommendations for user: ${userId}`);

            // 1. Lấy user context
            const userContext = await this.getUserContext(userId);
            
            // 2. Lấy tất cả destinations
            const allDestinations = await this.getAllDestinations();
            
            if (allDestinations.length === 0) {
                console.warn('No destinations found');
                return [];
            }

            // 3. Filter destinations nếu cần
            let candidateDestinations = allDestinations;
            
            if (excludeVisited) {
                const visitedIds = new Set();
                userContext.recentTrips.forEach(trip => {
                    if (trip.destinations) {
                        trip.destinations.forEach(dest => {
                            visitedIds.add(dest.id || dest.MainDestination);
                        });
                    }
                });
                candidateDestinations = allDestinations.filter(dest => 
                    !visitedIds.has(dest.id) && !visitedIds.has(dest.MainDestination)
                );
            }

            // 4. Collaborative Filtering recommendations
            let cfRecommendations = [];
            try {
                cfRecommendations = await cfRecommend(userId, Math.min(topK * 2, 20));
            } catch (error) {
                console.warn('CF recommendations failed:', error);
            }

            // 5. Content-Based recommendations
            let cbRecommendations = [];
            try {
                cbRecommendations = await recommendByContent(userId, candidateDestinations, Math.min(topK * 2, 20));
            } catch (error) {
                console.warn('CB recommendations failed:', error);
            }

            // 6. Deep Learning predictions
            let dlPredictions = [];
            try {
                const currentPrefs = {
                    month: userContext.currentMonth,
                    budget: preferences.budget || 'medium',
                    type: preferences.type || 'Nghỉ dưỡng',
                    adventure: preferences.adventureLevel || 'medium',
                    eco: preferences.ecoFriendly || false,
                    avgPastRating: userContext.recentFeedbacks.reduce((sum, f) => sum + (f.rating || 4), 0) / 
                                  Math.max(userContext.recentFeedbacks.length, 1),
                    padding: 0
                };

                const dlInput = [
                    currentPrefs.month,
                    ['low', 'medium', 'high'].indexOf(currentPrefs.budget),
                    ['Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực'].indexOf(currentPrefs.type),
                    ['low', 'medium', 'high'].indexOf(currentPrefs.adventure),
                    currentPrefs.eco ? 1 : 0,
                    currentPrefs.avgPastRating / 5,
                    currentPrefs.padding
                ];

                const dlResult = await predictUserPreference(dlInput);
                if (dlResult) {
                    dlPredictions = candidateDestinations.map(dest => ({
                        destination: dest,
                        score: dlResult[0] * 0.4 + dlResult[1] * 0.3 + dlResult[2] * 0.3,
                        source: 'deep_learning'
                    })).sort((a, b) => b.score - a.score).slice(0, topK * 2);
                }
            } catch (error) {
                console.warn('DL predictions failed:', error);
            }

            // 7. Combine recommendations
            const combinedScores = new Map();
            const explanations = new Map();

            // Add CF scores
            cfRecommendations.forEach(rec => {
                const destId = rec.itemId;
                const dest = candidateDestinations.find(d => d.id === destId || d.MainDestination === destId);
                if (dest) {
                    combinedScores.set(dest.id || dest.MainDestination, 
                        (combinedScores.get(dest.id || dest.MainDestination) || 0) + 
                        rec.predictedRating * this.weights.collaborative
                    );
                    explanations.set(dest.id || dest.MainDestination, 
                        (explanations.get(dest.id || dest.MainDestination) || []).concat(['Người dùng tương tự cũng thích'])
                    );
                }
            });

            // Add CB scores
            cbRecommendations.forEach(rec => {
                const destId = rec.destination.id || rec.destination.MainDestination;
                combinedScores.set(destId, 
                    (combinedScores.get(destId) || 0) + 
                    rec.similarity * this.weights.contentBased
                );
                explanations.set(destId, 
                    (explanations.get(destId) || []).concat([rec.explanation || 'Phù hợp với sở thích của bạn'])
                );
            });

            // Add DL scores
            dlPredictions.forEach(rec => {
                const destId = rec.destination.id || rec.destination.MainDestination;
                combinedScores.set(destId, 
                    (combinedScores.get(destId) || 0) + 
                    rec.score * this.weights.deepLearning
                );
                explanations.set(destId, 
                    (explanations.get(destId) || []).concat(['AI dự đoán bạn sẽ thích'])
                );
            });

            // 8. Create final recommendations
            let finalRecommendations = [];
            
            for (const [destId, score] of combinedScores.entries()) {
                const destination = candidateDestinations.find(d => 
                    (d.id || d.MainDestination) === destId
                );
                
                if (destination) {
                    let finalScore = score;
                    
                    // Add diversity bonus
                    if (diversityBoost) {
                        const diversityScore = this.calculateDiversity([...finalRecommendations, { destination }]);
                        finalScore += diversityScore * this.diversityWeight;
                    }
                    
                    // Add novelty bonus
                    if (noveltyBoost) {
                        const noveltyScore = this.calculateNovelty(destination, userContext);
                        finalScore += noveltyScore * this.noveltyWeight;
                    }

                    finalRecommendations.push({
                        destination,
                        score: finalScore,
                        explanation: includeExplanations ? explanations.get(destId)?.join(', ') : undefined,
                        confidence: Math.min(1, score / this.weights.collaborative), // Normalize confidence
                        sources: {
                            collaborative: cfRecommendations.some(r => r.itemId === destId),
                            contentBased: cbRecommendations.some(r => (r.destination.id || r.destination.MainDestination) === destId),
                            deepLearning: dlPredictions.some(r => (r.destination.id || r.destination.MainDestination) === destId)
                        }
                    });
                }
            }

            // 9. Sort and return top K
            finalRecommendations.sort((a, b) => b.score - a.score);
            
            // Ensure diversity in final results
            if (diversityBoost && finalRecommendations.length > topK) {
                finalRecommendations = this.ensureDiversity(finalRecommendations, topK);
            }

            const result = finalRecommendations.slice(0, topK);

            // 10. Log recommendation for analytics
            await this.logRecommendation(userId, result, preferences);

            console.log(`Generated ${result.length} hybrid recommendations`);
            return result;

        } catch (error) {
            console.error('Error generating hybrid recommendations:', error);
            throw error;
        }
    }

    // Ensure diversity in final recommendations
    ensureDiversity(recommendations, topK) {
        const selected = [];
        const remaining = [...recommendations];
        
        // Always include top recommendation
        if (remaining.length > 0) {
            selected.push(remaining.shift());
        }

        while (selected.length < topK && remaining.length > 0) {
            let bestIndex = 0;
            let bestDiversityScore = -1;

            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                let diversityScore = 0;

                // Calculate diversity with already selected
                selected.forEach(selected_rec => {
                    if (candidate.destination.Province !== selected_rec.destination.Province) {
                        diversityScore += 0.3;
                    }
                    if (candidate.destination.type !== selected_rec.destination.type) {
                        diversityScore += 0.2;
                    }
                    if (Math.abs((candidate.destination.rating || 4) - (selected_rec.destination.rating || 4)) > 0.5) {
                        diversityScore += 0.1;
                    }
                });

                // Combine with original score
                const combinedScore = candidate.score * 0.7 + diversityScore * 0.3;

                if (combinedScore > bestDiversityScore) {
                    bestDiversityScore = combinedScore;
                    bestIndex = i;
                }
            }

            selected.push(remaining.splice(bestIndex, 1)[0]);
        }

        return selected;
    }

    // Log recommendation for analytics and model improvement
    async logRecommendation(userId, recommendations, preferences) {
        try {
            await addDoc(collection(db, 'recommendation_logs'), {
                userId,
                recommendations: recommendations.map(r => ({
                    destinationId: r.destination.id || r.destination.MainDestination,
                    score: r.score,
                    confidence: r.confidence,
                    sources: r.sources
                })),
                preferences,
                timestamp: new Date(),
                sessionId: `${userId}_${Date.now()}`
            });
        } catch (error) {
            console.warn('Failed to log recommendation:', error);
        }
    }

    // Update model weights based on user feedback
    updateWeights(feedback) {
        const { collaborative_accuracy, content_accuracy, dl_accuracy } = feedback;
        
        const total = collaborative_accuracy + content_accuracy + dl_accuracy;
        if (total > 0) {
            this.weights.collaborative = collaborative_accuracy / total;
            this.weights.contentBased = content_accuracy / total;
            this.weights.deepLearning = dl_accuracy / total;
        }
    }

    // Get recommendation explanation
    explainRecommendation(recommendation) {
        const sources = [];
        if (recommendation.sources.collaborative) sources.push('người dùng tương tự');
        if (recommendation.sources.contentBased) sources.push('sở thích cá nhân');
        if (recommendation.sources.deepLearning) sources.push('AI phân tích');

        return `Gợi ý dựa trên ${sources.join(', ')}. ${recommendation.explanation || ''}`;
    }
}

// Singleton instance
export const hybridRecommendationEngine = new HybridRecommendationEngine();

// Export main function
export const generatePersonalizedRecommendations = (userId, preferences = {}, options = {}) => 
    hybridRecommendationEngine.generateRecommendations(userId, preferences, options);

export const explainRecommendation = (recommendation) => 
    hybridRecommendationEngine.explainRecommendation(recommendation);

export const updateRecommendationWeights = (feedback) => 
    hybridRecommendationEngine.updateWeights(feedback);