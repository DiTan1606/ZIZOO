// src/pages/RiskChecker.jsx
import React, { useState } from 'react';
import { predictRisk } from '../services/riskService';
import { provinces } from '../utils/provinceList';

export default function RiskChecker() {
    const [province, setProvince] = useState("Đà Nẵng");
    const [date, setDate] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCheck = async () => {
        if (!date) {
            alert("Vui lòng chọn ngày đi!");
            return;
        }
        setLoading(true);
        const data = await predictRisk(province, date);
        setResult(data);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
            <div className="max-w-3xl w-full">
                {/* Tiêu đề */}
                <div className="text-center mb-12">
                    <h1 className="text-7xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                        ZIZOO
                    </h1>
                    <p className="text-3xl font-bold text-gray-800">Cảnh báo thời tiết du lịch Việt Nam</p>
                    <p className="text-xl text-gray-600 mt-2">Nhập nơi đi + ngày đi → biết ngay có an toàn không!</p>
                </div>

                {/* Ô nhập liệu */}
                <div className="bg-white rounded-3xl shadow-2xl p-10 mb-10">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-2xl font-bold text-gray-800 mb-4">Bạn muốn đi đâu?</label>
                            <select
                                value={province}
                                onChange={(e) => setProvince(e.target.value)}
                                className="w-full px-8 py-6 text-xl border-4 border-blue-200 rounded-2xl focus:border-blue-600 focus:outline-none"
                            >
                                {provinces.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-2xl font-bold text-gray-800 mb-4">Ngày đi dự kiến?</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-8 py-6 text-xl border-4 border-blue-200 rounded-2xl focus:border-blue-600 focus:outline-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCheck}
                        disabled={loading || !date}
                        className="mt-10 w-full py-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-3xl font-bold rounded-3xl hover:shadow-2xl transform hover:scale-105 transition-all disabled:opacity-50"
                    >
                        {loading ? "Đang kiểm tra thời tiết..." : "XEM NGAY CÓ ĐI ĐƯỢC KHÔNG"}
                    </button>
                </div>

                {/* Kết quả */}
                {result && !result.error && (
                    <div className={`rounded-3xl shadow-2xl p-12 text-center animate-in ${result.level.includes("NGUY HIỂM") || result.level.includes("cao") ? 'bg-red-50 border-8 border-red-500' : result.level.includes("Trung bình") ? 'bg-yellow-50 border-8 border-yellow-500' : 'bg-green-50 border-8 border-green-500'}`}>

                        <h2 className="text-6xl font-extrabold mb-6" style={{ color: result.color }}>
                            {result.level}
                        </h2>

                        {result.isHighRiskMonth && (
                            <div className="bg-red-600 text-white px-8 py-6 rounded-2xl text-3xl font-bold mb-8 inline-block">
                                CẢNH BÁO ĐỎ: Tháng này từng có bão/lũ nghiêm trọng!
                            </div>
                        )}

                        <p className="text-4xl font-bold text-gray-800 mb-10 leading-relaxed">
                            {result.message}
                        </p>

                        <div className="bg-white/80 rounded-3xl p-8 text-left text-xl">
                            <p><strong>Địa điểm:</strong> {result.province}</p>
                            <p><strong>Ngày đi:</strong> {result.date}</p>
                            <p><strong>Mưa trung bình tháng:</strong> {result.details.avgRain} mm</p>

                            {result.details.realtime && (
                                <div className="mt-8 p-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-3xl border-4 border-blue-300">
                                    <p className="text-3xl font-bold text-blue-900 mb-6 text-center">
                                        DỰ BÁO CHI TIẾT HÔM ĐÓ ({result.details.realtime.timeRange})
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-lg">
                                        <div className="bg-white p-5 rounded-2xl shadow-md text-center">
                                            <p className="text-4xl font-bold text-orange-600">{result.details.realtime.temp}°C</p>
                                            <p className="text-gray-600">Nhiệt độ trung bình</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl shadow-md text-center">
                                            <p className="text-4xl font-bold text-blue-600">{result.details.realtime.rain} mm</p>
                                            <p className="text-gray-600">Tổng lượng mưa</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl shadow-md text-center">
                                            <p className="text-4xl font-bold text-teal-600">{result.details.realtime.wind} km/h</p>
                                            <p className="text-gray-600">Gió mạnh nhất</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl shadow-md text-center">
                                            <p className="text-4xl font-bold text-purple-600">{result.details.realtime.humidity}%</p>
                                            <p className="text-gray-600">Độ ẩm</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl shadow-md text-center">
                                            <p className="text-4xl font-bold text-indigo-600">{result.details.realtime.cloudiness}%</p>
                                            <p className="text-gray-600">Mây che phủ</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl shadow-md text-center">
                                            <p className="text-sm font-medium text-gray-700 capitalize">
                                                {result.details.realtime.description}
                                            </p>
                                            <img
                                                src={`https://openweathermap.org/img/wn/${result.details.realtime.icon}@2x.png`}
                                                alt="weather"
                                                className="w-16 h-16 mx-auto mt-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}