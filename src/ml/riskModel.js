// src/ml/riskModel.js
import * as tf from '@tensorflow/tfjs';
import { getStormRisksAll, getFloodRisksAll } from '../services/firestoreService';

let riskModel = null;

export const trainRiskModel = async () => {
    const storms = await getStormRisksAll();
    const floods = await getFloodRisksAll();

    const xs = [];
    const ys = [];

    storms.forEach(s => {
        const flood = floods.find(f => f.Tỉnh === s.Tỉnh && f.Tháng === s.Tháng) || {};
        xs.push([
            s.Tháng,
            s.Tần_Suất_Tháng || 1,
            s.Số_Người_Chết || 0,
            flood.Độ_Sâu_Ngập_m || 0,
            flood.Số_Nhà_Ngập_Hư_Hỏng || 0
        ]);
        ys.push(s.Thiệt_Hại_USD > 1e8 ? 1 : 0);
    });

    if (xs.length === 0) return;

    const xsTensor = tf.tensor2d(xs);
    const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

    riskModel = tf.sequential();
    riskModel.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [5] }));
    riskModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    riskModel.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });

    await riskModel.fit(xsTensor, ysTensor, { epochs: 30, verbose: 0 });
    console.log('Risk Model trained!');
};

export const predictRiskScore = (month, province, storms = [], floods = []) => {
    if (!riskModel) return 0.5;

    const storm = storms[0] || {};
    const flood = floods[0] || {};

    const input = tf.tensor2d([[
        month,
        storm.Tần_Suất_Tháng || 1,
        storm.Số_Người_Chết || 0,
        flood.Độ_Sâu_Ngập_m || 0,
        flood.Số_Nhà_Ngập_Hư_Hỏng || 0
    ]]);

    const pred = riskModel.predict(input).dataSync()[0];
    return pred;
};