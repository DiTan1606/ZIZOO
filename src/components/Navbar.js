import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const isActive = (path) => location.pathname === path;

    const navLinks = [
        { path: '/', label: 'Trang chủ', icon: '🏠' },
        { path: '/complete-planner', label: 'Lập kế hoạch', icon: '📋', protected: true },
        { path: '/ai-recommendations', label: 'AI Gợi ý', icon: '🤖', protected: true },
        { path: '/mytrips', label: 'Chuyến đi', icon: '✈️', protected: true },
        { path: '/about', label: 'Về chúng tôi', icon: 'ℹ️' },
        { path: '/contact', label: 'Liên hệ', icon: '📞' },
        { path: '/feedback', label: 'Phản hồi', icon: '💬' }
    ];

    return (
        <nav className="modern-navbar">
            <div className="navbar-container">
                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <div className="logo-icon">🌍</div>
                    <span className="logo-text">ZIZOO</span>
                    <span className="logo-subtitle">Travel AI</span>
                </Link>

                {/* Desktop Navigation */}
                <div className="navbar-menu desktop-menu">
                    {navLinks.map(link => {
                        if (link.protected && !currentUser) return null;
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                            >
                                <span className="nav-icon">{link.icon}</span>
                                <span className="nav-text">{link.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* User Section */}
                <div className="navbar-user">
                    {currentUser ? (
                        <div className="user-menu">
                            <Link to="/profile" className="user-profile">
                                <div className="user-avatar">
                                    {currentUser.photoURL ? (
                                        <img src={currentUser.photoURL} alt="Avatar" />
                                    ) : (
                                        <span>{(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="user-info">
                                    <span className="user-name">
                                        {currentUser.displayName || currentUser.email?.split('@')[0]}
                                    </span>
                                    <span className="user-status">Thành viên</span>
                                </div>
                            </Link>
                            <button onClick={handleLogout} className="logout-btn">
                                <span className="logout-icon">🚪</span>
                                <span className="logout-text">Đăng xuất</span>
                            </button>
                        </div>
                    ) : (
                        <div className="auth-buttons">
                            <Link to="/login" className="auth-btn login-btn">
                                <span className="auth-icon">🔑</span>
                                <span>Đăng nhập</span>
                            </Link>
                            <Link to="/register" className="auth-btn register-btn">
                                <span className="auth-icon">✨</span>
                                <span>Đăng ký</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button 
                    className="mobile-menu-btn"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <span className={`hamburger ${isMobileMenuOpen ? 'active' : ''}`}>
                        <span></span>
                        <span></span>
                        <span></span>
                    </span>
                </button>
            </div>

            {/* Mobile Menu */}
            <div className={`mobile-menu ${isMobileMenuOpen ? 'active' : ''}`}>
                <div className="mobile-menu-content">
                    {navLinks.map(link => {
                        if (link.protected && !currentUser) return null;
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`mobile-nav-link ${isActive(link.path) ? 'active' : ''}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="nav-icon">{link.icon}</span>
                                <span className="nav-text">{link.label}</span>
                            </Link>
                        );
                    })}
                    
                    {/* Mobile User Section */}
                    <div className="mobile-user-section">
                        {currentUser ? (
                            <>
                                <Link 
                                    to="/profile" 
                                    className="mobile-profile-link"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="nav-icon">👤</span>
                                    <span>Thông tin cá nhân</span>
                                </Link>
                                <button onClick={handleLogout} className="mobile-logout-btn">
                                    <span className="nav-icon">🚪</span>
                                    <span>Đăng xuất</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link 
                                    to="/login" 
                                    className="mobile-auth-link"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="nav-icon">🔑</span>
                                    <span>Đăng nhập</span>
                                </Link>
                                <Link 
                                    to="/register" 
                                    className="mobile-auth-link"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="nav-icon">✨</span>
                                    <span>Đăng ký</span>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="mobile-menu-overlay"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </nav>
    );
}