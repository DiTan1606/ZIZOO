// src/components/DailyRouteMap.js - Hiển thị route cho từng ngày
import React, { useState, useEffect } from 'react';
import { optimizeRouteWithDetails } from '../services/routeOptimizationService';

const GOONG_API_KEY = process.env.REACT_APP_GOONG_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export default function DailyRouteMap({ day, dayNumber, destination }) {
    const [locations, setLocations] = useState([]);
    const [optimizedLocations, setOptimizedLocations] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [optimizing, setOptimizing] = useState(false);

    useEffect(() => {
        if (showMap && day?.activities && destination) {
            geocodeLocations();
        }
    }, [showMap, day, destination]);

    const geocodeLocations = async () => {
        setLoading(true);
        try {
            // Đầu tiên, geocode destination để lấy bounds
            const destResponse = await fetch(
                `https://rsapi.goong.io/geocode?address=${encodeURIComponent(destination + ', Vietnam')}&api_key=${GOONG_API_KEY}`
            );
            const destData = await destResponse.json();
            
            let destinationBounds = null;
            let destinationCenter = null;
            
            if (destData.results && destData.results.length > 0) {
                const result = destData.results[0];
                destinationCenter = result.geometry.location;
                
                // Tạo bounds (vùng giới hạn) xung quanh destination - radius ~20km
                const radius = 0.2;
                destinationBounds = {
                    north: destinationCenter.lat + radius,
                    south: destinationCenter.lat - radius,
                    east: destinationCenter.lng + radius,
                    west: destinationCenter.lng - radius
                };
                console.log(`📍 Destination bounds for ${destination}:`, destinationBounds);
            }
            
            const activities = day.activities.filter(act => act.location);
            
            const geocoded = await Promise.all(
                activities.map(async (activity) => {
                    try {
                        // Thêm destination vào query để tìm trong khu vực
                        let searchQuery = `${activity.location}, ${destination}, Vietnam`;
                        if (activity.address) {
                            searchQuery = `${activity.location}, ${activity.address}, ${destination}`;
                        }
                        
                        const response = await fetch(
                            `https://rsapi.goong.io/geocode?address=${encodeURIComponent(searchQuery)}&api_key=${GOONG_API_KEY}`
                        );
                        const data = await response.json();
                        
                        if (data.results && data.results.length > 0) {
                            // Lọc kết quả trong bounds nếu có
                            let selectedResult = data.results[0];
                            
                            if (destinationBounds) {
                                const resultsInBounds = data.results.filter(result => {
                                    const loc = result.geometry.location;
                                    return loc.lat >= destinationBounds.south &&
                                           loc.lat <= destinationBounds.north &&
                                           loc.lng >= destinationBounds.west &&
                                           loc.lng <= destinationBounds.east;
                                });
                                
                                if (resultsInBounds.length > 0) {
                                    selectedResult = resultsInBounds[0];
                                    console.log(`✅ ${activity.location} found in ${destination}`);
                                } else {
                                    console.warn(`⚠️ ${activity.location} outside ${destination} bounds`);
                                }
                            }
                            
                            const { lat, lng } = selectedResult.geometry.location;
                            return {
                                ...activity,
                                lat,
                                lng
                            };
                        }
                        return null;
                    } catch (error) {
                        console.error('Geocode error:', error);
                        return null;
                    }
                })
            );

            const validLocations = geocoded.filter(loc => loc !== null);
            setLocations(validLocations);
            
            // Tự động tối ưu route nếu có >= 3 điểm
            if (validLocations.length >= 3) {
                await optimizeRoute(validLocations);
            } else {
                setOptimizedLocations(validLocations);
            }
        } catch (error) {
            console.error('Error geocoding:', error);
        }
        setLoading(false);
    };

    const optimizeRoute = async (locs) => {
        setOptimizing(true);
        try {
            const result = await optimizeRouteWithDetails(locs);
            setOptimizedLocations(result.route);
            setRouteInfo(result);
            console.log('Route optimized:', result);
        } catch (error) {
            console.error('Error optimizing route:', error);
            setOptimizedLocations(locs);
        }
        setOptimizing(false);
    };

    if (!day || !day.activities || day.activities.length === 0) {
        return null;
    }

    return (
        <div className="daily-route-map">

            <button
                onClick={() => setShowMap(!showMap)}
                className="show-route-btn"
                style={{
                    padding: '10px 20px',
                    backgroundColor: showMap ? '#6b7280' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '10px',
                    transition: 'all 0.3s'
                }}
            >
                {showMap ? '🗺️ Ẩn bản đồ' : '🗺️ Xem lộ trình trên bản đồ'}
            </button>

            {showMap && (
                <div style={{ marginTop: '15px' }}>
                    {loading || optimizing ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div style={{
                                display: 'inline-block',
                                width: '40px',
                                height: '40px',
                                border: '4px solid #f3f4f6',
                                borderTop: '4px solid #3b82f6',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></div>
                            <p style={{ marginTop: '10px', color: '#6b7280' }}>
                                {optimizing ? 'Đang tối ưu lộ trình...' : 'Đang tải bản đồ...'}
                            </p>
                        </div>
                    ) : optimizedLocations.length >= 2 ? (
                        <div>
                            {/* Route Info */}
                            {routeInfo && routeInfo.savings.percentage > 0 && (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#d1fae5',
                                    borderRadius: '8px',
                                    marginBottom: '15px',
                                    border: '2px solid #10b981'
                                }}>
                                    <p style={{ color: '#065f46', fontWeight: 'bold', marginBottom: '4px' }}>
                                        ✅ Lộ trình đã được tối ưu!
                                    </p>
                                    <p style={{ color: '#047857', fontSize: '14px' }}>
                                        📏 Tổng quãng đường: {routeInfo.totalDistance} km | 
                                        ⏱️ Thời gian di chuyển: ~{routeInfo.totalDuration} phút
                                    </p>
                                    <p style={{ color: '#047857', fontSize: '13px' }}>
                                        💡 Tiết kiệm: {routeInfo.savings.distanceSaved} km ({routeInfo.savings.percentage}%)
                                    </p>
                                </div>
                            )}

                            <iframe
                                width="100%"
                                height="400"
                                style={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                src={`https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${optimizedLocations[0].lat},${optimizedLocations[0].lng}&destination=${optimizedLocations[optimizedLocations.length - 1].lat},${optimizedLocations[optimizedLocations.length - 1].lng}${optimizedLocations.length > 2 ? '&waypoints=' + optimizedLocations.slice(1, -1).map(loc => `${loc.lat},${loc.lng}`).join('|') : ''}&mode=driving`}
                                title={`Route Map Day ${dayNumber}`}
                            />
                            
                            {/* Danh sách điểm đến */}
                            <div style={{ marginTop: '15px', maxHeight: '300px', overflowY: 'auto' }}>
                                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#1f2937' }}>
                                    📍 Lộ trình tối ưu ({optimizedLocations.length} điểm):
                                </h4>
                                {optimizedLocations.map((loc, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px',
                                            padding: '12px',
                                            backgroundColor: '#f9fafb',
                                            borderRadius: '8px',
                                            marginBottom: '8px'
                                        }}
                                    >
                                        <div style={{
                                            flexShrink: 0,
                                            width: '28px',
                                            height: '28px',
                                            backgroundColor: '#3b82f6',
                                            color: 'white',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '14px'
                                        }}>
                                            {index + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>
                                                {loc.location}
                                            </p>
                                            {loc.time && (
                                                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                                                    ⏰ {loc.time}
                                                </p>
                                            )}
                                            {loc.address && (
                                                <p style={{ 
                                                    fontSize: '13px', 
                                                    color: '#3b82f6', 
                                                    marginTop: '4px',
                                                    fontWeight: '500',
                                                    backgroundColor: '#eff6ff',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    display: 'inline-block'
                                                }}>
                                                    📍 {loc.address}
                                                </p>
                                            )}
                                            {loc.description && !loc.address && (
                                                <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
                                                    {loc.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '30px',
                            textAlign: 'center',
                            backgroundColor: '#fef3c7',
                            borderRadius: '8px',
                            color: '#92400e'
                        }}>
                            <p>⚠️ Cần ít nhất 2 địa điểm để hiển thị lộ trình</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
