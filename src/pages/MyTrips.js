// src/pages/MyTrips.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserItineraries } from '../services/firestoreService';
import { getUserItineraries as getCompleteItineraries } from '../services/completeItineraryService';
import MapViewer from '../components/MapViewer';
import ItineraryDetailModal from '../components/ItineraryDetailModal';

export default function MyTrips() {
    const { currentUser } = useAuth();
    const [trips, setTrips] = useState([]);
    const [completeTrips, setCompleteTrips] = useState([]);
    const [activeTab, setActiveTab] = useState('complete'); // Default to complete itineraries
    const [selectedItinerary, setSelectedItinerary] = useState(null);
    const mapInitialized = useRef(new Set()); // Theo dõi map đã load

    useEffect(() => {
        if (!currentUser) return;
        
        const fetchTrips = async () => {
            // Fetch both types of itineraries
            const [oldTrips, newTrips] = await Promise.all([
                getUserItineraries(currentUser.uid),
                getCompleteItineraries(currentUser.uid)
            ]);
            
            setTrips(oldTrips);
            setCompleteTrips(newTrips);
        };
        
        fetchTrips();
    }, [currentUser]);

    const refreshTrips = async () => {
        if (!currentUser) return;
        
        try {
            const [oldTrips, newTrips] = await Promise.all([
                getUserItineraries(currentUser.uid),
                getCompleteItineraries(currentUser.uid)
            ]);
            
            setTrips(oldTrips);
            setCompleteTrips(newTrips);
        } catch (error) {
            console.error('Error refreshing trips:', error);
        }
    };

    const handleMapReady = (tripId) => {
        if (mapInitialized.current.has(tripId)) return;
        mapInitialized.current.add(tripId);
        // Có thể thêm toast nếu cần
    };

    const formatMoney = (amount) => {
        if (!amount) return 'N/A';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatDate = (dateInput) => {
        if (!dateInput) {
            console.log('⚠️ formatDate: dateInput is null/undefined');
            return 'N/A';
        }
        
        try {
            console.log('📅 formatDate input:', dateInput, 'Type:', typeof dateInput, 'Has toDate:', !!dateInput?.toDate);
            
            let date;
            
            // Xử lý Firestore Timestamp
            if (dateInput.toDate && typeof dateInput.toDate === 'function') {
                console.log('✅ Using Firestore Timestamp.toDate()');
                date = dateInput.toDate();
            }
            // Xử lý Date object
            else if (dateInput instanceof Date) {
                console.log('✅ Using Date object');
                date = dateInput;
            }
            // Xử lý string format vi-VN (dd/mm/yyyy)
            else if (typeof dateInput === 'string' && dateInput.includes('/')) {
                console.log('✅ Parsing vi-VN format (dd/mm/yyyy)');
                const parts = dateInput.split('/');
                if (parts.length === 3) {
                    // Convert "15/12/2024" to "2024-12-15"
                    const [day, month, year] = parts;
                    date = new Date(`${year}-${month}-${day}`);
                } else {
                    date = new Date(dateInput);
                }
            }
            // Xử lý string hoặc number
            else {
                console.log('✅ Parsing as string/number');
                date = new Date(dateInput);
            }
            
            // Kiểm tra date hợp lệ
            if (isNaN(date.getTime())) {
                console.warn('❌ Invalid date after parsing:', dateInput);
                return 'N/A';
            }
            
            const formatted = date.toLocaleDateString('vi-VN');
            console.log('✅ Formatted date:', formatted);
            return formatted;
        } catch (error) {
            console.error('❌ Error formatting date:', error, dateInput);
            return 'N/A';
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-indigo-700">Chuyến đi của tôi</h1>
            
            {/* Tab Navigation */}
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                        activeTab === 'complete' 
                            ? 'bg-white text-indigo-700 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => setActiveTab('complete')}
                >
                    Lịch Trình Hoàn Chỉnh ({completeTrips.length})
                </button>
                <button
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                        activeTab === 'simple' 
                            ? 'bg-white text-indigo-700 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => setActiveTab('simple')}
                >
                    Lịch Trình Đơn Giản ({trips.length})
                </button>
            </div>

            {/* Complete Itineraries Tab */}
            {activeTab === 'complete' && (
                <>
                    {completeTrips.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">Chưa có lịch trình hoàn chỉnh nào.</p>
                            <p className="text-sm text-gray-400 mt-2">
                                Hãy tạo lịch trình hoàn chỉnh tại <strong>Complete Itinerary Planner</strong>!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {completeTrips.map(trip => (
                                <div
                                    key={trip.id}
                                    className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-2xl font-bold text-indigo-700">
                                                {trip.tripName}
                                            </h3>
                                            <p className="text-lg text-gray-600 mt-1">
                                                📍 {trip.destination}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {trip.duration === 1 
                                                    ? '1 ngày (đi trong ngày)' 
                                                    : `${trip.duration} ngày ${trip.duration - 1} đêm`
                                                } • {typeof trip.travelers === 'object' ? trip.travelers?.total || trip.travelers?.adults || 2 : trip.travelers} người • Bắt đầu: {formatDate(trip.startDate)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Ngân sách ({typeof trip.travelers === 'object' ? trip.travelers?.total || trip.travelers?.adults || 2 : trip.travelers} người)</p>
                                            <p className="text-xl font-bold text-green-600">
                                                {formatMoney(trip.budget)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatMoney(Math.round(trip.budget / (typeof trip.travelers === 'object' ? trip.travelers?.total || trip.travelers?.adults || 2 : trip.travelers)))}/người
                                            </p>
                                        </div>
                                    </div>

                                    {/* Daily Plans Preview */}
                                    {trip.fullItinerary?.dailyItinerary && (
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                            {trip.fullItinerary.dailyItinerary.slice(0, 3).map((day, i) => (
                                                <div key={i} className="bg-indigo-50 p-3 rounded-lg">
                                                    <p className="font-medium text-indigo-700">Ngày {day.day}: {day.theme}</p>
                                                    <p className="text-gray-600 text-xs mt-1">
                                                        {day.destinations?.slice(0, 2).map(d => d.name).join(', ')}
                                                        {day.destinations?.length > 2 && '...'}
                                                    </p>
                                                    <p className="text-green-600 font-medium text-xs mt-1">
                                                        {formatMoney(day.estimatedCost)}
                                                    </p>
                                                </div>
                                            ))}
                                            {trip.fullItinerary.dailyItinerary.length > 3 && (
                                                <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-center">
                                                    <p className="text-gray-500 text-xs">+{trip.fullItinerary.dailyItinerary.length - 3} ngày</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 flex justify-between items-center">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSelectedItinerary(trip.fullItinerary || trip)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                📋 Xem chi tiết
                                            </button>
                                            <button
                                                onClick={refreshTrips}
                                                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                🔄 Làm mới
                                            </button>
                                        </div>
                                        <div className="text-right text-sm text-gray-500">
                                            <div>Tạo lúc: {formatDate(trip.createdAt)}</div>
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                                                Lịch trình hoàn chỉnh
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Simple Itineraries Tab */}
            {activeTab === 'simple' && (
                <>
                    {trips.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">Chưa có lịch trình đơn giản nào.</p>
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
                </>
            )}

            {/* Itinerary Detail Modal */}
            {selectedItinerary && (
                <ItineraryDetailModal
                    itinerary={selectedItinerary}
                    onClose={() => setSelectedItinerary(null)}
                />
            )}
        </div>
    );
}