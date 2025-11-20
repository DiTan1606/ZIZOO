import React, { useState, useEffect } from 'react';
import { analyzeTripSafety } from '../services/weatherSafetyService';
import './TripWeatherWidget.css';

const TripWeatherWidget = ({ trip }) => {
  const [safetyData, setSafetyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSafety = async () => {
      setLoading(true);
      const data = await analyzeTripSafety(trip);
      setSafetyData(data);
      setLoading(false);
    };

    fetchSafety();
    
    // Auto-refresh mỗi 30 phút
    const interval = setInterval(fetchSafety, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [trip]);

  if (loading) {
    return (
      <div className="weather-widget loading">
        <div className="skeleton-line"></div>
        <div className="skeleton-line short"></div>
      </div>
    );
  }

  if (!safetyData) {
    return null;
  }

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    return `${hours} giờ trước`;
  };

  return (
    <div className={`weather-widget status-${safetyData.status.toLowerCase()}`}>
      <div className="widget-header">
        <div className="status-badge" style={{ backgroundColor: safetyData.color }}>
          {safetyData.icon} {safetyData.label}
        </div>
        <span className="update-time">
          {getTimeAgo(safetyData.updatedAt)}
        </span>
      </div>

      <div className="weather-summary">
        <div className="weather-item">
          <span className="weather-label">Hiện tại</span>
          <span className="weather-value">
            {getWeatherEmoji(safetyData.current.icon)} {Math.round(safetyData.current.temp)}°C
          </span>
          <span className="weather-desc">{safetyData.current.description}</span>
        </div>

        {safetyData.tripDay && (
          <div className="weather-item highlight">
            <span className="weather-label">Ngày đi</span>
            <span className="weather-value">
              {getWeatherEmoji(safetyData.tripDay.icon)} {Math.round(safetyData.tripDay.temp)}°C
            </span>
            <span className="weather-desc">{safetyData.tripDay.description}</span>
          </div>
        )}
      </div>

      {/* Cảnh báo chi tiết */}
      {safetyData.issues && safetyData.issues.length > 0 && (
        <div className="alerts-section">
          {safetyData.issues.map((issue, index) => {
            if (issue.type === 'all_critical_routes_closed') {
              return (
                <div key={index} className="alert-item critical">
                  🚫 Tất cả đường chính đều đóng - KHÔNG THỂ VÀO
                  {issue.routes && issue.routes.map((route, i) => (
                    <div key={i} className="route-detail">• {route.name}</div>
                  ))}
                </div>
              );
            }
            if (issue.type === 'some_critical_routes_closed') {
              return (
                <div key={index} className="alert-item warning">
                  ⚠️ Một số đường chính bị đóng
                  {issue.routes && issue.routes.map((route, i) => (
                    <div key={i} className="route-detail">• {route.name}</div>
                  ))}
                </div>
              );
            }
            if (issue.type === 'heavy_rain_forecast' || issue.type === 'current_heavy_rain') {
              return (
                <div key={index} className="alert-item warning">
                  🌧️ Mưa lớn {issue.type === 'current_heavy_rain' ? 'hiện tại' : 'dự kiến'}
                </div>
              );
            }
            if (issue.type === 'strong_wind') {
              return (
                <div key={index} className="alert-item warning">
                  💨 Gió mạnh
                </div>
              );
            }
            if (issue.type === 'weather_road_closure') {
              return (
                <div key={index} className="alert-item critical">
                  🌧️ {issue.count} đường đóng do thời tiết xấu
                  {issue.details && issue.details.map((detail, i) => (
                    <div key={i} className="route-detail">• {detail.description}</div>
                  ))}
                </div>
              );
            }
            if (issue.type === 'multiple_roads_closed' || issue.type === 'some_roads_closed') {
              return (
                <div key={index} className="alert-item critical">
                  🚫 {issue.count} đường bị đóng
                  {issue.details && issue.details.map((detail, i) => (
                    <div key={i} className="route-detail">• {detail.description}</div>
                  ))}
                </div>
              );
            }
            if (issue.type === 'construction') {
              return (
                <div key={index} className="alert-item warning">
                  🚧 {issue.count} đoạn đường đang thi công
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Message tổng quát */}
      <div className="message">{safetyData.message}</div>
    </div>
  );
};

// Helper functions
const getWeatherEmoji = (icon) => {
  const iconMap = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️'
  };
  return iconMap[icon] || '🌤️';
};

export default TripWeatherWidget;
