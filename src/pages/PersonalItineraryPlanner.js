// src/pages/PersonalItineraryPlanner.js
import React, { useState, useRef, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import MapViewer from '../components/MapViewer';
import { createPersonalItinerary } from '../services/personalItineraryService';

// Import services
import {
    TRAVEL_STYLES,
    TRAVEL_GROUPS,
    AGE_GROUPS,
    TRAVEL_PACES,
    ACCOMMODATION_TYPES,
    TRANSPORTATION_OPTIONS,
    INTERESTS,
    DIET_PREFERENCES,
    ACTIVITY_TYPES,
    validatePersonalInput,
    calculatePersonalSummary,
    generateSmartSuggestions,
    handleLocationUpdate
} from '../services/personalInputService';

// Địa điểm phổ biến
const POPULAR_DESTINATIONS = [
    'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hạ Long', 'Hội An',
    'Huế', 'Nha Trang', 'Phú Quốc', 'Sapa', 'Đà Lạt',
    'Cần Thơ', 'Vũng Tàu', 'Quy Nhơn', 'Tam Đảo', 'Mộc Châu'
];

export default function PersonalItineraryPlanner() {
    const { currentUser } = useAuth();
    const [prefs, setPrefs] = useState({
        // Thông tin cơ bản
        departureDate: format(new Date(), 'yyyy-MM-dd'),
        duration: 3,
        departureLocation: '',
        destination: '',
        travelers: 2,
        budget: 5000000,

        // Phong cách & Nhóm
        travelStyle: '',
        travelGroup: '',
        ageGroup: '',
        travelPace: 'balanced',

        // Chỗ ở & Di chuyển
        accommodationType: 'hotel',
        transportation: 'taxi',

        // Sở thích
        interests: [],
        dietPreference: 'normal',
        preferredActivities: [],

        // Yêu cầu đặc biệt
        specialRequirements: ''
    });

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [locationInput, setLocationInput] = useState('');

    const mapRef = useRef(null);
    const mapInitialized = useRef(false);

    // Tính toán summary
    const tripSummary = calculatePersonalSummary(prefs);
    const smartSuggestions = generateSmartSuggestions(prefs);

    // Xử lý thêm địa điểm
    const handleAddLocation = async () => {
        if (!locationInput.trim()) {
            toast.warning('📍 Vui lòng nhập địa điểm!');
            return;
        }

        try {
            const result = await handleLocationUpdate('add', locationInput, []);
            setPrefs(prev => ({ ...prev, destination: locationInput }));
            setLocationInput('');
            toast.success(result.message);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleMapReady = () => {
        if (mapInitialized.current) return;
        mapInitialized.current = true;
        setMapReady(true);
        toast.success('🗺️ Bản đồ đã sẵn sàng!');
    };

    // Tạo lịch trình
    // Trong handleGenerate function, thêm:
    const handleGenerate = async () => {
        const errors = validatePersonalInput(prefs, currentUser);
        if (errors.length > 0) {
            errors.forEach(error => toast.error(error));
            return;
        }

        if (loading || !mapReady) {
            toast.info('🗺️ Đang chờ bản đồ khởi tạo...');
            return;
        }

        setLoading(true);
        try {
            // XÓA dòng kiểm tra Places Service Status
            // const status = getPlacesServiceStatus(); // DÒNG NÀY GÂY LỖI

            console.log('🔧 Bắt đầu tạo lịch trình...');

            const itinerary = await createPersonalItinerary(
                prefs,
                currentUser.uid,
                mapRef.current?.map
            );
            setResult(itinerary);
            toast.success('🎉 Lịch trình cá nhân đã được tạo thành công!');
        } catch (err) {
            console.error('Lỗi tạo itinerary:', err);
            toast.error('❌ Lỗi tạo lịch trình! Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="max-w-7xl mx-auto p-4">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700 mb-4">
                    🗺️ Lịch Trình Du Lịch Cá Nhân
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Tạo lịch trình du lịch hoàn toàn cá nhân hóa theo sở thích và nhu cầu của bạn
                </p>
            </div>

            {/* Smart Suggestions */}
            {smartSuggestions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
                    <h3 className="font-semibold text-blue-700 mb-2">💡 Gợi ý thông minh:</h3>
                    <div className="flex flex-wrap gap-2">
                        {smartSuggestions.map((suggestion, index) => (
                            <span key={index} className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm border border-blue-200">
                                {suggestion}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* THÔNG TIN CƠ BẢN */}
                    <div className="lg:col-span-3 bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border-2 border-blue-200">
                        <h3 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
                            📋 Thông Tin Cơ Bản
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Ngày khởi hành */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🗓️ Ngày Khởi Hành
                                </label>
                                <input
                                    type="date"
                                    value={prefs.departureDate}
                                    onChange={e => setPrefs({ ...prefs, departureDate: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                />
                            </div>

                            {/* Số ngày */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    ⏱️ Số Ngày
                                </label>
                                <input
                                    type="number"
                                    value={prefs.duration}
                                    onChange={e => setPrefs({ ...prefs, duration: Math.max(1, +e.target.value) })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                    max="30"
                                />
                            </div>

                            {/* Số người */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    👥 Số Người
                                </label>
                                <input
                                    type="number"
                                    value={prefs.travelers}
                                    onChange={e => setPrefs({ ...prefs, travelers: Math.max(1, +e.target.value) })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                    max="20"
                                />
                            </div>

                            {/* Ngân sách */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    💰 Ngân Sách (VNĐ)
                                </label>
                                <input
                                    type="number"
                                    value={prefs.budget}
                                    onChange={e => setPrefs({ ...prefs, budget: +e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="500000"
                                    step="100000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ĐỊA ĐIỂM */}
                    <div className="lg:col-span-3">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            📍 Địa Điểm
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Điểm xuất phát */}
                            <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    🚀 Điểm Xuất Phát
                                </label>
                                <select
                                    value={prefs.departureLocation}
                                    onChange={e => setPrefs({ ...prefs, departureLocation: e.target.value })}
                                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">Chọn điểm xuất phát</option>
                                    {POPULAR_DESTINATIONS.map(dest => (
                                        <option key={dest} value={dest}>{dest}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Điểm đến */}
                            <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    🎯 Điểm Đến
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={prefs.destination}
                                        onChange={e => setPrefs({ ...prefs, destination: e.target.value })}
                                        className="flex-1 p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                    >
                                        <option value="">Chọn điểm đến</option>
                                        {POPULAR_DESTINATIONS.map(dest => (
                                            <option key={dest} value={dest}>{dest}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PHONG CÁCH & NHÓM */}
                    <div className="lg:col-span-3 bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
                        <h3 className="text-lg font-bold text-purple-700 mb-4 flex items-center gap-2">
                            👨‍👩‍👧‍👦 Phong Cách & Nhóm
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Phong cách du lịch */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    💼 Phong Cách
                                </label>
                                <select
                                    value={prefs.travelStyle}
                                    onChange={e => setPrefs({ ...prefs, travelStyle: e.target.value })}
                                    className="w-full p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">Chọn phong cách</option>
                                    {TRAVEL_STYLES.map(style => (
                                        <option key={style.value} value={style.value}>
                                            {style.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Nhóm du lịch */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    👥 Nhóm Du Lịch
                                </label>
                                <select
                                    value={prefs.travelGroup}
                                    onChange={e => setPrefs({ ...prefs, travelGroup: e.target.value })}
                                    className="w-full p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">Chọn nhóm</option>
                                    {TRAVEL_GROUPS.map(group => (
                                        <option key={group.value} value={group.value}>
                                            {group.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Độ tuổi chính */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🎂 Độ Tuổi Chính
                                </label>
                                <select
                                    value={prefs.ageGroup}
                                    onChange={e => setPrefs({ ...prefs, ageGroup: e.target.value })}
                                    className="w-full p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">Chọn độ tuổi</option>
                                    {AGE_GROUPS.map(age => (
                                        <option key={age.value} value={age.value}>
                                            {age.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* TỐC ĐỘ & CHỖ Ở */}
                    <div className="md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            ⚡ Tốc Độ & Chỗ Ở
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Tốc độ du lịch */}
                            <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🚶‍♂️ Tốc Độ
                                </label>
                                <select
                                    value={prefs.travelPace}
                                    onChange={e => setPrefs({ ...prefs, travelPace: e.target.value })}
                                    className="w-full p-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                >
                                    {TRAVEL_PACES.map(pace => (
                                        <option key={pace.value} value={pace.value}>
                                            {pace.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-600 mt-1">
                                    {TRAVEL_PACES.find(p => p.value === prefs.travelPace)?.description}
                                </p>
                            </div>

                            {/* Loại chỗ ở */}
                            <div className="bg-teal-50 p-4 rounded-xl border-2 border-teal-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🏨 Chỗ Ở
                                </label>
                                <select
                                    value={prefs.accommodationType}
                                    onChange={e => setPrefs({ ...prefs, accommodationType: e.target.value })}
                                    className="w-full p-3 border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                >
                                    {ACCOMMODATION_TYPES.map(acc => (
                                        <option key={acc.value} value={acc.value}>
                                            {acc.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* PHƯƠNG TIỆN */}
                    <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            🚗 Di Chuyển
                        </h3>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            🚕 Phương Tiện
                        </label>
                        <select
                            value={prefs.transportation}
                            onChange={e => setPrefs({ ...prefs, transportation: e.target.value })}
                            className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {TRANSPORTATION_OPTIONS.map(transport => (
                                <option key={transport.value} value={transport.value}>
                                    {transport.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-600 mt-1">
                            {TRANSPORTATION_OPTIONS.find(t => t.value === prefs.transportation)?.description}
                        </p>
                    </div>

                    {/* SỞ THÍCH & INTERESTS */}
                    <div className="lg:col-span-3 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                        <h3 className="text-lg font-bold text-green-700 mb-4 flex items-center gap-2">
                            🎯 Sở Thích Cá Nhân
                        </h3>

                        {/* Interests */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                ❤️ Sở Thích Của Bạn
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {INTERESTS.map(interest => (
                                    <label
                                        key={interest.value}
                                        className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                            prefs.interests.includes(interest.value)
                                                ? 'bg-white border-green-500 shadow-md'
                                                : 'bg-gray-50 border-gray-200 hover:border-green-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={prefs.interests.includes(interest.value)}
                                            onChange={e => {
                                                const updated = e.target.checked
                                                    ? [...prefs.interests, interest.value]
                                                    : prefs.interests.filter(i => i !== interest.value);
                                                setPrefs({ ...prefs, interests: updated });
                                            }}
                                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                        />
                                        <span className="text-sm font-medium flex items-center gap-1">
                                            <span>{interest.icon}</span>
                                            <span>{interest.label}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Diet Preference */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🍽️ Chế Độ Ăn
                                </label>
                                <select
                                    value={prefs.dietPreference}
                                    onChange={e => setPrefs({ ...prefs, dietPreference: e.target.value })}
                                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                >
                                    {DIET_PREFERENCES.map(diet => (
                                        <option key={diet.value} value={diet.value}>
                                            {diet.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Activities */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🎪 Hoạt Động Ưa Thích
                                </label>
                                <select
                                    value={prefs.preferredActivities}
                                    onChange={e => setPrefs({ ...prefs, preferredActivities: e.target.value })}
                                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                    multiple
                                    size="3"
                                >
                                    {ACTIVITY_TYPES.map(activity => (
                                        <option key={activity.value} value={activity.value}>
                                            {activity.icon} {activity.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-600 mt-1">
                                    Giữ Ctrl để chọn nhiều
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* YÊU CẦU ĐẶC BIỆT */}
                    <div className="lg:col-span-3 bg-orange-50 p-4 rounded-xl border-2 border-orange-200">
                        <h3 className="text-lg font-bold text-orange-700 mb-4 flex items-center gap-2">
                            💫 Yêu Cầu Đặc Biệt
                        </h3>
                        <textarea
                            value={prefs.specialRequirements}
                            onChange={e => setPrefs({ ...prefs, specialRequirements: e.target.value })}
                            placeholder="Ví dụ: Có trẻ nhỏ cần khu vui chơi, ăn chay, dị ứng hải sản, cần hướng dẫn viên, yêu cầu đặc biệt về chỗ ở..."
                            rows="3"
                            className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                    </div>

                    {/* SUMMARY & GENERATE BUTTON */}
                    <div className="lg:col-span-3">
                        {/* Trip Summary */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-xl shadow-lg mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                📊 Tóm Tắt Chuyến Đi
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="text-center">
                                    <p className="opacity-90">📅 Ngày đi</p>
                                    <p className="font-bold">{tripSummary.startDate}</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">🏁 Ngày về</p>
                                    <p className="font-bold">{tripSummary.endDate}</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">⏱️ Tổng ngày</p>
                                    <p className="font-bold">{tripSummary.totalDays} ngày</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">👥 Số người</p>
                                    <p className="font-bold">{tripSummary.totalTravelers} người</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">💰 Tổng ngân sách</p>
                                    <p className="font-bold">{tripSummary.adjustedBudget}₫</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">📆 Chi phí/ngày</p>
                                    <p className="font-bold">{tripSummary.budgetPerDay}₫</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">👤 Chi phí/người</p>
                                    <p className="font-bold">{tripSummary.budgetPerPerson}₫</p>
                                </div>
                                <div className="text-center">
                                    <p className="opacity-90">🎯 Chi phí/người/ngày</p>
                                    <p className="font-bold">{tripSummary.budgetPerPersonPerDay}₫</p>
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !mapReady || !currentUser}
                            className="w-full bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white py-6 rounded-2xl font-bold text-xl shadow-2xl hover:scale-105 transition transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                        <span>Đang tạo lịch trình cá nhân...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-2xl">🚀</span>
                                        <span>TẠO LỊCH TRÌNH CÁ NHÂN HÓA</span>
                                    </>
                                )}
                            </div>
                        </button>

                        {/* Error Messages */}
                        <div className="mt-3 text-center space-y-1">
                            {!currentUser && (
                                <p className="text-red-600 font-semibold animate-pulse">
                                    🔐 Vui lòng đăng nhập để tạo lịch trình!
                                </p>
                            )}
                            {currentUser && (
                                <p className="text-green-600 font-semibold">
                                    ✅ Sẵn sàng tạo lịch trình cá nhân!
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-300 mb-8">
                <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>🗺️</span>
                        Bản Đồ Hành Trình
                    </h3>
                </div>
                <div className="h-96 lg:h-[500px]">
                    <MapViewer
                        ref={mapRef}
                        points={[]}
                        showRoute={false}
                        onMapReady={handleMapReady}
                        center={{ lat: 16.0471, lng: 108.2258 }}
                        key="personal-itinerary-map"
                    />
                </div>
            </div>

            {/* Results Display */}
            {result && (
                <div className="space-y-8 animate-fade-in">
                    {/* Result header */}
                    <div className="text-center bg-gradient-to-r from-green-500 to-emerald-600 text-white py-8 rounded-2xl shadow-lg">
                        <h2 className="text-3xl font-bold mb-2">🎉 Lịch Trình Cá Nhân Đã Sẵn Sàng!</h2>
                        <p className="text-lg opacity-90">
                            {result.summary.departure} → {result.summary.destination} • {result.summary.duration} ngày
                        </p>
                    </div>

                    {/* Display itinerary details here */}
                    {/* ... (similar to previous result display) */}
                </div>
            )}
            {result && (
                <div className="space-y-8 animate-fade-in">
                    {/* Photography Highlights */}
                    {result.summary.photographySpots > 0 && (
                        <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-6 rounded-2xl shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                        📸 Điểm Chụp Ảnh Tuyệt Đẹp
                                    </h3>
                                    <p className="text-lg opacity-90">
                                        Đã tìm thấy {result.summary.photographySpots} địa điểm hoàn hảo cho chụp ảnh
                                    </p>
                                </div>
                                <div className="text-4xl">🌟</div>
                            </div>

                            {/* Photography Tips */}
                            {result.photographyTips.length > 0 && (
                                <div className="mt-4 bg-white/20 p-4 rounded-lg">
                                    <h4 className="font-bold mb-2">💡 Mẹo chụp ảnh:</h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {result.photographyTips.map((tip, index) => (
                                            <li key={index}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Daily Plans với photography info */}
                    {result.dailyPlan.map(dayPlan => (
                        <div key={dayPlan.day} className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-blue-200">
                            <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold">📅 Ngày {dayPlan.day} - {dayPlan.date}</h3>
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                            {dayPlan.destinations.length}/{dayPlan.maxPlaces} địa điểm
                        </span>
                                </div>
                                {dayPlan.photographySpots.length > 0 && (
                                    <div className="flex items-center gap-2 mt-2 text-yellow-300">
                                        <span>📸</span>
                                        <span>{dayPlan.photographySpots.length} điểm chụp ảnh đẹp</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-6">
                                {/* Photography Tips for the day */}
                                {dayPlan.photographyTips.length > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                                        <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                            📷 Mẹo chụp ảnh ngày {dayPlan.day}
                                        </h4>
                                        <ul className="list-disc list-inside space-y-1 text-yellow-700">
                                            {dayPlan.photographyTips.map((tip, index) => (
                                                <li key={index}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Destinations với photography info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dayPlan.destinations.map((place, index) => (
                                        <div key={index} className={`border rounded-lg p-4 ${
                                            place.isPhotographySpot
                                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-lg">{place.name}</h4>
                                                {place.isPhotographySpot && (
                                                    <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                            📸 HOT
                                        </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                                {place.rating && (
                                                    <span className="flex items-center gap-1">
                                            ⭐ {place.rating}
                                        </span>
                                                )}
                                                {place.photographyInfo?.score && (
                                                    <span className="flex items-center gap-1">
                                            📷 {place.photographyInfo.score}/20
                                        </span>
                                                )}
                                            </div>

                                            {/* Photography Info */}
                                            {place.isPhotographySpot && place.photographyInfo && (
                                                <div className="bg-white/50 p-3 rounded-lg border border-green-200 mt-2">
                                                    <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                                                        <span>🕒</span>
                                                        <span>Thời gian đẹp: {place.photographyInfo.bestTime}</span>
                                                    </div>
                                                    {place.photographyInfo.photoTips.length > 0 && (
                                                        <div className="text-sm text-green-600">
                                                            <span className="font-medium">💡 Mẹo: </span>
                                                            {place.photographyInfo.photoTips[0]}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <p className="text-gray-600 text-sm mt-2">
                                                {place.vicinity}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Activities & Meals */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <h4 className="font-bold text-blue-700 mb-2">🍽️ Bữa ăn</h4>
                                        <ul className="space-y-1 text-sm">
                                            <li>• {dayPlan.meals.breakfast}</li>
                                            <li>• {dayPlan.meals.lunch}</li>
                                            <li>• {dayPlan.meals.dinner}</li>
                                        </ul>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg">
                                        <h4 className="font-bold text-purple-700 mb-2">🎯 Hoạt động</h4>
                                        <ul className="space-y-1 text-sm">
                                            {dayPlan.activities.map((activity, idx) => (
                                                <li key={idx}>• {activity}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {/* Notes */}
                                {dayPlan.notes && (
                                    <div className="bg-orange-50 p-4 rounded-lg mt-4 border border-orange-200">
                                        <h4 className="font-bold text-orange-700 mb-1">📝 Ghi chú</h4>
                                        <p className="text-orange-800 text-sm">{dayPlan.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}