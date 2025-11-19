// src/components/PersonalizedRecommendations.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { generatePersonalizedItinerary, recordUserFeedback, getRecommendationExplanation } from '../services/recommendationService';
import './PersonalizedRecommendations.css';
import Footer from '../components/Footer';

const PersonalizedRecommendations = () => {
    const { currentUser } = useAuth();
    const [preferences, setPreferences] = useState({
        month: new Date().getMonth() + 1,
        provinces: [],
        types: [],
        budget: 5000000,
        adventureLevel: 3,
        ecoFriendly: false,
        maxDestinations: 8
    });
    
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alerts, setAlerts] = useState('');
    const [showExplanations, setShowExplanations] = useState(true);
    const [feedbackMode, setFeedbackMode] = useState(false);

    const provinces = [
        'Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
        'Quảng Ninh', 'Lào Cai', 'Điện Biên', 'Lai Châu', 'Sơn La',
        'Hòa Bình', 'Thái Nguyên', 'Lạng Sơn', 'Bắc Kạn', 'Cao Bằng',
        'Hà Giang', 'Phú Thọ', 'Vĩnh Phúc', 'Bắc Ninh', 'Hải Dương',
        'Hưng Yên', 'Hà Nam', 'Nam Định', 'Thái Bình', 'Ninh Bình',
        'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị',
        'Thừa Thiên Huế', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định',
        'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum',
        'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng', 'Bình Phước',
        'Tây Ninh', 'Bình Dương', 'Đồng Nai', 'Bà Rịa - Vũng Tàu',
        'Long An', 'Tiền Giang', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long',
        'Đồng Tháp', 'An Giang', 'Kiên Giang', 'Hậu Giang', 'Sóc Trăng',
        'Bạc Liêu', 'Cà Mau'
    ];

    const tripTypes = [
        'Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực', 'Gia đình', 'Một mình'
    ];

    const handlePreferenceChange = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleArrayPreferenceChange = (key, value, checked) => {
        setPreferences(prev => ({
            ...prev,
            [key]: checked 
                ? [...prev[key], value]
                : prev[key].filter(item => item !== value)
        }));
    };

    const generateRecommendations = async () => {
        if (!currentUser) {
            alert('Vui lòng đăng nhập để sử dụng tính năng gợi ý cá nhân hóa');
            return;
        }

        setLoading(true);
        try {
            const result = await generatePersonalizedItinerary(preferences, currentUser.uid);
            setRecommendations(result.destinations || []);
            setAlerts(result.alerts || '');
            
            console.log('Personalized recommendations generated:', {
                total: result.totalRecommendations,
                safe: result.safeRecommendations,
                isPersonalized: result.isPersonalized
            });
        } catch (error) {
            console.error('Error generating recommendations:', error);
            alert('Có lỗi xảy ra khi tạo gợi ý. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleFeedback = async (destination, rating) => {
        if (!currentUser) return;

        try {
            await recordUserFeedback(currentUser.uid, destination.id || destination.MainDestination, rating, {
                destination,
                userPreferences: preferences,
                timestamp: new Date()
            });
            
            // Update UI to show feedback was recorded
            setRecommendations(prev => prev.map(rec => 
                rec.id === destination.id || rec.MainDestination === destination.MainDestination
                    ? { ...rec, userRating: rating, feedbackGiven: true }
                    : rec
            ));
            
            alert('Cảm ơn phản hồi của bạn! Hệ thống sẽ học hỏi để cải thiện gợi ý.');
        } catch (error) {
            console.error('Error recording feedback:', error);
            alert('Có lỗi khi ghi nhận phản hồi.');
        }
    };

    const getRatingStars = (rating) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 0; i < fullStars; i++) {
            stars.push(<span key={i} className="star full">★</span>);
        }
        if (hasHalfStar) {
            stars.push(<span key="half" className="star half">★</span>);
        }
        const emptyStars = 5 - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
        }
        return stars;
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.8) return '#4CAF50';
        if (confidence >= 0.6) return '#FF9800';
        return '#F44336';
    };

    return (
        <div className="personalized-recommendations">
            <div className="header">
                <h2>Gợi ý cá nhân hóa bằng AI</h2>
                <p>Hệ thống AI phân tích sở thích và lịch sử của bạn để tạo lịch trình hoàn hảo</p>
            </div>

            {/* Preferences Form */}
            <div className="preferences-form">
                <h3 style={{ fontWeight: 700 }}>Thiết lập sở thích</h3>
                
                <div className="form-row">
                    <div className="form-group">
                        <label>Tháng du lịch:</label>
                        <select 
                            value={preferences.month} 
                            onChange={(e) => handlePreferenceChange('month', parseInt(e.target.value))}
                        >
                            {Array.from({length: 12}, (_, i) => (
                                <option key={i+1} value={i+1}>Tháng {i+1}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Ngân sách (VNĐ):</label>
                        <input 
                            type="range" 
                            min="1000000" 
                            max="50000000" 
                            step="1000000"
                            value={preferences.budget}
                            onChange={(e) => handlePreferenceChange('budget', parseInt(e.target.value))}
                        />
                        <span>{preferences.budget.toLocaleString()} VNĐ</span>
                    </div>

                    <div className="form-group">
                        <label>Mức độ mạo hiểm:</label>
                        <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            value={preferences.adventureLevel}
                            onChange={(e) => handlePreferenceChange('adventureLevel', parseInt(e.target.value))}
                        />
                        <span>Cấp độ {preferences.adventureLevel}</span>
                    </div>
                </div>

                <div className="form-group">
                    <label>Loại hình du lịch:</label>
                    <div className="checkbox-group">
                        {tripTypes.map(type => (
                            <label key={type} className="checkbox-label">
                                <input 
                                    type="checkbox"
                                    checked={preferences.types.includes(type)}
                                    onChange={(e) => handleArrayPreferenceChange('types', type, e.target.checked)}
                                />
                                {type}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label>Tỉnh thành muốn đi:</label>
                    <div className="province-selector">
                        <select 
                            onChange={(e) => {
                                if (e.target.value && !preferences.provinces.includes(e.target.value)) {
                                    handleArrayPreferenceChange('provinces', e.target.value, true);
                                }
                                e.target.value = '';
                            }}
                        >
                            <option value="">Chọn tỉnh thành...</option>
                            {provinces.map(province => (
                                <option key={province} value={province}>{province}</option>
                            ))}
                        </select>
                        <div className="selected-provinces">
                            {preferences.provinces.map(province => (
                                <span key={province} className="province-tag">
                                    {province}
                                    <button onClick={() => handleArrayPreferenceChange('provinces', province, false)}>×</button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-row">
                    <label className="checkbox-label">
                        <input 
                            type="checkbox"
                            checked={preferences.ecoFriendly}
                            onChange={(e) => handlePreferenceChange('ecoFriendly', e.target.checked)}
                        />
                        Du lịch xanh/bền vững
                    </label>

                    <label className="checkbox-label">
                        <input 
                            type="checkbox"
                            checked={showExplanations}
                            onChange={(e) => setShowExplanations(e.target.checked)}
                        />
                        Hiển thị giải thích AI
                    </label>

                    <label className="checkbox-label">
                        <input 
                            type="checkbox"
                            checked={feedbackMode}
                            onChange={(e) => setFeedbackMode(e.target.checked)}
                        />
                        Chế độ đánh giá
                    </label>
                </div>

                <button 
                    className="generate-btn" 
                    onClick={generateRecommendations}
                    disabled={loading}
                >
                    {loading ? 'AI đang phân tích...' : 'Tạo gợi ý cá nhân hóa'}
                </button>
            </div>

            {/* Alerts */}
            {alerts && (
                <div className="alerts">
                    <h4>⚠️ Cảnh báo rủi ro:</h4>
                    <p>{alerts}</p>
                </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <div className="recommendations">
                    <h3>🎯 Gợi ý dành riêng cho bạn ({recommendations.length} điểm đến)</h3>
                    
                    <div className="recommendations-grid">
                        {recommendations.map((destination, index) => (
                            <div key={index} className="recommendation-card">
                                <div className="card-header">
                                    <h4>{destination.MainDestination}</h4>
                                    <span className="province">{destination.Province}</span>
                                </div>

                                <div className="card-content">
                                    <div className="rating-section">
                                        <div className="rating">
                                            {getRatingStars(destination.rating || 4.0)}
                                            <span className="rating-text">({destination.rating || 4.0})</span>
                                        </div>
                                        
                                        {destination.aiScore && (
                                            <div className="ai-score">
                                                <span 
                                                    className="confidence-badge"
                                                    style={{ backgroundColor: getConfidenceColor(destination.confidence || 0.5) }}
                                                >
                                                    AI: {Math.round((destination.confidence || 0.5) * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {destination.estimatedCost && (
                                        <div className="cost">
                                            💰 Ước tính: {destination.estimatedCost.toLocaleString()} VNĐ
                                        </div>
                                    )}

                                    {destination.festival && (
                                        <div className="festival">
                                            🎉 Có {destination.festival} lễ hội trong tháng
                                        </div>
                                    )}

                                    {showExplanations && destination.aiExplanation && (
                                        <div className="ai-explanation">
                                            <strong>🤖 Tại sao gợi ý này:</strong>
                                            <p>{destination.aiExplanation}</p>
                                        </div>
                                    )}

                                    {feedbackMode && !destination.feedbackGiven && (
                                        <div className="feedback-section">
                                            <p>Bạn có thích gợi ý này không?</p>
                                            <div className="feedback-buttons">
                                                {[1, 2, 3, 4, 5].map(rating => (
                                                    <button
                                                        key={rating}
                                                        className="feedback-btn"
                                                        onClick={() => handleFeedback(destination, rating)}
                                                    >
                                                        {rating}★
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {destination.feedbackGiven && (
                                        <div className="feedback-given">
                                            ✅ Đã đánh giá: {destination.userRating}★
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className="login-prompt">
                    <p>🔐 Đăng nhập để sử dụng tính năng gợi ý cá nhân hóa bằng AI</p>
                </div>
            )}
            <Footer/>
        </div>
    );
};

export default PersonalizedRecommendations;