// src/pages/ItineraryPlanner.js
import React, { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import MapViewer from '../components/MapViewer';
import { createRealTimeItinerary } from '../services/createRealTimeItinerary';
import { saveFeedback, saveCachedDestination } from '../services/firestoreService';

const provinces = [
    "An Giang", "Bà Rịa - Vũng Tàu", "Bạc Liêu", "Bắc Giang", "Bắc Kạn", "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
    "Bình Thuận", "Cà Mau", "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
    "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa",
    "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình",
    "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng",
    "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
    "Vĩnh Long", "Vĩnh Phúc", "Yên Bái", "Hà Nội", "Hồ Chí Minh"
].sort();

const tripTypes = ['Nghỉ dưỡng', 'Mạo hiểm', 'Văn hóa', 'Ẩm thực', 'Gia đình', 'Một mình'];

const initialMapPoints = [{ name: 'Việt Nam', lat: 16.047079, lng: 108.206230 }];

// Component hiển thị dự báo thời tiết
const WeatherForecast = ({ forecast }) => (
    <div className="bg-blue-50 border-2 border-blue-300 text-blue-700 p-5 rounded-xl">
        <h3 className="text-xl font-bold mb-3">Dự báo thời tiết 7 ngày</h3>
        <ul className="list-disc pl-5">
            {forecast.map((day, index) => (
                <li key={index} className="mb-2">
                    {day.date}: {day.temp}°C, {day.description} ({day.rainChance}% mưa)
                </li>
            ))}
        </ul>
    </div>
);

// Component hiển thị gợi ý
const Suggestions = ({ suggestions }) => (
    <div className="bg-green-50 border-2 border-green-300 text-green-700 p-5 rounded-xl">
        <h3 className="text-xl font-bold mb-3">Gợi ý cho bạn</h3>
        <ul className="list-disc pl-5">
            {suggestions.map((s, index) => (
                <li key={index} className="mb-2">
                    <strong>{s.name}</strong> - {s.reason}<br />
                    Ngày {s.day}, Địa chỉ: {s.address}, Chi phí: {s.estimatedCost.toLocaleString('vi-VN')} VND
                </li>
            ))}
        </ul>
    </div>
);

export default function ItineraryPlanner() {
    const { currentUser } = useAuth();
    const [prefs, setPrefs] = useState({
        budget: 5000000,
        days: 3,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        types: ['Nghỉ dưỡng'],
        adventureLevel: 3,
        ecoFriendly: false,
        travelers: 1,
        provinces: ['Đà Nẵng'],
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const mapRef = useRef(null);

    const derived = useMemo(() => {
        const date = new Date(prefs.startDate);
        return {
            month: date.getMonth() + 1,
            formattedDate: format(date, 'dd/MM/yyyy'),
            isoDate: date.toISOString().split('T')[0],
        };
    }, [prefs.startDate]);

    const handleGenerate = async () => {
        if (loading) return;
        setLoading(true);
        try {
            let attempts = 0;
            while (!mapRef.current?.map && attempts < 60) {
                await new Promise((r) => setTimeout(r, 100));
                attempts++;
            }

            const map = mapRef.current?.map || null;
            if (!map && attempts >= 60) {
                throw new Error('Không thể tải bản đồ VietMap. Vui lòng kiểm tra kết nối mạng hoặc API Key.');
            }

            const itinerary = await createRealTimeItinerary(
                { ...prefs, startDate: derived.isoDate },
                currentUser?.uid || 'guest',
                map
            );
            setResult(itinerary);
            toast.success('Lịch trình đã tạo thành công!');
        } catch (err) {
            console.error('Lỗi tạo lịch trình:', err);
            let errorMessage = err.message || 'Không thể tạo lịch trình. Vui lòng thử lại!';
            if (err.message.includes('Không tìm thấy điểm đến')) {
                errorMessage = 'Không tìm thấy điểm đến phù hợp. Hãy thử chọn tỉnh khác hoặc giảm yêu cầu về đánh giá địa điểm.';
            }
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const mapPoints = result
        ? result.dailyPlan
              .flatMap((d) => d.destinations)
              .filter((p) => p.lat && p.lng)
        : [];

    if (mapPoints.length === 0 && result) {
        mapPoints.push({ name: 'Việt Nam', lat: 16.047079, lng: 108.206230 });
    }

    return (
        <div className="max-w-7xl mx-auto p-4">
            <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700">
                ZIZOO AI – Lên Kế Hoạch Du Lịch Thực Tế
            </h1>

            {/* FORM */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* NGÀY ĐI */}
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-2">
                            Ngày khởi hành
                        </label>
                        <input
                            id="startDate"
                            type="date"
                            value={prefs.startDate}
                            onChange={(e) => setPrefs({ ...prefs, startDate: e.target.value })}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">{derived.formattedDate}</p>
                    </div>

                    {/* NGÂN SÁCH */}
                    <div>
                        <label htmlFor="budget" className="block text-sm font-semibold text-gray-700 mb-2">
                            Ngân sách (VND)
                        </label>
                        <input
                            id="budget"
                            type="number"
                            value={prefs.budget}
                            onChange={(e) => setPrefs({ ...prefs, budget: +e.target.value })}
                            className="w-full p-3 border rounded-lg"
                            min="100000"
                            step="100000"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {new Intl.NumberFormat('vi-VN').format(prefs.budget)} ₫
                        </p>
                    </div>

                    {/* SỐ NGÀY */}
                    <div>
                        <label htmlFor="days" className="block text-sm font-semibold text-gray-700 mb-2">
                            Số ngày
                        </label>
                        <input
                            id="days"
                            type="number"
                            value={prefs.days}
                            onChange={(e) => setPrefs({ ...prefs, days: Math.max(1, +e.target.value) })}
                            className="w-full p-3 border rounded-lg"
                            min="1"
                            max="30"
                        />
                    </div>

                    {/* LOẠI HÌNH DU LỊCH */}
                    <div className="md:col-span-2 lg:col-span-3">
                        <fieldset>
                            <legend className="block text-sm font-semibold text-gray-700 mb-2">
                                Loại hình du lịch
                            </legend>
                            <div className="flex flex-wrap gap-4">
                                {tripTypes.map((type) => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={prefs.types.includes(type)}
                                            onChange={(e) => {
                                                const updated = e.target.checked
                                                    ? [...prefs.types, type]
                                                    : prefs.types.filter((t) => t !== type);
                                                setPrefs({ ...prefs, types: updated });
                                            }}
                                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium">{type}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    {/* MỨC ĐỘ MẠO HIỂM */}
                    <div>
                        <label htmlFor="adventureLevel" className="block text-sm font-semibold text-gray-700 mb-2">
                            Mạo hiểm (1-5)
                        </label>
                        <input
                            id="adventureLevel"
                            type="range"
                            min="1"
                            max="5"
                            value={prefs.adventureLevel}
                            onChange={(e) => setPrefs({ ...prefs, adventureLevel: +e.target.value })}
                            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>An toàn</span>
                            <span className="font-bold text-indigo-600">Cấp {prefs.adventureLevel}</span>
                            <span>Cực hạn</span>
                        </div>
                    </div>

                    {/* ECO FRIENDLY */}
                    <div className="flex items-center gap-3">
                        <input
                            id="ecoFriendly"
                            type="checkbox"
                            checked={prefs.ecoFriendly}
                            onChange={(e) => setPrefs({ ...prefs, ecoFriendly: e.target.checked })}
                            className="w-6 h-6 text-green-600 rounded focus:ring-green-500"
                        />
                        <label htmlFor="ecoFriendly" className="text-sm font-bold text-green-700 cursor-pointer">
                            Thân thiện môi trường
                        </label>
                    </div>

                    {/* SỐ NGƯỜI */}
                    <div>
                        <label htmlFor="travelers" className="block text-sm font-semibold text-gray-700 mb-2">
                            Số người
                        </label>
                        <input
                            id="travelers"
                            type="number"
                            value={prefs.travelers}
                            onChange={(e) => setPrefs({ ...prefs, travelers: Math.max(1, +e.target.value) })}
                            className="w-full p-3 border rounded-lg"
                            min="1"
                            max="20"
                        />
                    </div>

                    {/* TỈNH THÀNH */}
                    <div className="lg:col-span-3">
                        <label htmlFor="provinces" className="block text-sm font-semibold text-gray-700 mb-2">
                            Chọn tỉnh/thành phố
                        </label>
                        <select
                            id="provinces"
                            multiple
                            value={prefs.provinces}
                            onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                                setPrefs({ ...prefs, provinces: selected.length > 0 ? selected : ['Đà Nẵng'] });
                            }}
                            className="w-full p-3 border rounded-lg h-40 focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            {provinces.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            Giữ <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl</kbd> để chọn nhiều tỉnh
                        </p>
                    </div>

                    {/* NÚT TẠO */}
                    <div className="lg:col-span-3">
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !currentUser}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-5 rounded-xl font-bold text-xl shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Đang tạo lịch trình...' : 'TẠO LỊCH TRÌNH NGAY'}
                        </button>
                        {!currentUser && (
                            <p className="text-center text-sm text-red-600 mt-3">
                                Vui lòng đăng nhập để tạo lịch trình!
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* BẢN ĐỒ */}
            <div
                className="h-96 rounded-xl overflow-hidden shadow-2xl border-4 border-indigo-200 mb-8"
                style={{ display: result ? 'block' : 'none' }}
            >
                <MapViewer ref={mapRef} points={result ? mapPoints : initialMapPoints} showRoute={true} />
            </div>

            {/* KẾT QUẢ */}
            {result && (
                <div className="space-y-8">
                    {/* CẢNH BÁO */}
                    {result.alerts && (
                        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-xl font-bold">
                            Cảnh báo: {result.alerts}
                        </div>
                    )}

                    {/* THỜI TIẾT HIỆN TẠI */}
                    {result.weather && (
                        <div className="bg-blue-50 border-2 border-blue-300 text-blue-700 p-5 rounded-xl font-bold">
                            Thời tiết hiện tại: {result.weather}
                        </div>
                    )}

                    {/* DỰ BÁO THỜI TIẾT 7 NGÀY */}
                    {result.forecast7Days && <WeatherForecast forecast={result.forecast7Days} />}

                    {/* GỢI Ý ĐỊA ĐIỂM */}
                    {result.suggestions && result.suggestions.length > 0 && (
                        <Suggestions suggestions={result.suggestions} />
                    )}

                    {/* LỊCH TRÌNH CHI TIẾT */}
                    <div className="bg-white p-8 rounded-2xl shadow-xl">
                        <h3 className="text-3xl font-bold mb-6 text-indigo-700">Lịch trình chi tiết</h3>
                        {result.dailyPlan.map((day, i) => (
                            <div
                                key={i}
                                className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl"
                            >
                                <h4 className="text-2xl font-bold text-indigo-800 mb-4">
                                    Ngày {day.day} • {day.date} {day.note && `(${day.note})`}
                                </h4>
                                <div className="space-y-4">
                                    {day.destinations.map((d, j) => (
                                        <div
                                            key={j}
                                            className="flex items-center justify-between bg-white p-4 rounded-lg shadow"
                                        >
                                            <div>
                                                <p className="font-bold text-lg">{d.name}</p>
                                                <p className="text-sm text-gray-600">{d.address}</p>
                                                <p className="text-xs text-yellow-600 mt-1">
                                                    {d.rating} stars ({d.userRatingsTotal || 0} đánh giá)
                                                    {d.cached && (
                                                        <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded">
                                                            Từ cache
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <select
                                                onChange={async (e) => {
                                                    const rating = +e.target.value;
                                                    if (rating > 0 && currentUser) {
                                                        await saveFeedback(
                                                            currentUser.uid,
                                                            result.id,
                                                            d.placeId || d.name,
                                                            rating,
                                                            '',
                                                            prefs
                                                        );
                                                        if (rating >= 4 && d.placeId) {
                                                            await saveCachedDestination(d.placeId, {
                                                                ...d,
                                                                province: d.province,
                                                                types: [d.type],
                                                            });
                                                            toast.success(`${d.name} đã được lưu vào điểm HOT!`);
                                                        }
                                                    }
                                                }}
                                                className="border-2 border-indigo-300 rounded-lg px-3 py-2 font-medium"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>
                                                    Đánh giá
                                                </option>
                                                {[1, 2, 3, 4, 5].map((n) => (
                                                    <option key={n} value={n}>
                                                        {n} stars
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 pt-4 border-t-2 border-indigo-200">
                                    <p className="font-semibold">
                                        Ăn trưa: {day.meal?.lunch || 'Quán ăn địa phương'}
                                    </p>
                                    <p className="font-semibold">
                                        Ăn tối: {day.meal?.dinner || 'Nhà hàng đặc sản'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* KHÁCH SẠN */}
                    <div className="bg-white p-6 rounded-xl shadow">
                        <h3 className="text-2xl font-bold mb-4">Khách sạn gợi ý</h3>
                        {result.hotels?.length > 0 ? (
                            result.hotels.map((h, i) => (
                                <div key={i} className="flex justify-between items-center border-b py-3">
                                    <div>
                                        <p className="font-bold">{h.name}</p>
                                        <p className="text-sm text-gray-600">{h.address}</p>
                                    </div>
                                    <p className="text-xl font-bold text-green-600">
                                        ~{new Intl.NumberFormat('vi-VN').format(h.estimatedCost)}₫
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500">Không tìm thấy khách sạn phù hợp</p>
                        )}
                    </div>

                    {/* CHI PHÍ TỔNG */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-8 rounded-2xl shadow-2xl">
                        <h3 className="text-3xl font-bold mb-6">Tổng chi phí dự kiến</h3>
                        <div className="grid grid-cols-2 gap-6 text-lg">
                            <div>
                                Khách sạn:{' '}
                                <strong>{new Intl.NumberFormat('vi-VN').format(result.cost.hotel)}₫</strong>
                            </div>
                            <div>
                                Ăn uống:{' '}
                                <strong>{new Intl.NumberFormat('vi-VN').format(result.cost.food)}₫</strong>
                            </div>
                            <div>
                                Vé tham quan:{' '}
                                <strong>{new Intl.NumberFormat('vi-VN').format(result.cost.entrance)}₫</strong>
                            </div>
                            <div>
                                Di chuyển:{' '}
                                <strong>{new Intl.NumberFormat('vi-VN').format(result.cost.transport)}₫</strong>
                            </div>
                        </div>
                        <div className="mt-8 text-4xl font-bold text-center">
                            TỔNG: {new Intl.NumberFormat('vi-VN').format(result.cost.total)}₫
                            {result.cost.remaining > 0 && (
                                <span className="block text-2xl mt-2 text-yellow-300">
                                    Dư: {new Intl.NumberFormat('vi-VN').format(result.cost.remaining)}₫
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}