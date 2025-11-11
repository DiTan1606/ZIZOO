// src/pages/MyTrips.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserItineraries } from '../services/firestoreService';
import MapViewer from '../components/MapViewer';

export default function MyTrips() {
    const { currentUser } = useAuth();
    const [trips, setTrips] = useState([]);
    const mapInitialized = useRef(new Set()); // Theo dõi map đã load

    useEffect(() => {
        if (!currentUser) return;
        const fetchTrips = async () => {
            const data = await getUserItineraries(currentUser.uid);
            setTrips(data);
        };
        fetchTrips();
    }, [currentUser]);

    const handleMapReady = (tripId) => {
        if (mapInitialized.current.has(tripId)) return;
        mapInitialized.current.add(tripId);
        // Có thể thêm toast nếu cần
    };

    return (
        <div className="max-w-7xl mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-indigo-700">Chuyến đi của tôi</h1>
            {trips.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">Chưa có chuyến đi nào.</p>
                    <p className="text-sm text-gray-400 mt-2">
                        Hãy tạo lịch trình đầu tiên tại <strong>ZIZOO Planner</strong>!
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {trips.map(trip => {
                        const points = trip.dailyPlan
                            .flatMap(d => d.destinations)
                            .filter(p => p.lat && p.lng)
                            .map(p => ({ name: p.name, lat: p.lat, lng: p.lng }));

                        // Nếu không có tọa độ → dùng trung tâm mặc định
                        if (points.length === 0 && trip.prefs.center) {
                            points.push({
                                name: trip.prefs.landmark || 'Điểm xuất phát',
                                lat: trip.prefs.center.lat,
                                lng: trip.prefs.center.lng,
                            });
                        }

                        return (
                            <div
                                key={trip.id}
                                className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-2xl font-bold text-indigo-700">
                                            {trip.prefs.landmark || trip.prefs.provinces.join(', ')}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {trip.prefs.days} ngày • Bắt đầu:{' '}
                                            {new Date(trip.prefs.startDate).toLocaleDateString('vi-VN')}
                                        </p>
                                        <p className="text-sm font-medium text-green-600 mt-1">
                                            Ngân sách: {new Intl.NumberFormat('vi-VN').format(trip.prefs.budget)}₫
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Tổng chi phí</p>
                                        <p className="text-xl font-bold text-purple-600">
                                            {new Intl.NumberFormat('vi-VN').format(trip.cost.total)}₫
                                        </p>
                                    </div>
                                </div>

                                {/* BẢN ĐỒ – CHỈ LOAD 1 LẦN */}
                                <div className="h-64 mt-4 rounded-xl overflow-hidden border-2 border-indigo-100">
                                    <MapViewer
                                        key={`map-${trip.id}`} // Đảm bảo React không reuse
                                        points={points}
                                        showRoute={points.length > 1}
                                        onMapReady={() => handleMapReady(trip.id)}
                                        center={points[0] || { lat: 16.047079, lng: 108.206230 }}
                                    />
                                </div>

                                {/* TÓM TẮT ĐIỂM ĐẾN */}
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    {trip.dailyPlan.slice(0, 3).map((day, i) => (
                                        <div key={i} className="bg-indigo-50 p-3 rounded-lg">
                                            <p className="font-medium text-indigo-700">Ngày {day.day}</p>
                                            <p className="text-gray-600 truncate">
                                                {day.destinations[0]?.name || 'Khám phá'}
                                            </p>
                                        </div>
                                    ))}
                                    {trip.dailyPlan.length > 3 && (
                                        <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-center">
                                            <p className="text-gray-500 text-xs">+{trip.dailyPlan.length - 3} ngày</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}