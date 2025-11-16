import React from 'react';
import './About.css';

const About = () => {
    return (
        <div className="about-page">
            <div className="hero-section">
                <div className="container">
                    <h1>Về ZIZOO Travel AI</h1>
                    <p className="hero-subtitle">
                        Nền tảng lập kế hoạch du lịch thông minh được hỗ trợ bởi AI
                    </p>
                </div>
            </div>

            <div className="container">
                <section className="mission-section">
                    <div className="row">
                        <div className="col-md-6">
                            <h2>🎯 Sứ mệnh của chúng tôi</h2>
                            <p>
                                ZIZOO Travel AI được tạo ra với sứ mệnh democratize việc lập kế hoạch du lịch, 
                                giúp mọi người có thể tạo ra những chuyến đi hoàn hảo mà không cần phải là 
                                chuyên gia du lịch.
                            </p>
                            <p>
                                Chúng tôi tin rằng mỗi chuyến đi đều độc đáo, và công nghệ AI có thể giúp 
                                tạo ra những trải nghiệm du lịch được cá nhân hóa hoàn toàn.
                            </p>
                        </div>
                        <div className="col-md-6">
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <h3>10,000+</h3>
                                    <p>Lịch trình đã tạo</p>
                                </div>
                                <div className="stat-item">
                                    <h3>5,000+</h3>
                                    <p>Người dùng hài lòng</p>
                                </div>
                                <div className="stat-item">
                                    <h3>63</h3>
                                    <p>Tỉnh thành Việt Nam</p>
                                </div>
                                <div className="stat-item">
                                    <h3>24/7</h3>
                                    <p>Hỗ trợ AI</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="features-section">
                    <h2>🚀 Tính năng nổi bật</h2>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">🤖</div>
                            <h3>AI Cá nhân hóa</h3>
                            <p>
                                Sử dụng Collaborative Filtering và Content-based Filtering để 
                                tạo gợi ý phù hợp với sở thích cá nhân.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🌍</div>
                            <h3>Dữ liệu thời gian thực</h3>
                            <p>
                                Tích hợp Google Maps, OpenWeatherMap, và các nguồn dữ liệu 
                                đáng tin cậy để cập nhật thông tin liên tục.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🛣️</div>
                            <h3>Tối ưu lộ trình</h3>
                            <p>
                                Thuật toán thông minh tối ưu thời gian, chi phí và trải nghiệm 
                                dựa trên sở thích của bạn.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">⚡</div>
                            <h3>Cảnh báo thông minh</h3>
                            <p>
                                Tự động điều chỉnh lịch trình khi có thay đổi thời tiết, 
                                giao thông hoặc sự kiện bất ngờ.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🌱</div>
                            <h3>Du lịch bền vững</h3>
                            <p>
                                Tính toán dấu chân carbon và ưu tiên các phương tiện 
                                thân thiện với môi trường.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">💰</div>
                            <h3>Tối ưu ngân sách</h3>
                            <p>
                                Phân bổ ngân sách thông minh và đề xuất các lựa chọn 
                                phù hợp với túi tiền của bạn.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="technology-section">
                    <h2>🔬 Công nghệ đằng sau ZIZOO</h2>
                    <div className="tech-grid">
                        <div className="tech-category">
                            <h3>🧠 Machine Learning</h3>
                            <ul>
                                <li>Collaborative Filtering</li>
                                <li>Content-based Filtering</li>
                                <li>Hybrid Recommendation Engine</li>
                                <li>Natural Language Processing</li>
                            </ul>
                        </div>
                        <div className="tech-category">
                            <h3>🗺️ Tối ưu hóa</h3>
                            <ul>
                                <li>Traveling Salesman Problem (TSP)</li>
                                <li>Genetic Algorithms</li>
                                <li>Linear Programming</li>
                                <li>A* Pathfinding</li>
                            </ul>
                        </div>
                        <div className="tech-category">
                            <h3>📡 Tích hợp API</h3>
                            <ul>
                                <li>Google Maps Platform</li>
                                <li>OpenWeatherMap</li>
                                <li>TripAdvisor API</li>
                                <li>Social Media APIs</li>
                            </ul>
                        </div>
                        <div className="tech-category">
                            <h3>☁️ Infrastructure</h3>
                            <ul>
                                <li>Firebase Realtime Database</li>
                                <li>Cloud Functions</li>
                                <li>React.js Frontend</li>
                                <li>Progressive Web App</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="team-section">
                    <h2>👥 Đội ngũ phát triển</h2>
                    <p className="team-intro">
                        ZIZOO được phát triển bởi đội ngũ kỹ sư và chuyên gia du lịch đam mê 
                        công nghệ và khám phá thế giới.
                    </p>
                    <div className="values-grid">
                        <div className="value-item">
                            <h4>🎯 Tập trung vào người dùng</h4>
                            <p>Mọi tính năng đều được thiết kế với người dùng làm trung tâm</p>
                        </div>
                        <div className="value-item">
                            <h4>🔬 Đổi mới liên tục</h4>
                            <p>Luôn cập nhật công nghệ mới nhất và cải thiện trải nghiệm</p>
                        </div>
                        <div className="value-item">
                            <h4>🌍 Trách nhiệm xã hội</h4>
                            <p>Khuyến khích du lịch có trách nhiệm và bền vững</p>
                        </div>
                        <div className="value-item">
                            <h4>🤝 Cộng đồng</h4>
                            <p>Xây dựng cộng đồng du lịch thông minh và chia sẻ</p>
                        </div>
                    </div>
                </section>

                <section className="cta-section">
                    <div className="cta-content">
                        <h2>Sẵn sàng khám phá?</h2>
                        <p>Tạo lịch trình du lịch thông minh đầu tiên của bạn ngay hôm nay!</p>
                        <div className="cta-buttons">
                            <a href="/complete-planner" className="btn btn-primary">
                                Tạo lịch trình ngay
                            </a>
                            <a href="/contact" className="btn btn-outline">
                                Liên hệ với chúng tôi
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default About;