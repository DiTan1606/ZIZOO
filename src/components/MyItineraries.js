import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserItineraries, deleteUserItinerary } from '../services/completeItineraryService';
import './MyItineraries.css';

const MyItineraries = () => {
    const { currentUser } = useAuth();
    const [itineraries, setItineraries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItinerary, setSelectedItinerary] = useState(null);

    useEffect(() => {
        if (currentUser) {
            loadUserItineraries();
        }
    }, [currentUser]);

    const loadUserItineraries = async () => {
        try {
            setLoading(true);
            const userItineraries = await getUserItineraries(currentUser.uid);
            setItineraries(userItineraries);
        } catch (error) {
            console.error('Error loading itineraries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItinerary = async (itineraryId) => {
        if (window.confirm('Bạn có chắc muốn xóa lịch trình này?')) {
            try {
                await deleteUserItinerary(currentUser.uid, itineraryId);
                await loadUserItineraries(); // Reload list
            } catch (error) {
                console.error('Error deleting itinerary:', error);
                alert('Có lỗi khi xóa lịch trình');
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const formatMoney = (amount) => {
        if (!amount) return 'N/A';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    if (!currentUser) {
        return (
            <div className="my-itineraries-container">
                <p>Vui lòng đăng nhập để xem lịch trình của bạn.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="my-itineraries-container">
                <div className="loading">Đang tải lịch trình...</div>
            </div>
        );
    }

    return (
        <div className="my-itineraries-container">
            <h2>Lịch Trình Của Tôi</h2>
            
            {itineraries.length === 0 ? (
                <div className="no-itineraries">
                    <p>Bạn chưa có lịch trình nào. Hãy tạo lịch trình đầu tiên!</p>
                </div>
            ) : (
                <div className="itineraries-grid">
                    {itineraries.map((itinerary) => (
                        <div key={itinerary.id} className="itinerary-card">
                            <div className="itinerary-header">
                                <h3>{itinerary.tripName}</h3>
                                <span className="destination">{itinerary.destination}</span>
                            </div>
                            
                            <div className="itinerary-details">
                                <div className="detail-row">
                                    <span className="label">Ngày bắt đầu:</span>
                                    <span>{formatDate(itinerary.startDate)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Thời gian:</span>
                                    <span>{itinerary.duration} ngày</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Số người:</span>
                                    <span>{typeof itinerary.travelers === 'object' ? itinerary.travelers?.total || itinerary.travelers?.adults || 2 : itinerary.travelers || 2} người</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Ngân sách ({typeof itinerary.travelers === 'object' ? itinerary.travelers?.total || itinerary.travelers?.adults || 2 : itinerary.travelers || 2} người):</span>
                                    <span>{formatMoney(itinerary.budget)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Chi phí/người:</span>
                                    <span>{formatMoney(Math.round(itinerary.budget / (typeof itinerary.travelers === 'object' ? itinerary.travelers?.total || itinerary.travelers?.adults || 2 : itinerary.travelers || 2)))}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Tạo lúc:</span>
                                    <span>{formatDate(itinerary.createdAt?.toDate?.() || itinerary.createdAt)}</span>
                                </div>
                            </div>
                            
                            <div className="itinerary-actions">
                                <button 
                                    className="view-btn"
                                    onClick={() => setSelectedItinerary(itinerary.fullItinerary)}
                                >
                                    Xem Chi Tiết
                                </button>
                                <button 
                                    className="delete-btn"
                                    onClick={() => handleDeleteItinerary(itinerary.itineraryId)}
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal hiển thị chi tiết lịch trình */}
            {selectedItinerary && (
                <div className="itinerary-modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{selectedItinerary.header?.tripName}</h3>
                            <button 
                                className="close-btn"
                                onClick={() => setSelectedItinerary(null)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="itinerary-summary">
                                <h4>Tổng Quan</h4>
                                <p><strong>Điểm đến:</strong> {selectedItinerary.header?.destination?.main}</p>
                                <p><strong>Thời gian:</strong> {selectedItinerary.header?.duration?.days} ngày</p>
                                <p><strong>Ngân sách:</strong> {formatMoney(selectedItinerary.header?.budget?.total)}</p>
                            </div>

                            <div className="daily-plans">
                                <h4>Lịch Trình Theo Ngày</h4>
                                {selectedItinerary.dailyItinerary?.map((day, index) => (
                                    <div key={index} className="day-plan">
                                        <h5>Ngày {day.day}: {day.theme}</h5>
                                        <div className="destinations">
                                            {day.destinations?.map((dest, destIndex) => (
                                                <div key={destIndex} className="destination-item">
                                                    <span className="dest-name">{dest.name}</span>
                                                    <span className="dest-time">{dest.visitTime}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="day-cost">
                                            Chi phí ước tính: {formatMoney(day.estimatedCost)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyItineraries;