import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getUserNotifications, 
  getUnreadCount, 
  markNotificationAsRead 
} from '../services/weatherSafetyService';
import './NotificationBell.css';

const NotificationBell = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      loadUnreadCount();

      // Auto-refresh mỗi 5 phút
      const interval = setInterval(() => {
        loadUnreadCount();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    const data = await getUserNotifications(currentUser.uid);
    setNotifications(data);
    setLoading(false);
  };

  const loadUnreadCount = async () => {
    if (!currentUser) return;
    const count = await getUnreadCount(currentUser.uid);
    setUnreadCount(count);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }
  };

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      loadNotifications();
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date.toDate()) / 1000);
    if (seconds < 60) return 'vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  if (!currentUser) return null;

  return (
    <div className="notification-bell-container">
      <button 
        className="notification-bell-btn"
        onClick={handleBellClick}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {showDropdown && (
        <>
          <div 
            className="notification-overlay" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="notification-dropdown">
            <div className="notification-header">
              <h3>Thông báo</h3>
              {unreadCount > 0 && (
                <span className="unread-count">{unreadCount} mới</span>
              )}
            </div>

            <div className="notification-list">
              {loading ? (
                <div className="notification-loading">
                  <div className="spinner"></div>
                  <p>Đang tải...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">
                  <p>🔔</p>
                  <p>Chưa có thông báo nào</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-icon">
                      {notification.title.split(' ')[0]}
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">
                        {notification.title}
                      </div>
                      <div className="notification-message">
                        {notification.destination} • {notification.message}
                      </div>
                      <div className="notification-time">
                        {getTimeAgo(notification.createdAt)}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="notification-dot"></div>
                    )}
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="notification-footer">
                <button 
                  className="view-all-btn"
                  onClick={() => {
                    setShowDropdown(false);
                    // Navigate to notifications page if exists
                  }}
                >
                  Xem tất cả
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
