import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Đảm bảo CSS được import

// Tùy chỉnh icon mặc định cho Marker (bắt buộc với Leaflet khi dùng CDN)
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const MapViewer = forwardRef(({ points = [], showRoute = false }, ref) => {
  const mapRef = useRef(null);

  useImperativeHandle(ref, () => ({
    get map() {
      return mapRef.current;
    },
  }));

  useEffect(() => {
    if (mapRef.current) {
      ref.current = { map: mapRef.current };
    }
  }, []);

  return (
    <MapContainer
      center={points[0] || { lat: 16.0471, lng: 108.2258 }} // Đà Nẵng làm mặc định
      zoom={8}
      style={{ height: '400px', width: '100%', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
      ref={mapRef}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {points.map((point, index) => (
        <Marker key={index} position={[point.lat, point.lng]} icon={defaultIcon}>
          <Popup>{point.name}</Popup>
        </Marker>
      ))}
      {showRoute && points.length > 1 && (
        <></> // Placeholder cho route (OSM không có Directions API miễn phí, cần tự viết logic)
      )}
    </MapContainer>
  );
});

MapViewer.displayName = 'MapViewer';
export default MapViewer;