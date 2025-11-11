// src/components/MapViewer.js
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const MapViewer = forwardRef(({ points = [], showRoute = false, onMapReady, center }, ref) => {
    const mapDivRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);

    useImperativeHandle(ref, () => ({
        get map() {
            return mapInstanceRef.current;
        }
    }));

    useEffect(() => {
        if (!mapDivRef.current) return;

        const initMap = async () => {
            try {
                // Đợi Google Maps API load xong
                if (!window.google?.maps?.Map) {
                    await new Promise((resolve, reject) => {
                        const checkGoogle = () => {
                            if (window.google?.maps?.Map) {
                                resolve();
                            } else {
                                setTimeout(checkGoogle, 100);
                            }
                        };
                        checkGoogle();
                    });
                }

                const { Map } = window.google.maps;

                const mapCenter = center || (points[0] ? {
                    lat: Number(points[0].lat),
                    lng: Number(points[0].lng)
                } : { lat: 16.0471, lng: 108.2258 });

                const map = new Map(mapDivRef.current, {
                    center: mapCenter,
                    zoom: points.length > 1 ? 8 : 10,
                    mapId: 'ZIZOO_MAP_2025',
                    disableDefaultUI: false,
                    gestureHandling: 'greedy',
                    zoomControl: true,
                    streetViewControl: false
                });

                mapInstanceRef.current = map;

                // Xóa markers cũ
                markersRef.current.forEach(marker => marker.setMap(null));
                markersRef.current = [];

                // Thêm marker mới với Marker thông thường
                points.forEach((p, index) => {
                    try {
                        // Đảm bảo lat, lng là số
                        const lat = Number(p.lat);
                        const lng = Number(p.lng);

                        if (isNaN(lat) || isNaN(lng)) {
                            console.warn('Tọa độ không hợp lệ:', p);
                            return;
                        }

                        const marker = new window.google.maps.Marker({
                            map,
                            position: { lat, lng },
                            title: p.name || `Điểm ${index + 1}`,
                            label: {
                                text: `${index + 1}`,
                                color: 'white',
                                fontWeight: 'bold'
                            },
                            animation: window.google.maps.Animation.DROP
                        });

                        // Thêm info window
                        const infoWindow = new window.google.maps.InfoWindow({
                            content: `
                                <div class="p-2">
                                    <h3 class="font-bold">${p.name || 'Điểm tham quan'}</h3>
                                    ${p.address ? `<p class="text-sm text-gray-600">${p.address}</p>` : ''}
                                </div>
                            `
                        });

                        marker.addListener('click', () => {
                            infoWindow.open(map, marker);
                        });

                        markersRef.current.push(marker);
                    } catch (error) {
                        console.warn('Lỗi tạo marker:', error);
                    }
                });

                // Tự động zoom nếu có nhiều điểm
                if (showRoute && points.length > 1) {
                    const bounds = new window.google.maps.LatLngBounds();
                    points.forEach(p => {
                        const lat = Number(p.lat);
                        const lng = Number(p.lng);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            bounds.extend({ lat, lng });
                        }
                    });
                    if (!bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 50 });
                    }
                }

                // Gọi callback khi map sẵn sàng
                if (onMapReady) {
                    setTimeout(() => onMapReady(map), 100);
                }

                console.log('Map đã sẵn sàng – ZIZOO GO!');

            } catch (err) {
                console.error('Lỗi tải bản đồ:', err);
            }
        };

        // Load Google Maps script nếu chưa có
        if (!window.google?.maps) {
            const scriptId = 'google-maps-script';
            if (!document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places,geocoding`;
                script.async = true;
                script.onload = () => {
                    console.log('Google Maps script loaded');
                    initMap();
                };
                script.onerror = (error) => {
                    console.error('Lỗi tải Google Maps:', error);
                };
                document.head.appendChild(script);
            } else {
                // Script đã tồn tại, init map sau khi load
                if (window.google?.maps) {
                    initMap();
                } else {
                    const checkMap = () => {
                        if (window.google?.maps) {
                            initMap();
                        } else {
                            setTimeout(checkMap, 100);
                        }
                    };
                    checkMap();
                }
            }
        } else {
            initMap();
        }

        // Cleanup
        return () => {
            markersRef.current.forEach(marker => {
                marker.setMap(null);
            });
            markersRef.current = [];
        };
    }, [points, showRoute, onMapReady, center]);

    return (
        <div
            ref={mapDivRef}
            className="w-full h-full rounded-xl"
            style={{ minHeight: '400px' }}
        />
    );
});

MapViewer.displayName = 'MapViewer';
export default MapViewer;