import React, { useState } from 'react';
import { toast } from 'react-toastify';
import './Contact.css';

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
        type: 'general'
    });
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            toast.success('Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng 24h.');
            setFormData({
                name: '',
                email: '',
                subject: '',
                message: '',
                type: 'general'
            });
        } catch (error) {
            toast.error('Có lỗi xảy ra. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="contact-page">
            <div className="hero-section">
                <div className="container">
                    <h1>Liên hệ với chúng tôi</h1>
                    <p>Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7</p>
                </div>
            </div>

            <div className="container">
                <div className="contact-content">
                    <div className="contact-info">
                        <h2>🤝 Kết nối với ZIZOO</h2>
                        <p>
                            Có câu hỏi, góp ý hoặc cần hỗ trợ? Đội ngũ ZIZOO luôn sẵn sàng 
                            lắng nghe và hỗ trợ bạn tạo ra những chuyến đi tuyệt vời.
                        </p>

                        <div className="contact-methods">
                            <div className="contact-method">
                                <div className="method-icon">📧</div>
                                <div className="method-info">
                                    <h3>Email</h3>
                                    <p>support@zizoo.travel</p>
                                    <small>Phản hồi trong vòng 2-4 giờ</small>
                                </div>
                            </div>

                            <div className="contact-method">
                                <div className="method-icon">💬</div>
                                <div className="method-info">
                                    <h3>Live Chat</h3>
                                    <p>Chat trực tiếp với AI Assistant</p>
                                    <small>Có mặt 24/7</small>
                                </div>
                            </div>

                            <div className="contact-method">
                                <div className="method-icon">📱</div>
                                <div className="method-info">
                                    <h3>Hotline</h3>
                                    <p>1900 1234 (miễn phí)</p>
                                    <small>8:00 - 22:00 hàng ngày</small>
                                </div>
                            </div>

                            <div className="contact-method">
                                <div className="method-icon">🌐</div>
                                <div className="method-info">
                                    <h3>Social Media</h3>
                                    <p>Facebook, Instagram, Twitter</p>
                                    <small>Cập nhật tin tức mới nhất</small>
                                </div>
                            </div>
                        </div>

                        <div className="faq-section">
                            <h3>❓ Câu hỏi thường gặp</h3>
                            <div className="faq-list">
                                <div className="faq-item">
                                    <strong>ZIZOO có miễn phí không?</strong>
                                    <p>Có! Tất cả tính năng cơ bản đều miễn phí. Chúng tôi có gói Premium với tính năng nâng cao.</p>
                                </div>
                                <div className="faq-item">
                                    <strong>Làm sao để lưu lịch trình?</strong>
                                    <p>Đăng ký tài khoản miễn phí để lưu và quản lý tất cả lịch trình của bạn.</p>
                                </div>
                                <div className="faq-item">
                                    <strong>ZIZOO hỗ trợ những địa điểm nào?</strong>
                                    <p>Hiện tại chúng tôi hỗ trợ toàn bộ 63 tỉnh thành Việt Nam và đang mở rộng ra quốc tế.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="contact-form-section">
                        <div className="form-container">
                            <h2>📝 Gửi tin nhắn</h2>
                            <form onSubmit={handleSubmit} className="contact-form">
                                <div className="form-group">
                                    <label>Loại yêu cầu</label>
                                    <select 
                                        name="type" 
                                        value={formData.type}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="general">Câu hỏi chung</option>
                                        <option value="bug">Báo lỗi</option>
                                        <option value="feature">Đề xuất tính năng</option>
                                        <option value="partnership">Hợp tác kinh doanh</option>
                                        <option value="press">Báo chí</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Họ tên *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Nhập họ tên của bạn"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Tiêu đề *</label>
                                    <input
                                        type="text"
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="Tóm tắt nội dung bạn muốn liên hệ"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Nội dung *</label>
                                    <textarea
                                        name="message"
                                        value={formData.message}
                                        onChange={handleInputChange}
                                        required
                                        rows="6"
                                        placeholder="Mô tả chi tiết yêu cầu của bạn..."
                                    ></textarea>
                                </div>

                                <button 
                                    type="submit" 
                                    className="submit-btn"
                                    disabled={loading}
                                >
                                    {loading ? '⏳ Đang gửi...' : '🚀 Gửi tin nhắn'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="additional-info">
                    <div className="info-grid">
                        <div className="info-card">
                            <h3>🏢 Văn phòng</h3>
                            <p>
                                Tầng 10, Tòa nhà ABC<br/>
                                123 Đường Nguyễn Huệ<br/>
                                Quận 1, TP. Hồ Chí Minh
                            </p>
                        </div>

                        <div className="info-card">
                            <h3>⏰ Giờ làm việc</h3>
                            <p>
                                Thứ 2 - Thứ 6: 8:00 - 18:00<br/>
                                Thứ 7: 9:00 - 17:00<br/>
                                Chủ nhật: 10:00 - 16:00
                            </p>
                        </div>

                        <div className="info-card">
                            <h3>🌍 Ngôn ngữ hỗ trợ</h3>
                            <p>
                                Tiếng Việt (chính)<br/>
                                English<br/>
                                中文 (Trung Quốc)<br/>
                                한국어 (Hàn Quốc)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;