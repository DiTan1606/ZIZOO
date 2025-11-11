// src/services/updateScheduler.js
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cacheDestinationsForProvince } from './cacheDestinations';

// THÊM HÀM isHighRiskMonth VÀO ĐÂY
const isHighRiskMonth = (province, month) => {
    const map = {
        'Quảng Ninh': [7, 8, 9],
        'Thừa Thiên Huế': [9, 10, 11],
        'Kiên Giang': [6, 7, 8],
        'Hà Nội': [7, 8],
        'Thành phố Hồ Chí Minh': [6, 7, 8, 9],
    };
    return map[province]?.includes(month) || false;
};

export const scheduleProvinceUpdate = async () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    const provincesRef = collection(db, 'provinces');
    const snapshot = await getDocs(provincesRef);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const province = data.name;
        const center = data.center;
        const lastUpdate = data.lastUpdate?.toDate();
        const isHighRisk = isHighRiskMonth(province, currentMonth);

        const intervalDays = isHighRisk ? 7 : 30;
        const daysSinceUpdate = lastUpdate ? (now - lastUpdate) / (1000 * 60 * 60 * 24) : Infinity;

        if (daysSinceUpdate >= intervalDays) {
            console.log(`Cập nhật: ${province} (${isHighRisk ? 'RỦI RO' : 'THƯỜNG'})`);
            await cacheDestinationsForProvince(province, center);
            await updateDoc(doc.ref, { lastUpdate: serverTimestamp() });
        }
    }
};