// src/ml/collaborativeFiltering.js
import * as tf from '@tensorflow/tfjs';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Collaborative Filtering Model
 * Dự đoán rating của user cho destination dựa trên hành vi của users tương tự
 */
class CollaborativeFilteringModel {
    constructor() {
        this.model = null;
        this.userEmbeddings = null;
        this.itemEmbeddings = null;
        this.userIndex = new Map();
        this.itemIndex = new Map();
        this.isTraining = false;
    }

    // Tạo model Neural Collaborative Filtering
    createModel(numUsers, numItems, embeddingSize = 50) {
        // User input
        const userInput = tf.input({ shape: [1], name: 'user_id' });
        const userEmbedding = tf.layers.embedding({
            inputDim: numUsers,
            outputDim: embeddingSize,
            name: 'user_embedding'
        }).apply(userInput);
        const userFlat = tf.layers.flatten().apply(userEmbedding);

        // Item input
        const itemInput = tf.input({ shape: [1], name: 'item_id' });
        const itemEmbedding = tf.layers.embedding({
            inputDim: numItems,
            outputDim: embeddingSize,
            name: 'item_embedding'
        }).apply(itemInput);
        const itemFlat = tf.layers.flatten().apply(itemEmbedding);

        // Concatenate embeddings
        const concat = tf.layers.concatenate().apply([userFlat, itemFlat]);
        
        // Dense layers
        const dense1 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(concat);
        const dropout1 = tf.layers.dropout({ rate: 0.3 }).apply(dense1);
        const dense2 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(dropout1);
        const dropout2 = tf.layers.dropout({ rate: 0.2 }).apply(dense2);
        const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(dropout2);

        this.model = tf.model({
            inputs: [userInput, itemInput],
            outputs: output
        });

        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        return this.model;
    }

    // Chuẩn bị dữ liệu training từ Firebase
    async prepareTrainingData() {
        try {
            // Lấy feedback data từ Firebase
            const feedbackSnap = await getDocs(collection(db, 'feedbacks'));
            const feedbacks = feedbackSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Lấy trip history
            const tripsSnap = await getDocs(collection(db, 'trips'));
            const trips = tripsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Tạo user-item interactions
            const interactions = [];
            
            // Từ feedbacks
            feedbacks.forEach(feedback => {
                if (feedback.userId && feedback.destinationId && feedback.rating) {
                    interactions.push({
                        userId: feedback.userId,
                        itemId: feedback.destinationId,
                        rating: feedback.rating / 5.0, // Normalize to 0-1
                        type: 'feedback'
                    });
                }
            });

            // Từ trip history (implicit feedback)
            trips.forEach(trip => {
                if (trip.userId && trip.destinations) {
                    trip.destinations.forEach(dest => {
                        interactions.push({
                            userId: trip.userId,
                            itemId: dest.id || dest.MainDestination,
                            rating: 0.8, // Implicit positive rating
                            type: 'visit'
                        });
                    });
                }
            });

            // Tạo user và item indices
            const uniqueUsers = [...new Set(interactions.map(i => i.userId))];
            const uniqueItems = [...new Set(interactions.map(i => i.itemId))];

            uniqueUsers.forEach((userId, index) => {
                this.userIndex.set(userId, index);
            });

            uniqueItems.forEach((itemId, index) => {
                this.itemIndex.set(itemId, index);
            });

            // Chuyển đổi thành tensor data
            const userIds = interactions.map(i => this.userIndex.get(i.userId));
            const itemIds = interactions.map(i => this.itemIndex.get(i.itemId));
            const ratings = interactions.map(i => i.rating);

            return {
                userIds,
                itemIds,
                ratings,
                numUsers: uniqueUsers.length,
                numItems: uniqueItems.length,
                interactions
            };

        } catch (error) {
            console.error('Error preparing training data:', error);
            throw error;
        }
    }

    // Training model
    async train() {
        if (this.isTraining) {
            console.log('Model is already training...');
            return;
        }

        this.isTraining = true;
        console.log('Starting Collaborative Filtering training...');

        try {
            const data = await this.prepareTrainingData();
            
            if (data.interactions.length < 10) {
                console.warn('Not enough interaction data for training');
                this.isTraining = false;
                return;
            }

            // Tạo model
            this.createModel(data.numUsers, data.numItems);

            // Chuẩn bị tensors
            const userTensor = tf.tensor2d(data.userIds.map(id => [id]));
            const itemTensor = tf.tensor2d(data.itemIds.map(id => [id]));
            const ratingTensor = tf.tensor2d(data.ratings.map(r => [r]));

            // Training
            const history = await this.model.fit(
                [userTensor, itemTensor],
                ratingTensor,
                {
                    epochs: 50,
                    batchSize: 32,
                    validationSplit: 0.2,
                    shuffle: true,
                    callbacks: {
                        onEpochEnd: (epoch, logs) => {
                            if (epoch % 10 === 0) {
                                console.log(`CF Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, val_loss = ${logs.val_loss?.toFixed(4)}`);
                            }
                        }
                    }
                }
            );

            // Cleanup tensors
            userTensor.dispose();
            itemTensor.dispose();
            ratingTensor.dispose();

            console.log('Collaborative Filtering training completed!');
            this.isTraining = false;

            return history;

        } catch (error) {
            console.error('Training error:', error);
            this.isTraining = false;
            throw error;
        }
    }

    // Dự đoán rating cho user-item pair
    async predict(userId, itemId) {
        if (!this.model) {
            console.warn('Model not trained yet');
            return 0.5; // Default rating
        }

        const userIdx = this.userIndex.get(userId);
        const itemIdx = this.itemIndex.get(itemId);

        if (userIdx === undefined || itemIdx === undefined) {
            return 0.5; // Unknown user/item
        }

        const userTensor = tf.tensor2d([[userIdx]]);
        const itemTensor = tf.tensor2d([[itemIdx]]);

        const prediction = this.model.predict([userTensor, itemTensor]);
        const result = await prediction.data();

        userTensor.dispose();
        itemTensor.dispose();
        prediction.dispose();

        return result[0];
    }

    // Tìm users tương tự
    async findSimilarUsers(userId, topK = 10) {
        if (!this.model || !this.userIndex.has(userId)) {
            return [];
        }

        const userIdx = this.userIndex.get(userId);
        const similarities = [];

        // Tính cosine similarity giữa user embeddings
        for (const [otherUserId, otherIdx] of this.userIndex.entries()) {
            if (otherUserId === userId) continue;

            // Lấy embeddings (simplified approach)
            const similarity = Math.random(); // Placeholder - cần implement proper embedding similarity
            similarities.push({
                userId: otherUserId,
                similarity
            });
        }

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    // Gợi ý destinations cho user
    async recommendForUser(userId, topK = 10, excludeVisited = true) {
        if (!this.model || !this.userIndex.has(userId)) {
            return [];
        }

        const recommendations = [];
        const visitedItems = new Set();

        // Lấy items đã visit nếu cần exclude
        if (excludeVisited) {
            const userTripsSnap = await getDocs(
                query(collection(db, 'trips'), where('userId', '==', userId))
            );
            userTripsSnap.docs.forEach(doc => {
                const trip = doc.data();
                if (trip.destinations) {
                    trip.destinations.forEach(dest => {
                        visitedItems.add(dest.id || dest.MainDestination);
                    });
                }
            });
        }

        // Dự đoán rating cho tất cả items
        for (const [itemId, itemIdx] of this.itemIndex.entries()) {
            if (excludeVisited && visitedItems.has(itemId)) continue;

            const predictedRating = await this.predict(userId, itemId);
            recommendations.push({
                itemId,
                predictedRating,
                source: 'collaborative_filtering'
            });
        }

        return recommendations
            .sort((a, b) => b.predictedRating - a.predictedRating)
            .slice(0, topK);
    }
}

// Singleton instance
export const collaborativeFilteringModel = new CollaborativeFilteringModel();

// Export functions
export const trainCollaborativeFiltering = () => collaborativeFilteringModel.train();
export const predictUserItemRating = (userId, itemId) => collaborativeFilteringModel.predict(userId, itemId);
export const recommendDestinations = (userId, topK = 10) => collaborativeFilteringModel.recommendForUser(userId, topK);
export const findSimilarUsers = (userId, topK = 10) => collaborativeFilteringModel.findSimilarUsers(userId, topK);