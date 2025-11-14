// // src/pages/ItineraryPlanner.js
// import React, { useState, useRef, useEffect } from 'react';
// import { format } from 'date-fns';
// import { useAuth } from '../context/AuthContext';
// import { toast } from 'react-toastify';
// import MapViewer from '../components/MapViewer';
// import { createRealTimeItinerary } from '../services/createRealTimeItinerary';
// import { checkAndUpdateCache } from '../services/cacheDestinations';
// import { predictAndSaveRisk } from '../services/riskPredictor';
// import {
//     geocodeVietnamLocation,
//     getLocationSuggestions
// } from '../services/locationService';
//
// // Loại hình du lịch đặc trưng Việt Nam
// const vietnamTripTypes = [
//     'Nghỉ dưỡng biển',
//     'Khám phá văn hóa',
//     'Du lịch ẩm thực',
//     'Phiêu lưu mạo hiểm',
//     'Thiền và yoga',
//     'Du lịch gia đình',
//     'Chụp ảnh sống ảo',
//     'Trải nghiệm bản địa'
// ];
//
// // Địa điểm nổi tiếng Việt Nam để gợi ý
// const popularVietnamDestinations = [
//     'Đà Lạt', 'Phú Quốc', 'Hội An', 'Sapa', 'Nha Trang',
//     'Hạ Long', 'Huế', 'Đà Nẵng', 'Vũng Tàu', 'Mũi Né',
//     'Tam Đảo', 'Mộc Châu', 'Côn Đảo', 'Cát Bà', 'Cửa Lò'
// ];
//
// export default function ItineraryPlanner() {
//     const { currentUser } = useAuth();
//     const [prefs, setPrefs] = useState({
//         locations: [], // {name, province, center, address}
//         budget: 5000000,
//         days: 3,
//         startDate: format(new Date(), 'yyyy-MM-dd'),
//         types: ['Nghỉ dưỡng biển'],
//         adventureLevel: 1,
//         ecoFriendly: false,
//         travelers: 1,
//     });
//     const [locationInput, setLocationInput] = useState('');
//     const [result, setResult] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [mapReady, setMapReady] = useState(false);
//     const [riskForecasts, setRiskForecasts] = useState({});
//     const [loadingStates, setLoadingStates] = useState({
//         geocoding: false,
//         riskAnalysis: false
//     });
//     const [suggestions, setSuggestions] = useState([]);
//     const [showPopularDestinations, setShowPopularDestinations] = useState(true);
//
//     const mapRef = useRef(null);
//     const mapInitialized = useRef(false);
//
//     // Gợi ý địa điểm Việt Nam
//     useEffect(() => {
//         if (locationInput.length > 1) {
//             const suggestions = getLocationSuggestions(locationInput);
//             setSuggestions(suggestions);
//             setShowPopularDestinations(false);
//         } else {
//             setSuggestions([]);
//             setShowPopularDestinations(true);
//         }
//     }, [locationInput]);
//
//     // Thêm địa điểm Việt Nam
//     const handleAddLocation = async () => {
//         if (!locationInput.trim()) {
//             toast.warning('📍 Vui lòng nhập địa điểm!');
//             return;
//         }
//
//         setLoadingStates(prev => ({...prev, geocoding: true}));
//
//         try {
//             const locationData = await geocodeVietnamLocation(locationInput);
//
//             if (locationData) {
//                 const { name, province, center } = locationData;
//
//                 // Kiểm tra trùng lặp
//                 if (prefs.locations.some(loc => loc.province === province)) {
//                     toast.warning(`📍 ${province} đã được thêm vào lịch trình!`);
//                     return;
//                 }
//
//                 // Thêm vào danh sách
//                 const newLocation = { name, province, center };
//                 setPrefs(prev => ({
//                     ...prev,
//                     locations: [...prev.locations, newLocation]
//                 }));
//
//                 setLocationInput('');
//                 setSuggestions([]);
//                 setShowPopularDestinations(true);
//
//                 // Cập nhật cache và phân tích rủi ro
//                 try {
//                     await checkAndUpdateCache(province, center);
//                 } catch (cacheError) {
//                     console.warn('Cache update warning:', cacheError);
//                 }
//
//                 setLoadingStates(prev => ({...prev, riskAnalysis: true}));
//                 try {
//                     const forecast = await predictAndSaveRisk(province, center);
//                     setRiskForecasts(prev => ({
//                         ...prev,
//                         [province]: forecast
//                     }));
//                 } catch (riskError) {
//                     console.warn('Risk analysis warning:', riskError);
//                 }
//                 setLoadingStates(prev => ({...prev, riskAnalysis: false}));
//
//                 toast.success(`✅ Đã thêm "${name}" (${province}) vào lịch trình`);
//             } else {
//                 toast.error('❌ Không tìm thấy địa điểm này tại Việt Nam');
//             }
//         } catch (err) {
//             console.error('Lỗi thêm địa điểm:', err);
//             toast.error('❌ Lỗi khi thêm địa điểm. Vui lòng thử lại!');
//         } finally {
//             setLoadingStates(prev => ({...prev, geocoding: false}));
//         }
//     };
//
//     // Xóa địa điểm
//     const handleRemoveLocation = (index) => {
//         const location = prefs.locations[index];
//         setPrefs(prev => ({
//             ...prev,
//             locations: prev.locations.filter((_, i) => i !== index)
//         }));
//
//         setRiskForecasts(prev => {
//             const newForecasts = { ...prev };
//             delete newForecasts[location.province];
//             return newForecasts;
//         });
//
//         toast.info(`🗑️ Đã xóa "${location.name}" khỏi lịch trình`);
//     };
//
//     // Chọn địa điểm từ gợi ý phổ biến
//     const handleSelectPopularDestination = (destination) => {
//         setLocationInput(destination);
//         setShowPopularDestinations(false);
//     };
//
//     const handleMapReady = () => {
//         if (mapInitialized.current) return;
//         mapInitialized.current = true;
//         setMapReady(true);
//         toast.success('🗺️ Bản đồ Việt Nam đã sẵn sàng!');
//     };
//
//     const handleGenerate = async () => {
//         if (loading || !mapReady || prefs.locations.length === 0 || !currentUser) {
//             if (!currentUser) {
//                 toast.error('🔐 Vui lòng đăng nhập để tạo lịch trình!');
//             } else if (prefs.locations.length === 0) {
//                 toast.error('📍 Vui lòng thêm ít nhất 1 địa điểm!');
//             }
//             return;
//         }
//
//         setLoading(true);
//         try {
//             // Tạo itinerary cho địa điểm đầu tiên
//             const mainLocation = prefs.locations[0];
//
//             const itinerary = await createRealTimeItinerary(
//                 {
//                     ...prefs,
//                     province: mainLocation.province,
//                     center: mainLocation.center,
//                     startDate: prefs.startDate,
//                     landmarks: prefs.locations.map(loc => loc.name)
//                 },
//                 currentUser.uid,
//                 mapRef.current?.map
//             );
//             setResult(itinerary);
//             toast.success('🎉 Lịch trình đã được tạo thành công!');
//         } catch (err) {
//             console.error('Lỗi tạo itinerary:', err);
//             if (err.message.includes('rủi ro')) {
//                 toast.error(`⚠️ ${err.message}`);
//             } else {
//                 toast.error('❌ Lỗi tạo lịch trình! Vui lòng thử lại.');
//             }
//         } finally {
//             setLoading(false);
//         }
//     };
//
//     // Tính toán điểm trung tâm bản đồ Việt Nam
//     const calculateMapCenter = () => {
//         if (prefs.locations.length === 0) {
//             return { lat: 16.0471, lng: 108.2258 }; // Trung tâm Việt Nam (Đà Nẵng)
//         }
//
//         const avgLat = prefs.locations.reduce((sum, loc) => sum + loc.center.lat, 0) / prefs.locations.length;
//         const avgLng = prefs.locations.reduce((sum, loc) => sum + loc.center.lng, 0) / prefs.locations.length;
//
//         return { lat: avgLat, lng: avgLng };
//     };
//
//     const mapCenter = calculateMapCenter();
//     const mapPoints = prefs.locations.map(loc => ({
//         name: loc.name,
//         lat: loc.center.lat,
//         lng: loc.center.lng
//     }));
//
//     // Tính toán risk level tổng thể
//     const getOverallRiskLevel = () => {
//         const allRisks = Object.values(riskForecasts).flat();
//         if (allRisks.length === 0) return 'unknown';
//
//         const maxRisk = Math.max(...allRisks.map(r => r.risk_score || 0));
//
//         if (maxRisk > 70) return 'high';
//         if (maxRisk > 40) return 'medium';
//         return 'low';
//     };
//
//     const overallRiskLevel = getOverallRiskLevel();
//
//     return (
//         <div className="max-w-7xl mx-auto p-4">
//             {/* Header */}
//             <div className="text-center mb-8">
//                 <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700 mb-4">
//                     🇻🇳 ZIZOO - Lịch Trình Du Lịch Việt Nam
//                 </h1>
//                 <p className="text-lg text-gray-600 max-w-2xl mx-auto">
//                     Tạo lịch trình du lịch thông minh cho mọi điểm đến tại Việt Nam.
//                     Thêm địa điểm yêu thích và để AI lên kế hoạch hoàn hảo cho bạn!
//                 </p>
//             </div>
//
//             {/* Loading States */}
//             {(loadingStates.geocoding || loadingStates.riskAnalysis) && (
//                 <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
//                     <div className="flex items-center gap-3">
//                         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
//                         <div>
//                             {loadingStates.geocoding && <p>🔄 Đang xác định vị trí "{locationInput}"...</p>}
//                             {loadingStates.riskAnalysis && <p>📊 Đang phân tích rủi ro thời tiết...</p>}
//                         </div>
//                     </div>
//                 </div>
//             )}
//
//             {/* Risk Alert Banner */}
//             {overallRiskLevel !== 'unknown' && (
//                 <div className={`p-4 rounded-xl mb-6 text-white font-bold text-center shadow-lg transition-all duration-500 ${
//                     overallRiskLevel === 'high'
//                         ? 'bg-red-600 animate-pulse'
//                         : overallRiskLevel === 'medium'
//                             ? 'bg-yellow-500'
//                             : 'bg-green-600'
//                 }`}>
//                     {overallRiskLevel === 'high' ? (
//                         <div>
//                             <p className="text-xl">⚠️ CẢNH BÁO: RỦI RO CAO Ở MỘT SỐ KHU VỰC</p>
//                             <p className="text-sm mt-1 opacity-90">Nên xem xét lại thời điểm du lịch</p>
//                         </div>
//                     ) : overallRiskLevel === 'medium' ? (
//                         <p>📢 LƯU Ý: RỦI RO TRUNG BÌNH - CẦN THEO DÕI THỜI TIẾT</p>
//                     ) : (
//                         <p>✅ AN TOÀN: Tất cả khu vực đều an toàn để đi du lịch</p>
//                     )}
//                 </div>
//             )}
//
//             {/* Main Form */}
//             <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//
//                     {/* ĐỊA ĐIỂM DU LỊCH VIỆT NAM */}
//                     <div className="lg:col-span-3">
//                         <label className="block text-sm font-semibold text-gray-700 mb-3">
//                             🗺️ Địa Điểm Du Lịch Việt Nam
//                             <span className="text-xs font-normal text-gray-500 ml-2">(Có thể chọn nhiều địa điểm)</span>
//                         </label>
//
//                         {/* Input và Button */}
//                         <div className="flex gap-2 mb-4">
//                             <div className="flex-1 relative">
//                                 <input
//                                     type="text"
//                                     placeholder="Nhập tên thành phố, điểm du lịch... VD: Đà Lạt, Phú Quốc, Hội An..."
//                                     value={locationInput}
//                                     onChange={e => setLocationInput(e.target.value)}
//                                     onKeyPress={e => e.key === 'Enter' && handleAddLocation()}
//                                     className="w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all"
//                                 />
//                                 {loadingStates.geocoding && (
//                                     <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
//                                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
//                                     </div>
//                                 )}
//                             </div>
//                             <button
//                                 onClick={handleAddLocation}
//                                 disabled={loadingStates.geocoding || !locationInput.trim()}
//                                 className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-8 py-4 rounded-xl font-bold disabled:opacity-50 hover:scale-105 transition transform shadow-lg"
//                             >
//                                 Thêm
//                             </button>
//                         </div>
//
//                         {/* Gợi ý tìm kiếm */}
//                         {suggestions.length > 0 && (
//                             <div className="border-2 border-blue-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto mb-4">
//                                 <div className="p-2 bg-blue-50 text-blue-700 font-semibold text-sm">
//                                     💡 Gợi ý địa điểm:
//                                 </div>
//                                 {suggestions.map((suggestion, index) => (
//                                     <div
//                                         key={index}
//                                         className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 flex items-center gap-3 transition-colors"
//                                         onClick={() => {
//                                             setLocationInput(suggestion);
//                                             setSuggestions([]);
//                                         }}
//                                     >
//                                         <span className="text-blue-500">📍</span>
//                                         <span className="font-medium">{suggestion}</span>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//
//                         {/* Địa điểm phổ biến */}
//                         {showPopularDestinations && prefs.locations.length === 0 && (
//                             <div className="mb-4">
//                                 <p className="text-sm font-semibold text-gray-700 mb-3">🌟 Điểm Đến Phổ Biến:</p>
//                                 <div className="flex flex-wrap gap-2">
//                                     {popularVietnamDestinations.map((destination, index) => (
//                                         <button
//                                             key={index}
//                                             onClick={() => handleSelectPopularDestination(destination)}
//                                             className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-4 py-2 rounded-full font-medium hover:from-purple-200 hover:to-pink-200 transition-all shadow-sm border border-purple-200"
//                                         >
//                                             {destination}
//                                         </button>
//                                     ))}
//                                 </div>
//                             </div>
//                         )}
//
//                         {/* Danh sách địa điểm đã thêm */}
//                         {prefs.locations.length > 0 && (
//                             <div className="mt-6 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
//                                 <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
//                                     <span>📌</span>
//                                     Địa Điểm Đã Chọn ({prefs.locations.length})
//                                 </p>
//                                 <div className="flex flex-wrap gap-3">
//                                     {prefs.locations.map((location, index) => (
//                                         <div
//                                             key={index}
//                                             className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg animate-fade-in"
//                                         >
//                                             <span className="text-lg">📍</span>
//                                             <div className="flex-1">
//                                                 <p className="font-bold">{location.name}</p>
//                                                 <p className="text-blue-100 text-xs">{location.province}</p>
//                                             </div>
//                                             <button
//                                                 onClick={() => handleRemoveLocation(index)}
//                                                 className="text-white hover:text-red-200 font-bold text-lg transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20"
//                                                 title="Xóa địa điểm"
//                                             >
//                                                 ×
//                                             </button>
//                                         </div>
//                                     ))}
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//
//                     {/* NGÂN SÁCH */}
//                     <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-100">
//                         <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                             <span>💰</span>
//                             Ngân Sách
//                         </label>
//                         <input
//                             type="number"
//                             value={prefs.budget}
//                             onChange={e => setPrefs({ ...prefs, budget: +e.target.value })}
//                             className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
//                             min="500000"
//                             step="100000"
//                         />
//                         <div className="flex justify-between items-center mt-2">
//                             <p className="text-xs text-gray-600">Tổng ngân sách:</p>
//                             <p className="text-lg font-bold text-green-600">
//                                 {new Intl.NumberFormat('vi-VN').format(prefs.budget)} ₫
//                             </p>
//                         </div>
//                     </div>
//
//                     {/* SỐ NGÀY */}
//                     <div className="bg-green-50 p-4 rounded-xl border-2 border-green-100">
//                         <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                             <span>📅</span>
//                             Số Ngày
//                         </label>
//                         <input
//                             type="number"
//                             value={prefs.days}
//                             onChange={e => setPrefs({ ...prefs, days: Math.max(1, +e.target.value) })}
//                             className="w-full p-3 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500"
//                             min="1"
//                             max="30"
//                         />
//                         <div className="flex justify-between items-center mt-2">
//                             <p className="text-xs text-gray-600">Thời gian:</p>
//                             <p className="text-lg font-bold text-green-600">
//                                 {prefs.days} ngày
//                             </p>
//                         </div>
//                     </div>
//
//                     {/* NGÀY BẮT ĐẦU */}
//                     <div className="bg-purple-50 p-4 rounded-xl border-2 border-purple-100">
//                         <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                             <span>⏰</span>
//                             Ngày Bắt Đầu
//                         </label>
//                         <input
//                             type="date"
//                             value={prefs.startDate}
//                             onChange={e => setPrefs({ ...prefs, startDate: e.target.value })}
//                             className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
//                             min={format(new Date(), 'yyyy-MM-dd')}
//                         />
//                         <p className="text-xs text-gray-600 mt-2 text-center">
//                             {new Date(prefs.startDate).toLocaleDateString('vi-VN', {
//                                 weekday: 'long',
//                                 year: 'numeric',
//                                 month: 'long',
//                                 day: 'numeric'
//                             })}
//                         </p>
//                     </div>
//
//                     {/* LOẠI HÌNH DU LỊCH VIỆT NAM */}
//                     <div className="md:col-span-2 lg:col-span-3 bg-orange-50 p-4 rounded-xl border-2 border-orange-100">
//                         <fieldset>
//                             <legend className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
//                                 <span>🎯</span>
//                                 Loại Hình Du Lịch
//                                 <span className="text-xs font-normal text-gray-500">(Chọn một hoặc nhiều)</span>
//                             </legend>
//                             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//                                 {vietnamTripTypes.map(type => (
//                                     <label
//                                         key={type}
//                                         className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all ${
//                                             prefs.types.includes(type)
//                                                 ? 'bg-white border-blue-500 shadow-md'
//                                                 : 'bg-gray-50 border-gray-200 hover:border-blue-300'
//                                         }`}
//                                     >
//                                         <input
//                                             type="checkbox"
//                                             checked={prefs.types.includes(type)}
//                                             onChange={e => {
//                                                 const updated = e.target.checked
//                                                     ? [...prefs.types, type]
//                                                     : prefs.types.filter(t => t !== type);
//                                                 setPrefs({ ...prefs, types: updated });
//                                             }}
//                                             className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
//                                         />
//                                         <span className="text-sm font-medium flex-1">{type}</span>
//                                     </label>
//                                 ))}
//                             </div>
//                         </fieldset>
//                     </div>
//
//                     {/* MỨC ĐỘ MẠO HIỂM */}
//                     <div className="bg-red-50 p-4 rounded-xl border-2 border-red-100">
//                         <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
//                             <span>🏔️</span>
//                             Mức Độ Mạo Hiểm
//                         </label>
//                         <input
//                             type="range"
//                             min="1"
//                             max="5"
//                             value={prefs.adventureLevel}
//                             onChange={e => setPrefs({ ...prefs, adventureLevel: +e.target.value })}
//                             className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600"
//                         />
//                         <div className="flex justify-between items-center mt-3">
//                             <span className="text-xs text-gray-600">Nhẹ nhàng</span>
//                             <span className="font-bold text-red-600 text-lg">
//                                 {['', '🎯', '🚶', '🏃', '🧗', '🚀'][prefs.adventureLevel]}
//                             </span>
//                             <span className="text-xs text-gray-600">Cực hạn</span>
//                         </div>
//                         <p className="text-center text-sm font-medium text-red-700 mt-2">
//                             Cấp độ {prefs.adventureLevel}
//                         </p>
//                     </div>
//
//                     {/* TUỲ CHỌN BỔ SUNG */}
//                     <div className="bg-teal-50 p-4 rounded-xl border-2 border-teal-100 flex flex-col gap-4">
//                         <label className="flex items-center gap-3 cursor-pointer">
//                             <input
//                                 type="checkbox"
//                                 checked={prefs.ecoFriendly}
//                                 onChange={e => setPrefs({ ...prefs, ecoFriendly: e.target.checked })}
//                                 className="w-6 h-6 text-green-600 rounded focus:ring-green-500"
//                             />
//                             <span className="flex items-center gap-2 font-semibold text-green-700">
//                                 <span>🌱</span>
//                                 Du Lịch Xanh
//                             </span>
//                         </label>
//
//                         <div>
//                             <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                                 <span>👥</span>
//                                 Số Người
//                             </label>
//                             <input
//                                 type="number"
//                                 value={prefs.travelers}
//                                 onChange={e => setPrefs({ ...prefs, travelers: Math.max(1, +e.target.value) })}
//                                 className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500"
//                                 min="1"
//                                 max="20"
//                             />
//                             <p className="text-xs text-gray-600 mt-1 text-center">
//                                 {prefs.travelers} {prefs.travelers === 1 ? 'người' : 'người'}
//                             </p>
//                         </div>
//                     </div>
//
//                     {/* THÔNG TIN DỰ KIẾN */}
//                     <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4 rounded-xl shadow-lg">
//                         <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
//                             <span>📊</span>
//                             Thông Tin Dự Kiến
//                         </h3>
//                         <div className="space-y-2 text-sm">
//                             <div className="flex justify-between">
//                                 <span>Địa điểm:</span>
//                                 <span className="font-bold">{prefs.locations.length} điểm</span>
//                             </div>
//                             <div className="flex justify-between">
//                                 <span>Tổng ngân sách:</span>
//                                 <span className="font-bold">{new Intl.NumberFormat('vi-VN').format(prefs.budget)}₫</span>
//                             </div>
//                             <div className="flex justify-between">
//                                 <span>Chi phí/ngày:</span>
//                                 <span className="font-bold">{new Intl.NumberFormat('vi-VN').format(Math.round(prefs.budget / prefs.days))}₫</span>
//                             </div>
//                             <div className="flex justify-between">
//                                 <span>Chi phí/người:</span>
//                                 <span className="font-bold">{new Intl.NumberFormat('vi-VN').format(Math.round(prefs.budget / prefs.travelers))}₫</span>
//                             </div>
//                         </div>
//                     </div>
//
//                     {/* NÚT TẠO LỊCH TRÌNH */}
//                     <div className="lg:col-span-3">
//                         <button
//                             onClick={handleGenerate}
//                             disabled={loading || !mapReady || prefs.locations.length === 0 || !currentUser}
//                             className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-6 rounded-2xl font-bold text-xl shadow-2xl hover:scale-105 transition transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden"
//                         >
//                             {/* Hiệu ứng nền */}
//                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
//
//                             {/* Nội dung */}
//                             <div className="relative z-10 flex items-center justify-center gap-3">
//                                 {loading ? (
//                                     <>
//                                         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
//                                         <span>Đang tạo lịch trình Việt Nam...</span>
//                                     </>
//                                 ) : (
//                                     <>
//                                         <span className="text-2xl">🚀</span>
//                                         <span>TẠO LỊCH TRÌNH DU LỊCH VIỆT NAM</span>
//                                     </>
//                                 )}
//                             </div>
//                         </button>
//
//                         {/* Thông báo lỗi */}
//                         <div className="mt-3 text-center space-y-1">
//                             {!currentUser && (
//                                 <p className="text-red-600 font-semibold animate-pulse">
//                                     🔐 Vui lòng đăng nhập để tạo lịch trình!
//                                 </p>
//                             )}
//
//                             {prefs.locations.length === 0 && currentUser && (
//                                 <p className="text-orange-600 font-semibold">
//                                     📍 Vui lòng thêm ít nhất 1 địa điểm tại Việt Nam!
//                                 </p>
//                             )}
//
//                             {prefs.locations.length > 0 && currentUser && (
//                                 <p className="text-green-600 font-semibold">
//                                     ✅ Sẵn sàng tạo lịch trình cho {prefs.locations.length} địa điểm!
//                                 </p>
//                             )}
//                         </div>
//                     </div>
//                 </div>
//             </div>
//
//             {/* BẢN ĐỒ VIỆT NAM */}
//             <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-300 mb-8">
//                 <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4">
//                     <h3 className="text-xl font-bold flex items-center gap-2">
//                         <span>🗺️</span>
//                         Bản Đồ Hành Trình
//                         {prefs.locations.length > 0 && (
//                             <span className="text-sm font-normal opacity-90">
//                                 ({prefs.locations.length} địa điểm)
//                             </span>
//                         )}
//                     </h3>
//                 </div>
//                 <div className="h-96 lg:h-[500px]">
//                     <MapViewer
//                         ref={mapRef}
//                         points={mapPoints}
//                         showRoute={mapPoints.length > 1}
//                         onMapReady={handleMapReady}
//                         center={mapCenter}
//                         key={`vietnam-map-${prefs.locations.length}-${Date.now()}`}
//                     />
//                 </div>
//             </div>
//
//             {/* HIỂN THỊ KẾT QUẢ LỊCH TRÌNH */}
//             {result && (
//                 <div className="space-y-8 animate-fade-in">
//                     {/* Header Kết Quả */}
//                     <div className="text-center bg-gradient-to-r from-green-500 to-emerald-600 text-white py-8 rounded-2xl shadow-lg">
//                         <h2 className="text-3xl font-bold mb-2">🎉 Lịch Trình Đã Sẵn Sàng!</h2>
//                         <p className="text-lg opacity-90">Chúc bạn có chuyến du lịch Việt Nam tuyệt vời!</p>
//                     </div>
//
//                     {/* Thông tin thời tiết và cảnh báo */}
//                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                         {result.weather && (
//                             <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-xl">
//                                 <h4 className="font-bold text-lg text-blue-700 mb-3 flex items-center gap-2">
//                                     <span>🌤️</span>
//                                     Thời Tiết Dự Báo
//                                 </h4>
//                                 <p className="text-blue-800">{result.weather}</p>
//                             </div>
//                         )}
//
//                         {result.alerts && (
//                             <div className="bg-red-50 border-2 border-red-200 p-6 rounded-xl">
//                                 <h4 className="font-bold text-lg text-red-700 mb-3 flex items-center gap-2">
//                                     <span>⚠️</span>
//                                     Cảnh Báo
//                                 </h4>
//                                 <p className="text-red-800">{result.alerts}</p>
//                             </div>
//                         )}
//                     </div>
//
//                     {/* Lịch trình chi tiết */}
//                     {result.dailyPlan && result.dailyPlan.length > 0 && (
//                         <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-100">
//                             <h3 className="text-3xl font-bold mb-8 text-center text-gray-800">
//                                 📅 Lịch Trình Chi Tiết
//                             </h3>
//                             <div className="space-y-6">
//                                 {result.dailyPlan.map((day, index) => (
//                                     <div key={index} className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-100">
//                                         <div className="flex items-center justify-between mb-4">
//                                             <h4 className="text-2xl font-bold text-indigo-800">
//                                                 Ngày {day.day} • {day.date}
//                                             </h4>
//                                             {day.note && (
//                                                 <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-sm">
//                                                     {day.note}
//                                                 </span>
//                                             )}
//                                         </div>
//
//                                         {/* Điểm đến */}
//                                         <div className="space-y-4 mb-6">
//                                             <h5 className="font-semibold text-lg text-gray-700 mb-3">📍 Điểm Tham Quan:</h5>
//                                             {day.destinations && day.destinations.map((destination, destIndex) => (
//                                                 <div key={destIndex} className="bg-white p-4 rounded-lg shadow border border-gray-200">
//                                                     <div className="flex items-start gap-4">
//                                                         {destination.photo && (
//                                                             <img
//                                                                 src={destination.photo}
//                                                                 alt={destination.name}
//                                                                 className="w-20 h-20 rounded-lg object-cover"
//                                                                 onError={(e) => {
//                                                                     e.target.style.display = 'none';
//                                                                 }}
//                                                             />
//                                                         )}
//                                                         <div className="flex-1">
//                                                             <p className="font-bold text-lg text-gray-800">{destination.name}</p>
//                                                             <p className="text-sm text-gray-600 mt-1">{destination.address}</p>
//                                                             <div className="flex items-center gap-4 mt-2">
//                                                                 <span className="text-sm text-yellow-600">
//                                                                     ⭐ {destination.rating} ({destination.userRatingsTotal} đánh giá)
//                                                                 </span>
//                                                             {destination.pricePerPerson > 0 ? (
//                                                                 <span className="text-sm font-medium text-green-600">
//                                                                     💰 ~{new Intl.NumberFormat('vi-VN').format(destination.pricePerPerson)}₫/người
//                                                                 </span>
//                                                             ) : (
//                                                                 <span className="text-sm font-medium text-blue-600">
//                                                                     🎉 Miễn phí
//                                                                 </span>
//                                                             )}
//                                                             </div>
//                                                         </div>
//                                                     </div>
//                                                 </div>
//                                             ))}
//                                         </div>
//
//                                         {/* Ăn uống */}
//                                         {day.meal && (
//                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                                                 <div className="bg-white p-4 rounded-lg border border-green-200">
//                                                     <h5 className="font-bold text-green-700 mb-2">🍽️ Ăn Trưa</h5>
//                                                     <p className="font-medium">{day.meal.lunch.name}</p>
//                                                     <p className="text-sm text-gray-600">{day.meal.lunch.address}</p>
//                                                     <p className="text-green-600 font-bold mt-2">
//                                                         {new Intl.NumberFormat('vi-VN').format(day.meal.lunch.price)}₫
//                                                     </p>
//                                                 </div>
//                                                 <div className="bg-white p-4 rounded-lg border border-orange-200">
//                                                     <h5 className="font-bold text-orange-700 mb-2">🍷 Ăn Tối</h5>
//                                                     <p className="font-medium">{day.meal.dinner.name}</p>
//                                                     <p className="text-sm text-gray-600">{day.meal.dinner.address}</p>
//                                                     <p className="text-orange-600 font-bold mt-2">
//                                                         {new Intl.NumberFormat('vi-VN').format(day.meal.dinner.price)}₫
//                                                     </p>
//                                                 </div>
//                                             </div>
//                                         )}
//                                     </div>
//                                 ))}
//                             </div>
//                         </div>
//                     )}
//                     {result.hotels && result.hotels.length > 0 && (
//                         <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-purple-100">
//                             <h3 className="text-2xl font-bold text-purple-700 mb-4 flex items-center gap-2">
//                                 🏨 Gợi ý Chỗ Ở
//                             </h3>
//                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                                 {result.hotels.map((hotel, index) => (
//                                     <div key={index} className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-md transition">
//                                         {hotel.photo && (
//                                             <img
//                                                 src={hotel.photo}
//                                                 alt={hotel.name}
//                                                 className="w-full h-32 object-cover rounded-lg mb-3"
//                                             />
//                                         )}
//                                         <h4 className="font-bold text-lg text-gray-800">{hotel.name}</h4>
//                                         <p className="text-sm text-gray-600 mb-2">{hotel.address}</p>
//
//                                         <div className="flex items-center justify-between mb-2">
//                                             <span className="text-yellow-600 font-semibold">
//                                                 ⭐ {hotel.rating} ({hotel.userRatingsTotal || 0} đánh giá)
//                                             </span>
//                                             <span className={`px-2 py-1 rounded-full text-xs font-bold ${
//                                                 hotel.category === 'luxury' ? 'bg-purple-100 text-purple-700' :
//                                                 hotel.category === 'mid-range' ? 'bg-blue-100 text-blue-700' :
//                                                 'bg-green-100 text-green-700'
//                                             }`}>
//                                                 {hotel.category === 'luxury' ? '⭐ Cao cấp' :
//                                                 hotel.category === 'mid-range' ? '💫 Tiêu chuẩn' : '💰 Tiết kiệm'}
//                                             </span>
//                                         </div>
//
//                                         <p className="text-lg font-bold text-green-600">
//                                             {new Intl.NumberFormat('vi-VN').format(hotel.pricePerNight)}₫/đêm
//                                         </p>
//                                     </div>
//                                 ))}
//                             </div>
//                         </div>
//                     )}
//
//                     {/* Tổng chi phí */}
//                     {result.cost && (
//                         <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-8 rounded-2xl shadow-2xl">
//                             <h3 className="text-3xl font-bold mb-6 text-center">💰 Tổng Chi Phí Dự Kiến</h3>
//                             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-lg mb-6">
//                                 <div className="text-center">
//                                     <p className="opacity-90">Khách sạn</p>
//                                     <p className="font-bold text-xl">{new Intl.NumberFormat('vi-VN').format(result.cost.hotel)}₫</p>
//                                 </div>
//                                 <div className="text-center">
//                                     <p className="opacity-90">Ăn uống</p>
//                                     <p className="font-bold text-xl">{new Intl.NumberFormat('vi-VN').format(result.cost.food)}₫</p>
//                                 </div>
//                                 <div className="text-center">
//                                     <p className="opacity-90">Vé tham quan</p>
//                                     <p className="font-bold text-xl">{new Intl.NumberFormat('vi-VN').format(result.cost.entrance)}₫</p>
//                                 </div>
//                                 <div className="text-center">
//                                     <p className="opacity-90">Di chuyển</p>
//                                     <p className="font-bold text-xl">{new Intl.NumberFormat('vi-VN').format(result.cost.transport)}₫</p>
//                                 </div>
//                             </div>
//                             <div className="border-t border-white/30 pt-6">
//                                 <div className="flex justify-between items-center text-3xl font-bold">
//                                     <span>TỔNG CỘNG:</span>
//                                     <span>{new Intl.NumberFormat('vi-VN').format(result.cost.total)}₫</span>
//                                 </div>
//                                 {result.cost.remaining !== undefined && (
//                                     <p className={`text-center mt-4 text-xl font-semibold ${
//                                         result.cost.remaining > 0 ? 'text-green-300' : 'text-red-300'
//                                     }`}>
//                                         {result.cost.remaining > 0
//                                             ? `✅ Còn dư: ${new Intl.NumberFormat('vi-VN').format(result.cost.remaining)}₫`
//                                             : `⚠️ Vượt ngân sách: ${new Intl.NumberFormat('vi-VN').format(-result.cost.remaining)}₫`
//                                         }
//                                     </p>
//                                 )}
//                             </div>
//                         </div>
//                     )}
//
//                     {/* Nút hành động */}
//                     <div className="text-center space-y-4">
//                         <button
//                             onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
//                             className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
//                         >
//                             🔼 Lên Đầu Trang
//                         </button>
//                         <p className="text-gray-600">
//                             Lịch trình đã được lưu tự động. Bạn có thể xem lại trong mục "Chuyến đi của tôi"
//                         </p>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// }