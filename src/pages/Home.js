// src/pages/Home.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import MapViewer from '../components/MapViewer';

export default function Home() {
    const samplePoints = [
        { lat: 10.771966, lng: 106.702086, name: "Trung tâm TP.HCM" },
        { lat: 21.0285, lng: 105.8542, name: "Hà Nội" },
        { lat: 16.0471, lng: 108.2258, name: "Đà Nẵng" },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100">
            {/* Hero Section */}
            <div className="text-center py-24 px-6">
                <h1 className="text-7xl md:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-purple-600 to-pink-600 mb-8 animate-pulse">
                    ZIZOO
                </h1>
                <p className="text-2xl md:text-3xl text-gray-800 font-light mb-12 max-w-4xl mx-auto leading-relaxed">
                    Ứng dụng du lịch thông minh nhất Việt Nam 2025<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 font-bold">
            Cảnh báo rủi ro bão lũ theo thời gian thực • AI gợi ý lộ trình an toàn
          </span>
                </p>

                {/* Bản đồ nhỏ ở trang chủ */}
                <div className="max-w-6xl mx-auto mb-16 shadow-2xl rounded-3xl overflow-hidden">
                    <MapViewer points={samplePoints} showRoute={false} />
                </div>

                {/* Nút hành động */}
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                    <Link
                        to="/complete-planner"
                        className="px-12 py-6 text-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300"
                    >
                        Bắt đầu lập kế hoạch ngay
                    </Link>

                    <Link
                        to="/risk-map"
                        className="px-12 py-6 text-2xl font-bold text-white bg-gradient-to-r from-red-600 via-orange-500 to-pink-600 rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300 animate-pulse"
                    >
                        Xem bản đồ rủi ro toàn quốc
                    </Link>
                </div>

                <p className="mt-12 text-lg text-gray-600">
                    Đã phân tích dữ liệu từ <strong>63 tỉnh thành</strong> • Cập nhật mỗi 10 phút
                </p>
            </div>
        </div>
    );
}