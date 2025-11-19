// src/pages/RiskMapGoogle.js - Bản đồ dự báo bão và ngập lụt
import React, { useState } from 'react';
import searchIcon from '../icon/search.png';
import Footer from '../components/Footer';

const WINDY_API_KEY = process.env.REACT_APP_WINDY_API_KEY;

export default function RiskMapGoogle() {
    const [selectedLayer, setSelectedLayer] = useState('rain');
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedLocation, setSelectedLocation] = useState(null);
    const [searching, setSearching] = useState(false);

    // Tọa độ mặc định (Việt Nam)
    const [mapCenter, setMapCenter] = useState({ lat: 16.0544, lon: 108.2022, zoom: 6 });

    const layers = [
        { id: 'rain', name: '🌧️ Mưa', color: 'bg-blue-500' },
        { id: 'wind', name: '💨 Gió', color: 'bg-cyan-500' },
        { id: 'clouds', name: '☁️ Mây', color: 'bg-gray-400' },
        { id: 'temp', name: '🌡️ Nhiệt độ', color: 'bg-orange-500' },
        { id: 'pressure', name: '🌀 Áp suất', color: 'bg-purple-500' },
        { id: 'waves', name: '🌊 Sóng biển', color: 'bg-teal-500' },
    ];

    const changeLayer = (layer) => {
        setSelectedLayer(layer);
    };

    const searchLocation = async () => {
        if (!searchQuery.trim()) return;
        
        setSearching(true);
        try {
            // Sử dụng Nominatim API (miễn phí, không cần key)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery + ', Vietnam')}&format=json&limit=5&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'ZIZOO-Travel-App'
                    }
                }
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                // Tự động chọn kết quả đầu tiên
                const firstResult = data[0];
                const lat = parseFloat(firstResult.lat);
                const lon = parseFloat(firstResult.lon);
                
                setMapCenter({ lat, lon, zoom: 10 });
                setSelectedLocation(firstResult);
            } else {
                alert('Không tìm thấy địa điểm này!');
                setSelectedLocation(null);
            }
        } catch (error) {
            console.error('Lỗi tìm kiếm:', error);
            alert('Có lỗi xảy ra khi tìm kiếm!');
        }
        setSearching(false);
    };



    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            searchLocation();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600">
            {/* Header */}
            <div className="bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-4xl font-extrabold text-white mb-2 text-center" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        BẢN ĐỒ DỰ BÁO BÃO VÀ NGẬP LỤT VIỆT NAM
                    </h1>
                    <p className="text-white/90 text-center text-lg" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                        Theo dõi thời tiết thực tế và dự báo 10 ngày tới
                    </p>
                </div>
            </div>

            {/* Search Location */}
            <div className="max-w-7xl mx-auto p-4">
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Tìm kiếm địa điểm:</h3>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập tên địa điểm (VD: Đà Nẵng, Hội An, Phú Quốc...)"
                            className="flex-1 px-6 py-4 text-lg border-2 border-blue-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                        <button
                            onClick={searchLocation}
                            disabled={searching || !searchQuery.trim()}
                            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg font-bold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {searching ? (
                                <>🔄 Đang tìm...</>
                            ) : (
                                <>
                                    <img src={searchIcon} alt="Search" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                                    Tìm kiếm
                                </>
                            )}
                        </button>
                    </div>
                    
                    {selectedLocation && (
                        <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                            <p className="text-green-800 font-bold">
                                ✅ Đã chọn: {selectedLocation.display_name}
                            </p>
                        </div>
                    )}
                </div>

                {/* Layer Controls */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Chọn lớp bản đồ:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {layers.map(layer => (
                            <button
                                key={layer.id}
                                onClick={() => changeLayer(layer.id)}
                                className={`px-4 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-105 ${
                                    selectedLayer === layer.id 
                                        ? `${layer.color} shadow-lg scale-105` 
                                        : 'bg-gray-400 hover:bg-gray-500'
                                }`}
                            >
                                {layer.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Map Container */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <iframe
                        key={`${mapCenter.lat}-${mapCenter.lon}-${mapCenter.zoom}-${selectedLayer}`}
                        width="100%"
                        height="650"
                        src={`https://embed.windy.com/embed2.html?lat=${mapCenter.lat}&lon=${mapCenter.lon}&detailLat=${mapCenter.lat}&detailLon=${mapCenter.lon}&width=650&height=650&zoom=${mapCenter.zoom}&level=surface&overlay=${selectedLayer}&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`}
                        title="Windy Weather Map"
                        style={{ border: 'none' }}
                    />
                </div>

                {/* Info Panel */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mt-4">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4"> Hướng dẫn sử dụng:</h3>
                    <div className="grid md:grid-cols-2 gap-6 text-gray-700">
                        <div>
                            <h4 className="font-bold text-lg mb-2">🎯 Điều khiển bản đồ:</h4>
                            <ul className="space-y-2 ml-4">
                                <li>• Tìm kiếm địa điểm để xem thời tiết chi tiết</li>
                                <li>• Kéo thả để di chuyển bản đồ</li>
                                <li>• Cuộn chuột để phóng to/thu nhỏ</li>
                                <li>• Click vào bản đồ để xem chi tiết</li>
                                <li>• Sử dụng thanh thời gian bên dưới để xem dự báo</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-2">⚠️ Cảnh báo:</h4>
                            <ul className="space-y-2 ml-4">
                                <li>• <span className="text-red-600 font-bold">Đỏ đậm:</span> Nguy hiểm cao</li>
                                <li>• <span className="text-orange-600 font-bold">Cam:</span> Cảnh báo trung bình</li>
                                <li>• <span className="text-yellow-600 font-bold">Vàng:</span> Cần chú ý</li>
                                <li>• <span className="text-green-600 font-bold">Xanh:</span> An toàn</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}