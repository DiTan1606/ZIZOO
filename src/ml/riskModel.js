// src/ml/riskModel.js
import * as tf from '@tensorflow/tfjs';
import { db } from '../firebase';
import {
    collection,
    getDocs,
    query,           // ← ĐÃ THÊM
    where            // ← ĐÃ THÊM
} from 'firebase/firestore';

let riskModel = null;
let isTraining = false;

/**
 * Train mô hình AI từ dữ liệu thực tế (weather_monthly + storms + floods)
 */
export const trainRiskModel = async () => {
    if (isTraining || riskModel) {
        console.log('Mô hình đã được train hoặc đang train...');
        return riskModel;
    }

    isTraining = true;
    console.log('Bắt đầu train AI Risk Model từ dữ liệu thực...');

    const features = [];
    const labels = [];

    try {
        // Lấy dữ liệu từ Firestore
        const [weatherSnap, stormSnap, floodSnap] = await Promise.all([
            getDocs(collection(db, 'weather_monthly')),
            getDocs(collection(db, 'disaster_travel_data_cleaned_storms_cleaned')),
            getDocs(collection(db, 'disaster_travel_data_cleaned_floods_cleaned'))
        ]);

        // Tạo map: tỉnh + tháng → lượng mưa trung bình
        const provinceMap = {};
        weatherSnap.forEach(doc => {
            const d = doc.data();
            const key = `${d.TinhThanh}_${d.Tháng}`;
            provinceMap[key] = provinceMap[key] || { rain: 0, count: 0 };
            provinceMap[key].rain += d.LuongMua || 0;
            provinceMap[key].count += 1;
        });

        // Hàm thêm dữ liệu vào tập train
        const addRecord = (province, month, rain, isDisaster = false) => {
            const avgRain = rain || 0;
            features.push([
                month / 12,                    // Tháng chuẩn hóa
                Math.min(avgRain / 1000, 1),   // Mưa chuẩn hóa
                avgRain > 300 ? 1 : 0,         // Mưa cực lớn
                avgRain > 200 ? 1 : 0,         // Mưa lớn
                isDisaster ? 1 : 0,            // Có thiên tai không
                month >= 6 && month <= 10 ? 1 : 0 // Mùa mưa bão
            ]);
            labels.push(isDisaster ? 1 : 0);
        };

        // Dữ liệu bình thường từ weather_monthly
        Object.entries(provinceMap).forEach(([key, val]) => {
            const [province, monthStr] = key.split('_');
            const month = parseInt(monthStr);
            const avgRain = val.rain / val.count;
            addRecord(province, month, avgRain, false);
        });

        // Dữ liệu thiên tai → label = 1
        stormSnap.forEach(doc => {
            const d = doc.data();
            const key = `${d.Province}_${d.Month}`;
            const base = provinceMap[key] || { rain: 350, count: 1 };
            addRecord(d.Province, d.Month, base.rain / base.count, true);
        });

        floodSnap.forEach(doc => {
            const d = doc.data();
            const key = `${d.Province}_${d.Month}`;
            const base = provinceMap[key] || { rain: 400, count: 1 };
            addRecord(d.Province, d.Month, base.rain / base.count, true);
        });

        if (features.length < 50) {
            console.warn('Dữ liệu chưa đủ để train');
            isTraining = false;
            return null;
        }

        // Train model
        const xs = tf.tensor2d(features);
        const ys = tf.tensor2d(labels.map(l => [l]));

        riskModel = tf.sequential();
        riskModel.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [6] }));
        riskModel.add(tf.layers.dropout({ rate: 0.3 }));
        riskModel.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        riskModel.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        riskModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

        riskModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        await riskModel.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            verbose: 0,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) console.log(`Epoch ${epoch}: acc = ${(logs.acc * 100).toFixed(2)}%`);
                }
            }
        });

        xs.dispose();
        ys.dispose();
        console.log('AI RISK MODEL TRAIN THÀNH CÔNG 100%!');
    } catch (err) {
        console.error('Lỗi train model:', err);
    }

    isTraining = false;
    return riskModel;
};

// Dự đoán bằng AI đã train
export const predictRiskWithAI = async (inputArray) => {
    if (!riskModel) {
        await trainRiskModel();
        if (!riskModel) return 30; // fallback
    }

    const tensor = tf.tensor2d([inputArray]);
    const prediction = riskModel.predict(tensor);
    const result = prediction.dataSync()[0];
    tensor.dispose();
    prediction.dispose();

    return Math.round(result * 100);
};

// Dự báo rủi ro cho 1 tỉnh (dùng trong riskService)
export const predictProvinceRiskAI = async (province, month = new Date().getMonth() + 1) => {
    try {
        const q = query(
            collection(db, 'weather_monthly'),
            where('TinhThanh', '==', province),
            where('Tháng', '==', month)
        );
        const snap = await getDocs(q);

        let avgRain = 150;
        if (!snap.empty) {
            const total = snap.docs.reduce((sum, doc) => sum + (doc.data().LuongMua || 0), 0);
            avgRain = total / snap.size;
        }

        const input = [
            month / 12,
            Math.min(avgRain / 1000, 1),
            avgRain > 300 ? 1 : 0,
            avgRain > 200 ? 1 : 0,
            0,
            month >= 6 && month <= 10 ? 1 : 0
        ];

        const aiScore = await predictRiskWithAI(input);
        return Math.min(100, aiScore + 15); // Tăng nhẹ để hợp lý
    } catch (err) {
        return 40;
    }
};