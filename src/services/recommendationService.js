// src/services/recommendationService.js
import { getStormRisks, getFloodRisks, getFestivals } from './firestoreService';
import { predictRiskWithAI } from '../ml/riskModel';
import { searchNearbyPlaces } from './placesService';
import { generatePersonalizedRecommendations, explainRecommendation } from '../ml/hybridRecommendationEngine';
import { trainCollaborativeFiltering } from '../ml/collaborativeFiltering';
import { updateUserPreferences } from '../ml/contentBasedFiltering';
import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import provinceCoords from '../assets/provinceCoord.json';

const typeToPlaces = {
    'Nghỉ dưỡng': ['tourist_attraction', 'beach', 'spa'],
    'Mạo hiểm': ['park', 'hiking_area'],
    'Văn hóa': ['museum', 'historical_landmark'],
    'Ẩm thực': ['restaurant'],
    'Gia đình': ['amusement_park', 'zoo'],
    'Một mình': ['cafe', 'library']
};

// === NEW: AI-POWERED PERSONALIZED RECOMMENDATIONS ===
export const generatePersonalizedItinerary = async (prefs, userId) => {
    const { 
        month, 
        provinces = [], 
        types = [], 
        budget = 5000000, 
        adventureLevel = 3, 
        ecoFriendly = false,
        maxDestinations = 10
    } = prefs;

    try {
        console.log(`Generating personalized itinerary for user: ${userId}`);

        // 1. Generate AI recommendations
        const aiRecommendations = await generatePersonalizedRecommendations(userId, {
            month,
            budget: budget > 10000000 ? 'high' : budget > 5000000 ? 'medium' : 'low',
            type: types[0] || 'Nghỉ dưỡng',
            adventureLevel: adventureLevel > 3 ? 'high' : adventureLevel > 1 ? 'medium' : 'low',
            ecoFriendly,
            provinces
        }, {
            topK: maxDestinations,
            includeExplanations: true,
            diversityBoost: true,
            noveltyBoost: true
        });

        // 2. Filter by provinces if specified
        let filteredRecommendations = aiRecommendations;
        if (provinces.length > 0) {
            filteredRecommendations = aiRecommendations.filter(rec => 
                provinces.includes(rec.destination.Province)
            );
        }

        // 3. Check risk for recommended destinations
        const validMonth = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
        let alerts = [];
        const safeRecommendations = [];

        for (const rec of filteredRecommendations) {
            const province = rec.destination.Province;
            try {
                const storms = await getStormRisks(province, validMonth);
                const floods = await getFloodRisks(province, validMonth);
                const riskScore = await predictRiskWithAI([validMonth, province, storms.length, floods.length, 0, 0]);
                
                if (riskScore > 0.7) {
                    alerts.push(`${province}: Rủi ro cao (bão/lũ) - ${rec.destination.MainDestination}`);
                } else {
                    safeRecommendations.push({
                        ...rec.destination,
                        aiScore: rec.score,
                        aiExplanation: rec.explanation,
                        confidence: rec.confidence,
                        estimatedCost: budget / Math.max(filteredRecommendations.length, 1)
                    });
                }
            } catch (err) {
                console.warn(`Risk check failed for ${province}:`, err);
                safeRecommendations.push({
                    ...rec.destination,
                    aiScore: rec.score,
                    aiExplanation: rec.explanation,
                    confidence: rec.confidence,
                    estimatedCost: budget / Math.max(filteredRecommendations.length, 1)
                });
            }
        }

        // 4. Enhance with Google Places data if needed
        const enhancedDestinations = await enhanceWithGooglePlaces(safeRecommendations, types, ecoFriendly, adventureLevel);

        // 5. Add festival information
        try {
            const festivals = await getFestivals(validMonth);
            enhancedDestinations.forEach(dest => {
                const festival = festivals.find(f => f.Province === dest.Province);
                if (festival) {
                    dest.festival = festival.FestivalCount;
                    dest.festivalName = festival.FestivalName;
                }
            });
        } catch (err) {
            console.warn('Error fetching festivals:', err);
        }

        return {
            destinations: enhancedDestinations.length > 0 ? enhancedDestinations : await fallbackRecommendations(prefs, userId),
            alerts: alerts.length > 0 ? alerts.join(' | ') : null,
            isPersonalized: true,
            totalRecommendations: aiRecommendations.length,
            safeRecommendations: safeRecommendations.length
        };

    } catch (error) {
        console.error('Error generating personalized itinerary:', error);
        // Fallback to traditional method
        return await generateItinerary(prefs, userId);
    }
};

// Enhance destinations with Google Places data
async function enhanceWithGooglePlaces(destinations, types, ecoFriendly, adventureLevel) {
    const enhanced = [];

    for (const dest of destinations) {
        try {
            // Skip if already has detailed Google Places data
            if (dest.place_id || dest.types) {
                enhanced.push(dest);
                continue;
            }

            const coord = provinceCoords[dest.Province];
            if (!coord) {
                enhanced.push(dest);
                continue;
            }

            const placesTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
            if (ecoFriendly) placesTypes.push('park');
            if (adventureLevel > 3) placesTypes.push('hiking_area');

            const results = await searchNearbyPlaces({
                location: { lat: coord.lat, lng: coord.lng },
                radius: 30000,
                type: placesTypes[0] || 'tourist_attraction',
                keyword: dest.MainDestination
            });

            // Find best match
            const match = results.find(p => 
                p.name.toLowerCase().includes(dest.MainDestination.toLowerCase()) ||
                dest.MainDestination.toLowerCase().includes(p.name.toLowerCase())
            ) || results[0];

            if (match) {
                enhanced.push({
                    ...dest,
                    lat: match.geometry.location.lat,
                    lng: match.geometry.location.lng,
                    rating: match.rating || dest.rating,
                    priceLevel: match.price_level || dest.priceLevel,
                    place_id: match.place_id,
                    types: match.types,
                    photos: match.photos,
                    vicinity: match.vicinity
                });
            } else {
                enhanced.push(dest);
            }

        } catch (err) {
            console.warn(`Enhancement failed for ${dest.MainDestination}:`, err);
            enhanced.push(dest);
        }
    }

    return enhanced;
}

// Fallback recommendations when AI fails
async function fallbackRecommendations(prefs, userId) {
    try {
        const traditional = await generateItinerary(prefs, userId);
        return traditional.destinations.map(dest => ({
            ...dest,
            aiScore: 0.5,
            aiExplanation: 'Gợi ý dựa trên thuật toán truyền thống',
            confidence: 0.6,
            isPersonalized: false
        }));
    } catch (error) {
        console.error('Fallback recommendations failed:', error);
        return [{
            MainDestination: 'Không thể tạo gợi ý',
            Province: 'N/A',
            lat: 16.0471,
            lng: 108.2062,
            rating: 3.0,
            aiScore: 0,
            confidence: 0
        }];
    }
}

// === ORIGINAL METHOD (kept for compatibility) ===
export const generateItinerary = async (prefs, userId) => {
    const { month, provinces = [], types = [], budget = 5000000, adventureLevel = 3, ecoFriendly = false } = prefs;

    // === FIX: Đảm bảo month hợp lệ ===
    const validMonth = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
    if (!provinces.length) throw new Error('Vui lòng chọn ít nhất 1 tỉnh!');

    let alerts = [];
    const risky = [];

    // === KIỂM TRA RỦI RO ===
    for (const province of provinces) {
        try {
            const storms = await getStormRisks(province, validMonth);
            const floods = await getFloodRisks(province, validMonth);
            const riskScore = await predictRiskWithAI([validMonth, province, storms.length, floods.length, 0, 0]);
            if (riskScore > 0.7) {
                risky.push(province);
                alerts.push(`${province}: Rủi ro cao (bão/lũ)`);
            }
        } catch (err) {
            console.warn(`Lỗi kiểm tra rủi ro ${province}:`, err);
        }
    }

    const safeProvinces = provinces.filter(p => !risky.includes(p));
    let destinations = [];

    // === GOOGLE PLACES API ===
    for (const province of safeProvinces) {
        const coord = provinceCoords[province];
        if (!coord) {
            console.warn(`Không có tọa độ cho ${province}`);
            continue;
        }

        const placesTypes = types.flatMap(t => typeToPlaces[t] || ['tourist_attraction']);
        if (ecoFriendly) placesTypes.push('park');
        if (adventureLevel > 3) placesTypes.push('hiking_area');

        try {
            const results = await searchNearbyPlaces({
                location: { lat: coord.lat, lng: coord.lng },
                radius: 50000,
                type: placesTypes[0] || 'tourist_attraction',
                keyword: province
            });

            const topSpots = results
                .filter(p => p.rating >= 4.0)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 3)
                .map(p => ({
                    MainDestination: p.name,
                    Province: province,
                    lat: p.geometry.location.lat,
                    lng: p.geometry.location.lng,
                    rating: p.rating,
                    priceLevel: p.price_level,
                    estimatedCost: budget / safeProvinces.length
                }));

            destinations = [...destinations, ...topSpots];
        } catch (err) {
            console.warn(`Places fail ${province}:`, err);
            destinations.push({
                MainDestination: `${province} (Gợi ý)`,
                Province: province,
                lat: coord.lat,
                lng: coord.lng,
                rating: 4.0
            });
        }
    }

    // === LỄ HỘI ===
    try {
        const festivals = await getFestivals(validMonth);
        destinations = destinations.map(d => ({
            ...d,
            festival: festivals.find(f => f.Province === d.Province)?.FestivalCount || null
        }));
    } catch (err) {
        console.warn('Lỗi lấy lễ hội:', err);
    }

    return {
        destinations: destinations.length > 0 ? destinations : [{
            MainDestination: 'Không tìm thấy điểm đến phù hợp',
            lat: 16.0471,
            lng: 108.2062
        }],
        alerts: alerts.length > 0 ? alerts.join(' | ') : null,
        isPersonalized: false
    };
};

// === FEEDBACK & LEARNING FUNCTIONS ===
export const recordUserFeedback = async (userId, destinationId, rating, feedback = {}) => {
    try {
        // Update content-based model
        const destination = { id: destinationId, ...feedback.destination };
        await updateUserPreferences(userId, destination, rating, feedback);

        // Store feedback for collaborative filtering
        await addDoc(collection(db, 'feedbacks'), {
            userId,
            destinationId,
            rating,
            feedback,
            timestamp: new Date(),
            userPref: feedback.userPreferences
        });

        console.log('User feedback recorded successfully');
    } catch (error) {
        console.error('Error recording feedback:', error);
    }
};

export const retrainRecommendationModels = async () => {
    try {
        console.log('Starting recommendation models retraining...');
        
        // Retrain collaborative filtering
        await trainCollaborativeFiltering();
        
        console.log('Recommendation models retrained successfully');
    } catch (error) {
        console.error('Error retraining models:', error);
    }
};

// === UTILITY FUNCTIONS ===
export const getRecommendationExplanation = (recommendation) => {
    return explainRecommendation(recommendation);
};

export const getUserRecommendationHistory = async (userId, limit = 20) => {
    try {
        const historySnap = await getDocs(
            query(
                collection(db, 'recommendation_logs'),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(limit)
            )
        );

        return historySnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error fetching recommendation history:', error);
        return [];
    }
};