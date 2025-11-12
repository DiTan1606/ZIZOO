// src/components/MapViewer.js
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const MapViewer = forwardRef(({ points = [], showRoute = false, onMapReady, center }, ref) => {
    const mapDivRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const mapInitializedRef = useRef(false);

    useImperativeHandle(ref, () => ({
        get map() {
            return mapInstanceRef.current;
        },
        cleanup: () => {
            // Cleanup markers và map
            markersRef.current.forEach(marker => {
                if (marker.setMap) marker.setMap(null);
            });
            markersRef.current = [];
            if (mapInstanceRef.current) {
                mapInstanceRef.current = null;
            }
            mapInitializedRef.current = false;
        }
    }));

    useEffect(() => {
        // Kiểm tra nếu component đã unmount
        if (!mapDivRef.current || mapInitializedRef.current) {
            return;
        }

        const initMap = async () => {
            try {
                // Kiểm tra lại sau khi await
                if (!mapDivRef.current) {
                    console.warn('Map container không tồn tại');
                    return;
                }

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

                // Kiểm tra lại sau khi load Google Maps
                if (!mapDivRef.current) return;

                const { Map } = window.google.maps;

                const mapCenter = center || (points[0] ? {
                    lat: Number(points[0].lat),
                    lng: Number(points[0].lng)
                } : { lat: 16.0471, lng: 108.2258 });

                // Kiểm tra tọa độ hợp lệ
                if (isNaN(mapCenter.lat) || isNaN(mapCenter.lng)) {
                    console.warn('Tọa độ trung tâm không hợp lệ:', mapCenter);
                    return;
                }

                const map = new Map(mapDivRef.current, {
                    center: mapCenter,
                    zoom: points.length > 1 ? 8 : 10,
                    mapId: 'ZIZOO_MAP_2025',
                    disableDefaultUI: false,
                    gestureHandling: 'greedy',
                    zoomControl: true,
                    streetViewControl: false,
                    fullscreenControl: true
                });

                mapInstanceRef.current = map;
                mapInitializedRef.current = true;

                // Xóa markers cũ
                markersRef.current.forEach(marker => {
                    if (marker.setMap) marker.setMap(null);
                });
                markersRef.current = [];

                // Thêm marker mới với AdvancedMarkerElement nếu có
                const useAdvancedMarkers = window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;

                points.forEach((p, index) => {
                    try {
                        // Đảm bảo lat, lng là số
                        const lat = Number(p.lat);
                        const lng = Number(p.lng);

                        if (isNaN(lat) || isNaN(lng)) {
                            console.warn('Tọa độ không hợp lệ:', p);
                            return;
                        }

                        let marker;

                        if (useAdvancedMarkers) {
                            // Sử dụng AdvancedMarkerElement
                            marker = new window.google.maps.marker.AdvancedMarkerElement({
                                map,
                                position: { lat, lng },
                                title: p.name || `Điểm ${index + 1}`,
                                gmpClickable: true
                            });
                        } else {
                            // Fallback sử dụng Marker cũ
                            marker = new window.google.maps.Marker({
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
                        }

                        // Thêm info window
                        const infoWindow = new window.google.maps.InfoWindow({
                            content: `
                                <div class="p-2 max-w-xs">
                                    <h3 class="font-bold text-sm">${p.name || 'Điểm tham quan'}</h3>
                                    ${p.address ? `<p class="text-xs text-gray-600 mt-1">${p.address}</p>` : ''}
                                    ${p.rating ? `<p class="text-xs text-yellow-600 mt-1">⭐ ${p.rating}</p>` : ''}
                                </div>
                            `
                        });

                        // Thêm sự kiện click cho marker
                        if (useAdvancedMarkers) {
                            marker.addListener('click', () => {
                                infoWindow.open(map, marker);
                            });
                        } else {
                            marker.addListener('click', () => {
                                infoWindow.open(map, marker);
                            });
                        }

                        markersRef.current.push(marker);
                    } catch (error) {
                        console.warn('Lỗi tạo marker:', error);
                    }
                });

                // Tự động zoom nếu có nhiều điểm
                if (showRoute && points.length > 1) {
                    const bounds = new window.google.maps.LatLngBounds();
                    let hasValidPoints = false;

                    points.forEach(p => {
                        const lat = Number(p.lat);
                        const lng = Number(p.lng);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            bounds.extend({ lat, lng });
                            hasValidPoints = true;
                        }
                    });

                    if (hasValidPoints && !bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 50 });
                    }
                }

                // Gọi callback khi map sẵn sàng
                if (onMapReady) {
                    setTimeout(() => {
                        if (mapInstanceRef.current) {
                            onMapReady(map);
                        }
                    }, 100);
                }

                console.log('Map đã sẵn sàng – ZIZOO GO!');

            } catch (err) {
                console.error('Lỗi tải bản đồ:', err);
                mapInitializedRef.current = false;
            }
        };

        // Load Google Maps script nếu chưa có
        if (!window.google?.maps) {
            const scriptId = 'google-maps-script';
            let script = document.getElementById(scriptId);

            if (!script) {
                script = document.createElement('script');
                script.id = scriptId;
                script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places,geocoding&callback=Function.prototype`;
                script.async = true;
                script.defer = true;

                const onScriptLoad = () => {
                    console.log('Google Maps script loaded');
                    if (mapDivRef.current) {
                        initMap();
                    }
                };

                const onScriptError = (error) => {
                    console.error('Lỗi tải Google Maps:', error);
                };

                script.onload = onScriptLoad;
                script.onerror = onScriptError;
                document.head.appendChild(script);
            } else {
                // Script đã tồn tại
                if (window.google?.maps) {
                    initMap();
                } else {
                    // Chờ script load xong
                    script.onload = () => {
                        if (mapDivRef.current) {
                            initMap();
                        }
                    };
                }
            }
        } else {
            // Google Maps đã load, init map ngay
            initMap();
        }

        // Cleanup
        return () => {
            markersRef.current.forEach(marker => {
                if (marker.setMap) marker.setMap(null);
            });
            markersRef.current = [];

            if (mapInstanceRef.current) {
                mapInstanceRef.current = null;
            }
            mapInitializedRef.current = false;
        };
    }, []); // Empty dependency array - chỉ chạy một lần

    // Effect riêng cho points và center
    useEffect(() => {
        if (!mapInstanceRef.current || !points.length) return;

        try {
            // Xóa markers cũ
            markersRef.current.forEach(marker => {
                if (marker.setMap) marker.setMap(null);
            });
            markersRef.current = [];

            const useAdvancedMarkers = window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;

            // Thêm markers mới
            points.forEach((p, index) => {
                try {
                    const lat = Number(p.lat);
                    const lng = Number(p.lng);

                    if (isNaN(lat) || isNaN(lng)) {
                        console.warn('Tọa độ không hợp lệ:', p);
                        return;
                    }

                    let marker;

                    if (useAdvancedMarkers) {
                        marker = new window.google.maps.marker.AdvancedMarkerElement({
                            map: mapInstanceRef.current,
                            position: { lat, lng },
                            title: p.name || `Điểm ${index + 1}`,
                            gmpClickable: true
                        });
                    } else {
                        marker = new window.google.maps.Marker({
                            map: mapInstanceRef.current,
                            position: { lat, lng },
                            title: p.name || `Điểm ${index + 1}`,
                            label: {
                                text: `${index + 1}`,
                                color: 'white',
                                fontWeight: 'bold'
                            }
                        });
                    }

                    // Info window
                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `
                            <div class="p-2 max-w-xs">
                                <h3 class="font-bold text-sm">${p.name || 'Điểm tham quan'}</h3>
                                ${p.address ? `<p class="text-xs text-gray-600 mt-1">${p.address}</p>` : ''}
                                ${p.rating ? `<p class="text-xs text-yellow-600 mt-1">⭐ ${p.rating}</p>` : ''}
                            </div>
                        `
                    });

                    if (useAdvancedMarkers) {
                        marker.addListener('click', () => {
                            infoWindow.open(mapInstanceRef.current, marker);
                        });
                    } else {
                        marker.addListener('click', () => {
                            infoWindow.open(mapInstanceRef.current, marker);
                        });
                    }

                    markersRef.current.push(marker);
                } catch (error) {
                    console.warn('Lỗi tạo marker:', error);
                }
            });

            // Update bounds nếu có nhiều điểm
            if (showRoute && points.length > 1) {
                const bounds = new window.google.maps.LatLngBounds();
                let hasValidPoints = false;

                points.forEach(p => {
                    const lat = Number(p.lat);
                    const lng = Number(p.lng);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        bounds.extend({ lat, lng });
                        hasValidPoints = true;
                    }
                });

                if (hasValidPoints && !bounds.isEmpty()) {
                    mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
                }
            } else if (points.length === 1) {
                // Center map trên điểm duy nhất
                const point = points[0];
                const lat = Number(point.lat);
                const lng = Number(point.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    mapInstanceRef.current.setCenter({ lat, lng });
                    mapInstanceRef.current.setZoom(12);
                }
            }

        } catch (error) {
            console.error('Lỗi cập nhật markers:', error);
        }
    }, [points, showRoute]); // Chỉ phụ thuộc vào points và showRoute

    // Effect riêng cho center
    useEffect(() => {
        if (!mapInstanceRef.current || !center) return;

        try {
            const lat = Number(center.lat);
            const lng = Number(center.lng);

            if (!isNaN(lat) && !isNaN(lng)) {
                mapInstanceRef.current.setCenter({ lat, lng });

                // Chỉ zoom nếu không có points hoặc chỉ có 1 point
                if (!points.length || points.length === 1) {
                    mapInstanceRef.current.setZoom(12);
                }
            }
        } catch (error) {
            console.warn('Lỗi cập nhật center:', error);
        }
    }, [center]); // Chỉ phụ thuộc vào center

    return (
        <div
            ref={mapDivRef}
            className="w-full h-full rounded-xl"
            style={{ minHeight: '400px' }}
            key="map-container"
        />
    );
});

MapViewer.displayName = 'MapViewer';
export default MapViewer;