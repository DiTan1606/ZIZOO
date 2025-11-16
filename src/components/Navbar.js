// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { currentUser, logout } = useAuth(); // ĐÃ ĐÚNG
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link to="/" className="text-3xl font-bold tracking-tight">ZIZOO</Link>
                <div className="flex items-center space-x-6 text-lg">
                    <Link to="/" className="hover:text-yellow-300 transition">Trang chủ</Link>
                    <Link to="/planner" className="hover:text-yellow-300 transition">Lên kế hoạch</Link>
                    <Link to="/complete-planner" className="hover:text-yellow-300 transition flex items-center gap-1">
                        📋 Lịch trình hoàn chỉnh
                    </Link>
                    <Link to="/ai-recommendations" className="hover:text-yellow-300 transition flex items-center gap-1">
                        🤖 AI Gợi ý
                    </Link>
                    <Link to="/mytrips" className="hover:text-yellow-300 transition">Chuyến đi</Link>
                    {currentUser ? (
                        <>
                            <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                                {currentUser.email}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Đăng xuất
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/login"
                                className="bg-green-500 hover:bg-green-600 px-5 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Đăng nhập
                            </Link>
                            <Link
                                to="/register"
                                className="bg-blue-500 hover:bg-blue-600 px-5 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Đăng ký
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}