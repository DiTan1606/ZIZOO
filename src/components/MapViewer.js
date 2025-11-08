// src/components/MapViewer.js
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { initPlacesService } from '../services/placesService';

const MapViewer = forwardRef(({ points = [], showRoute = false }, ref) => {
    const mapDivRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useImperativeHandle(ref, () => ({
        get map() {
            return mapInstanceRef.current;
        }
    }));

    useEffect(() => {
        if (!mapDivRef.current) return;

        const initMap = async () => {
            if (!window.google?.maps) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places&callback=onGoogleMapsLoaded`;
                script.async = true;
                window.onGoogleMapsLoaded = () => {
                    createMap();
                };
                document.head.appendChild(script);
            } else {
                createMap();
            }
        };

        const createMap = async () => {
            const center = points[0] || { lat: 16.0471, lng: 108.2258 };
            const map = new window.google.maps.Map(mapDivRef.current, {
                center,
                zoom: 10,
                mapId: 'ZIZOO_MAP',
                disableDefaultUI: false,
            });

            mapInstanceRef.current = map;

            // AUTO INIT PLACES SERVICE NGAY KHI MAP SẴN SÀNG
            await initPlacesService(map);

            // Markers + Route
            points.forEach(p => {
                new window.google.maps.Marker({
                    position: { lat: p.lat, lng: p.lng },
                    map,
                    title: p.name,
                });
            });

            if (showRoute && points.length > 1) {
                const bounds = new window.google.maps.LatLngBounds();
                points.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
                map.fitBounds(bounds);
            }
        };

        initMap();
    }, [points, showRoute]);

    return (
        <div ref={mapDivRef} className="w-full h-96 rounded-xl overflow-hidden shadow-2xl" />
    );
});

MapViewer.displayName = 'MapViewer';
export default MapViewer;