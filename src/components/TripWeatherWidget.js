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
            // CẢNH BÁO ĐẶC BIỆT: Mưa liên tục
            if (issue.type === 'continuous_rain_all_days') {
              const intensity = issue.rainIntensity || 'moderate';
              const className = `alert-item rain-continuous rain-${intensity}`;
              
              let icon = '🌧️🌧️🌧️';
              let title = 'MƯA SUỐT CHUYẾN ĐI';
              let advice = '⚠️ Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng';
              
              if (intensity === 'light') {
                icon = '🌧️';
                title = 'MƯA NHỎ SUỐT CHUYẾN ĐI';
                advice = 'ℹ️ Mưa nhỏ không đáng kể. Nên mang áo mưa';
              } else if (intensity === 'moderate') {
                icon = '🌧️🌧️';
                title = 'MƯA VỪA SUỐT CHUYẾN ĐI';
                advice = '⚠️ Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng';
              } else if (intensity === 'heavy') {
                icon = '🌧️🌧️🌧️';
                title = 'MƯA LỚN SUỐT CHUYẾN ĐI';
                advice = '🚨 Nên cân nhắc hoãn chuyến đi hoặc chuẩn bị kỹ lưỡng';
              }
              
              return (
                <div key={index} className={className}>
                  <div className="alert-header">
                    {icon} {title}
                  </div>
                  <div className="alert-details">
                    <div>• Tất cả {issue.totalDays} ngày đều có mưa</div>
                    <div>• Trung bình {issue.avgRain}mm/ngày</div>
                    <div className="alert-advice">{advice}</div>
                  </div>
                </div>
              );
            }
            if (issue.type === 'continuous_rain_most_days') {
              const intensity = issue.rainIntensity || 'moderate';
              const className = `alert-item rain-frequent rain-${intensity}`;
              
              let icon = '🌧️🌧️';
              let title = 'MƯA NHIỀU NGÀY';
              let advice = '⚠️ Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng';
              
              if (intensity === 'light') {
                icon = '🌧️';
                title = 'MƯA NHỎ NHIỀU NGÀY';
                advice = 'ℹ️ Mưa nhỏ không đáng kể. Nên mang áo mưa';
              } else if (intensity === 'moderate') {
                icon = '🌧️🌧️';
                title = 'MƯA VỪA NHIỀU NGÀY';
                advice = '⚠️ Nên mang đồ mưa và chuẩn bị kế hoạch dự phòng';
              } else if (intensity === 'heavy') {
                icon = '🌧️🌧️🌧️';
                title = 'MƯA LỚN NHIỀU NGÀY';
                advice = '🚨 Nên chuẩn bị kỹ lưỡng hoặc cân nhắc hoãn';
              }
              
              return (
                <div key={index} className={className}>
                  <div className="alert-header">
                    {icon} {title}
                  </div>
                  <div className="alert-details">
                    <div>• Mưa {issue.rainyDays}/{issue.totalDays} ngày trong chuyến đi</div>
                    <div>• Trung bình {issue.avgRain}mm/ngày</div>
                    <div className="alert-advice">{advice}</div>
                  </div>
                </div>
              );
            }
            if (issue.type === 'frequent_rain') {
              const intensity = issue.rainIntensity || 'moderate';
              const className = `alert-item rain-${intensity}`;
              
              let icon = '🌧️';
              if (intensity === 'moderate') icon = '🌧️🌧️';
              if (intensity === 'heavy') icon = '🌧️🌧️🌧️';
              
              return (
                <div key={index} className={className}>
                  {icon} Mưa {issue.rainyDays}/{issue.totalDays} ngày (trung bình {issue.avgRain}mm/ngày)
                </div>
              );
            }
            if (issue.type === 'heavy_rain_average') {
              return (
                <div key={index} className="alert-item warning">
                  🌧️ Mưa lớn trung bình {issue.avgRain}mm/ngày
                </div>
              );
            }
            if (issue.type === 'all_critical_routes_closed') {
              return (
                <div key={index} className="alert-item critical road-closure-critical">
                  <div className="alert-header">
                    🚫 TẤT CẢ ĐƯỜNG CHÍNH ĐỀU ĐÓNG
                  </div>
                  <div className="alert-subheader">
                    ⛔ KHÔNG THỂ VÀO BẰNG ĐƯỜNG BỘ
                  </div>
                  <div className="alert-details">
                    {issue.routes && issue.routes.map((route, i) => (
                      <div key={i} className="closed-route-item critical-route">
                        <div className="route-name-status">
                          <span className="route-icon">🛣️</span>
                          <span className="route-name">{route.name}</span>
                          <span className="route-status-badge closed">ĐÓNG</span>
                        </div>
                        <div className="route-description">{route.description}</div>
                        {route.details && route.details.length > 0 && (
                          <div className="incident-list">
                            {route.details.map((d, j) => (
                              <div key={j} className="incident-item">
                                <span className="incident-icon">⚠️</span>
                                {d.description}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="alert-advice critical">
                    🚨 Nên hoãn chuyến đi hoặc chọn phương tiện khác (máy bay)
                  </div>
                </div>
              );
            }
            if (issue.type === 'some_critical_routes_closed') {
              const openRoutes = issue.routes?.filter(r => r.isOpen) || [];
              const closedRoutes = issue.routes?.filter(r => !r.isOpen) || [];
              
              return (
                <div key={index} className="alert-item info road-closure-info">
                  <div className="alert-header">
                    ℹ️ THÔNG TIN ĐƯỜNG ĐI
                  </div>
                  <div className="alert-details">
                    {/* Đường đóng */}
                    {closedRoutes.length > 0 && (
                      <div className="routes-section closed-section">
                        <div className="section-title">🚫 Đường đang đóng:</div>
                        {closedRoutes.map((route, i) => (
                          <div key={i} className="closed-route-item">
                            <div className="route-name-status">
                              <span className="route-icon">🛣️</span>
                              <span className="route-name">{route.name}</span>
                              <span className="route-status-badge closed">ĐÓNG</span>
                            </div>
                            <div className="route-description">{route.description}</div>
                            {route.incidents > 0 && (
                              <div className="incident-count">
                                ⚠️ {route.incidents} sự cố
                              </div>
                            )}
                            {route.details && route.details.length > 0 && (
                              <div className="incident-list">
                                {route.details.map((d, j) => (
                                  <div key={j} className="incident-item">
                                    → {d.description}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Đường còn mở */}
                    {openRoutes.length > 0 && (
                      <div className="routes-section open-section">
                        <div className="section-title">✅ Đường còn mở:</div>
                        {openRoutes.map((route, i) => (
                          <div key={i} className="open-route-item">
                            <div className="route-name-status">
                              <span className="route-icon">🛣️</span>
                              <span className="route-name">{route.name}</span>
                              <span className="route-status-badge open">MỞ</span>
                            </div>
                            <div className="route-description">{route.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="alert-advice">
                    💡 Còn {openRoutes.length} đường khác để vào. Nên kiểm tra tình trạng trước khi đi.
                  </div>
                </div>
              );
            }
            if (issue.type === 'secondary_routes_closed') {
              return (
                <div key={index} className="alert-item info">
                  ℹ️ Một số đường phụ bị đóng
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
