// src/pages/MyTrips.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserItineraries } from '../services/firestoreService';
import MapViewer from '../components/MapViewer';

export default function MyTrips() {
    const { currentUser } = useAuth();
    const [trips, setTrips] = useState([]);

    useEffect(() => {
        if (!currentUser) return;
        getUserItineraries(currentUser.uid).then(setTrips);
    }, [currentUser]);

    return (
        <div className="max-w-7xl mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">Chuyến đi của tôi</h1>
            {trips.length === 0 ? (
                <p>Chưa có chuyến đi nào.</p>
            ) : (
                trips.map(trip => (
                    <div key={trip.id} className="bg-white p-6 rounded-xl shadow mb-6">
                        <h3 className="text-xl font-bold">{trip.prefs.provinces.join(', ')}</h3>
                        <p>Ngày: {new Date(trip.prefs.startDate).toLocaleDateString('vi-VN')}</p>
                        <div className="h-64 mt-4 rounded-xl overflow-hidden">
                            <MapViewer
                                points={trip.dailyPlan.flatMap(d => d.destinations)}
                                showRoute={true}
                            />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}