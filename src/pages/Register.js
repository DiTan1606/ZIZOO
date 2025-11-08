// src/pages/Register.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // Thêm confirm để tránh lỗi nhập sai
    const { register } = useAuth(); // Giả sử AuthContext có hàm register
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return toast.error('Mật khẩu xác nhận không khớp!');
        }
        if (password.length < 6) {
            return toast.error('Mật khẩu phải ≥ 6 ký tự!');
        }
        try {
            await register(email, password);
            toast.success('Đăng ký thành công! Chào mừng đến ZIZOO!');
            navigate('/planner'); // Chuyển về planner sau đăng ký
        } catch (err) {
            toast.error(`Đăng ký thất bại: ${err.message}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">Đăng Ký Tài Khoản</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <input
                            type="email"
                            placeholder="Email của bạn"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <input
                            type="password"
                            placeholder="Mật khẩu (≥6 ký tự)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <input
                            type="password"
                            placeholder="Xác nhận mật khẩu"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition"
                    >
                        Đăng Ký
                    </button>
                </form>
                <p className="text-center mt-4 text-gray-600">
                    Đã có tài khoản? <Link to="/login" className="text-blue-600 hover:underline">Đăng nhập ngay</Link>
                </p>
            </div>
        </div>
    );
}