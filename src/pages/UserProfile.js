import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './UserProfile.css';

const UserProfile = () => {
    const { currentUser, updateUserProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    
    const [profileData, setProfileData] = useState({
        displayName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        location: '',
        bio: '',
        interests: [],
        travelStyle: 'standard',
        budget: 'medium',
        language: 'vi'
    });

    const [preferences, setPreferences] = useState({
        emailNotifications: true,
        pushNotifications: true,
        weatherAlerts: true,
        priceAlerts: true,
        newsletter: true,
        dataSharing: false
    });

    const [stats, setStats] = useState({
        totalTrips: 0,
        totalDestinations: 0,
        totalSpent: 0,
        favoriteDestination: '',
        joinDate: ''
    });

    useEffect(() => {
        if (currentUser) {
            setProfileData(prev => ({
                ...prev,
                displayName: currentUser.displayName || '',
                email: currentUser.email || '',
                // Load other data from localStorage or API
            }));
            
            // Simulate loading user stats
            setStats({
                totalTrips: 12,
                totalDestinations: 8,
                totalSpent: 45000000,
                favoriteDestination: 'Đà Nẵng',
                joinDate: currentUser.metadata?.creationTime || new Date().toISOString()
            });
        }
    }, [currentUser]);

    const handleInputChange = (field, value) => {
        setProfileData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePreferenceChange = (field, value) => {
        setPreferences(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleInterestToggle = (interest) => {
        setProfileData(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (updateUserProfile) {
                await updateUserProfile({
                    displayName: profileData.displayName
                });
            }
            
            toast.success('Cập nhật thông tin thành công!');
        } catch (error) {
            toast.error('Có lỗi xảy ra khi cập nhật thông tin.');
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const interestOptions = [
        { id: 'food', name: 'Ẩm thực', icon: '🍜' },
        { id: 'photography', name: 'Chụp ảnh', icon: '📸' },
        { id: 'adventure', name: 'Phiêu lưu', icon: '🏔️' },
        { id: 'relaxation', name: 'Thư giãn', icon: '🧘' },
        { id: 'culture', name: 'Văn hóa', icon: '🏛️' },
        { id: 'nature', name: 'Thiên nhiên', icon: '🌿' },
        { id: 'shopping', name: 'Mua sắm', icon: '🛍️' },
        { id: 'nightlife', name: 'Cuộc sống đêm', icon: '🌃' }
    ];

    if (!currentUser) {
        return (
            <div className="profile-page">
                <div className="container">
                    <p>Vui lòng đăng nhập để xem thông tin cá nhân.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="container">
                <div className="profile-header">
                    <div className="profile-avatar">
                        <div className="avatar-circle">
                            {currentUser.photoURL ? (
                                <img src={currentUser.photoURL} alt="Avatar" />
                            ) : (
                                <span>{(profileData.displayName || currentUser.email || 'U')[0].toUpperCase()}</span>
                            )}
                        </div>
                        <button className="change-avatar-btn">📷</button>
                    </div>
                    <div className="profile-info">
                        <h1>{profileData.displayName || 'Người dùng ZIZOO'}</h1>
                        <p className="user-email">{currentUser.email}</p>
                        <p className="join-date">Tham gia từ {formatDate(stats.joinDate)}</p>
                    </div>
                    <div className="profile-stats">
                        <div className="stat-item">
                            <span className="stat-number">{stats.totalTrips}</span>
                            <span className="stat-label">Chuyến đi</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{stats.totalDestinations}</span>
                            <span className="stat-label">Điểm đến</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{formatMoney(stats.totalSpent)}</span>
                            <span className="stat-label">Tổng chi tiêu</span>
                        </div>
                    </div>
                </div>

                <div className="profile-content">
                    <div className="profile-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            👤 Thông tin cá nhân
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
                            onClick={() => setActiveTab('preferences')}
                        >
                            ⚙️ Tùy chọn
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                            onClick={() => setActiveTab('security')}
                        >
                            🔒 Bảo mật
                        </button>
                    </div>

                    <div className="tab-content">
                        {activeTab === 'profile' && (
                            <div className="profile-form">
                                <h2>Thông tin cá nhân</h2>
                                
                                <div className="form-section">
                                    <h3>Thông tin cơ bản</h3>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Tên hiển thị</label>
                                            <input
                                                type="text"
                                                value={profileData.displayName}
                                                onChange={(e) => handleInputChange('displayName', e.target.value)}
                                                placeholder="Nhập tên hiển thị"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Số điện thoại</label>
                                            <input
                                                type="tel"
                                                value={profileData.phone}
                                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                                placeholder="Nhập số điện thoại"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Ngày sinh</label>
                                            <input
                                                type="date"
                                                value={profileData.dateOfBirth}
                                                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Giới tính</label>
                                            <select
                                                value={profileData.gender}
                                                onChange={(e) => handleInputChange('gender', e.target.value)}
                                            >
                                                <option value="">Chọn giới tính</option>
                                                <option value="male">Nam</option>
                                                <option value="female">Nữ</option>
                                                <option value="other">Khác</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Địa chỉ</label>
                                        <input
                                            type="text"
                                            value={profileData.location}
                                            onChange={(e) => handleInputChange('location', e.target.value)}
                                            placeholder="Thành phố, Tỉnh"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Giới thiệu bản thân</label>
                                        <textarea
                                            value={profileData.bio}
                                            onChange={(e) => handleInputChange('bio', e.target.value)}
                                            placeholder="Chia sẻ về bản thân và sở thích du lịch..."
                                            rows="4"
                                        />
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3>Sở thích du lịch</h3>
                                    <div className="interests-grid">
                                        {interestOptions.map(interest => (
                                            <button
                                                key={interest.id}
                                                type="button"
                                                className={`interest-btn ${profileData.interests.includes(interest.id) ? 'selected' : ''}`}
                                                onClick={() => handleInterestToggle(interest.id)}
                                            >
                                                <span className="interest-icon">{interest.icon}</span>
                                                <span className="interest-name">{interest.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3>Phong cách du lịch</h3>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Phong cách ưa thích</label>
                                            <select
                                                value={profileData.travelStyle}
                                                onChange={(e) => handleInputChange('travelStyle', e.target.value)}
                                            >
                                                <option value="budget">Tiết kiệm</option>
                                                <option value="standard">Trung bình</option>
                                                <option value="comfort">Thoải mái</option>
                                                <option value="luxury">Sang trọng</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Mức ngân sách thường</label>
                                            <select
                                                value={profileData.budget}
                                                onChange={(e) => handleInputChange('budget', e.target.value)}
                                            >
                                                <option value="low">Dưới 2 triệu</option>
                                                <option value="medium">2-5 triệu</option>
                                                <option value="high">5-10 triệu</option>
                                                <option value="premium">Trên 10 triệu</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    className="save-btn"
                                    onClick={handleSaveProfile}
                                    disabled={loading}
                                >
                                    {loading ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
                                </button>
                            </div>
                        )}

                        {activeTab === 'preferences' && (
                            <div className="preferences-form">
                                <h2>Tùy chọn & Thông báo</h2>
                                
                                <div className="form-section">
                                    <h3>Thông báo</h3>
                                    <div className="preference-item">
                                        <div className="preference-info">
                                            <strong>Email thông báo</strong>
                                            <p>Nhận thông báo về lịch trình và cập nhật qua email</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={preferences.emailNotifications}
                                                onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>

                                    <div className="preference-item">
                                        <div className="preference-info">
                                            <strong>Push notifications</strong>
                                            <p>Thông báo đẩy về thời tiết, giao thông</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={preferences.pushNotifications}
                                                onChange={(e) => handlePreferenceChange('pushNotifications', e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>

                                    <div className="preference-item">
                                        <div className="preference-info">
                                            <strong>Cảnh báo thời tiết</strong>
                                            <p>Thông báo khi có thời tiết xấu ảnh hưởng lịch trình</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={preferences.weatherAlerts}
                                                onChange={(e) => handlePreferenceChange('weatherAlerts', e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3>Quyền riêng tư</h3>
                                    <div className="preference-item">
                                        <div className="preference-info">
                                            <strong>Chia sẻ dữ liệu</strong>
                                            <p>Cho phép chia sẻ dữ liệu ẩn danh để cải thiện dịch vụ</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={preferences.dataSharing}
                                                onChange={(e) => handlePreferenceChange('dataSharing', e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="security-form">
                                <h2>Bảo mật tài khoản</h2>
                                
                                <div className="form-section">
                                    <h3>Đổi mật khẩu</h3>
                                    <div className="form-group">
                                        <label>Mật khẩu hiện tại</label>
                                        <input type="password" placeholder="Nhập mật khẩu hiện tại" />
                                    </div>
                                    <div className="form-group">
                                        <label>Mật khẩu mới</label>
                                        <input type="password" placeholder="Nhập mật khẩu mới" />
                                    </div>
                                    <div className="form-group">
                                        <label>Xác nhận mật khẩu mới</label>
                                        <input type="password" placeholder="Nhập lại mật khẩu mới" />
                                    </div>
                                    <button className="change-password-btn">🔐 Đổi mật khẩu</button>
                                </div>

                                <div className="form-section">
                                    <h3>Xác thực 2 bước</h3>
                                    <p>Tăng cường bảo mật tài khoản với xác thực 2 bước</p>
                                    <button className="enable-2fa-btn">📱 Kích hoạt 2FA</button>
                                </div>

                                <div className="form-section danger-zone">
                                    <h3>Vùng nguy hiểm</h3>
                                    <p>Các hành động này không thể hoàn tác</p>
                                    <button className="delete-account-btn">🗑️ Xóa tài khoản</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;