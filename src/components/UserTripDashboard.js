// src/components/UserTripDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateUserDashboard } from '../services/userTripAnalytics';
import './UserTripDashboard.css';

const UserTripDashboard = () => {
    const { currentUser } = useAuth();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            loadDashboard();
        }
    }, [currentUser]);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const data = await generateUserDashboard(currentUser.uid);
            setDashboard(data);
        } catch (error) {
            console.error('Lỗi tải dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
    };

    const getMonthName = (month) => {
        const months = [
            'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
        ];
        return months[month - 1];
    };

    const getTravelStyleName = (style) => {
        const styles = {
            budget: 'Tiết kiệm',
            standard: 'Trung bình',
            comfort: 'Thoải mái',
            luxury: 'Sang trọng'
        };
        return styles[style] || style;
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Đang tải thống kê...</p>
            </div>
        );
    }

    if (!dashboard || dashboard.totalTrips === 0) {
        return (
            <div className="dashboard-empty">
                <h2>📊 Thống kê chuyến đi</h2>
                <p>Bạn chưa có chuyến đi nào. Hãy tạo lịch trình đầu tiên!</p>
            </div>
        );
    }

    return (
        <div className="user-trip-dashboard">
            <div className="dashboard-header">
                <h1>📊 Thống kê chuyến đi của bạn</h1>
                <p>Tổng quan về các chuyến đi đã thực hiện</p>
            </div>

            {/* Overview Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">✈️</div>
                    <div className="stat-content">
                        <div className="stat-value">{dashboard.totalTrips}</div>
                        <div className="stat-label">Chuyến đi</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📍</div>
                    <div className="stat-content">
                        <div className="stat-value">{dashboard.totalDestinations}</div>
                        <div className="stat-label">Điểm đến</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">💰</div>
                    <div className="stat-content">
                        <div className="stat-value">{formatMoney(dashboard.totalSpent)}</div>
                        <div className="stat-label">Tổng chi tiêu</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                        <div className="stat-value">{formatMoney(dashboard.averageBudget)}</div>
                        <div className="stat-label">Ngân sách TB/chuyến</div>
                    </div>
                </div>
            </div>

            {/* Favorite Destinations */}
            {dashboard.favoriteDestinations.length > 0 && (
                <div className="dashboard-section">
                    <h2>🏆 Điểm đến yêu thích</h2>
                    <div className="favorite-destinations">
                        {dashboard.favoriteDestinations.map((item, index) => (
                            <div key={index} className="favorite-item">
                                <div className="favorite-rank">#{index + 1}</div>
                                <div className="favorite-info">
                                    <div className="favorite-name">{item.destination}</div>
                                    <div className="favorite-count">{item.count} chuyến đi</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Favorite Places */}
            {dashboard.favoritePlaces.length > 0 && (
                <div className="dashboard-section">
                    <h2>📸 Địa điểm đã ghé thăm nhiều nhất</h2>
                    <div className="favorite-places-grid">
                        {dashboard.favoritePlaces.slice(0, 6).map((item, index) => (
                            <div key={index} className="place-card">
                                <div className="place-name">{item.place}</div>
                                <div className="place-count">{item.count} lần</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Travel Preferences */}
            <div className="dashboard-section">
                <h2>🎯 Sở thích du lịch</h2>
                <div className="preferences-grid">
                    {dashboard.preferredTravelStyle && (
                        <div className="preference-card">
                            <div className="preference-label">Phong cách ưa thích</div>
                            <div className="preference-value">
                                {getTravelStyleName(dashboard.preferredTravelStyle)}
                            </div>
                        </div>
                    )}

                    {dashboard.commonInterests.length > 0 && (
                        <div className="preference-card">
                            <div className="preference-label">Sở thích phổ biến</div>
                            <div className="interests-list">
                                {dashboard.commonInterests.slice(0, 3).map((item, index) => (
                                    <span key={index} className="interest-tag">
                                        {item.interest} ({item.count})
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Time Preferences */}
            {dashboard.timePreferences && (
                <div className="dashboard-section">
                    <h2>📅 Thời gian du lịch ưa thích</h2>
                    <div className="time-preferences">
                        {dashboard.timePreferences.preferredMonths.length > 0 && (
                            <div className="time-pref-card">
                                <h3>Tháng thường đi</h3>
                                <div className="months-list">
                                    {dashboard.timePreferences.preferredMonths.map((item, index) => (
                                        <div key={index} className="month-item">
                                            <span className="month-name">{getMonthName(item.month)}</span>
                                            <span className="month-count">{item.count} lần</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {dashboard.timePreferences.preferredDurations.length > 0 && (
                            <div className="time-pref-card">
                                <h3>Độ dài chuyến đi</h3>
                                <div className="durations-list">
                                    {dashboard.timePreferences.preferredDurations.map((item, index) => (
                                        <div key={index} className="duration-item">
                                            <span className="duration-value">{item.duration} ngày</span>
                                            <span className="duration-count">{item.count} lần</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTripDashboard;
