// src/services/cacheDestinations.js
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc, setDoc, updateDoc,
    getDoc, addDoc, serverTimestamp  // THÊM getDoc, addDoc
} from 'firebase/firestore';

const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const TOURISM_TYPES = [
    'tourist_attraction', 'museum', 'park', 'zoo', 'amusement_park',
    'art_gallery', 'church', 'temple', 'spa', 'beach', 'resort', 'restaurant'
];

// DI CHUYỂN HÀM isHighRiskMonth LÊN ĐẦU
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

export const checkAndUpdateCache = async (province, center) => {
    const provincesRef = collection(db, 'provinces');
    const id = province.replace(/ /g, '_');
    const docRef = doc(provincesRef, id);
    const snap = await getDoc(docRef); // ĐÃ SỬA THÀNH getDoc

    const now = new Date();
    const month = now.getMonth() + 1;
    const isHighRisk = isHighRiskMonth(province, month);
    const threshold = isHighRisk ? 7 : 30;

    if (!snap.exists()) {
        await setDoc(docRef, { name: province, center, lastUpdate: serverTimestamp() });
        await cacheDestinationsForProvince(province, center);
    } else {
        const last = snap.data().lastUpdate?.toDate();
        const daysSince = last ? (now - last) / (1000 * 60 * 60 * 24) : Infinity;
        if (daysSince >= threshold) {
            await cacheDestinationsForProvince(province, center);
            await updateDoc(docRef, { lastUpdate: serverTimestamp() });
        }
    }
};

export const cacheDestinationsForProvince = async (province, center) => {
    const cacheRef = collection(db, 'cachedDestinations');
    const q = query(cacheRef, where('province', '==', province));
    const existing = await getDocs(q);
    const existingIds = new Set(existing.docs.map(d => d.data().placeId));

    let count = 0;
    for (const type of TOURISM_TYPES) {
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${center.lat},${center.lng}&radius=50000&type=${type}&key=${GOOGLE_API_KEY}`;
        while (url) {
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (!data.results) break;
                for (const place of data.results) {
                    if (place.rating >= 4.0 && place.user_ratings_total >= 50 && !existingIds.has(place.place_id)) {
                        await addDoc(cacheRef, { // ĐÃ SỬA THÀNH addDoc
                            placeId: place.place_id,
                            name: place.name,
                            address: place.vicinity || '',
                            rating: place.rating,
                            userRatingsTotal: place.user_ratings_total,
                            lat: place.geometry.location.lat,
                            lng: place.geometry.location.lng,
                            types: place.types,
                            province,
                            photoRef: place.photos?.[0]?.photo_reference || null,
                            cachedAt: serverTimestamp(),
                        });
                        count++;
                        existingIds.add(place.place_id);
                    }
                }
                url = data.next_page_token
                    ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${GOOGLE_API_KEY}&pagetoken=${data.next_page_token}`
                    : null;
                if (url) await new Promise(r => setTimeout(r, 2200));
            } catch (err) {
                console.warn('Lỗi quét:', err);
                break;
            }
        }
    }
    console.log(`Đã thêm ${count} điểm mới cho ${province}`);
};