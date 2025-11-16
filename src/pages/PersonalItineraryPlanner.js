// src/pages/PersonalItineraryPlanner.js
import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import MapViewer from '../components/MapViewer';
import { createPersonalItinerary } from '../services/personalItineraryService';

// Import services
import {
    TRAVEL_STYLES,
    TRAVEL_GROUPS,
    INTERESTS,
    validatePersonalInput,
    calculatePersonalSummary
} from '../services/personalInputService';

export default function PersonalItineraryPlanner() {
    const { currentUser } = useAuth();
    const [prefs, setPrefs] = useState({
        destination: '',
        duration: 3,
        travelers: 2,
        budget: 5000000,
        travelStyle: 'standard',
        interests: []
    });

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generatingStep, setGeneratingStep] = useState('');
    const [mapReady, setMapReady] = useState(false);

    const mapRef = useRef(null);
    const mapInitialized = useRef(false);

    // Tính toán summary
    const tripSummary = calculatePersonalSummary({
        ...prefs,
        departureDate: format(new Date(), 'yyyy-MM-dd')
    });

    // Khởi tạo map
    const handleMapReady = () => {
        if (mapInitialized.current) return;
        mapInitialized.current = true;
        setMapReady(true);
    };

    // Tạo lịch trình
    const handleGenerate = async () => {
        if (!currentUser) {
            toast.error('🔐 Vui lòng đăng nhập để tạo lịch trình!');
            return;
        }

        if (!prefs.destination.trim()) {
            toast.error('🎯 Vui lòng nhập điểm đến!');
            return;
        }

        if (loading) return;

        setLoading(true);
        setGeneratingStep('Đang khởi tạo...');

        try {
            console.log('🔧 Bắt đầu tạo lịch trình...');

            setGeneratingStep('Đang tìm địa điểm phù hợp...');
            const itinerary = await createPersonalItinerary(
                prefs,
                currentUser.uid,
                mapRef.current?.map
            );

            setResult(itinerary);
            toast.success('🎉 Lịch trình đã sẵn sàng!');
        } catch (err) {
            console.error('Lỗi tạo itinerary:', err);
            toast.error(`❌ ${err.message || 'Lỗi tạo lịch trình'}`);
        } finally {
            setLoading(false);
            setGeneratingStep('');
        }
    };

    // Xử lý thay đổi interests
    const handleInterestChange = (interestValue) => {
        setPrefs(prev => ({
            ...prev,
            interests: prev.interests.includes(interestValue)
                ? prev.interests.filter(i => i !== interestValue)
                : [...prev.interests, interestValue]
        }));
    };

    // Định dạng tiền
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-3">
                    🗺️ Tạo Lịch Trình Du Lịch
                </h1>
                <p className="text-gray-600">
                    Chỉ cần nhập điểm đến - chúng tôi lo phần còn lại!
                </p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">

                {/* ĐIỂM ĐẾN */}
                <div className="mb-6">
                    <label className="block text-lg font-semibold text-gray-800 mb-3">
                        🎯 Bạn muốn đi đâu?
                    </label>
                    <input
                        type="text"
                        value={prefs.destination}
                        onChange={e => setPrefs({ ...prefs, destination: e.target.value })}
                        placeholder="Nhập tỉnh/thành phố (ví dụ: Đà Lạt, Nha Trang, Phú Quốc...)"
                        className="w-full p-4 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                        💡 Gợi ý: Hà Nội, Đà Nẵng, Hội An, Đà Lạt, Phú Quốc, Nha Trang...
                    </p>
                </div>

                {/* 4 THÔNG TIN CƠ BẢN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Số ngày */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            ⏱️ Số ngày
                        </label>
                        <select
                            value={prefs.duration}
                            onChange={e => setPrefs({ ...prefs, duration: +e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={2}>2 ngày 1 đêm</option>
                            <option value={3}>3 ngày 2 đêm</option>
                            <option value={4}>4 ngày 3 đêm</option>
                            <option value={5}>5 ngày 4 đêm</option>
                            <option value={7}>7 ngày 6 đêm</option>
                        </select>
                    </div>

                    {/* Số người */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            👥 Số người
                        </label>
                        <select
                            value={prefs.travelers}
                            onChange={e => setPrefs({ ...prefs, travelers: +e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={1}>1 người</option>
                            <option value={2}>2 người</option>
                            <option value={3}>3 người</option>
                            <option value={4}>4 người</option>
                            <option value={5}>5 người</option>
                            <option value={6}>6 người</option>
                            <option value={8}>8 người</option>
                            <option value={10}>10 người</option>
                        </select>
                    </div>

                    {/* Ngân sách - NHẬP TÙY Ý */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            💰 Ngân sách (VNĐ)
                        </label>
                        <input
                            type="number"
                            value={prefs.budget}
                            onChange={e => setPrefs({ ...prefs, budget: +e.target.value })}
                            placeholder="Nhập số tiền..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="100000"
                            step="100000"
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                            {[1000000, 2000000, 5000000, 10000000, 20000000].map(amount => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setPrefs({ ...prefs, budget: amount })}
                                    className={`px-2 py-1 text-xs rounded border ${
                                        prefs.budget === amount
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-gray-100 text-gray-700 border-gray-300'
                                    }`}
                                >
                                    {formatMoney(amount)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Phong cách */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            💼 Phong cách
                        </label>
                        <select
                            value={prefs.travelStyle}
                            onChange={e => setPrefs({ ...prefs, travelStyle: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {TRAVEL_STYLES.map(style => (
                                <option key={style.value} value={style.value}>
                                    {style.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* SỞ THÍCH */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                        🎯 Sở thích của bạn (tuỳ chọn)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {INTERESTS.map(interest => (
                            <label
                                key={interest.value}
                                className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-all text-sm ${
                                    prefs.interests.includes(interest.value)
                                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={prefs.interests.includes(interest.value)}
                                    onChange={() => handleInterestChange(interest.value)}
                                    className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="flex items-center gap-1">
                                    <span>{interest.icon}</span>
                                    <span>{interest.label}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Thông tin ngân sách */}
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <div className="text-center">
                        <p className="text-lg font-semibold text-blue-800">
                            💰 Ngân sách của bạn: {formatMoney(prefs.budget)}
                        </p>
                        <p className="text-sm text-blue-600">
                            {prefs.travelers} người × {prefs.duration} ngày = {formatMoney(prefs.budget / prefs.travelers)}/người
                        </p>
                    </div>
                </div>

                {/* Nút tạo */}
                <button
                    onClick={handleGenerate}
                    disabled={loading || !prefs.destination.trim()}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>{generatingStep || 'Đang tạo lịch trình...'}</span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-xl">🚀</span>
                            <span>TẠO LỊCH TRÌNH NGAY</span>
                        </div>
                    )}
                </button>

                {/* Thông báo trạng thái */}
                <div className="mt-3 text-center">
                    {!currentUser ? (
                        <p className="text-red-600 font-semibold">
                            🔐 Vui lòng đăng nhập để tạo lịch trình!
                        </p>
                    ) : !prefs.destination.trim() ? (
                        <p className="text-orange-600">
                            🎯 Hãy nhập điểm đến để bắt đầu
                        </p>
                    ) : (
                        <p className="text-green-600 font-semibold">
                            ✅ Sẵn sàng tạo lịch trình cho {prefs.destination}!
                        </p>
                    )}
                </div>
            </div>

            {/* Map */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
                <div className="bg-blue-600 text-white p-4">
                    <h3 className="text-lg font-bold">
                        🗺️ Bản đồ {prefs.destination || 'điểm đến'}
                    </h3>
                </div>
                <div className="h-64 md:h-80">
                    <MapViewer
                        ref={mapRef}
                        points={[]}
                        showRoute={false}
                        onMapReady={handleMapReady}
                        center={{ lat: 16.0471, lng: 108.2258 }}
                    />
                </div>
            </div>

            {/* Kết quả */}
            {result && (
                <div className="space-y-6 animate-fade-in">
                    {/* Header kết quả */}
                    <div className="text-center bg-gradient-to-r from-green-400 to-blue-500 text-white py-6 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-bold mb-2">🎉 Lịch Trình Đã Sẵn Sàng!</h2>
                        <p className="text-lg">
                            {result.summary.destination} • {result.summary.duration} ngày • {result.summary.travelers} người
                        </p>
                        <p className="text-sm opacity-90 mt-1">
                            {result.summary.style} • {result.summary.totalPlaces} địa điểm
                        </p>
                    </div>

                    {/* Chi phí */}
                    {result.costBreakdown && (
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 p-6 rounded-xl">
                            <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2 text-lg">
                                💰 Tổng chi phí ước tính
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-xl font-bold text-green-600">
                                        {formatMoney(result.costBreakdown.total)}
                                    </div>
                                    <div className="text-xs text-green-700 font-semibold">Tổng cộng</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-lg font-bold text-blue-600">
                                        {formatMoney(result.costBreakdown.perPerson)}
                                    </div>
                                    <div className="text-xs text-blue-700">/ người</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-lg font-bold text-orange-600">
                                        {formatMoney(Math.round(result.costBreakdown.total / result.summary.duration))}
                                    </div>
                                    <div className="text-xs text-orange-700">/ ngày</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-lg font-bold text-purple-600">
                                        {formatMoney(result.costBreakdown.accommodations)}
                                    </div>
                                    <div className="text-xs text-purple-700">Chỗ ở</div>
                                </div>
                                <div className={`p-3 rounded-lg shadow-sm ${
                                    result.costBreakdown.withinBudget ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                    <div className={`text-lg font-bold ${
                                        result.costBreakdown.withinBudget ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {result.costBreakdown.withinBudget ? '✅ Đủ ngân sách' : '⚠️ Vượt ngân sách'}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {formatMoney(prefs.budget)} → {formatMoney(result.costBreakdown.total)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lịch trình hàng ngày */}
                    {result.dailyPlan && result.dailyPlan.map(dayPlan => (
                        <div key={dayPlan.day} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                                <h3 className="text-lg font-bold">
                                    📅 Ngày {dayPlan.day} - {dayPlan.date}
                                </h3>
                                {dayPlan.theme && (
                                    <p className="text-blue-100 text-sm mt-1">{dayPlan.theme}</p>
                                )}
                            </div>

                            <div className="p-4">
                                {/* Địa điểm */}
                                <div className="mb-6">
                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        📍 Địa điểm tham quan
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                            {dayPlan.places.length} địa điểm
                                        </span>
                                    </h4>
                                    <div className="space-y-3">
                                        {dayPlan.places.map((place, index) => (
                                            <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${
                                                    place.isPhotographySpot ? 'bg-green-500' : 'bg-blue-500'
                                                }`}></div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className="font-semibold text-gray-900">{place.name}</span>
                                                        {place.isPhotographySpot && (
                                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                                📸 Ảnh đẹp
                                                            </span>
                                                        )}
                                                        <span className="text-sm text-gray-500 flex items-center gap-1">
                                                            ⭐ {place.rating}
                                                            {place.userRatingsTotal && (
                                                                <span>({place.userRatingsTotal})</span>
                                                            )}
                                                        </span>
                                                        {place.pricePerPerson > 0 && (
                                                            <span className="text-sm text-orange-600 font-medium">
                                                                💰 {formatMoney(place.pricePerPerson)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-2">{place.address}</p>

                                                    {place.bestVisitTime && (
                                                        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                                            <span>🕒</span>
                                                            <span>Thời gian tốt nhất: {place.bestVisitTime}</span>
                                                        </div>
                                                    )}

                                                    {place.photographyInfo && place.photographyInfo.photoTips && (
                                                        <div className="mt-2">
                                                            <p className="text-xs font-medium text-gray-700 mb-1">📷 Mẹo chụp ảnh:</p>
                                                            <ul className="text-xs text-gray-600 space-y-1">
                                                                {place.photographyInfo.photoTips.slice(0, 2).map((tip, tipIndex) => (
                                                                    <li key={tipIndex}>• {tip}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Trải nghiệm ẩm thực */}
                                {dayPlan.foodExperiences && dayPlan.foodExperiences.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                            🍽️ Trải nghiệm ẩm thực
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {dayPlan.foodExperiences.map((food, index) => (
                                                <div key={index} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                                    <div className="text-orange-500 text-xl">🍴</div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-orange-800">{food.name}</div>
                                                        <div className="text-sm text-orange-700">{food.specialty}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs text-gray-600">⭐ {food.rating}</span>
                                                            {food.pricePerPerson && (
                                                                <span className="text-xs text-gray-600">
                                                                    💰 {formatMoney(food.pricePerPerson)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Thông tin bổ sung */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Điểm chụp ảnh */}
                                    {dayPlan.photographySpots && dayPlan.photographySpots.length > 0 && (
                                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                            <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                                                📸 Điểm chụp ảnh
                                            </h4>
                                            <div className="text-sm text-green-700">
                                                <p>Có {dayPlan.photographySpots.length} điểm chụp ảnh đẹp trong ngày</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Ghi chú */}
                                    {dayPlan.notes && (
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                                💡 Ghi chú
                                            </h4>
                                            <div className="text-sm text-blue-700">
                                                {Array.isArray(dayPlan.notes)
                                                    ? dayPlan.notes.map((note, idx) => <p key={idx}>• {note}</p>)
                                                    : <p>• {dayPlan.notes}</p>
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Đặc sản địa phương */}
                    {result.specialties && result.specialties.length > 0 && (
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-6 rounded-xl">
                            <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2 text-lg">
                                🍜 Đặc sản địa phương không thể bỏ lỡ
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {result.specialties.map((specialty, index) => (
                                    <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
                                        <div className="font-semibold text-orange-700 mb-2">{specialty.name}</div>
                                        <div className="text-sm text-orange-600 mb-3">{specialty.description}</div>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            {specialty.price > 0 ? (
                                                <span className="font-medium text-green-600">
                                                    💰 {formatMoney(specialty.price)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">💵 Giá tham khảo</span>
                                            )}
                                            {specialty.bestSeason && specialty.bestSeason !== 'Cả năm' && (
                                                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded">
                                                    🗓️ {specialty.bestSeason}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mẹo và gợi ý */}
                    {result.tips && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Mẹo chụp ảnh */}
                            {result.tips.photography && result.tips.photography.length > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                                    <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                                        📷 Mẹo chụp ảnh
                                    </h3>
                                    <ul className="text-sm text-yellow-700 space-y-2">
                                        {result.tips.photography.map((tip, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span>•</span>
                                                <span>{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Thời gian tốt nhất */}
                            {result.tips.bestTimes && result.tips.bestTimes.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                                    <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                        ⏰ Thời gian tham quan tốt nhất
                                    </h3>
                                    <ul className="text-sm text-blue-700 space-y-2">
                                        {result.tips.bestTimes.map((time, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span>•</span>
                                                <span>{time}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Điểm nổi bật */}
                    {result.highlights && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 p-6 rounded-xl">
                            <h3 className="font-bold text-purple-800 mb-4 text-lg text-center">
                                ✨ Điểm nổi bật trong chuyến đi
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {result.highlights.mustVisit && result.highlights.mustVisit.length > 0 && (
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">⭐</div>
                                        <div className="font-semibold text-purple-700">Must-visit</div>
                                        <div className="text-sm text-purple-600">{result.highlights.mustVisit.length} địa điểm</div>
                                    </div>
                                )}
                                {result.highlights.photographyHotspots && result.highlights.photographyHotspots.length > 0 && (
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">📸</div>
                                        <div className="font-semibold text-purple-700">Điểm chụp ảnh</div>
                                        <div className="text-sm text-purple-600">{result.highlights.photographyHotspots.length} điểm</div>
                                    </div>
                                )}
                                {result.highlights.culturalSpots && result.highlights.culturalSpots.length > 0 && (
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">🏛️</div>
                                        <div className="font-semibold text-purple-700">Văn hóa</div>
                                        <div className="text-sm text-purple-600">{result.highlights.culturalSpots.length} điểm</div>
                                    </div>
                                )}
                                {result.highlights.natureSpots && result.highlights.natureSpots.length > 0 && (
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">🌳</div>
                                        <div className="font-semibold text-purple-700">Thiên nhiên</div>
                                        <div className="text-sm text-purple-600">{result.highlights.natureSpots.length} điểm</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}