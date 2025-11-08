// src/ml/trainer.js
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { trainPreferenceModel } from './userPreferenceModel';
import { trainRiskModel } from './riskModel';

export const retrainAllModels = async () => {
    console.log('Starting model retraining...');

    // === 1. Retrain sở thích từ feedback ===
    const feedbackSnap = await getDocs(collection(db, 'feedbacks'));
    const feedbacks = feedbackSnap.docs.map(d => d.data());

    if (feedbacks.length > 5) {
        const trainingData = feedbacks.map(f => {
            const pref = f.userPref || {
                month: 6,
                budget: 'medium',
                type: 'Nghỉ dưỡng',
                adventure: 'medium',
                eco: false
            };
            return {
                input: [
                    pref.month || 6,
                    ['low', 'medium', 'high'].indexOf(pref.budget),
                    ['Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực'].indexOf(pref.type),
                    ['low', 'medium', 'high'].indexOf(pref.adventure),
                    pref.eco ? 1 : 0,
                    (f.rating || 3) / 5,
                    0
                ],
                output: [
                    ['Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực'].indexOf(pref.type) / 3,
                    ['low', 'medium', 'high'].indexOf(pref.adventure) / 2,
                    pref.eco ? 1 : 0
                ]
            };
        });

        await trainPreferenceModel(trainingData);
    }

    // === 2. Retrain rủi ro từ lịch sử ===
    const stormSnap = await getDocs(collection(db, 'storms'));
    const floodSnap = await getDocs(collection(db, 'floods'));

    const riskData = [
        ...stormSnap.docs.map(d => ({ ...d.data(), hasRisk: true })),
        ...floodSnap.docs.map(d => ({ ...d.data(), hasRisk: true }))
    ];

    // Thêm negative samples (tháng an toàn)
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
    allMonths.forEach(month => {
        const hasRecord = riskData.some(r => r.Month === month);
        if (!hasRecord) {
            riskData.push({ Month: month, Deaths: 0, Damage_USD: 0, 'Độ Sâu Ngập (m)': 0, hasRisk: false });
        }
    });

    if (riskData.length > 10) {
        await trainRiskModel(riskData);
    }

    console.log('All models retrained successfully!');
};