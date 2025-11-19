import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3>Liên hệ</h3>
                        <div className="contact-item">
                            <span className="icon">✉</span>
                            <div>
                                <strong>Email</strong>
                                <p>support@zizoo.travel</p>
                            </div>
                        </div>
                        <div className="contact-item">
                            <span className="icon">☎</span>
                            <div>
                                <strong>Hotline</strong>
                                <p>1900 1234 (miễn phí)</p>
                            </div>
                        </div>
                    </div>

                    <div className="footer-section">
                        <h3>Văn phòng</h3>
                        <p>
                            Tầng 10, Tòa nhà ABC<br/>
                            123 Đường Nguyễn Huệ<br/>
                            Quận 1, TP. Hồ Chí Minh
                        </p>
                    </div>

                    <div className="footer-section">
                        <h3>Giờ làm việc</h3>
                        <p>
                            Thứ 2 - Thứ 6: 8:00 - 18:00<br/>
                            Thứ 7: 9:00 - 17:00<br/>
                            Chủ nhật: 10:00 - 16:00
                        </p>
                    </div>

                    <div className="footer-section">
                        <h3>Ngôn ngữ hỗ trợ</h3>
                        <p>
                            Tiếng Việt • English<br/>
                            中文 • 한국어
                        </p>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; 2025 ZIZOO. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
