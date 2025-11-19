import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            toast.success("Đăng nhập thành công!");
            navigate('/');
        } catch (err) {
            toast.error("Sai email hoặc mật khẩu!");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <img 
                        src="/logo.png" 
                        alt="ZIZOO Logo" 
                        style={{ 
                            width: '120px', 
                            height: '120px', 
                            margin: '0 auto 16px',
                            display: 'block'
                        }} 
                    />
                    <h2 style={{ 
                        fontFamily: 'sans-serif', 
                        textAlign: 'center', 
                        margin: '0',
                        fontSize: '30px',
                        fontWeight: '700',
                        color: '#1f2937',
                        width: '100%',
                        display: 'block'
                    }}>Đăng Nhập</h2>
                </div>
                <form onSubmit={handleSubmit}>
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border mb-4 rounded" required />
                    <input type="password" placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border mb-6 rounded" required />
                    <button 
                        type="submit" 
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            padding: '12px 0',
                            borderRadius: '9999px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '16px',
                            marginBottom: '16px'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                        Đăng nhập
                    </button>
                    <p className="text-center text-gray-600 mb-4">
                        <Link to="/forgot-password" className="hover:text-indigo-600 transition">Quên mật khẩu?</Link>
                    </p>
                    <Link 
                        to="/register" 
                        style={{
                            display: 'block',
                            width: '100%',
                            background: 'white',
                            color: '#FF8A5B',
                            padding: '12px 0',
                            borderRadius: '9999px',
                            fontWeight: '700',
                            textAlign: 'center',
                            textDecoration: 'none',
                            transition: 'all 0.3s ease',
                            fontSize: '16px',
                            border: '2px solid #FF8A5B'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.background = '#FFF5F0';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.background = 'white';
                        }}
                    >
                        Tạo tài khoản
                    </Link>
                </form>
            </div>
        </div>
    );
}