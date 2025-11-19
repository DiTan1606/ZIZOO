// src/pages/Home.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import MapViewer from '../components/MapViewer';
import Footer from '../components/Footer';
import './Home.css';

// Import feature icons
import aiIcon from '../icon/AIcnh.png';
import dataIcon from '../icon/dltgt.png';
import routeIcon from '../icon/tult.png';
import alertIcon from '../icon/cbtm.png';
import sustainableIcon from '../icon/dlbv.png';
import budgetIcon from '../icon/tuns.png';

// Import core value icons
import userFocusIcon from '../icon/ttnd.png';
import innovationIcon from '../icon/dmlt.png';
import responsibilityIcon from '../icon/tnxh.png';
import communityIcon from '../icon/cd.png';

export default function Home() {
    const samplePoints = [
        { lat: 10.771966, lng: 106.702086, name: "Trung tâm TP.HCM" },
        { lat: 21.0285, lng: 105.8542, name: "Hà Nội" },
        { lat: 16.0471, lng: 108.2258, name: "Đà Nẵng" },
    ];

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <div className="relative text-center py-8 px-6 overflow-hidden" style={{
                backgroundImage: `url(${require('../icon/home.jpg')})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}>
                {/* Overlay with opacity */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70"></div>

                <div className="relative z-10">
                    <div className="flex justify-center mb-2">
                        <div className="relative">
                            <img 
                                src={require('../icon/Logo-02.png')} 
                                alt="ZIZOO" 
                                className="w-128 h-64 object-contain drop-shadow-2xl"
                            />
                            <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl"></div>
                        </div>
                    </div>
                    
                    <p className="text-xl md:text-2xl text-white font-light mb-4 max-w-4xl mx-auto leading-relaxed tracking-wide" style={{
                        textShadow: '0 2px 15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 255, 255, 0.2)',
                        fontFamily: 'Georgia, serif'
                    }}>
                        Khám phá và Trải nghiệm du lịch Việt Nam theo cách của bạn
                    </p>
                    
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/95 backdrop-blur-md rounded-full mb-6 shadow-2xl border-2 border-white">
                        <p className="text-base font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                            Cảnh báo rủi ro bão lũ theo thời gian thực • AI gợi ý lộ trình an toàn
                        </p>
                    </div>

                    {/* Bản đồ nhỏ ở trang chủ */}
                    <div className="max-w-6xl mx-auto mb-6 shadow-2xl rounded-3xl overflow-hidden border-4 border-white backdrop-blur-sm" style={{
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.5)'
                    }}>
                        <MapViewer points={samplePoints} showRoute={false} />
                    </div>

                    {/* Nút hành động */}
                    <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-6">
                        <Link
                            to="/complete-planner"
                            className="px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full border-2 border-white/30 transform hover:scale-105 transition-all duration-300"
                            style={{
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.5)',
                                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            Bắt đầu lập kế hoạch ngay
                        </Link>

                        <Link
                            to="/risk-map"
                            className="px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-red-600 via-orange-500 to-pink-600 rounded-full border-2 border-white/30 transform hover:scale-105 transition-all duration-300"
                            style={{
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.5)',
                                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            Xem bản đồ rủi ro toàn quốc
                        </Link>
                    </div>

                    <div className="inline-flex items-center gap-8 px-8 py-4 bg-white/20 backdrop-blur-md rounded-full" style={{
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                    }}>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg text-white" style={{
                                textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)'
                            }}>63 tỉnh thành</span>
                        </div>
                        <div className="w-2 h-2 bg-white rounded-full shadow-lg"></div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg text-white" style={{
                                textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)'
                            }}>Cập nhật theo thời gian thực</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* About Section */}
            <div className="relative py-20 px-6 overflow-hidden" style={{
                backgroundImage: `url(${require('../icon/home2.jpg')})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed'
            }}>
                {/* Overlay */}
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm"></div>
                
                <div className="max-w-6xl mx-auto relative z-10">
                    <h2 className="text-4xl font-bold text-center mb-12" style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Về ZIZOO</h2>
                    
                    <div className="grid md:grid-cols-2 gap-12 mb-16">
                        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white">
                            <h3 className="text-2xl font-bold mb-4 text-indigo-600">Sứ mệnh của chúng tôi</h3>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                ZIZOO Travel AI được tạo ra với sứ mệnh giúp mọi người có thể tạo ra những chuyến đi hoàn hảo 
                                mà không cần phải là chuyên gia du lịch.
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                Chúng tôi tin rằng mỗi chuyến đi đều độc đáo, và công nghệ AI có thể giúp 
                                tạo ra những trải nghiệm du lịch được cá nhân hóa hoàn toàn.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white">
                                <h4 className="text-3xl font-bold text-indigo-600 mb-2">10,000+</h4>
                                <p className="text-gray-600">Lịch trình đã tạo</p>
                            </div>
                            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white">
                                <h4 className="text-3xl font-bold text-purple-600 mb-2">5,000+</h4>
                                <p className="text-gray-600">Người dùng hài lòng</p>
                            </div>
                            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white">
                                <h4 className="text-3xl font-bold text-green-600 mb-2">63</h4>
                                <p className="text-gray-600">Tỉnh thành VN</p>
                            </div>
                            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white">
                                <h4 className="text-3xl font-bold text-orange-600 mb-2">24/7</h4>
                                <p className="text-gray-600">Hỗ trợ AI</p>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-3xl font-bold text-center mb-10" style={{ 
                        background: 'linear-gradient(135deg, #FDB44B 0%, #FF8A5B 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Tính năng nổi bật</h3>
                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                            <div className="mb-4 flex justify-center">
                                <img src={aiIcon} alt="AI" style={{ width: '64px', height: '64px' }} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-indigo-600">AI Cá nhân hóa</h4>
                            <p className="text-gray-600">Sử dụng Collaborative Filtering và Content-based Filtering để tạo gợi ý phù hợp</p>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl">
                            <div className="mb-4 flex justify-center">
                                <img src={dataIcon} alt="Data" style={{ width: '64px', height: '64px' }} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-green-600">Dữ liệu thời gian thực</h4>
                            <p className="text-gray-600">Tích hợp Google Maps, OpenWeatherMap và các nguồn dữ liệu đáng tin cậy</p>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                            <div className="mb-4 flex justify-center">
                                <img src={routeIcon} alt="Route" style={{ width: '64px', height: '64px' }} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-purple-600">Tối ưu lộ trình</h4>
                            <p className="text-gray-600">Thuật toán thông minh tối ưu thời gian, chi phí và trải nghiệm</p>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl">
                            <div className="mb-4 flex justify-center">
                                <img src={alertIcon} alt="Alert" style={{ width: '64px', height: '64px' }} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-red-600">Cảnh báo thông minh</h4>
                            <p className="text-gray-600">Tự động điều chỉnh lịch trình khi có thay đổi thời tiết hoặc sự kiện</p>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-teal-50 to-green-50 rounded-xl">
                            <div className="mb-4 flex justify-center">
                                <img src={sustainableIcon} alt="Sustainable" style={{ width: '64px', height: '64px' }} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-teal-600">Du lịch bền vững</h4>
                            <p className="text-gray-600">Tính toán dấu chân carbon và ưu tiên phương tiện thân thiện môi trường</p>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl">
                            <div className="mb-4 flex justify-center">
                                <img src={budgetIcon} alt="Budget" style={{ width: '64px', height: '64px' }} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-yellow-600">Tối ưu ngân sách</h4>
                            <p className="text-gray-600">Phân bổ ngân sách thông minh và đề xuất lựa chọn phù hợp túi tiền</p>
                        </div>
                    </div>

                    <h3 className="text-3xl font-bold text-center mb-10" style={{ 
                        background: 'linear-gradient(135deg, #FDB44B 0%, #FF8A5B 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Công nghệ đằng sau ZIZOO</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                        <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl">
                            <h4 className="text-lg font-bold mb-4 text-indigo-600">Machine Learning</h4>
                            <ul className="space-y-2 text-gray-700 text-sm">
                                <li>• Collaborative Filtering</li>
                                <li>• Content-based Filtering</li>
                                <li>• Hybrid Recommendation</li>
                                <li>• Natural Language Processing</li>
                            </ul>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                            <h4 className="text-lg font-bold mb-4 text-purple-600">Tối ưu hóa</h4>
                            <ul className="space-y-2 text-gray-700 text-sm">
                                <li>• Traveling Salesman Problem</li>
                                <li>• Genetic Algorithms</li>
                                <li>• Linear Programming</li>
                                <li>• A* Pathfinding</li>
                            </ul>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl">
                            <h4 className="text-lg font-bold mb-4 text-green-600">Tích hợp API</h4>
                            <ul className="space-y-2 text-gray-700 text-sm">
                                <li>• Google Maps Platform</li>
                                <li>• OpenWeatherMap</li>
                                <li>• TripAdvisor API</li>
                                <li>• Social Media APIs</li>
                            </ul>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl">
                            <h4 className="text-lg font-bold mb-4 text-orange-600">Infrastructure</h4>
                            <ul className="space-y-2 text-gray-700 text-sm">
                                <li>• Firebase Realtime Database</li>
                                <li>• Cloud Functions</li>
                                <li>• React.js Frontend</li>
                                <li>• Progressive Web App</li>
                            </ul>
                        </div>
                    </div>

                    <h3 className="text-3xl font-bold text-center mb-10" style={{ 
                        background: 'linear-gradient(135deg, #FDB44B 0%, #FF8A5B 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Giá trị cốt lõi</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl text-center">
                            <div className="mb-3 flex justify-center">
                                <img src={userFocusIcon} alt="User Focus" style={{ width: '48px', height: '48px' }} />
                            </div>
                            <h4 className="text-lg font-bold mb-2 text-indigo-600">Tập trung người dùng</h4>
                            <p className="text-gray-600 text-sm">Mọi tính năng đều được thiết kế với người dùng làm trung tâm</p>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl text-center">
                            <div className="mb-3 flex justify-center">
                                <img src={innovationIcon} alt="Innovation" style={{ width: '48px', height: '48px' }} />
                            </div>
                            <h4 className="text-lg font-bold mb-2 text-purple-600">Đổi mới liên tục</h4>
                            <p className="text-gray-600 text-sm">Luôn cập nhật công nghệ mới nhất và cải thiện trải nghiệm</p>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl text-center">
                            <div className="mb-3 flex justify-center">
                                <img src={responsibilityIcon} alt="Responsibility" style={{ width: '48px', height: '48px' }} />
                            </div>
                            <h4 className="text-lg font-bold mb-2 text-green-600">Trách nhiệm xã hội</h4>
                            <p className="text-gray-600 text-sm">Khuyến khích du lịch có trách nhiệm và bền vững</p>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl text-center">
                            <div className="mb-3 flex justify-center">
                                <img src={communityIcon} alt="Community" style={{ width: '48px', height: '48px' }} />
                            </div>
                            <h4 className="text-lg font-bold mb-2 text-orange-600">Cộng đồng</h4>
                            <p className="text-gray-600 text-sm">Xây dựng cộng đồng du lịch thông minh và chia sẻ</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <Footer />
        </div>
    );
}