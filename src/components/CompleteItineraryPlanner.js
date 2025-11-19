// src/components/CompleteItineraryPlanner.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createCompleteItinerary } from '../services/completeItineraryService';
import ItineraryAlertsPanel from './ItineraryAlertsPanel';
import DestinationSelector from './DestinationSelector';
import TripTypeSelector from './TripTypeSelector';
import WorkingLocationForm from './WorkingLocationForm';
import { WorkingLocation } from '../models/workingLocation';
import './CompleteItineraryPlanner.css';

// Import icons
import mapIcon from '../icon/map.png';
import quickIcon from '../icon/quick.png';

const CompleteItineraryPlanner = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [selectedDestinations, setSelectedDestinations] = useState([]);
    const [tripType, setTripType] = useState('pure-travel');
    const [showWorkingForm, setShowWorkingForm] = useState(false);
    // Get tomorrow's date for default
    const getTomorrowDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    const [preferences, setPreferences] = useState({
        tripType: 'pure-travel',
        destination: 'Vũng Tàu',
        departureCity: 'Hồ Chí Minh',
        startDate: getTomorrowDate(),
        startTime: '08:00', // Giờ bắt đầu hành trình du lịch (tại điểm đến)
        duration: 3,
        travelers: 2,
        budget: 3000000,
        travelStyle: 'standard',
        interests: ['food', 'photography', 'relaxation'],
        customDestinations: [] // Địa điểm do người dùng chọn
    });
    const [completeItinerary, setCompleteItinerary] = useState(null);
    const [selectedDepartureFlight, setSelectedDepartureFlight] = useState(null);
    const [selectedReturnFlight, setSelectedReturnFlight] = useState(null);

    const vietnamCities = [
        'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
        'Nha Trang', 'Đà Lạt', 'Phú Quốc', 'Hội An', 'Huế', 'Sapa',
        'Vũng Tàu', 'Quảng Ninh', 'Ninh Bình', 'Quy Nhon', 'Phan Thiết',
        'Mũi Né', 'Rạch Giá', 'Hạ Long', 'Tam Cốc', 'Bắc Ninh',
        'Thái Nguyên', 'Lào Cai', 'Điện Biên', 'Sơn La', 'Lai Châu',
        'Cao Bằng', 'Lạng Sơn', 'Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế',
        'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa',
        'Bình Thuận', 'Đồng Nai', 'Bà Rịa - Vũng Tàu', 'Long An', 'Tiền Giang',
        'Bến Tre', 'Trà Vinh', 'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Kiên Giang',
        'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Côn Đảo'
    ];

    const travelStyles = [
        { value: 'budget', name: 'Tiết kiệm', desc: 'Tối ưu chi phí, trải nghiệm cơ bản' },
        { value: 'standard', name: 'Trung bình', desc: 'Cân bằng chất lượng và giá cả' },
        { value: 'comfort', name: 'Thoải mái', desc: 'Tiện nghi tốt, dịch vụ chất lượng' },
        { value: 'luxury', name: 'Sang trọng', desc: 'Dịch vụ cao cấp, trải nghiệm đẳng cấp' }
    ];

    const interestOptions = [
        { value: 'culture', name: 'Văn hóa', icon: '🏛️' },
        { value: 'nature', name: 'Thiên nhiên', icon: '🌿' },
        { value: 'food', name: 'Ẩm thực', icon: '🍜' },
        { value: 'photography', name: 'Chụp ảnh', icon: '📸' },
        { value: 'adventure', name: 'Mạo hiểm', icon: '🏔️' },
        { value: 'relaxation', name: 'Thư giãn', icon: '🏖️' },
        { value: 'shopping', name: 'Mua sắm', icon: '🛍️' },
        { value: 'nightlife', name: 'Cuộc sống đêm', icon: '🌃' },
    ];

    const handleInputChange = (field, value) => {
        // Validation for number inputs
        if (field === 'duration') {
            value = Math.max(1, Math.min(30, parseInt(value) || 1));
        } else if (field === 'travelers') {
            value = Math.max(1, Math.min(50, parseInt(value) || 1));
        } else if (field === 'budget') {
            value = Math.max(1000000, parseInt(value) || 1000000);
        }
        
        setPreferences(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleInterestToggle = (interest) => {
        setPreferences(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };



    const handleDestinationsConfirm = (destinations) => {
        setSelectedDestinations(destinations);
        setPreferences(prev => ({
            ...prev,
            customDestinations: destinations
        }));
        setStep(3); // Chuyển sang bước xác nhận
    };

    // Handler cho trip type
    const handleTripTypeChange = (type) => {
        setTripType(type);
        setPreferences(prev => ({
            ...prev,
            tripType: type,
            workingLocations: type === 'pure-travel' ? [] : prev.workingLocations
        }));
    };

    // Helper function để lấy danh sách ngày
    const getTripDates = () => {
        const dates = [];
        const start = new Date(preferences.startDate);
        for (let i = 0; i < preferences.duration; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    };

    // Handler thêm working location
    const handleAddWorkingLocation = (formData) => {
        try {
            const newLocation = new WorkingLocation(formData);
            const validation = newLocation.validate();
            
            if (!validation.isValid) {
                toast.error(validation.errors.join(', '));
                return;
            }
            
            setPreferences(prev => ({
                ...prev,
                workingLocations: [...(prev.workingLocations || []), newLocation.toJSON()]
            }));
            
            setShowWorkingForm(false);
            toast.success(' Đã thêm địa điểm làm việc!');
        } catch (error) {
            toast.error('Lỗi: ' + error.message);
        }
    };

    // Handler xóa working location
    const handleRemoveWorkingLocation = (index) => {
        setPreferences(prev => ({
            ...prev,
            workingLocations: (prev.workingLocations || []).filter((_, i) => i !== index)
        }));
        toast.success('Đã xóa địa điểm làm việc!');
    };

    const generateItinerary = async () => {
        if (!currentUser) {
            toast.error('Vui lòng đăng nhập để tạo lịch trình!');
            return;
        }

        if (!preferences.destination || !preferences.startDate) {
            toast.error('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        setLoading(true);
        
        // Hiển thị toast loading với progress
        const loadingToast = toast.info(' Đang tạo lịch trình... Vui lòng đợi 5-10 giây', {
            autoClose: false,
            closeButton: false
        });
        
        try {
            // ⚡ Giảm timeout xuống 20s (đã tối ưu)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: Quá thời gian tạo lịch trình')), 20000)
            );
            
            const itineraryPromise = createCompleteItinerary(preferences, currentUser.uid);
            
            const itinerary = await Promise.race([itineraryPromise, timeoutPromise]);
            
            toast.dismiss(loadingToast);
            setCompleteItinerary(itinerary);
            setStep(4); // Chuyển sang step 4 để hiển thị kết quả
            toast.success(' Lịch trình hoàn chỉnh đã được tạo và lưu thành công!');
        } catch (error) {
            console.error('Lỗi tạo lịch trình:', error);
            toast.dismiss(loadingToast);
            
            if (error.message.includes('Timeout')) {
                toast.error(' Quá thời gian tạo lịch trình (20s). Vui lòng thử lại hoặc giảm số ngày xuống 3-5 ngày.', {
                    autoClose: 5000
                });
            } else {
                toast.error(`Lỗi: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHotel = (hotel) => {
        if (!completeItinerary) return;

        // Tính chênh lệch giá khách sạn
        const oldHotelCost = completeItinerary.accommodation.selected.totalCost;
        const newHotelCost = hotel.totalCost;
        const priceDifference = newHotelCost - oldHotelCost;

        // Cập nhật khách sạn đã chọn
        const updatedItinerary = {
            ...completeItinerary,
            accommodation: {
                ...completeItinerary.accommodation,
                selected: hotel
            },
            costBreakdown: {
                ...completeItinerary.costBreakdown,
                accommodation: {
                    ...completeItinerary.costBreakdown.accommodation,
                    total: newHotelCost,
                    perNight: hotel.pricePerNight
                },
                grandTotal: completeItinerary.costBreakdown.grandTotal + priceDifference
            },
            summary: {
                ...completeItinerary.summary,
                totalCost: completeItinerary.summary.totalCost + priceDifference,
                costPerPerson: Math.round((completeItinerary.summary.totalCost + priceDifference) / completeItinerary.summary.travelers)
            }
        };

        setCompleteItinerary(updatedItinerary);
        toast.success(`✅ Đã chọn ${hotel.name}. Giá tổng đã được cập nhật!`);
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
    };

    // Hàm chọn vé máy bay và cập nhật giá
    const handleSelectFlight = (flight, direction) => {
        if (direction === 'departure') {
            setSelectedDepartureFlight(flight);
        } else {
            setSelectedReturnFlight(flight);
        }
        
        // Cập nhật giá tổng
        if (completeItinerary) {
            const updatedItinerary = { ...completeItinerary };
            
            if (direction === 'departure') {
                updatedItinerary.transport.intercity.departure.recommended = flight;
            } else {
                updatedItinerary.transport.intercity.return.recommended = flight;
            }
            
            // Tính lại tổng chi phí
            const departurePrice = (direction === 'departure' ? flight : selectedDepartureFlight || updatedItinerary.transport.intercity.departure.recommended).pricePerPerson || 0;
            const returnPrice = (direction === 'return' ? flight : selectedReturnFlight || updatedItinerary.transport.intercity.return.recommended).pricePerPerson || 0;
            const travelers = updatedItinerary.header.travelers.total;
            
            const newTransportCost = (departurePrice + returnPrice) * travelers;
            const oldTransportCost = updatedItinerary.costBreakdown.transport.intercity;
            const difference = newTransportCost - oldTransportCost;
            
            updatedItinerary.costBreakdown.transport.intercity = newTransportCost;
            updatedItinerary.costBreakdown.transport.total += difference;
            updatedItinerary.costBreakdown.grandTotal += difference;
            updatedItinerary.costBreakdown.perPerson = Math.round(updatedItinerary.costBreakdown.grandTotal / travelers);
            
            setCompleteItinerary(updatedItinerary);
            toast.success(`Đã chọn chuyến bay ${flight.provider} ${flight.flightNumber || ''}`);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const printItinerary = () => {
        window.print();
    };

    const downloadItinerary = () => {
        const dataStr = JSON.stringify(completeItinerary, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${completeItinerary.header.tripName}.json`;
        link.click();
    };

    if (step === 1) {
        return (
            <div className="complete-itinerary-planner">
                <div className="header">
                    <h1>Tạo Lịch Trình Du Lịch Hoàn Chỉnh</h1>
                    <p>Lịch trình chi tiết với đầy đủ thông tin: lộ trình, chi phí, lưu trú, phương tiện, đồ đạc...</p>
                    
                    <div className="quick-test-section">
                        <p><strong>Quick Test:</strong> Đã điền sẵn: HCM → Vũng Tàu, ngày mai, 2 người, 3M VNĐ, 3N2Đ</p>
                        <button 
                            type="button" 
                            className="btn-quick-test"
                            onClick={() => setStep(2)}
                            style={{
                                background: 'linear-gradient(135deg, #FDB44B 0%, #FF8A5B 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                marginTop: '8px',
                                fontWeight: '600'
                            }}
                        >
                            Tạo ngay với thông tin mặc định
                        </button>
                    </div>
                </div>

                <div className="form-container">
                    <div className="form-section">
                        <h3> Thông tin cơ bản</h3>
                        <div className="form-row-two-cols">
                            <div className="form-group">
                                <label>Điểm khởi hành</label>
                                <input
                                    type="text"
                                    value={preferences.departureCity}
                                    onChange={(e) => handleInputChange('departureCity', e.target.value)}
                                    placeholder="Nhập điểm khởi hành..."
                                    list="departure-cities-list"
                                />
                                <datalist id="departure-cities-list">
                                    {vietnamCities.map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </datalist>
                                <small> Gợi ý: Hồ Chí Minh, Hà Nội, Đà Nẵng, Cần Thơ, Hải Phòng...</small>
                            </div>

                            <div className="form-group">
                                <label>Điểm đến</label>
                                <input
                                    type="text"
                                    value={preferences.destination}
                                    onChange={(e) => handleInputChange('destination', e.target.value)}
                                    placeholder="Nhập điểm đến..."
                                    list="destinations-list"
                                />
                                <datalist id="destinations-list">
                                    {vietnamCities.map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </datalist>
                                <small> Gợi ý: Vũng Tàu, Đà Lạt, Nha Trang, Phú Quốc, Hội An, Huế...</small>
                            </div>
                        </div>

                        <div className="form-row form-row-two-cols">
                            <div className="form-group">
                                <label>Ngày khởi hành</label>
                                <input 
                                    type="date"
                                    value={preferences.startDate}
                                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="form-group">
                                <label>Giờ bắt đầu tham quan</label>
                                <input 
                                    type="time"
                                    value={preferences.startTime}
                                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                                />
                                <div className="input-helper">
                                    Giờ bắt đầu hành trình (giả định đã đến nơi)
                                </div>
                            </div>
                        </div>

                        <div className="form-row form-row-two-cols">
                            <div className="form-group">
                                <label>Số ngày</label>
                                <div className="number-input-container">
                                    <input 
                                        type="number"
                                        value={preferences.duration}
                                        onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 1)}
                                        min="1"
                                        max="30"
                                        placeholder="Nhập số ngày..."
                                    />
                                    <div className="input-helper">
                                        {preferences.duration === 1 
                                            ? '1 ngày (đi trong ngày)' 
                                            : `${preferences.duration} ngày ${preferences.duration - 1} đêm`
                                        }
                                    </div>
                                </div>
                                <div className="quick-options">
                                    {[
                                        { days: 1, label: '1 ngày' },
                                        { days: 2, label: '2N1Đ' },
                                        { days: 3, label: '3N2Đ' },
                                        { days: 4, label: '4N3Đ' },
                                        { days: 7, label: '1 tuần' }
                                    ].map(({ days, label }) => (
                                        <button
                                            key={days}
                                            type="button"
                                            className={`quick-btn ${preferences.duration === days ? 'active' : ''}`}
                                            onClick={() => handleInputChange('duration', days)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Số người</label>
                                <div className="number-input-container">
                                    <input 
                                        type="number"
                                        value={preferences.travelers}
                                        onChange={(e) => handleInputChange('travelers', parseInt(e.target.value) || 1)}
                                        min="1"
                                        max="50"
                                        placeholder="Nhập số người..."
                                    />
                                    <div className="input-helper">
                                        {preferences.travelers === 1 ? '1 người (Solo travel)' : 
                                         preferences.travelers === 2 ? '2 người (Cặp đôi)' :
                                         preferences.travelers <= 4 ? `${preferences.travelers} người (Gia đình nhỏ)` :
                                         preferences.travelers <= 10 ? `${preferences.travelers} người (Nhóm bạn)` :
                                         `${preferences.travelers} người (Đoàn lớn)`}
                                    </div>
                                </div>
                                <div className="quick-options">
                                    {[
                                        { num: 1, label: 'Solo' },
                                        { num: 2, label: 'Cặp đôi' },
                                        { num: 4, label: 'Gia đình' },
                                        { num: 6, label: 'Nhóm nhỏ' },
                                        { num: 10, label: 'Nhóm lớn' }
                                    ].map(({ num, label }) => (
                                        <button
                                            key={num}
                                            type="button"
                                            className={`quick-btn ${preferences.travelers === num ? 'active' : ''}`}
                                            onClick={() => handleInputChange('travelers', num)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Ngân sách tổng (VNĐ)</label>
                            <input 
                                type="number"
                                value={preferences.budget}
                                onChange={(e) => handleInputChange('budget', parseInt(e.target.value))}
                                min="1000000"
                                step="500000"
                                placeholder="Nhập ngân sách..."
                            />
                            <div className="budget-suggestions">
                                {[2000000, 5000000, 10000000, 20000000, 50000000].map(amount => (
                                    <button
                                        key={amount}
                                        type="button"
                                        className={preferences.budget === amount ? 'active' : ''}
                                        onClick={() => handleInputChange('budget', amount)}
                                    >
                                        {formatMoney(amount)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3> Phong cách du lịch</h3>
                        <div className="travel-styles">
                            {travelStyles.map(style => (
                                <div 
                                    key={style.value}
                                    className={`travel-style ${preferences.travelStyle === style.value ? 'selected' : ''}`}
                                    onClick={() => handleInputChange('travelStyle', style.value)}
                                >
                                    <h4>{style.name}</h4>
                                    <p>{style.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-section">
                        <h3> Sở thích & Quan tâm</h3>
                        <div className="interests-grid-four-cols">
                            {interestOptions.map(interest => (
                                <div 
                                    key={interest.value}
                                    className={`interest-item ${preferences.interests.includes(interest.value) ? 'selected' : ''}`}
                                    onClick={() => handleInterestToggle(interest.value)}
                                >
                                    <span className="icon">{interest.icon}</span>
                                    <span className="name">{interest.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trip Type Selector - Đã di chuyển xuống đây */}
                    <div className="form-section">
                        <TripTypeSelector 
                            selectedType={tripType}
                            onTypeChange={handleTripTypeChange}
                        />

                        {/* Working Locations Section - Chỉ hiện khi chọn Công tác + Du lịch */}
                        {tripType === 'business-travel' && (
                            <div className="working-locations-section" style={{
                                marginTop: '25px',
                                padding: '20px',
                                background: 'rgba(102, 126, 234, 0.05)',
                                borderRadius: '12px',
                                border: '2px dashed rgba(102, 126, 234, 0.3)'
                            }}>
                                <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
                                     Địa điểm làm việc
                                </h4>
                                
                                {/* Danh sách working locations */}
                                {preferences.workingLocations && preferences.workingLocations.length > 0 && (
                                    <div style={{ marginBottom: '15px' }}>
                                        {preferences.workingLocations.map((loc, index) => (
                                            <div key={index} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '12px 15px',
                                                background: 'white',
                                                borderRadius: '8px',
                                                marginBottom: '10px',
                                                border: '1px solid #e8ecf1'
                                            }}>
                                                <div>
                                                    <strong style={{ color: '#2c3e50' }}>{loc.name}</strong>
                                                    <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                                                        ⏰ {loc.startTime} - {loc.endTime} | 
                                                        📅 {loc.isAllDays 
                                                            ? ' Tất cả các ngày' 
                                                            : ` ${loc.workingDays.length} ngày`}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveWorkingLocation(index)}
                                                    style={{
                                                        background: '#ff4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '50%',
                                                        width: '28px',
                                                        height: '28px',
                                                        cursor: 'pointer',
                                                        fontSize: '16px'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Button thêm */}
                                {!showWorkingForm && (
                                    <button 
                                        onClick={() => setShowWorkingForm(true)}
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            fontWeight: '600',
                                            width: '100%'
                                        }}
                                    >
                                        + Thêm địa điểm làm việc
                                    </button>
                                )}
                                
                                {/* Form */}
                                {showWorkingForm && (
                                    <WorkingLocationForm
                                        tripDates={getTripDates()}
                                        onAddWorkingLocation={handleAddWorkingLocation}
                                        onCancel={() => setShowWorkingForm(false)}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="form-actions">
                        <button 
                            className="next-btn"
                            onClick={() => setStep(2)}
                            disabled={!preferences.destination || !preferences.startDate}
                        >
                            Tiếp theo: Chọn địa điểm
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 2) {
        return (
            <DestinationSelector
                preferences={preferences}
                onConfirm={handleDestinationsConfirm}
                onBack={() => setStep(1)}
            />
        );
    }

    if (step === 3) {
        return (
            <div className="complete-itinerary-planner">
                <div className="header">
                    <h1> Xác nhận thông tin lịch trình</h1>
                    <p>Kiểm tra lại thông tin trước khi tạo lịch trình hoàn chỉnh</p>
                </div>

                <div className="preview-container">
                    <div className="preview-section">
                        <h3><strong>Thông tin chuyến đi</strong></h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <strong>Tuyến đường:</strong> {preferences.departureCity} → {preferences.destination}
                            </div>
                            <div className="info-item">
                                <strong>Thời gian:</strong> {formatDate(preferences.startDate)} ({preferences.duration} ngày {preferences.duration - 1} đêm)
                            </div>
                            <div className="info-item">
                                <strong>Số người:</strong> {preferences.travelers} người
                            </div>
                            <div className="info-item">
                                <strong>Phong cách:</strong> {travelStyles.find(s => s.value === preferences.travelStyle)?.name}
                            </div>
                            <div className="info-item">
                                <strong>Ngân sách:</strong> {formatMoney(preferences.budget)} ({formatMoney(Math.round(preferences.budget / preferences.travelers))}/người)
                            </div>
                            <div className="info-item">
                                <strong>Sở thích:</strong> {preferences.interests.map(i => 
                                    interestOptions.find(opt => opt.value === i)?.name || i
                                ).filter(Boolean).join(', ') || 'Không có'}
                            </div>
                            <div className="info-item">
                                <strong>Địa điểm đã chọn:</strong> {selectedDestinations.length} địa điểm
                            </div>
                        </div>
                    </div>

                    {selectedDestinations.length > 0 && (
                        <div className="preview-section">
                            <h3><strong>Địa điểm bạn đã chọn</strong></h3>
                            <div className="selected-destinations-preview">
                                {selectedDestinations.map((dest, index) => (
                                    <div key={dest.id} className="preview-destination-item">
                                        <span className="preview-number">{index + 1}</span>
                                        <div className="preview-info">
                                            <strong>{dest.name}</strong>
                                            {dest.preferredTime && (
                                                <span className="preview-time">⏰ {dest.preferredTime}</span>
                                            )}
                                            {dest.duration && (
                                                <span className="preview-duration">⏱️ {dest.duration}h</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="preview-section">
                        <h3><strong>Lịch trình sẽ bao gồm</strong></h3>
                        <div className="features-list">
                            <div className="feature-item">
                                <span className="icon">📋</span>
                                <div>
                                    <strong>1. Thông tin cơ bản (Header)</strong>
                                    <p>Tên chuyến đi, thời gian, số người, phong cách, ngân sách</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">📅</span>
                                <div>
                                    <strong>2. Lịch trình chi tiết theo từng ngày</strong>
                                    <p>Giờ giấc cụ thể, địa điểm tham quan, bữa ăn, hoạt động tự do</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">💰</span>
                                <div>
                                    <strong>3. Danh sách chi phí dự kiến</strong>
                                    <p>Vé máy bay/xe, khách sạn, ăn uống, tham quan, phát sinh</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">🚗</span>
                                <div>
                                    <strong>4. Phương tiện di chuyển</strong>
                                    <p>Từ điểm khởi hành đến điểm đến và di chuyển tại địa phương</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">🏨</span>
                                <div>
                                    <strong>5. Lưu trú</strong>
                                    <p>Gợi ý khách sạn/homestay phù hợp với ngân sách và phong cách</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">🎒</span>
                                <div>
                                    <strong>6. Danh sách đồ cần mang</strong>
                                    <p>Phù hợp với điểm đến, thời tiết và hoạt động</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">⚠️</span>
                                <div>
                                    <strong>7. Lưu ý quan trọng</strong>
                                    <p>Thời tiết, văn hóa, an toàn, số điện thoại khẩn cấp</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="icon">🗺️</span>
                                <div>
                                    <strong>8. Bản đồ và tối ưu lộ trình</strong>
                                    <p>Thứ tự di chuyển hợp lý, tiết kiệm thời gian</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="preview-actions">
                        <button 
                            className="back-btn"
                            onClick={() => setStep(2)}
                        >
                         Quay lại chọn địa điểm
                        </button>
                        <button 
                            className="generate-btn"
                            onClick={generateItinerary}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    <div style={{ marginLeft: '10px' }}>
                                        <div>Đang tạo lịch trình hoàn chỉnh...</div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '4px' }}>
                                             Vui lòng đợi 5-10 giây (đã tối ưu)
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                ' Tạo lịch trình hoàn chỉnh'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 4 && completeItinerary) {
        return (
            <div className="complete-itinerary-result">
                <div className="result-header no-print">
                    <h1> Lịch trình hoàn chỉnh đã sẵn sàng!</h1>
                </div>

                {/* Real-time Alerts Panel */}
                <div className="no-print">
                    <ItineraryAlertsPanel 
                        itineraryId={completeItinerary.id}
                        onAdjustmentAccepted={(alert, suggestion) => {
                            toast.info(`Đã áp dụng: ${suggestion}`);
                            // Có thể thêm logic để cập nhật lịch trình
                        }}
                    />
                </div>

                <div className="itinerary-content">
                    {/* 1. THÔNG TIN CƠ BẢN */}
                    <section className="itinerary-section">
                        <h2><strong> 1. Thông tin cơ bản</strong></h2>
                        <div className="header-info">
                            <h3 className="trip-title"><strong>{completeItinerary.header.tripName}</strong></h3>
                            <div className="basic-info">
                                <div className="info-row">
                                    <span><strong>Thời gian:</strong> {completeItinerary.header.duration.startDate} - {completeItinerary.header.duration.endDate}</span>
                                    <span><strong>Số người:</strong> {completeItinerary.header.travelers.total} người</span>
                                </div>
                                <div className="info-row">
                                    <span><strong>Phong cách:</strong> {completeItinerary.header.travelStyle.name}</span>
                                    <span><strong>Ngân sách:</strong> {formatMoney(completeItinerary.header.budget.total)}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Data Quality Badge */}
                    {completeItinerary.dataQuality && (
                        <section className="data-quality-badge no-print">
                            <div className="quality-indicator">
                                <span className="quality-icon">
                                    {completeItinerary.dataQuality.realTimeData ? '🟢' : '🟡'}
                                </span>
                                <div className="quality-info">
                                    <strong>Chất lượng dữ liệu: {completeItinerary.dataQuality.realTimeData ? 'Thời gian thực' : 'Cơ bản'}</strong>
                                    <div className="quality-details">
                                        <span>Địa điểm: {completeItinerary.dataQuality.placesSource}</span>
                                        <span>Thời tiết: {completeItinerary.dataQuality.weatherSource}</span>
                                        {completeItinerary.dataQuality.monitoringActive && (
                                            <span>🔍 Đang theo dõi thời gian thực</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 2. LỊCH TRÌNH CHI TIẾT */}
                    <section className="itinerary-section">
                        <h2><strong>2. Lịch trình chi tiết theo từng ngày</strong></h2>
                        {completeItinerary.dailyItinerary.map((day, index) => (
                            <div key={index} className="day-plan">
                                <div className="day-header">
                                    <h3><strong>Ngày {day.day}: {day.date} - {day.theme}</strong></h3>
                                    <span className="day-cost">Chi phí ước tính: {formatMoney(day.estimatedCost)}</span>
                                </div>

                                <div className="day-schedule">
                                    {day.schedule?.map((item, idx) => (
                                        <div key={idx} className="schedule-item">
                                            <div className="time">{item.time}</div>
                                            <div className="activity">
                                                <strong>{item.activity}</strong>
                                                {item.duration && <span className="duration">({item.duration})</span>}
                                                {item.notes && (
                                                    <ul className="notes">
                                                        {item.notes.map((note, noteIdx) => (
                                                            <li key={noteIdx}>{note}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {day.specialNotes && day.specialNotes.length > 0 && (
                                    <div className="day-notes">
                                        <strong>💡 Lưu ý đặc biệt:</strong>
                                        <ul>
                                            {day.specialNotes.map((note, noteIdx) => (
                                                <li key={noteIdx}>{note}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </section>

                    {/* 3. CHI PHÍ DỰ KIẾN */}
                    <section className="itinerary-section">
                        <h2><strong>3. Danh sách chi phí dự kiến</strong></h2>
                        <div className="cost-breakdown">
                            <div className="cost-category">
                                <h4><strong>Phương tiện di chuyển</strong></h4>
                                <div className="cost-details">
                                    <div className="cost-item">
                                        <span>Vé khứ hồi ({completeItinerary.transport?.intercity?.departure?.recommended?.type || 'N/A'})</span>
                                        <span>{formatMoney(completeItinerary.costBreakdown.transport.intercity)}</span>
                                    </div>
                                    <div className="cost-item">
                                        <span>Di chuyển tại địa phương</span>
                                        <span>{formatMoney(completeItinerary.costBreakdown.transport.local)}</span>
                                    </div>
                                    <div className="cost-subtotal">
                                        <span><strong>Tổng phương tiện:</strong></span>
                                        <span><strong>{formatMoney(completeItinerary.costBreakdown.transport.total)}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="cost-category">
                                <h4><strong>Lưu trú</strong></h4>
                                <div className="cost-details">
                                    <div className="cost-item">
                                        <span>{completeItinerary.costBreakdown?.accommodation?.type || 'Khách sạn'} ({completeItinerary.costBreakdown?.accommodation?.nights || 0} đêm)</span>
                                        <span>{formatMoney(completeItinerary.costBreakdown.accommodation.total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="cost-category">
                                <h4><strong>Ăn uống</strong></h4>
                                <div className="cost-details">
                                    <div className="cost-item">
                                        <span>Ăn uống ({completeItinerary.header.duration.days} ngày)</span>
                                        <span>{formatMoney(completeItinerary.costBreakdown.food.total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="cost-category">
                                <h4><strong>Tham quan</strong></h4>
                                <div className="cost-details">
                                    <div className="cost-item">
                                        <span>Vé tham quan, hoạt động</span>
                                        <span>{formatMoney(completeItinerary.costBreakdown.sightseeing.total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="cost-category">
                                <h4><strong>Chi phí phát sinh</strong></h4>
                                <div className="cost-details">
                                    <div className="cost-item">
                                        <span>Dự phòng ({completeItinerary.costBreakdown.contingency.percentage}%)</span>
                                        <span>{formatMoney(completeItinerary.costBreakdown.contingency.amount)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="cost-total">
                                <div className="total-row">
                                    <span><strong>TỔNG CỘNG ({completeItinerary.summary.totalDays} ngày, {completeItinerary.preferences.travelers} người):</strong></span>
                                    <span><strong>{formatMoney(completeItinerary.costBreakdown.grandTotal)}</strong></span>
                                </div>
                                <div className="per-person">
                                    <span>Chi phí/người: {formatMoney(completeItinerary.costBreakdown.perPerson)}</span>
                                </div>
                                <div className={`budget-status ${completeItinerary.costBreakdown.budgetStatus.withinBudget ? 'within' : 'over'}`}>
                                    {completeItinerary.costBreakdown.budgetStatus.withinBudget ? 
                                        `Trong ngân sách (còn lại ${formatMoney(completeItinerary.costBreakdown.budgetStatus.difference)})` :
                                        `Vượt ngân sách ${formatMoney(Math.abs(completeItinerary.costBreakdown.budgetStatus.difference))}`
                                    }
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 4. PHƯƠNG TIỆN DI CHUYỂN */}
                    <section className="itinerary-section">
                        <h2><strong>4. Phương tiện di chuyển</strong></h2>
                        <div className="transport-plan">
                            {/* Lượt đi */}
                            <div className="transport-category">
                                <h4>Lượt đi: {completeItinerary.header.destination.departure} → {completeItinerary.header.destination.main}</h4>
                                <p><strong>📅 Ngày:</strong> {completeItinerary.transport.intercity.departure.date}</p>
                                
                                {/* Hiển thị TẤT CẢ các options để chọn */}
                                {completeItinerary.transport?.intercity?.departure?.options && completeItinerary.transport.intercity.departure.options.length > 0 && (
                                    <div className="flights-selection">
                                        <p><strong>Chọn phương tiện:</strong></p>
                                        <div className="flights-grid">
                                            {completeItinerary.transport.intercity.departure.options.map((option, idx) => {
                                                if (!option) return null;
                                                const currentSelected = selectedDepartureFlight || completeItinerary.transport?.intercity?.departure?.recommended || {};
                                                
                                                // So sánh chính xác: ưu tiên flightNumber, sau đó company
                                                let isSelected = false;
                                                if (option.flightNumber && currentSelected.flightNumber) {
                                                    isSelected = option.flightNumber === currentSelected.flightNumber;
                                                } else if (option.company && currentSelected.company) {
                                                    isSelected = option.company === currentSelected.company;
                                                } else if (option.provider && currentSelected.provider) {
                                                    isSelected = option.provider === currentSelected.provider;
                                                }
                                                
                                                const isFlight = option?.type === 'flight';
                                                const displayName = option?.provider || option?.company || option?.name || 'N/A';
                                                
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className={`flight-option-card ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => handleSelectFlight(option, 'departure')}
                                                    >
                                                        {isSelected && <span className="badge-selected">✓ Đã chọn</span>}
                                                        <p><strong>{isFlight ? '✈️ ' : '🚌 '}{displayName}</strong></p>
                                                        {option.flightNumber && <p className="flight-number">{option.flightNumber}</p>}
                                                        <p className="flight-time">⏱️ {option.duration || 'N/A'}</p>
                                                        {option.departure && option.arrival && (
                                                            <p className="flight-schedule">🕐 {option.departure} → {option.arrival}</p>
                                                        )}
                                                        <p className="flight-price">💰 {formatMoney(option.pricePerPerson || option.cost || 0)}/người</p>
                                                        {option.estimated && <p className="estimated-badge">Giá ước tính</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Lượt về */}
                            <div className="transport-category">
                                <h4> Lượt về: {completeItinerary.header.destination.main} → {completeItinerary.header.destination.departure}</h4>
                                <p><strong>📅 Ngày:</strong> {completeItinerary.transport.intercity.return.date}</p>
                                
                                {/* Hiển thị TẤT CẢ các options để chọn */}
                                {completeItinerary.transport?.intercity?.return?.options && completeItinerary.transport.intercity.return.options.length > 0 && (
                                    <div className="flights-selection">
                                        <p><strong>Chọn phương tiện:</strong></p>
                                        <div className="flights-grid">
                                            {completeItinerary.transport.intercity.return.options.map((option, idx) => {
                                                if (!option) return null;
                                                const currentSelected = selectedReturnFlight || completeItinerary.transport?.intercity?.return?.recommended || {};
                                                
                                                // So sánh chính xác: ưu tiên flightNumber, sau đó company
                                                let isSelected = false;
                                                if (option.flightNumber && currentSelected.flightNumber) {
                                                    isSelected = option.flightNumber === currentSelected.flightNumber;
                                                } else if (option.company && currentSelected.company) {
                                                    isSelected = option.company === currentSelected.company;
                                                } else if (option.provider && currentSelected.provider) {
                                                    isSelected = option.provider === currentSelected.provider;
                                                }
                                                
                                                const isFlight = option?.type === 'flight';
                                                const displayName = option?.provider || option?.company || option?.name || 'N/A';
                                                
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className={`flight-option-card ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => handleSelectFlight(option, 'return')}
                                                    >
                                                        {isSelected && <span className="badge-selected">✓ Đã chọn</span>}
                                                        <p><strong>{isFlight ? '✈️ ' : '🚌 '}{displayName}</strong></p>
                                                        {option.flightNumber && <p className="flight-number">{option.flightNumber}</p>}
                                                        <p className="flight-time">⏱️ {option.duration || 'N/A'}</p>
                                                        {option.departure && option.arrival && (
                                                            <p className="flight-schedule">🕐 {option.departure} → {option.arrival}</p>
                                                        )}
                                                        <p className="flight-price">💰 {formatMoney(option.pricePerPerson || option.cost || 0)}/người</p>
                                                        {option.estimated && <p className="estimated-badge">Giá ước tính</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Di chuyển địa phương */}
                            <div className="transport-category">
                                <h4>Di chuyển tại {completeItinerary.header.destination.main}</h4>
                                <p><strong>Khuyến nghị:</strong> {completeItinerary.transport?.local?.recommended?.name || completeItinerary.transport?.local?.recommended?.type || 'N/A'}</p>
                                <p><strong>Chi phí:</strong> {formatMoney(completeItinerary.transport.local.recommended.costPerDay)}/ngày</p>
                                {completeItinerary.transport.local.apps && completeItinerary.transport.local.apps.length > 0 && (
                                    <div className="transport-apps">
                                        <strong>Apps hữu ích:</strong> {completeItinerary.transport.local.apps.join(', ')}
                                    </div>
                                )}
                                {completeItinerary.transport.local.tips && completeItinerary.transport.local.tips.length > 0 && (
                                    <div className="transport-tips">
                                        <strong>Lưu ý:</strong>
                                        <ul>
                                            {completeItinerary.transport.local.tips.slice(0, 3).map((tip, idx) => (
                                                <li key={idx}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* 5. LƯU TRÚ */}
                    <section className="itinerary-section">
                        <h2><strong>5. Lưu trú</strong></h2>
                        <div className="accommodation-plan">
                            {/* Khách sạn đã chọn */}
                            {completeItinerary.accommodation.selected && (
                                <div className="accommodation-selected">
                                    <h4>Khách sạn đã chọn</h4>
                                    <div className="hotel-card selected">
                                        <h5>{completeItinerary.accommodation.selected.name}</h5>
                                        <p><strong>Rating:</strong> {completeItinerary.accommodation.selected.rating}/5</p>
                                        <p><strong>Vị trí:</strong> {completeItinerary.accommodation.selected.location}</p>
                                        <p><strong>Giá:</strong> {formatMoney(completeItinerary.accommodation.selected.pricePerNight)}/đêm</p>
                                        <p><strong>Tổng:</strong> {formatMoney(completeItinerary.accommodation.selected.totalCost)} ({completeItinerary.accommodation.duration.nights} đêm)</p>
                                        <p><strong>Tiện nghi:</strong> {completeItinerary.accommodation.selected.amenities.join(', ')}</p>
                                    </div>
                                    <p><strong>Thời gian:</strong> {completeItinerary.accommodation.duration.checkIn} - {completeItinerary.accommodation.duration.checkOut}</p>
                                </div>
                            )}
                            
                            {/* Các tùy chọn khác */}
                            {completeItinerary.accommodation.options && completeItinerary.accommodation.options.length > 0 && (
                                <div className="accommodation-options">
                                    <h4>Các tùy chọn khác</h4>
                                    <div className="hotels-grid">
                                        {completeItinerary.accommodation.options
                                            .filter(hotel => hotel.name !== completeItinerary.accommodation.selected?.name)
                                            .map((hotel, idx) => (
                                            <div key={idx} className="hotel-card">
                                                <h5>{hotel.name}</h5>
                                                <p>⭐ {hotel.rating}/5</p>
                                                <p>📍 {hotel.location}</p>
                                                <p>💰 {formatMoney(hotel.pricePerNight)}/đêm</p>
                                                <p>💵 Tổng: {formatMoney(hotel.totalCost)}</p>
                                                <button 
                                                    className="btn-select-hotel"
                                                    onClick={() => handleSelectHotel(hotel)}
                                                >
                                                    Chọn khách sạn này
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Nền tảng đặt phòng */}
                            <div className="booking-platforms">
                                <h4>Đặt phòng qua</h4>
                                <div className="platforms-list">
                                    {completeItinerary.accommodation.bookingPlatforms.map((platform, idx) => (
                                        <a key={idx} href={platform.url} target="_blank" rel="noopener noreferrer" className="platform-link">
                                            {platform.name}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 6. DANH SÁCH ĐỒ CẦN MANG */}
                    <section className="itinerary-section">
                        <h2><strong>6. Danh sách đồ cần mang</strong></h2>
                        <div className="packing-list">
                            <div className="packing-category">
                                <h4>Đồ cần thiết</h4>
                                <ul>
                                    {completeItinerary.packingList.essential.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="packing-category">
                                <h4>Quần áo</h4>
                                <ul>
                                    {completeItinerary.packingList.clothing.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="packing-category">
                                <h4>Đồ điện tử</h4>
                                <ul>
                                    {completeItinerary.packingList.electronics.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="packing-category">
                                <h4>Đồ vệ sinh</h4>
                                <ul>
                                    {completeItinerary.packingList.toiletries.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            {completeItinerary.packingList.optional.length > 0 && (
                                <div className="packing-category">
                                    <h4>Đồ tùy chọn</h4>
                                    <ul>
                                        {completeItinerary.packingList.optional.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="packing-category prohibited">
                                <h4>Đồ không được mang</h4>
                                <ul>
                                    {completeItinerary.packingList.prohibited.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 7. LƯU Ý QUAN TRỌNG */}
                    <section className="itinerary-section">
                        <h2><strong>7. Lưu ý quan trọng</strong></h2>
                        <div className="important-notes">
                            {Object.entries(completeItinerary.importantNotes).map(([category, notes]) => (
                                <div key={category} className="notes-category">
                                    <h4>{getCategoryIcon(category)} {getCategoryName(category)}</h4>
                                    {Array.isArray(notes) ? (
                                        <ul>
                                            {notes.map((note, idx) => (
                                                <li key={idx}>{note}</li>
                                            ))}
                                        </ul>
                                    ) : typeof notes === 'object' && notes !== null ? (
                                        <div className="object-notes">
                                            {Object.entries(notes).map(([key, value]) => (
                                                <p key={key}><strong>{key}:</strong> {value}</p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>{notes}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 8. BẢN ĐỒ VÀ LỘ TRÌNH */}
                    <section className="itinerary-section">
                        <h2><strong>8. Bản đồ và tối ưu lộ trình</strong></h2>
                        <div className="route-optimization">
                            <div className="route-overview">
                                <h4>Tổng quan lộ trình</h4>
                                <p><strong>Tổng số điểm đến:</strong> {completeItinerary.routeOptimization.overview.totalDestinations}</p>
                                <p><strong>Chiến lược tối ưu:</strong> {completeItinerary.routeOptimization.overview.optimizationStrategy}</p>
                            </div>

                            <div className="route-tips">
                                <h4>Mẹo di chuyển</h4>
                                <ul>
                                    {completeItinerary.routeOptimization.tips.map((tip, idx) => (
                                        <li key={idx}>{tip}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    return null;
};

// Helper functions
const getCategoryIcon = (category) => {
    const icons = {
        weather: '🌤️',
        culture: '🏛️',
        safety: '🛡️',
        health: '🏥',
        emergency: '🚨',
        business: '🕐',
        currency: '💱',
        language: '🗣️',
        customs: '📋'
    };
    return icons[category] || '📝';
};

const getCategoryName = (category) => {
    const names = {
        weather: 'Thời tiết',
        culture: 'Văn hóa địa phương',
        safety: 'An toàn',
        health: 'Y tế',
        emergency: 'Khẩn cấp',
        business: 'Giờ mở cửa',
        currency: 'Tiền tệ',
        language: 'Ngôn ngữ',
        customs: 'Phong tục'
    };
    return names[category] || category;
};

export default CompleteItineraryPlanner;