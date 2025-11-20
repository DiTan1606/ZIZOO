// src/pages/MyTrips.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserItineraries } from '../services/firestoreService';
import { getUserItineraries as getCompleteItineraries } from '../services/completeItineraryService';
import { 
    updateItineraryStatus, 
    getItineraryStatus 
} from '../services/itineraryManagementService';
import { toast } from 'react-toastify';
import MapViewer from '../components/MapViewer';
import ItineraryDetailModal from '../components/ItineraryDetailModal';
import './MyTrips.css';

export default function MyTrips() {
    const { currentUser } = useAuth();
    const [trips, setTrips] = useState([]);
    const [completeTrips, setCompleteTrips] = useState([]);
    const [activeTab, setActiveTab] = useState('active'); // Tab: active, completed, cancelled
    const [selectedItinerary, setSelectedItinerary] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [tripToCancel, setTripToCancel] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
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

    // Lọc trips theo status
    const getFilteredTrips = () => {
        const filtered = completeTrips.filter(trip => {
            const status = getItineraryStatus(trip);
            
            // Debug logging
            if (trip.status) {
                console.log(`📊 Trip ${trip.id}: DB status="${trip.status}", computed status="${status}"`);
            }
            
            if (activeTab === 'active') return status === 'active' || status === 'ongoing';
            if (activeTab === 'completed') return status === 'completed';
            if (activeTab === 'cancelled') return status === 'cancelled';
            return true;
        });
        
        console.log(`📋 Active tab: ${activeTab}, Filtered trips: ${filtered.length}/${completeTrips.length}`);
        return filtered;
    };

    // Đánh dấu hoàn thành
    const handleMarkCompleted = async (tripId) => {
        console.log('🔄 Marking trip as completed:', tripId);
        console.log('🔄 Current user:', currentUser?.uid);
        console.log('🔄 updateItineraryStatus function:', typeof updateItineraryStatus);
        
        try {
            const result = await updateItineraryStatus(currentUser.uid, tripId, 'completed');
            console.log('✅ Status updated in Firestore, result:', result);
            
            // Update local state immediately
            setCompleteTrips(prev => prev.map(trip => 
                trip.id === tripId 
                    ? { ...trip, status: 'completed', completedAt: new Date() }
                    : trip
            ));
            
            toast.success('✅ Đã đánh dấu chuyến đi hoàn thành!');
            
            // Tự động chuyển sang tab "Đã hoàn thành"
            setActiveTab('completed');
            
            // Refresh từ server sau 5s để đảm bảo Firestore đã sync
            setTimeout(async () => {
                await refreshTrips();
                console.log('✅ Trips refreshed from server');
            }, 5000);
        } catch (error) {
            console.error('❌ Error marking trip as completed:', error);
            console.error('❌ Error stack:', error.stack);
            toast.error('Lỗi khi cập nhật trạng thái: ' + error.message);
            
            // Rollback local state nếu có lỗi
            await refreshTrips();
        }
    };

    // Mở modal hủy
    const handleOpenCancelModal = (trip) => {
        setTripToCancel(trip);
        setShowCancelModal(true);
    };

    // Xác nhận hủy
    const handleConfirmCancel = async () => {
        if (!cancelReason.trim()) {
            toast.error('Vui lòng nhập lý do hủy!');
            return;
        }

        console.log('🔄 Cancelling trip:', tripToCancel.id);
        console.log('🔄 Current user:', currentUser?.uid);
        console.log('🔄 Cancel reason:', cancelReason);
        console.log('🔄 updateItineraryStatus function:', typeof updateItineraryStatus);

        try {
            const result = await updateItineraryStatus(
                currentUser.uid, 
                tripToCancel.id, 
                'cancelled',
                cancelReason
            );
            console.log('✅ Status updated in Firestore, result:', result);
            
            // Update local state immediately
            setCompleteTrips(prev => prev.map(trip => 
                trip.id === tripToCancel.id 
                    ? { ...trip, status: 'cancelled', cancelReason, cancelledAt: new Date() }
                    : trip
            ));
            
            toast.success('✅ Đã hủy chuyến đi!');
            setShowCancelModal(false);
            setTripToCancel(null);
            setCancelReason('');
            
            // Tự động chuyển sang tab "Đã hủy"
            setActiveTab('cancelled');
            
            // Refresh từ server sau 5s để đảm bảo Firestore đã sync
            setTimeout(async () => {
                await refreshTrips();
                console.log('✅ Trips refreshed from server');
            }, 5000);
        } catch (error) {
            console.error('❌ Error cancelling trip:', error);
            console.error('❌ Error stack:', error.stack);
            toast.error('Lỗi khi hủy chuyến đi: ' + error.message);
            
            // Rollback local state nếu có lỗi
            setShowCancelModal(false);
            setTripToCancel(null);
            setCancelReason('');
            await refreshTrips();
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
            
            // Xử lý Firestore Timestamp (có method toDate)
            if (dateInput.toDate && typeof dateInput.toDate === 'function') {
                console.log('✅ Using Firestore Timestamp.toDate()');
                date = dateInput.toDate();
            }
            // Xử lý Firestore Timestamp object (có seconds và nanoseconds)
            else if (dateInput.seconds !== undefined && dateInput.nanoseconds !== undefined) {
                console.log('✅ Converting Firestore Timestamp object');
                date = new Date(dateInput.seconds * 1000 + dateInput.nanoseconds / 1000000);
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
            // Xử lý ISO string
            else if (typeof dateInput === 'string') {
                console.log('✅ Parsing ISO string');
                date = new Date(dateInput);
            }
            // Xử lý Unix timestamp (milliseconds)
            else if (typeof dateInput === 'number') {
                console.log('✅ Parsing Unix timestamp');
                date = new Date(dateInput);
            }
            // Fallback
            else {
                console.log('⚠️ Unknown format, trying generic Date constructor');
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
            {/* Hero Section */}
            <div className="mytrips-hero">
                <h1>Chuyến đi của tôi</h1>
                <p>Quản lý và theo dõi tất cả các chuyến đi của bạn</p>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                        activeTab === 'active' 
                            ? 'bg-white text-indigo-700 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => setActiveTab('active')}
                >
                    🎯 Đang hoạt động ({completeTrips.filter(t => {
                        const status = getItineraryStatus(t);
                        return status === 'active' || status === 'ongoing';
                    }).length})
                </button>
                <button
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                        activeTab === 'completed' 
                            ? 'bg-white text-indigo-700 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => setActiveTab('completed')}
                >
                    Đã hoàn thành ({completeTrips.filter(t => getItineraryStatus(t) === 'completed').length})
                </button>
                <button
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                        activeTab === 'cancelled' 
                            ? 'bg-white text-indigo-700 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => setActiveTab('cancelled')}
                >
                    Đã hủy ({completeTrips.filter(t => getItineraryStatus(t) === 'cancelled').length})
                </button>
            </div>

            {/* Trips List */}
            <>
                {getFilteredTrips().length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">
                                {activeTab === 'active' && 'Chưa có chuyến đi nào đang hoạt động.'}
                                {activeTab === 'completed' && 'Chưa có chuyến đi nào hoàn thành.'}
                                {activeTab === 'cancelled' && 'Chưa có chuyến đi nào bị hủy.'}
                            </p>
                            <p className="text-sm text-gray-400 mt-2">
                                Hãy tạo lịch trình mới tại <strong>Lập kế hoạch</strong>
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {getFilteredTrips().map(trip => {
                                const status = getItineraryStatus(trip);
                                return (
                                <div
                                    key={trip.id}
                                    className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-bold text-indigo-700">
                                                    {trip.tripName}
                                                </h3>
                                                {/* Status Badge */}
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                    status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                                                    status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {status === 'ongoing' && 'Đang đi'}
                                                    {status === 'completed' && 'Hoàn thành'}
                                                    {status === 'cancelled' && 'Đã hủy'}
                                                    {status === 'active' && 'Sắp tới'}
                                                </span>
                                            </div>
                                            <p className="text-lg text-gray-600 mt-1">
                                                {trip.destination}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {trip.duration === 1 
                                                    ? '1 ngày (đi trong ngày)' 
                                                    : `${trip.duration} ngày ${trip.duration - 1} đêm`
                                                } • {typeof trip.travelers === 'object' ? trip.travelers?.total || trip.travelers?.adults || 2 : trip.travelers} người • Bắt đầu: {formatDate(trip.startDate)}
                                            </p>
                                            {trip.cancelReason && (
                                                <p className="text-sm text-red-600 mt-2 italic">
                                                    Lý do hủy: {trip.cancelReason}
                                                </p>
                                            )}
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
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                onClick={() => setSelectedItinerary(trip.fullItinerary || trip)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Xem chi tiết
                                            </button>
                                            
                                            {/* Action buttons based on status */}
                                            {(status === 'active' || status === 'ongoing') && (
                                                <>
                                                    <button
                                                        onClick={() => handleMarkCompleted(trip.id)}
                                                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Hoàn thành
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenCancelModal(trip)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Hủy chuyến
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-right text-sm text-gray-500">
                                            <div>Tạo lúc: {formatDate(trip.createdAt)}</div>
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                                                Lịch trình hoàn chỉnh
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </>


            {/* Removed Simple Itineraries Tab - Only using Complete Itineraries now */}
            {activeTab === 'old-simple' && (
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

            {/* Cancel Trip Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-2xl font-bold text-red-600 mb-4">
                            Hủy chuyến đi
                        </h3>
                        <p className="text-gray-700 mb-4">
                            Bạn có chắc muốn hủy chuyến đi <strong>{tripToCancel?.tripName}</strong>?
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Lý do hủy <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Vui lòng nhập lý do hủy chuyến đi..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                rows="4"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirmCancel}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Xác nhận hủy
                            </button>
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setTripToCancel(null);
                                    setCancelReason('');
                                }}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}