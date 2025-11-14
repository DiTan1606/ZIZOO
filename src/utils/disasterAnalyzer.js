// src/utils/disasterAnalyzer.js
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

// Tên collection đúng của bạn (đã kiểm tra)
const STORMS_COLLECTION = 'disaster_travel_data_cleaned_storms_cleaned';
const FLOODS_COLLECTION = 'disaster_travel_data_cleaned_floods_cleaned';

export const analyzeHighRiskMonths = async () => {
    try {
        const [stormSnap, floodSnap] = await Promise.all([
            getDocs(collection(db, STORMS_COLLECTION)),
            getDocs(collection(db, FLOODS_COLLECTION))
        ]);

        const storms = stormSnap.docs.map(doc => doc.data());
        const floods = floodSnap.docs.map(doc => doc.data());

        console.log(`Đã tải ${storms.length} cơn bão + ${floods.length} trận lũ`);

        const riskMap = {};

        // Xử lý bão
        storms.forEach(s => {
            const province = s.Province || s.Tỉnh;
            const month = Number(s.Month || s.Tháng);
            if (!province || !month) return;

            if (!riskMap[province]) riskMap[province] = {};
            if (!riskMap[province][month]) riskMap[province][month] = { count: 0, severity: 0 };

            riskMap[province][month].count += 1;
            riskMap[province][month].severity += 3; // Bão luôn nghiêm trọng
        });

        // Xử lý lũ
        floods.forEach(f => {
            const province = f.Province || f.Tỉnh;
            const month = Number(f.Month || f.Tháng);
            if (!province || !month) return;

            if (!riskMap[province]) riskMap[province] = {};
            if (!riskMap[province][month]) riskMap[province][month] = { count: 0, severity: 0 };

            riskMap[province][month].count += 1;
            const depth = f.Độ_Sâu_Ngập_m || f.depth || 0;
            riskMap[province][month].severity += depth > 1.5 ? 3 : depth > 0.8 ? 2 : 1;
        });

        // Xác định tháng "nguy hiểm cao" nếu: có ít nhất 1 sự cố nghiêm trọng
        const highRiskMonths = {};

        Object.entries(riskMap).forEach(([province, months]) => {
            Object.entries(months).forEach(([monthStr, data]) => {
                const month = Number(monthStr);
                if (data.severity >= 3) { // Có thiên tai nghiêm trọng
                    if (!highRiskMonths[province]) highRiskMonths[province] = [];
                    if (!highRiskMonths[province].includes(month)) {
                        highRiskMonths[province].push(month);
                    }
                }
            });
        });

        // Sắp xếp tháng tăng dần
        Object.keys(highRiskMonths).forEach(p => {
            highRiskMonths[p].sort((a, b) => a - b);
        });

        return highRiskMonths;
    } catch (err) {
        console.error('Lỗi analyzeHighRiskMonths:', err);
        return {};
    }
};