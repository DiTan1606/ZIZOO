// src/components/DailyRouteMap.js - Hiển thị route cho từng ngày với Google Maps
import React, { useState, useEffect, useRef } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export default function DailyRouteMap({ day, dayNumber, destination }) {
    const [locations, setLocations] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const directionsRendererRef = useRef(null);

    useEffect(() => {
        if (showMap && day?.activities && destination) {
            geocodeLocations();
        }
    }, [showMap, day, destination]);

    useEffect(() => {
        if (showMap && locations.length > 0 && !mapInstanceRef.current) {
            initMap();
        }
    }, [showMap, locations]);

    const geocodeLocations = async () => {
        setLoading(true);
        try {
            const activities = day.activities.filter(act => act.location);
            
            const geocoded = await Promise.all(
                activities.map(async (activity) => {
                    try {
                        // Sử dụng Google Geocoding API
                        let searchQuery = `${activity.location}, ${destination}, Vietnam`;
                        if (activity.address) {
                            searchQuery = `${activity.location}, ${activity.address}, ${destination}`;
                        }
                        
                        const response = await fetch(
                            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}`
                        );
                        const data = await response.json();
                        
                        if (data.status === 'OK' && data.results.length > 0) {
                            const { lat, lng } = data.results[0].geometry.location;
                            console.log(`✅ ${activity.location} found at:`, { lat, lng });
                            return {
                                ...activity,
                                lat,
                                lng,
                                address: data.results[0].formatted_address
                            };
                        } else {
                            console.warn(`⚠️ Could not geocode: ${activity.location}`);
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
            
            // Tính route info
            if (validLocations.length >= 2) {
                calculateRouteInfo(validLocations);
            }
        } catch (error) {
            console.error('Error geocoding:', error);
        }
        setLoading(false);
    };

    // Kiểm tra xem có đường đi giữa 2 điểm không
    const checkIfReachable = (directionsService, from, to) => {
        return new Promise((resolve) => {
            directionsService.route(
                {
                    origin: { lat: from.lat, lng: from.lng },
                    destination: { lat: to.lat, lng: to.lng },
                    travelMode: window.google.maps.TravelMode.DRIVING
                },
                (result, status) => {
                    resolve(status === 'OK');
                }
            );
        });
    };

    const calculateRouteInfo = async (locs) => {
        if (!window.google || locs.length < 2) return;

        try {
            const directionsService = new window.google.maps.DirectionsService();
            
            // Lọc địa điểm: chỉ giữ lại địa điểm có đường đi
            const validLocs = [];
            const islandLocs = [];
            
            // Kiểm tra từng địa điểm xem có thể đi đường bộ không
            for (let i = 0; i < locs.length; i++) {
                if (i === 0) {
                    validLocs.push(locs[i]); // Điểm đầu luôn giữ
                    continue;
                }
                
                // Thử tìm đường từ điểm trước đó đến điểm này
                const canReach = await checkIfReachable(
                    directionsService,
                    validLocs[validLocs.length - 1],
                    locs[i]
                );
                
                if (canReach) {
                    validLocs.push(locs[i]);
                } else {
                    islandLocs.push(locs[i]);
                    console.log(`⚠️ ${locs[i].name} - Không có đường bộ (đảo/biển)`);
                }
            }
            
            console.log(`✅ ${validLocs.length} địa điểm có đường, ${islandLocs.length} địa điểm đảo/biển`);
            
            // Nếu không có đủ địa điểm để vẽ route
            if (validLocs.length < 2) {
                setRouteInfo({
                    totalDistance: 'N/A',
                    totalDuration: 'N/A',
                    route: null,
                    error: 'Hầu hết địa điểm cần đi tàu/phà'
                });
                return;
            }
            
            // Vẽ route cho các địa điểm hợp lệ
            const origin = { lat: validLocs[0].lat, lng: validLocs[0].lng };
            const destination = { lat: validLocs[validLocs.length - 1].lat, lng: validLocs[validLocs.length - 1].lng };
            const waypoints = validLocs.slice(1, -1).map(loc => ({
                location: { lat: loc.lat, lng: loc.lng },
                stopover: true
            }));

            directionsService.route(
                {
                    origin,
                    destination,
                    waypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                    optimizeWaypoints: true
                },
                (result, status) => {
                    if (status === 'OK') {
                        // Tính tổng khoảng cách và thời gian
                        let totalDistance = 0;
                        let totalDuration = 0;
                        
                        result.routes[0].legs.forEach(leg => {
                            totalDistance += leg.distance.value;
                            totalDuration += leg.duration.value;
                        });

                        setRouteInfo({
                            totalDistance: (totalDistance / 1000).toFixed(1), // km
                            totalDuration: Math.round(totalDuration / 60), // minutes
                            route: result.routes[0],
                            warning: islandLocs.length > 0 ? `${islandLocs.length} địa điểm cần đi tàu/phà (đã loại khỏi lộ trình)` : null
                        });

                        // Render route trên map
                        if (directionsRendererRef.current) {
                            directionsRendererRef.current.setDirections(result);
                        }
                    } else {
                        // Không tìm thấy đường đi (có thể là đảo/biển)
                        console.warn(`⚠️ Không tìm thấy đường đi: ${status}`);
                        
                        // Vẫn hiển thị markers nhưng không có route
                        setRouteInfo({
                            totalDistance: 'N/A',
                            totalDuration: 'N/A',
                            route: null,
                            error: status === 'ZERO_RESULTS' ? 'Một số địa điểm cần đi tàu/phà' : 'Không tìm thấy đường đi'
                        });
                    }
                }
            );
        } catch (error) {
            console.error('Error calculating route:', error);
        }
    };

    const initMap = () => {
        if (!window.google || !mapRef.current || locations.length === 0) return;

        try {
            // Tính center từ tất cả locations
            const bounds = new window.google.maps.LatLngBounds();
            locations.forEach(loc => {
                bounds.extend({ lat: loc.lat, lng: loc.lng });
            });

            const center = bounds.getCenter();

            // Tạo map
            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: center.lat(), lng: center.lng() },
                zoom: 13,
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true
            });

            mapInstanceRef.current = map;

            // Fit bounds
            map.fitBounds(bounds);

            // Thêm markers
            locations.forEach((loc, index) => {
                new window.google.maps.Marker({
                    position: { lat: loc.lat, lng: loc.lng },
                    map: map,
                    label: {
                        text: `${index + 1}`,
                        color: 'white',
                        fontWeight: 'bold'
                    },
                    title: loc.location
                });
            });

            // Tạo DirectionsRenderer để vẽ route
            if (locations.length >= 2) {
                const directionsRenderer = new window.google.maps.DirectionsRenderer({
                    map: map,
                    suppressMarkers: true, // Không hiển thị markers mặc định
                    polylineOptions: {
                        strokeColor: '#4285F4',
                        strokeWeight: 4
                    }
                });
                directionsRendererRef.current = directionsRenderer;

                // Tính và vẽ route
                calculateRouteInfo(locations);
            }
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    };

    if (!day || !day.activities || day.activities.length === 0) {
        return null;
    }

    return (
        <div style={{ marginTop: '20px' }}>
            <button
                onClick={() => setShowMap(!showMap)}
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
                {showMap ? '🗺️ Ẩn bản đồ' : '🗺️ Xem bản đồ & lộ trình'}
            </button>

            {showMap && (
                <div>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <p>⏳ Đang tải bản đồ...</p>
                        </div>
                    )}

                    {!loading && locations.length === 0 && (
                        <div style={{ 
                            padding: '20px', 
                            backgroundColor: '#fef3c7', 
                            borderRadius: '8px',
                            border: '1px solid #fbbf24'
                        }}>
                            <p>⚠️ Không thể tìm thấy tọa độ cho các địa điểm.</p>
                        </div>
                    )}

                    {!loading && locations.length > 0 && (
                        <>
                            {/* Route Info */}
                            {routeInfo && (
                                <div style={{
                                    padding: '15px',
                                    backgroundColor: routeInfo.error ? '#fff3cd' : '#dbeafe',
                                    borderRadius: '8px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    gap: '20px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap'
                                }}>
                                    {routeInfo.error ? (
                                        <div style={{ color: '#856404', width: '100%' }}>
                                            <strong>⚠️ Lưu ý:</strong> {routeInfo.error}
                                            <div style={{ fontSize: '0.9em', marginTop: '5px' }}>
                                                Các địa điểm vẫn được hiển thị trên bản đồ. Một số địa điểm có thể cần phương tiện đặc biệt (tàu, phà).
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <strong>📏 Tổng quãng đường:</strong> {routeInfo.totalDistance} km
                                            </div>
                                            <div>
                                                <strong>⏱️ Thời gian di chuyển:</strong> ~{routeInfo.totalDuration} phút
                                            </div>
                                            {routeInfo.warning && (
                                                <div style={{ color: '#856404', fontSize: '0.9em', width: '100%', marginTop: '5px' }}>
                                                    ⚠️ {routeInfo.warning}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Map Container */}
                            <div
                                ref={mapRef}
                                style={{
                                    width: '100%',
                                    height: '400px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb',
                                    overflow: 'hidden'
                                }}
                            />

                            {/* Locations List */}
                            <div style={{ marginTop: '15px' }}>
                                <h4 style={{ marginBottom: '10px', color: '#374151' }}>
                                    📍 Các điểm tham quan ({locations.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {locations.map((loc, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: '10px',
                                                backgroundColor: '#f9fafb',
                                                borderRadius: '6px',
                                                border: '1px solid #e5e7eb',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px'
                                            }}
                                        >
                                            <span style={{
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '12px'
                                            }}>
                                                {index + 1}
                                            </span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', color: '#111827' }}>
                                                    {loc.location}
                                                </div>
                                                {loc.time && (
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        ⏰ {loc.time}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
