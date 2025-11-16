// src/components/ItineraryAlertsPanel.js
import React, { useState, useEffect } from 'react';
import { subscribeToAlerts, getActiveAlerts, getAlertsHistory } from '../services/alertsAndAdjustmentsService';
import './ItineraryAlertsPanel.css';

const ItineraryAlertsPanel = ({ itineraryId, onAdjustmentAccepted }) => {
    const [alerts, setAlerts] = useState([]);
    const [alertsHistory, setAlertsHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (!itineraryId) return;

        // Load active alerts
        loadActiveAlerts();
        
        // Subscribe to new alerts
        const unsubscribe = subscribeToAlerts((id, newAlerts) => {
            if (id === itineraryId) {
                setAlerts(newAlerts);
            }
        });

        return unsubscribe;
    }, [itineraryId]);

    const loadActiveAlerts = async () => {
        try {
            const activeAlerts = getActiveAlerts(itineraryId);
            setAlerts(activeAlerts);
        } catch (error) {
            console.error('Error loading active alerts:', error);
        }
    };

    const loadAlertsHistory = async () => {
        if (!showHistory) {
            setLoading(true);
            try {
                const history = await getAlertsHistory(itineraryId);
                setAlertsHistory(history);
            } catch (error) {
                console.error('Error loading alerts history:', error);
            } finally {
                setLoading(false);
            }
        }
        setShowHistory(!showHistory);
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'high': return '🚨';
            case 'medium': return '⚠️';
            case 'low': return 'ℹ️';
            default: return '📢';
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return '#dc3545';
            case 'medium': return '#fd7e14';
            case 'low': return '#0dcaf0';
            default: return '#6c757d';
        }
    };

    const getAlertTypeLabel = (type) => {
        const labels = {
            weather_severe: 'Thời tiết nghiêm trọng',
            weather_rain: 'Mưa lớn',
            weather_temperature: 'Nhiệt độ cực đoan',
            place_closed_permanently: 'Đóng cửa vĩnh viễn',
            place_closed_temporarily: 'Đóng cửa tạm thời',
            place_closed_now: 'Hiện tại đóng cửa',
            traffic_heavy: 'Giao thông ùn tắc',
            pricing_increase: 'Tăng giá',
            crowd_high: 'Đông đúc'
        };
        return labels[type] || type;
    };

    const handleAcceptSuggestion = (alert, suggestionIndex) => {
        const suggestion = alert.suggestedActions[suggestionIndex];
        console.log('Accepting suggestion:', suggestion);
        
        if (onAdjustmentAccepted) {
            onAdjustmentAccepted(alert, suggestion);
        }
    };

    const formatTimeAgo = (date) => {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} ngày trước`;
        if (hours > 0) return `${hours} giờ trước`;
        if (minutes > 0) return `${minutes} phút trước`;
        return 'Vừa xong';
    };

    if (!itineraryId) {
        return (
            <div className="alerts-panel">
                <div className="no-itinerary">
                    <p>Chọn một lịch trình để xem cảnh báo</p>
                </div>
            </div>
        );
    }

    return (
        <div className="alerts-panel">
            <div className="alerts-header">
                <h3>🔔 Cảnh báo & Thông báo</h3>
                <div className="alerts-summary">
                    {alerts.length > 0 ? (
                        <span className="alert-count">
                            {alerts.length} cảnh báo mới
                        </span>
                    ) : (
                        <span className="no-alerts">Không có cảnh báo</span>
                    )}
                </div>
            </div>

            {/* Active Alerts */}
            {alerts.length > 0 && (
                <div className="active-alerts">
                    <h4>Cảnh báo hiện tại</h4>
                    {alerts.map((alert, index) => (
                        <div 
                            key={index} 
                            className={`alert-item severity-${alert.severity}`}
                            style={{ borderLeftColor: getSeverityColor(alert.severity) }}
                        >
                            <div className="alert-header">
                                <span className="alert-icon">
                                    {getSeverityIcon(alert.severity)}
                                </span>
                                <div className="alert-title">
                                    <strong>{alert.title}</strong>
                                    <span className="alert-type">
                                        {getAlertTypeLabel(alert.type)}
                                    </span>
                                </div>
                                <span className="alert-time">
                                    {formatTimeAgo(new Date())}
                                </span>
                            </div>

                            <div className="alert-content">
                                <p className="alert-message">{alert.message}</p>
                                
                                {alert.destination && (
                                    <div className="alert-location">
                                        <strong>Địa điểm:</strong> {alert.destination.name}
                                        {alert.day && <span> (Ngày {alert.day})</span>}
                                    </div>
                                )}

                                {alert.suggestedActions && alert.suggestedActions.length > 0 && (
                                    <div className="suggested-actions">
                                        <strong>Đề xuất xử lý:</strong>
                                        <ul>
                                            {alert.suggestedActions.map((action, actionIndex) => (
                                                <li key={actionIndex}>
                                                    <span>{action}</span>
                                                    <button
                                                        className="accept-suggestion-btn"
                                                        onClick={() => handleAcceptSuggestion(alert, actionIndex)}
                                                        title="Áp dụng đề xuất này"
                                                    >
                                                        ✓
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {alert.data && (
                                    <details className="alert-details">
                                        <summary>Chi tiết kỹ thuật</summary>
                                        <pre>{JSON.stringify(alert.data, null, 2)}</pre>
                                    </details>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* History Toggle */}
            <div className="history-section">
                <button 
                    className="history-toggle"
                    onClick={loadAlertsHistory}
                    disabled={loading}
                >
                    {loading ? (
                        <span>Đang tải...</span>
                    ) : (
                        <span>
                            {showHistory ? '📖 Ẩn lịch sử' : '📚 Xem lịch sử cảnh báo'}
                        </span>
                    )}
                </button>

                {/* Alerts History */}
                {showHistory && (
                    <div className="alerts-history">
                        <h4>Lịch sử cảnh báo</h4>
                        {alertsHistory.length > 0 ? (
                            <div className="history-list">
                                {alertsHistory.map((historyItem, index) => (
                                    <div key={index} className="history-item">
                                        <div className="history-header">
                                            <span className="history-time">
                                                {new Date(historyItem.timestamp.toDate()).toLocaleString('vi-VN')}
                                            </span>
                                            <span className="history-count">
                                                {historyItem.alerts.length} cảnh báo
                                            </span>
                                        </div>
                                        <div className="history-alerts">
                                            {historyItem.alerts.slice(0, 3).map((alert, alertIndex) => (
                                                <div key={alertIndex} className="history-alert">
                                                    <span className="history-alert-icon">
                                                        {getSeverityIcon(alert.severity)}
                                                    </span>
                                                    <span className="history-alert-title">
                                                        {alert.title}
                                                    </span>
                                                </div>
                                            ))}
                                            {historyItem.alerts.length > 3 && (
                                                <div className="history-more">
                                                    +{historyItem.alerts.length - 3} khác
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-history">Chưa có lịch sử cảnh báo</p>
                        )}
                    </div>
                )}
            </div>

            {/* Monitoring Status */}
            <div className="monitoring-status">
                <div className="status-indicator active">
                    <span className="status-dot"></span>
                    <span>Đang theo dõi thời gian thực</span>
                </div>
                <div className="monitoring-info">
                    <small>
                        Hệ thống tự động kiểm tra thời tiết, giao thông, và trạng thái địa điểm mỗi 10 phút
                    </small>
                </div>
            </div>
        </div>
    );
};

export default ItineraryAlertsPanel;