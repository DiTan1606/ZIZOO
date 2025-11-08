// src/services/firestoreService.js

import { db } from '../firebase';
import {
    collection, addDoc, getDocs, query, where, doc, updateDoc, setDoc, getDoc,
    orderBy, limit, serverTimestamp
} from 'firebase/firestore';

export const saveCachedPlace = async (placeId, data) => {
    await setDoc(doc(db, 'cached_places', placeId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

export const getCachedPlace = async (placeId) => {
    const snap = await getDoc(doc(db, 'cached_places', placeId));
    return snap.exists() ? snap.data() : null;
};

export const getCachedPlacesByProvince = async (province, types = []) => {
    let q = query(
        collection(db, 'cached_places'),
        where('province', '==', province)
    );
    if (types.length > 0) {
        q = query(q, where('types', 'array-contains-any', types));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
// === STORMS (BÃO) ===
export const getStormRisks = async (province, month) => {
    if (!province || !month) {
        console.warn('getStormRisks: Thiếu province hoặc month → trả về []');
        return [];
    }
    const q = query(
        collection(db, 'storms'),
        where('Tỉnh', '==', province),
        where('Tháng', '==', month)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
};

// === FLOODS (LŨ CHI TIẾT) ===
export const getFloodRisks = async (province, month) => {
    if (!province || !month) {
        console.warn('getFloodRisks: Thiếu province hoặc month → trả về []');
        return [];
    }
    const q = query(
        collection(db, 'floods'),
        where('Tỉnh', '==', province),
        where('Tháng', '==', month)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
};

// === FESTIVALS (LỄ HỘI) ===
export const getFestivals = async (month) => {
    if (!month) return [];
    const q = query(collection(db, 'festivals'), where('Tháng', '==', month));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
        Province: d.data().Tỉnh,
        FestivalCount: d.data().Số_Lễ_Hội
    }));
};

export const saveItinerary = async (userId, itinerary) => {
    return await addDoc(collection(db, 'itineraries'), {
        userId,
        ...itinerary,
        createdAt: serverTimestamp()
    });
};

export const getUserItineraries = async (userId) => {
    const q = query(collection(db, 'itineraries'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
// === FEEDBACK (ĐÁNH GIÁ) ===
export const saveFeedback = async (userId, itineraryId, destinationId, rating, comment = '', userPref = {}) => {
    await addDoc(collection(db, 'feedbacks'), {
        userId,
        itineraryId,
        destinationId,
        rating,
        comment,
        userPref,
        createdAt: new Date()
    });
};

// === DỮ LIỆU TOÀN BỘ CHO ML (TRAINING) ===
export const getStormRisksAll = async () => {
    const snap = await getDocs(collection(db, 'storms'));
    return snap.docs.map(d => d.data());
};

export const getFloodRisksAll = async () => {
    const snap = await getDocs(collection(db, 'floods'));
    return snap.docs.map(d => d.data());
};

// firestoreService.js – Thêm 2 hàm mới
export const saveCachedDestination = async (placeId, data) => {
    await setDoc(doc(db, 'cached_destinations', placeId), {
        ...data,
        cachedAt: new Date(),
        ratingCount: data.ratingCount || 1,
        totalRating: data.rating || 0
    }, { merge: true });
};

export const getCachedDestinations = async (province, types = []) => {
    const q = query(
        collection(db, 'cached_destinations'),
        where('province', '==', province),
        where('types', 'array-contains-any', types.length > 0 ? types : ['tourist_attraction']),
        orderBy('totalRating', 'desc'),
        limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};