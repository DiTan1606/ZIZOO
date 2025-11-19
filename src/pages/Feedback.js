import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Footer from '../components/Footer';
import './Feedback.css';

const Feedback = () => {
    const { currentUser } = useAuth();
    const [feedbackData, setFeedbackData] = useState({
        type: 'bug',
        title: '',
        description: '',
        severity: 'medium',
        category: 'general',
        steps: '',
        expected: '',
        actual: '',
        browser: '',
        device: '',
        rating: 5,
        email: currentUser?.email || ''
    });
    const [loading, setLoading] = useState(false);
    const [attachments, setAttachments] = useState([]);

    const feedbackTypes = [
        { value: 'bug', label: 'Báo lỗi', description: 'Báo cáo lỗi hoặc sự cố' },
        { value: 'feature', label: 'Đề xuất tính năng', description: 'Gợi ý tính năng mới' },
        { value: 'improvement', label: 'Cải thiện', description: 'Đề xuất cải thiện tính năng hiện có' },
        { value: 'compliment', label: 'Khen ngợi', description: 'Chia sẻ trải nghiệm tích cực' },
        { value: 'complaint', label: 'Khiếu nại', description: 'Phản ánh vấn đề dịch vụ' },
        { value: 'other', label: 'Khác', description: 'Phản hồi khác' }
    ];

    const severityLevels = [
        { value: 'low', label: 'Thấp', color: '#28a745' },
        { value: 'medium', label: 'Trung bình', color: '#ffc107' },
        { value: 'high', label: 'Cao', color: '#fd7e14' },
        { value: 'critical', label: 'Nghiêm trọng', color: '#dc3545' }
    ];

    const categories = [
        'general', 'ui-ux', 'performance', 'ai-recommendations', 
        'itinerary-planning', 'maps', 'weather', 'payments', 'account'
    ];

    const handleInputChange = (field, value) => {
        setFeedbackData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Create feedback object
            const feedback = {
                ...feedbackData,
                userId: currentUser?.uid,
                timestamp: new Date().toISOString(),
                attachments: attachments.map(file => file.name),
                userAgent: navigator.userAgent,
                url: window.location.href
            };

            console.log('Feedback submitted:', feedback);
            
            toast.success('Cảm ơn bạn đã gửi phản hồi! Chúng tôi sẽ xem xét và phản hồi sớm nhất.');
            
            // Reset form
            setFeedbackData({
                type: 'bug',
                title: '',
                description: '',
                severity: 'medium',
                category: 'general',
                steps: '',
                expected: '',
                actual: '',
                browser: '',
                device: '',
                rating: 5,
                email: currentUser?.email || ''
            });
            setAttachments([]);
            
        } catch (error) {
            toast.error('Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const renderStarRating = () => {
        return (
            <div className="star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        className={`star ${star <= feedbackData.rating ? 'active' : ''}`}
                        onClick={() => handleInputChange('rating', star)}
                    >
                        ★
                    </button>
                ))}
                <span className="rating-text">
                    {feedbackData.rating}/5 - {
                        feedbackData.rating === 5 ? 'Xuất sắc' :
                        feedbackData.rating === 4 ? 'Tốt' :
                        feedbackData.rating === 3 ? 'Bình thường' :
                        feedbackData.rating === 2 ? 'Kém' : 'Rất kém'
                    }
                </span>
            </div>
        );
    };

    return (
        <div className="feedback-page">
            <div className="hero-section">
                <div className="container">
                    <h1>Phản hồi & Báo lỗi</h1>
                    <p>Ý kiến của bạn giúp chúng tôi cải thiện ZIZOO mỗi ngày</p>
                </div>
            </div>

            <div className="container">
                <div className="feedback-content">
                    <div className="feedback-info">
                        <h2>• Tại sao phản hồi quan trọng?</h2>
                        <div className="info-cards">
                            <div className="info-card">
                                <div className="card-icon">✨</div>
                                <h3>Cải thiện sản phẩm</h3>
                                <p>Phản hồi của bạn giúp chúng tôi phát triển tính năng mới và cải thiện trải nghiệm người dùng.</p>
                            </div>
                            <div className="info-card">
                                <div className="card-icon">🔧</div>
                                <h3>Sửa lỗi nhanh chóng</h3>
                                <p>Báo cáo lỗi giúp chúng tôi phát hiện và khắc phục sự cố một cách nhanh chóng.</p>
                            </div>
                            <div className="info-card">
                                <div className="card-icon">💡</div>
                                <h3>Ý tưởng mới</h3>
                                <p>Đề xuất tính năng mới từ bạn có thể trở thành reality trong phiên bản tiếp theo.</p>
                            </div>
                        </div>
                    </div>

                    <div className="feedback-form-section">
                        <form onSubmit={handleSubmit} className="feedback-form">
                            <h2>Gửi phản hồi của bạn</h2>

                            {/* Feedback Type */}
                            <div className="form-group">
                                <label>Loại phản hồi *</label>
                                <div className="feedback-types">
                                    {feedbackTypes.map(type => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            className={`type-btn ${feedbackData.type === type.value ? 'active' : ''}`}
                                            onClick={() => handleInputChange('type', type.value)}
                                        >
                                            <div className="type-label">{type.label}</div>
                                            <div className="type-desc">{type.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div className="form-group">
                                <label>Tiêu đề *</label>
                                <input
                                    type="text"
                                    value={feedbackData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    placeholder="Tóm tắt ngắn gọn vấn đề hoặc đề xuất"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label>Mô tả chi tiết *</label>
                                <textarea
                                    value={feedbackData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder="Mô tả chi tiết vấn đề, đề xuất hoặc trải nghiệm của bạn..."
                                    rows="5"
                                    required
                                />
                            </div>

                            {/* Bug-specific fields */}
                            {feedbackData.type === 'bug' && (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Mức độ nghiêm trọng</label>
                                            <select
                                                value={feedbackData.severity}
                                                onChange={(e) => handleInputChange('severity', e.target.value)}
                                            >
                                                {severityLevels.map(level => (
                                                    <option key={level.value} value={level.value}>
                                                        {level.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Danh mục</label>
                                            <select
                                                value={feedbackData.category}
                                                onChange={(e) => handleInputChange('category', e.target.value)}
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>
                                                        {cat.replace('-', ' ').toUpperCase()}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Các bước tái hiện lỗi</label>
                                        <textarea
                                            value={feedbackData.steps}
                                            onChange={(e) => handleInputChange('steps', e.target.value)}
                                            placeholder="1. Vào trang... &#10;2. Click vào... &#10;3. Nhập..."
                                            rows="3"
                                        />
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Kết quả mong đợi</label>
                                            <input
                                                type="text"
                                                value={feedbackData.expected}
                                                onChange={(e) => handleInputChange('expected', e.target.value)}
                                                placeholder="Điều gì nên xảy ra?"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Kết quả thực tế</label>
                                            <input
                                                type="text"
                                                value={feedbackData.actual}
                                                onChange={(e) => handleInputChange('actual', e.target.value)}
                                                placeholder="Điều gì đã xảy ra?"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Rating for compliments */}
                            {(feedbackData.type === 'compliment' || feedbackData.type === 'complaint') && (
                                <div className="form-group">
                                    <label>Đánh giá tổng thể</label>
                                    {renderStarRating()}
                                </div>
                            )}

                            {/* Contact Info */}
                            <div className="form-group">
                                <label>Email liên hệ</label>
                                <input
                                    type="email"
                                    value={feedbackData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    placeholder="Email để chúng tôi phản hồi (tùy chọn)"
                                />
                            </div>

                            {/* File Upload */}
                            <div className="form-group">
                                <label>Đính kèm file (tùy chọn)</label>
                                <div className="file-upload">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf,.doc,.docx"
                                        onChange={handleFileUpload}
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="file-upload-btn">
                                        + Chọn file
                                    </label>
                                    <small>Hỗ trợ: ảnh, PDF, Word (tối đa 10MB)</small>
                                </div>
                                
                                {attachments.length > 0 && (
                                    <div className="attachments-list">
                                        {attachments.map((file, index) => (
                                            <div key={index} className="attachment-item">
                                                <span>{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttachment(index)}
                                                    className="remove-btn"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                className="submit-btn"
                                disabled={loading}
                            >
                                {loading ? '⟳ Đang gửi...' : 'Gửi phản hồi'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Feedback;