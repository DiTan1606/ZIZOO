import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/userProfileService';
import './Navbar.css';

// Import icons
import logoIcon from '../icon/logo.png';
import homeIcon from '../icon/trangchu.png';
import planIcon from '../icon/lapkehoach.png';
import aiIcon from '../icon/AIgoiy.png';
import tripIcon from '../icon/chuyendi.png';
import aboutIcon from '../icon/vechungtoi.png';
import contactIcon from '../icon/phone-call.png';
import feedbackIcon from '../icon/phanhoi.png';
import profileIcon from '../icon/thongtincanhan.png';
import logoutIcon from '../icon/dangxuat.png';

export default function Navbar() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userAvatar, setUserAvatar] = useState(null);

    // Load user avatar from Firestore
    useEffect(() => {
        if (currentUser) {
            loadUserAvatar();
        }
    }, [currentUser]);

    const loadUserAvatar = async () => {
        try {
            const result = await getUserProfile(currentUser.uid);
            if (result.success && result.data.avatarURL) {
                setUserAvatar(result.data.avatarURL);
            }
        } catch (error) {
            console.error('Error loading avatar:', error);
        }
    };

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
        { path: '/', label: 'Trang chủ', iconImg: homeIcon },
        { path: '/complete-planner', label: 'Lập kế hoạch', iconImg: planIcon, protected: true },
        { path: '/ai-recommendations', label: 'AI Gợi ý', iconImg: aiIcon, protected: true },
        { path: '/mytrips', label: 'Chuyến đi', iconImg: tripIcon, protected: true },
        { path: '/about', label: 'Về chúng tôi', iconImg: aboutIcon },
        { path: '/contact', label: 'Liên hệ', iconImg: contactIcon },
        { path: '/feedback', label: 'Phản hồi', iconImg: feedbackIcon }
    ];

    return (
        <nav className="modern-navbar">
            <div className="navbar-container">
                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <img src={logoIcon} alt="ZIZOO" className="logo-icon-img" />
                    <div className="logo-text-container">
                        <span className="logo-text">ZIZOO</span>
                        <span className="logo-subtitle">Travel AI</span>
                    </div>
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
                                {link.iconImg ? (
                                    <img src={link.iconImg} alt="" className="nav-icon-img" />
                                ) : (
                                    <span className="nav-icon">{link.icon}</span>
                                )}
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
                                    {userAvatar || currentUser.photoURL ? (
                                        <img src={userAvatar || currentUser.photoURL} alt="Avatar" />
                                    ) : (
                                        <span>{(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}</span>
                                    )}
                                </div>
                            </Link>
                            <button onClick={handleLogout} className="logout-btn">
                                <img src={logoutIcon} alt="" className="nav-icon-img" />
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
                                {link.iconImg ? (
                                    <img src={link.iconImg} alt="" className="nav-icon-img" />
                                ) : (
                                    <span className="nav-icon">{link.icon}</span>
                                )}
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
                                    <img src={profileIcon} alt="" className="nav-icon-img" />
                                    <span>Thông tin cá nhân</span>
                                </Link>
                                <button onClick={handleLogout} className="mobile-logout-btn">
                                    <img src={logoutIcon} alt="" className="nav-icon-img" />
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