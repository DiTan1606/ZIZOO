import React from 'react';
import './ItineraryDetailModal.css';

const ItineraryDetailModal = ({ itinerary, onClose }) => {
    if (!itinerary) return null;

    const formatMoney = (amount) => {
        if (!amount) return 'N/A';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        
        try {
            let date;
            
            // Xử lý Firestore Timestamp
            if (dateInput.toDate && typeof dateInput.toDate === 'function') {
                date = dateInput.toDate();
            }
            // Xử lý Date object
            else if (dateInput instanceof Date) {
                date = dateInput;
            }
            // Xử lý string format vi-VN (dd/mm/yyyy)
            else if (typeof dateInput === 'string' && dateInput.includes('/')) {
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
                date = new Date(dateInput);
            }
            
            // Kiểm tra date hợp lệ
            if (isNaN(date.getTime())) {
                console.warn('Invalid date in modal:', dateInput);
                return 'N/A';
            }
            
            return date.toLocaleDateString('vi-VN');
        } catch (error) {
            console.error('Error formatting date in modal:', error, dateInput);
            return 'N/A';
        }
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        return timeString.substring(0, 5); // "HH:MM"
    };

    return (
        <div className="itinerary-modal-overlay" onClick={onClose}>
            <div className="itinerary-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-info">
                        <h1>{itinerary.header?.tripName || 'Lịch trình du lịch'}</h1>
                        <div className="trip-meta">
                            <span className="destination">📍 {itinerary.header?.destination?.main}</span>
                            <span className="duration">📅 {itinerary.header?.duration?.days} ngày {itinerary.header?.duration?.days - 1} đêm</span>
                            <span className="travelers">👥 {typeof itinerary.header?.travelers === 'object' ? itinerary.header.travelers?.total || itinerary.header.travelers?.adults || 2 : itinerary.header?.travelers || 2} người</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {/* Trip Summary */}
                    <div className="trip-summary">
                        <div className="summary-card">
                            <h3>💰 Tổng quan chi phí</h3>
                            <div className="cost-breakdown">
                                <div className="cost-item">
                                    <span>Tổng chi phí:</span>
                                    <span className="cost-value">{formatMoney(itinerary.costBreakdown?.grandTotal)}</span>
                                </div>
                                <div className="cost-item">
                                    <span>Chi phí/người:</span>
                                    <span className="cost-value">{formatMoney(itinerary.costBreakdown?.perPerson)}</span>
                                </div>
                                <div className="cost-item">
                                    <span>Ngân sách:</span>
                                    <span className="budget-value">{formatMoney(itinerary.header?.budget?.total)}</span>
                                </div>
                                {itinerary.costBreakdown?.budgetStatus && (
                                    <div className={`budget-status ${itinerary.costBreakdown.budgetStatus.withinBudget ? 'within' : 'over'}`}>
                                        {itinerary.costBreakdown.budgetStatus.withinBudget ? 
                                            `✅ Trong ngân sách (còn lại ${formatMoney(itinerary.costBreakdown.budgetStatus.difference)})` :
                                            `⚠️ Vượt ngân sách ${formatMoney(Math.abs(itinerary.costBreakdown.budgetStatus.difference))}`
                                        }
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="summary-card">
                            <h3>🎯 Thông tin chuyến đi</h3>
                            <div className="trip-info">
                                <div className="info-item">
                                    <span>Ngày khởi hành:</span>
                                    <span>{formatDate(itinerary.header?.duration?.startDate)}</span>
                                </div>
                                <div className="info-item">
                                    <span>Phong cách du lịch:</span>
                                    <span>{typeof itinerary.header?.travelStyle === 'object' ? itinerary.header.travelStyle?.name || 'Standard' : itinerary.header?.travelStyle || 'Standard'}</span>
                                </div>
                                <div className="info-item">
                                    <span>Sở thích:</span>
                                    <span>{itinerary.header?.interests?.map(interest => 
                                        typeof interest === 'object' ? interest.name || interest.description || interest.type : interest
                                    ).join(', ') || 'Không có thông tin'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Itinerary */}
                    <div className="daily-itinerary">
                        <h3>📅 Lịch trình theo ngày</h3>
                        {itinerary.dailyItinerary?.map((day, index) => (
                            <div key={index} className="day-card">
                                <div className="day-header">
                                    <h4>Ngày {day.day} - {formatDate(day.date)}</h4>
                                    <span className="day-theme">{day.theme}</span>
                                    <span className="day-cost">{formatMoney(day.estimatedCost)}</span>
                                </div>

                                {/* Weather */}
                                {day.weather && (
                                    <div className="weather-info">
                                        <span className="weather-temp">🌡️ {day.weather.temperature}°C</span>
                                        <span className="weather-desc">{day.weather.description}</span>
                                        {day.weather.rainfall && (
                                            <span className="weather-rain">🌧️ {day.weather.rainfall}mm</span>
                                        )}
                                    </div>
                                )}

                                {/* Schedule */}
                                {day.schedule && day.schedule.length > 0 && (
                                    <div className="day-schedule">
                                        <h5>⏰ Lịch trình theo giờ</h5>
                                        <div className="schedule-list">
                                            {day.schedule.map((item, scheduleIndex) => (
                                                <div key={scheduleIndex} className="schedule-item">
                                                    <span className="schedule-time">{formatTime(item.time)}</span>
                                                    <div className="schedule-content">
                                                        <span className="schedule-activity">{item.activity}</span>
                                                        {item.duration && (
                                                            <span className="schedule-duration">({item.duration})</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Destinations */}
                                {day.destinations && day.destinations.length > 0 && (
                                    <div className="destinations">
                                        <h5>📍 Địa điểm tham quan</h5>
                                        <div className="destinations-grid">
                                            {day.destinations.map((dest, destIndex) => (
                                                <div key={destIndex} className="destination-card">
                                                    <div className="dest-header">
                                                        <h6>{dest.name}</h6>
                                                        {dest.rating && (
                                                            <span className="dest-rating">⭐ {dest.rating}</span>
                                                        )}
                                                    </div>
                                                    {dest.address && (
                                                        <p className="dest-address">📍 {dest.address}</p>
                                                    )}
                                                    {dest.visitTime && (
                                                        <p className="dest-time">⏱️ Thời gian: {dest.visitTime}</p>
                                                    )}
                                                    {dest.entryFee && (
                                                        <p className="dest-fee">💰 Phí: {formatMoney(dest.entryFee)}</p>
                                                    )}
                                                    {dest.notes && dest.notes.length > 0 && (
                                                        <div className="dest-notes">
                                                            {dest.notes.map((note, noteIndex) => (
                                                                <span key={noteIndex} className="note-tag">
                                                                    {typeof note === 'object' ? note.description || note.name || note.type || 'Ghi chú' : note}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Meals */}
                                {day.meals && (
                                    <div className="meals">
                                        <h5>🍽️ Bữa ăn</h5>
                                        <div className="meals-grid">
                                            {day.meals.breakfast && (
                                                <div className="meal-card">
                                                    <h6>🌅 Sáng: {day.meals.breakfast.name}</h6>
                                                    <p>{day.meals.breakfast.address}</p>
                                                    {day.meals.breakfast.estimatedCost && (
                                                        <span className="meal-cost">{formatMoney(day.meals.breakfast.estimatedCost)}</span>
                                                    )}
                                                </div>
                                            )}
                                            {day.meals.lunch && (
                                                <div className="meal-card">
                                                    <h6>☀️ Trưa: {day.meals.lunch.name}</h6>
                                                    <p>{day.meals.lunch.address}</p>
                                                    {day.meals.lunch.estimatedCost && (
                                                        <span className="meal-cost">{formatMoney(day.meals.lunch.estimatedCost)}</span>
                                                    )}
                                                </div>
                                            )}
                                            {day.meals.dinner && (
                                                <div className="meal-card">
                                                    <h6>🌙 Tối: {day.meals.dinner.name}</h6>
                                                    <p>{day.meals.dinner.address}</p>
                                                    {day.meals.dinner.estimatedCost && (
                                                        <span className="meal-cost">{formatMoney(day.meals.dinner.estimatedCost)}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Special Notes */}
                                {day.specialNotes && day.specialNotes.length > 0 && (
                                    <div className="special-notes">
                                        <h5>📝 Lưu ý đặc biệt</h5>
                                        <ul>
                                            {day.specialNotes.map((note, noteIndex) => (
                                                <li key={noteIndex}>
                                                    {typeof note === 'object' ? note.description || note.name || note.type || 'Lưu ý' : note}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Transport Plan */}
                    {itinerary.transport && (
                        <div className="transport-section">
                            <h3>🚗 Phương tiện di chuyển</h3>
                            <div className="transport-cards">
                                {itinerary.transport.intercity && (
                                    <div className="transport-card">
                                        <h4>✈️ Di chuyển liên tỉnh</h4>
                                        <p><strong>Phương tiện:</strong> {itinerary.transport.intercity.method}</p>
                                        <p><strong>Chi phí:</strong> {formatMoney(itinerary.transport.intercity.cost)}</p>
                                        {itinerary.transport.intercity.details && (
                                            <p><strong>Chi tiết:</strong> {itinerary.transport.intercity.details}</p>
                                        )}
                                    </div>
                                )}
                                {itinerary.transport.local && (
                                    <div className="transport-card">
                                        <h4>🚕 Di chuyển địa phương</h4>
                                        <p><strong>Phương tiện:</strong> {itinerary.transport.local.method}</p>
                                        <p><strong>Chi phí:</strong> {formatMoney(itinerary.transport.local.cost)}</p>
                                        {itinerary.transport.local.details && (
                                            <p><strong>Chi tiết:</strong> {itinerary.transport.local.details}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Accommodation */}
                    {itinerary.accommodation && (
                        <div className="accommodation-section">
                            <h3>🏨 Lưu trú</h3>
                            <div className="accommodation-card">
                                <h4>{itinerary.accommodation.type}</h4>
                                <p><strong>Chi phí:</strong> {formatMoney(itinerary.accommodation.totalCost)}</p>
                                <p><strong>Số đêm:</strong> {itinerary.accommodation.nights} đêm</p>
                                {itinerary.accommodation.recommendations && (
                                    <div className="accommodation-recommendations">
                                        <h5>Gợi ý khách sạn:</h5>
                                        <ul>
                                            {itinerary.accommodation.recommendations.map((hotel, index) => (
                                                <li key={index}>{hotel}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Packing List */}
                    {itinerary.packingList && (
                        <div className="packing-section">
                            <h3>🎒 Danh sách đồ cần mang</h3>
                            <div className="packing-categories">
                                {Object.entries(itinerary.packingList).map(([category, items]) => (
                                    <div key={category} className="packing-category">
                                        <h4>{category}</h4>
                                        <ul>
                                            {items.map((item, index) => (
                                                <li key={index}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ItineraryDetailModal;