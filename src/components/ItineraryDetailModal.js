import React from 'react';
import './ItineraryDetailModal.css';
import DailyRouteMap from './DailyRouteMap';

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

                                {/* Route Map */}
                                <DailyRouteMap 
                                    day={{
                                        activities: day.schedule?.map(item => ({
                                            location: item.activity,
                                            time: item.time,
                                            description: item.duration,
                                            address: item.address || (item.location?.address)
                                        })) || day.destinations?.map(dest => ({
                                            location: dest.name,
                                            time: dest.visitTime,
                                            description: dest.address,
                                            address: dest.address
                                        })) || []
                                    }}
                                    dayNumber={day.day}
                                    destination={itinerary.header?.destination?.main || itinerary.header?.destination}
                                />

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
                                                        {item.address && (
                                                            <div style={{ 
                                                                fontSize: '13px', 
                                                                color: '#3b82f6', 
                                                                marginTop: '4px',
                                                                fontWeight: '500'
                                                            }}>
                                                                📍 {item.address}
                                                            </div>
                                                        )}
                                                        {item.location?.address && !item.address && (
                                                            <div style={{ 
                                                                fontSize: '13px', 
                                                                color: '#3b82f6', 
                                                                marginTop: '4px',
                                                                fontWeight: '500'
                                                            }}>
                                                                📍 {item.location.address}
                                                            </div>
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
                            
                            {/* Intercity Transport */}
                            {itinerary.transport.intercity && (
                                <div className="transport-card">
                                    <h4>✈️ Di chuyển liên tỉnh</h4>
                                    
                                    {/* Departure */}
                                    {itinerary.transport.intercity.departure && (
                                        <div className="transport-route">
                                            <div className="flight-ticket">
                                                <div className="ticket-header">
                                                    <span className="ticket-icon">
                                                        {itinerary.transport.intercity.departure.recommended?.type === 'flight' ? '✈️' : '🚌'}
                                                    </span>
                                                    <span className="ticket-type">
                                                        {itinerary.transport.intercity.departure.recommended?.type === 'flight' ? 'Chuyến bay' : 'Xe khách'}
                                                    </span>
                                                </div>
                                                
                                                <div className="ticket-route">
                                                    <div className="route-point">
                                                        <div className="city-name">{itinerary.transport.intercity.departure.from}</div>
                                                        <div className="date-time">{itinerary.transport.intercity.departure.date}</div>
                                                    </div>
                                                    
                                                    <div className="route-line">
                                                        <div className="duration-badge">
                                                            {itinerary.transport.intercity.departure.recommended?.duration || 'N/A'}
                                                        </div>
                                                        <div className="arrow">→</div>
                                                    </div>
                                                    
                                                    <div className="route-point">
                                                        <div className="city-name">{itinerary.transport.intercity.departure.to}</div>
                                                    </div>
                                                </div>
                                                
                                                {itinerary.transport.intercity.departure.recommended && (
                                                    <div className="ticket-details">
                                                        {(itinerary.transport.intercity.departure.recommended.provider || itinerary.transport.intercity.departure.recommended.company) && (
                                                            <div className="detail-item">
                                                                <span className="label">Hãng:</span>
                                                                <span className="value">{itinerary.transport.intercity.departure.recommended.provider || itinerary.transport.intercity.departure.recommended.company}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.departure.recommended.flightNumber && (
                                                            <div className="detail-item">
                                                                <span className="label">Số hiệu:</span>
                                                                <span className="value">{itinerary.transport.intercity.departure.recommended.flightNumber}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.departure.recommended.comfort && (
                                                            <div className="detail-item">
                                                                <span className="label">Hạng vé:</span>
                                                                <span className="value">{itinerary.transport.intercity.departure.recommended.comfort}</span>
                                                            </div>
                                                        )}
                                                        {(itinerary.transport.intercity.departure.recommended.price || itinerary.transport.intercity.departure.recommended.cost) && (
                                                            <div className="detail-item price">
                                                                <span className="label">Giá vé ({typeof itinerary.header?.travelers === 'object' ? itinerary.header.travelers?.total || itinerary.header.travelers?.adults || 2 : itinerary.header?.travelers || 2} người):</span>
                                                                <span className="value">{formatMoney(itinerary.transport.intercity.departure.recommended.price || itinerary.transport.intercity.departure.recommended.cost)}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.departure.recommended.pricePerPerson && (
                                                            <div className="detail-item">
                                                                <span className="label">Giá/người:</span>
                                                                <span className="value">{formatMoney(itinerary.transport.intercity.departure.recommended.pricePerPerson)}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.departure.recommended.note && (
                                                            <div className="detail-note">
                                                                💡 {itinerary.transport.intercity.departure.recommended.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {itinerary.transport.intercity.departure.options && itinerary.transport.intercity.departure.options.length > 1 && (() => {
                                                // Lọc bỏ option đã được recommend
                                                const recommendedCompany = itinerary.transport.intercity.departure.recommended?.company;
                                                const otherOptions = itinerary.transport.intercity.departure.options.filter(
                                                    option => option.company !== recommendedCompany
                                                );
                                                
                                                if (otherOptions.length === 0) return null;
                                                
                                                return (
                                                    <details className="transport-options">
                                                        <summary>Xem thêm {otherOptions.length} tùy chọn khác</summary>
                                                        <div className="options-list">
                                                            {otherOptions.map((option, idx) => (
                                                                <div key={idx} className="option-item">
                                                                    <p><strong>{option.type}</strong></p>
                                                                    <p>⏱️ {option.duration} | 💰 {formatMoney(option.cost)}</p>
                                                                    {option.company && <p>🚌 {option.company}</p>}
                                                                    {option.note && <p>📝 Loại xe: {option.note.split('-')[1]?.trim() || option.note}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    
                                    {/* Return */}
                                    {itinerary.transport.intercity.return && (
                                        <div className="transport-route">
                                            <div className="flight-ticket return-ticket">
                                                <div className="ticket-header">
                                                    <span className="ticket-icon">
                                                        {itinerary.transport.intercity.return.recommended?.type === 'flight' ? '✈️' : '🚌'}
                                                    </span>
                                                    <span className="ticket-type">
                                                        {itinerary.transport.intercity.return.recommended?.type === 'flight' ? 'Chuyến bay về' : 'Xe khách về'}
                                                    </span>
                                                </div>
                                                
                                                <div className="ticket-route">
                                                    <div className="route-point">
                                                        <div className="city-name">{itinerary.transport.intercity.return.from}</div>
                                                        <div className="date-time">{itinerary.transport.intercity.return.date}</div>
                                                    </div>
                                                    
                                                    <div className="route-line">
                                                        <div className="duration-badge">
                                                            {itinerary.transport.intercity.return.recommended?.duration || 'N/A'}
                                                        </div>
                                                        <div className="arrow">→</div>
                                                    </div>
                                                    
                                                    <div className="route-point">
                                                        <div className="city-name">{itinerary.transport.intercity.return.to}</div>
                                                    </div>
                                                </div>
                                                
                                                {itinerary.transport.intercity.return.recommended && (
                                                    <div className="ticket-details">
                                                        {(itinerary.transport.intercity.return.recommended.provider || itinerary.transport.intercity.return.recommended.company) && (
                                                            <div className="detail-item">
                                                                <span className="label">Hãng:</span>
                                                                <span className="value">{itinerary.transport.intercity.return.recommended.provider || itinerary.transport.intercity.return.recommended.company}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.return.recommended.flightNumber && (
                                                            <div className="detail-item">
                                                                <span className="label">Số hiệu:</span>
                                                                <span className="value">{itinerary.transport.intercity.return.recommended.flightNumber}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.return.recommended.comfort && (
                                                            <div className="detail-item">
                                                                <span className="label">Hạng vé:</span>
                                                                <span className="value">{itinerary.transport.intercity.return.recommended.comfort}</span>
                                                            </div>
                                                        )}
                                                        {(itinerary.transport.intercity.return.recommended.price || itinerary.transport.intercity.return.recommended.cost) && (
                                                            <div className="detail-item price">
                                                                <span className="label">Giá vé ({typeof itinerary.header?.travelers === 'object' ? itinerary.header.travelers?.total || itinerary.header.travelers?.adults || 2 : itinerary.header?.travelers || 2} người):</span>
                                                                <span className="value">{formatMoney(itinerary.transport.intercity.return.recommended.price || itinerary.transport.intercity.return.recommended.cost)}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.return.recommended.pricePerPerson && (
                                                            <div className="detail-item">
                                                                <span className="label">Giá/người:</span>
                                                                <span className="value">{formatMoney(itinerary.transport.intercity.return.recommended.pricePerPerson)}</span>
                                                            </div>
                                                        )}
                                                        {itinerary.transport.intercity.return.recommended.note && (
                                                            <div className="detail-note">
                                                                💡 {itinerary.transport.intercity.return.recommended.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Local Transport */}
                            {itinerary.transport.local && (
                                <div className="transport-card">
                                    <h4>🚕 Di chuyển tại địa phương</h4>
                                    {itinerary.transport.local.recommended && (
                                        <div className="local-transport">
                                            <p><strong>Khuyến nghị:</strong> {
                                                typeof itinerary.transport.local.recommended === 'object' 
                                                    ? (itinerary.transport.local.recommended.name || itinerary.transport.local.recommended.type || 'Xe địa phương')
                                                    : itinerary.transport.local.recommended
                                            }</p>
                                            {itinerary.transport.local.recommended.costPerDay && (
                                                <p><strong>Chi phí/ngày:</strong> {formatMoney(itinerary.transport.local.recommended.costPerDay)}</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    {itinerary.transport.local.tips && itinerary.transport.local.tips.length > 0 && (
                                        <div className="transport-tips">
                                            <h5>💡 Lưu ý:</h5>
                                            <ul>
                                                {itinerary.transport.local.tips.map((tip, idx) => (
                                                    <li key={idx}>{tip}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    
                                    {itinerary.transport.local.apps && itinerary.transport.local.apps.length > 0 && (
                                        <div className="transport-apps">
                                            <p><strong>Ứng dụng đặt xe:</strong> {itinerary.transport.local.apps.join(', ')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Accommodation */}
                    {itinerary.accommodation && (
                        <div className="accommodation-section">
                            <h3>🏨 Lưu trú</h3>
                            <div className="accommodation-card">
                                {itinerary.accommodation.selected && (
                                    <>
                                        <h4>{itinerary.accommodation.selected.name || itinerary.accommodation.selected.type || 'Khách sạn'}</h4>
                                        {itinerary.accommodation.selected.rating && (
                                            <p>⭐ {itinerary.accommodation.selected.rating}/5</p>
                                        )}
                                        {itinerary.accommodation.selected.address && (
                                            <p>📍 {itinerary.accommodation.selected.address}</p>
                                        )}
                                        {itinerary.accommodation.selected.totalCost && (
                                            <p><strong>Chi phí:</strong> {formatMoney(itinerary.accommodation.selected.totalCost)}</p>
                                        )}
                                        {itinerary.accommodation.selected.costPerNight && (
                                            <p><strong>Giá/đêm:</strong> {formatMoney(itinerary.accommodation.selected.costPerNight)}</p>
                                        )}
                                    </>
                                )}
                                {itinerary.accommodation.duration && (
                                    <p><strong>Số đêm:</strong> {itinerary.accommodation.duration.nights} đêm</p>
                                )}
                                {itinerary.accommodation.options && itinerary.accommodation.options.length > 1 && (
                                    <details className="accommodation-options">
                                        <summary>Xem thêm {itinerary.accommodation.options.length - 1} tùy chọn khác</summary>
                                        <div className="options-list">
                                            {itinerary.accommodation.options.slice(1).map((hotel, idx) => (
                                                <div key={idx} className="option-item">
                                                    <p><strong>{hotel.name}</strong></p>
                                                    {hotel.rating && <p>⭐ {hotel.rating}/5</p>}
                                                    {hotel.totalCost && <p>💰 {formatMoney(hotel.totalCost)}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
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