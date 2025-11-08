// src/pages/Home.js
import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div className="text-center py-20">
            <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-6">
                ZIZOO
            </h1>
            <p className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto">
                Ứng dụng lập kế hoạch du lịch thông minh với AI, dữ liệu thời tiết thực tế và tối ưu lộ trình
            </p>
            <Link
                to="/planner"
                className="inline-block bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-10 py-4 rounded-full text-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300"
            >
                Bắt đầu ngay!
            </Link>
        </div>
    );
}