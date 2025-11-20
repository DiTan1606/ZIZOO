// src/components/AIRecommendationModal.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import geminiService from '../services/geminiService';
import { getUserTripsForTraining } from '../services/tripKnowledgeService';
import './AIRecommendationModal.css';

export default function AIRecommendationModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [step, setStep] = useState(1); // 1: Questions, 2: Loading, 3: Results
    const [preferences, setPreferences] = useState({
        budget: '',
        duration: '',
        travelers: '',
        travelStyle: '',
        interests: []
    });
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);

    const budgetOptions = [
        { value: '3000000', label: '< 3 triệu', icon: '💰' },
        { value: '5000000', label: '3-5 triệu', icon: '💵' },
        { value: '10000000', label: '5-10 triệu', icon: '💸' },
        { value: '15000000', label: '> 10 triệu', icon: '🤑' }
    ];

    const durationOptions = [
        { value: '2', label: '2-3 ngày', icon: '🌅' },
        { value: '4', label: '4-5 ngày', icon: '🌄' },
        { value: '7', label: '1 tuần', icon: '🌇' }
    ];

    const travelersOptions = [
        { value: '1', label: '1 người', icon: '🧍' },
        { value: '2', label: '2 người', icon: '👫' },
        { value: '4', label: '3-4 người', icon: '👨‍👩‍👦' },
        { value: '6', label: '5-7 người', icon: '👨‍👩‍👧‍👦' }
    ];

    const styleOptions = [
        { value: 'budget', label: 'Tiết kiệm', icon: '🎒' },
        { value: 'comfort', label: 'Thoải mái', icon: '🏨' },
        { value: 'luxury', label: 'Sang trọng', icon: '✨' }
    ];

    const interestOptions = [
        { value: 'nature', label: 'Thiên nhiên', icon: '🏞️' },
        { value: 'culture', label: 'Văn hóa', icon: '🏛️' },
        { value: 'food', label: 'Ẩm thực', icon: '🍜' },
        { value: 'beach', label: 'Biển', icon: '🏖️' },
        { value: 'adventure', label: 'Mạo hiểm', icon: '🧗' },
        { value: 'relax', label: 'Nghỉ dưỡng', icon: '🧘' }
    ];

    const toggleInterest = (interest) => {
        setPreferences(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };

    const handleGetRecommendations = async () => {
        if (!preferences.budget || !preferences.duration || !preferences.travelers || !preferences.travelStyle || preferences.interests.length === 0) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        setLoading(true);
        setStep(2);

        try {
            // Lấy lịch sử chuyến đi của user
            let tripHistory = '';
            if (currentUser) {
                const trips = await getUserTripsForTraining(currentUser.uid);
                if (trips.length > 0) {
                    tripHistory = `\n\nLịch sử chuyến đi: ${trips.map(t => 
                        t.header?.destination?.main || 'Không rõ'
                    ).join(', ')}`;
                }
            }

            const description = `Tôi muốn đi du lịch ${preferences.duration} ngày với ${preferences.travelers} người, ngân sách ${parseInt(preferences.budget).toLocaleString('vi-VN')}đ, phong cách ${preferences.travelStyle}, thích ${preferences.interests.join(', ')}.${tripHistory}`;

            const results = await geminiService.suggestDestinationFromDescription(description, {
                budget: parseInt(preferences.budget),
                duration: parseInt(preferences.duration),
                travelers: parseInt(preferences.travelers),
                interests: preferences.interests
            });

            setRecommendations(results);
            setStep(3);
        } catch (error) {
            console.error('Error getting recommendations:', error);
            alert('Có lỗi xảy ra. Vui lòng thử lại!');
            setStep(1);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDestination = (destination) => {
        // Chuyển sang Complete Planner với data đã điền
        navigate('/complete-planner', {
            state: {
                aiSuggestion: {
                    destination: destination.name,
                    province: destination.province,
                    duration: parseInt(preferences.duration),
                    travelers: parseInt(preferences.travelers),
                    budget: parseInt(preferences.budget),
                    travelStyle: preferences.travelStyle,
                    interests: preferences.interests,
                    reason: destination.reason
                }
            }
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="ai-modal-overlay" onClick={onClose}>
            <div className="ai-modal-content" onClick={e => e.stopPropagation()}>
                <button className="ai-modal-close" onClick={onClose}>✕</button>

                {/* Step 1: Questions */}
                {step === 1 && (
                    <div className="ai-modal-step">
                        <h2 className="ai-modal-title">🤖 AI Gợi ý chuyến đi cho bạn</h2>
                        <p className="ai-modal-subtitle">Trả lời vài câu hỏi để ZIZOO hiểu bạn hơn</p>

                        {/* Budget */}
                        <div className="ai-question-group">
                            <label className="ai-question-label">💰 Ngân sách dự kiến?</label>
                            <div className="ai-options-grid">
                                {budgetOptions.map(option => (
                                    <button
                                        key={option.value}
                                        className={`ai-option-btn ${preferences.budget === option.value ? 'active' : ''}`}
                                        onClick={() => setPreferences(prev => ({ ...prev, budget: option.value }))}
                                    >
                                        <span className="ai-option-icon">{option.icon}</span>
                                        <span className="ai-option-label">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duration */}
                        <div className="ai-question-group">
                            <label className="ai-question-label">📅 Đi bao nhiêu ngày?</label>
                            <div className="ai-options-grid">
                                {durationOptions.map(option => (
                                    <button
                                        key={option.value}
                                        className={`ai-option-btn ${preferences.duration === option.value ? 'active' : ''}`}
                                        onClick={() => setPreferences(prev => ({ ...prev, duration: option.value }))}
                                    >
                                        <span className="ai-option-icon">{option.icon}</span>
                                        <span className="ai-option-label">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Travelers */}
                        <div className="ai-question-group">
                            <label className="ai-question-label">👥 Đi với bao nhiêu người?</label>
                            <div className="ai-options-grid">
                                {travelersOptions.map(option => (
                                    <button
                                        key={option.value}
                                        className={`ai-option-btn ${preferences.travelers === option.value ? 'active' : ''}`}
                                        onClick={() => setPreferences(prev => ({ ...prev, travelers: option.value }))}
                                    >
                                        <span className="ai-option-icon">{option.icon}</span>
                                        <span className="ai-option-label">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Travel Style */}
                        <div className="ai-question-group">
                            <label className="ai-question-label">✨ Phong cách du lịch?</label>
                            <div className="ai-options-grid">
                                {styleOptions.map(option => (
                                    <button
                                        key={option.value}
                                        className={`ai-option-btn ${preferences.travelStyle === option.value ? 'active' : ''}`}
                                        onClick={() => setPreferences(prev => ({ ...prev, travelStyle: option.value }))}
                                    >
                                        <span className="ai-option-icon">{option.icon}</span>
                                        <span className="ai-option-label">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Interests */}
                        <div className="ai-question-group">
                            <label className="ai-question-label">❤️ Bạn thích gì? (Chọn nhiều)</label>
                            <div className="ai-options-grid">
                                {interestOptions.map(option => (
                                    <button
                                        key={option.value}
                                        className={`ai-option-btn ${preferences.interests.includes(option.value) ? 'active' : ''}`}
                                        onClick={() => toggleInterest(option.value)}
                                    >
                                        <span className="ai-option-icon">{option.icon}</span>
                                        <span className="ai-option-label">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="ai-submit-btn" onClick={handleGetRecommendations}>
                            🚀 Nhận gợi ý từ AI
                        </button>
                    </div>
                )}

                {/* Step 2: Loading */}
                {step === 2 && (
                    <div className="ai-modal-step ai-loading-step">
                        <div className="ai-loading-animation">
                            <div className="ai-spinner"></div>
                            <h3>🤖 AI đang phân tích...</h3>
                            <p>Đang tìm điểm đến hoàn hảo cho bạn</p>
                        </div>
                    </div>
                )}

                {/* Step 3: Results */}
                {step === 3 && (
                    <div className="ai-modal-step">
                        <h2 className="ai-modal-title">✨ Gợi ý dành cho bạn</h2>
                        <p className="ai-modal-subtitle">AI đã chọn {recommendations.length} điểm đến phù hợp nhất</p>

                        <div className="ai-recommendations-list">
                            {recommendations.map((rec, index) => (
                                <div key={index} className="ai-recommendation-card">
                                    <div className="ai-rec-header">
                                        <h3 className="ai-rec-title">{rec.name}</h3>
                                        <span className="ai-rec-province">{rec.province}</span>
                                    </div>
                                    <p className="ai-rec-reason">{rec.reason}</p>
                                    <div className="ai-rec-highlights">
                                        {rec.highlights?.map((highlight, i) => (
                                            <span key={i} className="ai-rec-highlight">✓ {highlight}</span>
                                        ))}
                                    </div>
                                    <div className="ai-rec-footer">
                                        <div className="ai-rec-info">
                                            <span>💰 {rec.estimatedCost}</span>
                                            <span>📅 {rec.bestTime}</span>
                                        </div>
                                        <button 
                                            className="ai-rec-select-btn"
                                            onClick={() => handleSelectDestination(rec)}
                                        >
                                            Chọn điểm này →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="ai-back-btn" onClick={() => setStep(1)}>
                            ← Thử lại với sở thích khác
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
