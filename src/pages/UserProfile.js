import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './UserProfile.css';
import {
    getUserProfile,
    saveUserProfile,
    uploadAvatar,
    deleteAvatar,
    updateUserPreferences,
    getUserStats,
    changePassword,
    ensureProfileFields
} from '../services/userProfileService';

// Import icons
import profileIcon from '../icon/thongtincanhan.png';
import saveIcon from '../icon/luuthaydoi.png';
import securityIcon from '../icon/baomat.png';
import optionsIcon from '../icon/tuychon.png';

const UserProfile = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const fileInputRef = useRef(null);
    
    const [profileData, setProfileData] = useState({
        displayName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        location: '',
        bio: '',
        avatarURL: null
    });

    const [preferences, setPreferences] = useState({
        interests: [],
        travelStyle: 'standard',
        notifications: {
            email: true,
            push: true,
            sms: false
        },
        privacy: {
            profileVisible: true,
            showEmail: false,
            showPhone: false
        }
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [stats, setStats] = useState({
        totalTrips: 0,
        totalDestinations: 0,
        memberSince: null
    });

    // Load user profile on mount
    useEffect(() => {
        if (currentUser) {
            // Ensure profile has all required fields
            ensureProfileFields(currentUser.uid).then(() => {
                loadUserProfile();
                loadUserStats();
            });
        }
    }, [currentUser]);

    const loadUserProfile = async () => {
        try {
            const result = await getUserProfile(currentUser.uid);
            if (result.success) {
                setProfileData(prev => ({
                    ...prev,
                    ...result.data,
                    email: currentUser.email
                }));
                setPreferences({
                    interests: result.data.interests || [],
                    travelStyle: result.data.travelStyle || 'standard',
                    notifications: result.data.notifications || {
                        email: true,
                        push: true,
                        sms: false
                    },
                    privacy: result.data.privacy || {
                        profileVisible: true,
                        showEmail: false,
                        showPhone: false
                    }
                });
                setAvatarPreview(result.data.avatarURL);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const loadUserStats = async () => {
        try {
            const result = await getUserStats(currentUser.uid);
            if (result.success) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    // Handle avatar file selection
    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Upload avatar
    const handleAvatarUpload = async () => {
        if (!avatarFile) {
            toast.warning('Vui lòng chọn ảnh trước');
            return;
        }

        setLoading(true);
        try {
            const result = await uploadAvatar(currentUser.uid, avatarFile);
            if (result.success) {
                toast.success('Cập nhật ảnh đại diện thành công!');
                setAvatarPreview(result.avatarURL);
                setAvatarFile(null);
                await loadUserProfile();
            } else {
                toast.error(result.error || 'Lỗi khi upload ảnh');
            }
        } catch (error) {
            toast.error('Lỗi khi upload ảnh');
        } finally {
            setLoading(false);
        }
    };

    // Delete avatar
    const handleAvatarDelete = async () => {
        if (!window.confirm('Bạn có chắc muốn xóa ảnh đại diện?')) return;

        setLoading(true);
        try {
            const result = await deleteAvatar(currentUser.uid);
            if (result.success) {
                toast.success('Đã xóa ảnh đại diện');
                setAvatarPreview(null);
                await loadUserProfile();
            } else {
                toast.error(result.error || 'Lỗi khi xóa ảnh');
            }
        } catch (error) {
            toast.error('Lỗi khi xóa ảnh');
        } finally {
            setLoading(false);
        }
    };

    // Save profile
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await saveUserProfile(currentUser.uid, {
                displayName: profileData.displayName,
                phone: profileData.phone,
                dateOfBirth: profileData.dateOfBirth,
                gender: profileData.gender,
                location: profileData.location,
                bio: profileData.bio
            });

            if (result.success) {
                toast.success('Lưu thông tin thành công!');
            } else {
                toast.error(result.error || 'Lỗi khi lưu thông tin');
            }
        } catch (error) {
            toast.error('Lỗi khi lưu thông tin');
        } finally {
            setLoading(false);
        }
    };

    // Save preferences
    const handleSavePreferences = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await updateUserPreferences(currentUser.uid, preferences);
            if (result.success) {
                toast.success('Lưu tùy chọn thành công!');
            } else {
                toast.error(result.error || 'Lỗi khi lưu tùy chọn');
            }
        } catch (error) {
            toast.error('Lỗi khi lưu tùy chọn');
        } finally {
            setLoading(false);
        }
    };

    // Change password
    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Mật khẩu mới không khớp');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        setLoading(true);
        try {
            const result = await changePassword(
                currentUser,
                passwordData.currentPassword,
                passwordData.newPassword
            );

            if (result.success) {
                toast.success('Đổi mật khẩu thành công!');
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            } else {
                toast.error(result.error || 'Lỗi khi đổi mật khẩu');
            }
        } catch (error) {
            toast.error('Lỗi khi đổi mật khẩu');
        } finally {
            setLoading(false);
        }
    };

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

    const toggleInterest = (interest) => {
        setPreferences(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };

    // Alias for compatibility
    const handleInterestToggle = toggleInterest;

    if (!currentUser) {
        return (
            <div className="profile-page">
                <div className="container">
                    <p>Vui lòng đăng nhập để xem trang cá nhân.</p>
                </div>
            </div>
        );
    }

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        
        try {
            let date;
            
            // Xử lý Firestore Timestamp
            if (dateInput.toDate && typeof dateInput.toDate === 'function') {
                date = dateInput.toDate();
            }
            // Xử lý Date object
            else if (dateInput instanceof Date) {
                date = dateInput;
            }
            // Xử lý string format vi-VN (dd/mm/yyyy)
            else if (typeof dateInput === 'string' && dateInput.includes('/')) {
                const parts = dateInput.split('/');
                if (parts.length === 3) {
                    // Convert "15/12/2024" to "2024-12-15"
                    const [day, month, year] = parts;
                    date = new Date(`${year}-${month}-${day}`);
                } else {
                    date = new Date(dateInput);
                }
            }
            // Xử lý string hoặc number
            else {
                date = new Date(dateInput);
            }
            
            // Kiểm tra date hợp lệ
            if (isNaN(date.getTime())) {
                console.warn('Invalid date:', dateInput);
                return 'N/A';
            }
            
            return date.toLocaleDateString('vi-VN');
        } catch (error) {
            console.error('Error formatting date:', error, dateInput);
            return 'N/A';
        }
    };

    const interestOptions = [
        { value: 'food', name: 'Ẩm thực', icon: '🍜' },
        { value: 'photography', name: 'Chụp ảnh', icon: '📸' },
        { value: 'adventure', name: 'Phiêu lưu', icon: '🏔️' },
        { value: 'relaxation', name: 'Thư giãn', icon: '🧘' },
        { value: 'culture', name: 'Văn hóa', icon: '🏛️' },
        { value: 'nature', name: 'Thiên nhiên', icon: '🌿' },
        { value: 'shopping', name: 'Mua sắm', icon: '🛍️' },
        { value: 'nightlife', name: 'Cuộc sống đêm', icon: '🌃' }
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
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" />
                            ) : (
                                <span>{(profileData.displayName || currentUser.email || 'U')[0].toUpperCase()}</span>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            style={{ display: 'none' }}
                        />
                        <button 
                            className="change-avatar-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Thay đổi ảnh đại diện"
                        >
                            📷
                        </button>
                        {avatarFile && (
                            <div className="avatar-actions">
                                <button 
                                    className="btn-upload-avatar"
                                    onClick={handleAvatarUpload}
                                    disabled={loading}
                                >
                                    {loading ? '⏳ Đang upload...' : '✓ Upload ảnh'}
                                </button>
                                <button 
                                    className="btn-cancel-avatar"
                                    onClick={() => {
                                        setAvatarFile(null);
                                        setAvatarPreview(profileData.avatarURL);
                                    }}
                                >
                                    ✗ Hủy
                                </button>
                            </div>
                        )}
                        {avatarPreview && !avatarFile && (
                            <button 
                                className="btn-delete-avatar"
                                onClick={handleAvatarDelete}
                                disabled={loading}
                            >
                                🗑️ Xóa ảnh
                            </button>
                        )}
                    </div>
                    <div className="profile-info">
                        <h1>{profileData.displayName || 'Người dùng ZIZOO'}</h1>
                        <p className="user-email">Thành viên</p>
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
                                <h2>
                                    <img src={profileIcon} alt="" className="section-icon" />
                                    Thông tin cá nhân
                                </h2>
                                
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
                                                key={interest.value}
                                                type="button"
                                                className={`interest-btn ${(preferences.interests || []).includes(interest.value) ? 'selected' : ''}`}
                                                onClick={() => handleInterestToggle(interest.value)}
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
                                    {loading ? (
                                        <>⏳ Đang lưu...</>
                                    ) : (
                                        <>
                                            <img src={saveIcon} alt="" className="btn-icon" />
                                            Lưu thay đổi
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {activeTab === 'preferences' && (
                            <div className="preferences-form">
                                <h2>
                                    <img src={optionsIcon} alt="" className="section-icon" />
                                    Tùy chọn & Thông báo
                                </h2>
                                
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
                                <h2>
                                    <img src={securityIcon} alt="" className="section-icon" />
                                    Bảo mật tài khoản
                                </h2>
                                
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