// src/ml/userPreferenceModel.js
import * as tf from '@tensorflow/tfjs';

/**
 * Mô hình dự đoán sở thích người dùng
 * Input: [month, budget, type, adventure, eco, avgPastRating, padding]
 * Output: [preferredType (0-1), preferredAdventure (0-1), preferredEco (0-1)]
 */
let model = null;

export const createPreferenceModel = () => {
    model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [7], units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 3, activation: 'sigmoid' })); // 3 outputs

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
    });
    return model;
};

export const trainPreferenceModel = async (trainingData) => {
    if (!model) createPreferenceModel();

    const xs = tf.tensor2d(trainingData.map(d => d.input));
    const ys = tf.tensor2d(trainingData.map(d => d.output));

    await model.fit(xs, ys, {
        epochs: 60,
        batchSize: 8,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (epoch % 10 === 0) {
                    console.log(`[Preference Model] Epoch ${epoch}: loss = ${logs.loss.toFixed(5)}`);
                }
            }
        }
    });

    xs.dispose();
    ys.dispose();
    console.log('Preference model training completed!');
};

export const predictUserPreference = async (input) => {
    if (!model) {
        console.warn('Preference model not loaded');
        return null;
    }
    const tensor = tf.tensor2d([input]);
    const prediction = model.predict(tensor);
    const result = await prediction.array();
    tensor.dispose();
    prediction.dispose();
    return result[0]; // [typeProb, advProb, ecoProb]
};