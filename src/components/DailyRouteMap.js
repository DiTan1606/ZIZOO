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

    const calculateRouteInfo = async (locs) => {
        if (!window.google || locs.length < 2) return;

        try {
            const directionsService = new window.google.maps.DirectionsService();
            
            const origin = { lat: locs[0].lat, lng: locs[0].lng };
            const destination = { lat: locs[locs.length - 1].lat, lng: locs[locs.length - 1].lng };
            const waypoints = locs.slice(1, -1).map(loc => ({
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
                            route: result.routes[0]
                        });

                        // Render route trên map
                        if (directionsRendererRef.current) {
                            directionsRendererRef.current.setDirections(result);
                        }
                    } else {
                        console.error('Directions request failed:', status);
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
                                    backgroundColor: '#dbeafe',
                                    borderRadius: '8px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    gap: '20px',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <strong>📏 Tổng quãng đường:</strong> {routeInfo.totalDistance} km
                                    </div>
                                    <div>
                                        <strong>⏱️ Thời gian di chuyển:</strong> ~{routeInfo.totalDuration} phút
                                    </div>
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
