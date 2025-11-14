// src/services/riskService.js
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import axios from 'axios';
import provinceCoords from '../assets/provinceCoord.json';
import { isHighRiskMonth } from '../utils/riskConfig';

const OPENWEATHER_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;

// Log API key khi tải file
console.log("OPENWEATHER KEY ĐANG DÙNG:", OPENWEATHER_KEY);

export const predictRisk = async (province, selectedDate) => {
    console.log(`Bắt đầu predictRisk cho ${province} vào ${selectedDate}`);
    
    // Kiểm tra tỉnh hợp lệ
    if (!provinceCoords[province]) {
        console.warn(`Không tìm thấy tọa độ cho ${province}, dùng mặc định Hà Nội`);
    }

    const date = new Date(selectedDate);
    const month = date.getMonth() + 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    const isFuture = diffDays >= 0;
    const isRealtime = isFuture && diffDays <= 4; // Dự báo 5 ngày (40 bản ghi 3 giờ)

    try {
        // 1. DỮ LIỆU LỊCH SỬ (backup)
        console.log(`Truy vấn Firestore cho ${province}, tháng ${month}`);
        let avgRain = 120;
        try {
            const q = query(
                collection(db, 'weather_monthly'),
                where('TinhThanh', '==', province),
                where('Tháng', '==', month)
            );
            const snap = await getDocs(q);
            console.log(`Kết quả Firestore: ${snap.size} tài liệu`);
            if (!snap.empty) {
                const total = snap.docs.reduce((s, d) => s + (d.data().LuongMua || 0), 0);
                avgRain = Math.round(total / snap.size);
            }
        } catch (err) {
            console.warn("Lỗi truy vấn Firestore, dùng giá trị mặc định:", err.message);
        }

        // 2. DỰ BÁO THỰC TẾ – DÙNG ENDPOINT /forecast
        let realtime = null;
        if (isRealtime && OPENWEATHER_KEY && OPENWEATHER_KEY !== "YOUR_KEY_HERE") {
            const coord = provinceCoords[province] || provinceCoords["Hà Nội"];
            console.log(`Gọi API OpenWeather cho ${province} với tọa độ:`, coord);
            try {
                const res = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
                    params: {
                        lat: coord.lat,
                        lon: coord.lng,
                        units: 'metric',
                        appid: OPENWEATHER_KEY,
                        lang: 'vi'
                    }
                });
                console.log('Phản hồi từ OpenWeather:', res.data);
                const forecasts = res.data.list;
                if (forecasts && forecasts.length > 0) {
                    // Tìm bản ghi gần nhất với ngày yêu cầu (dữ liệu 3 giờ/lần)
                    const targetTimestamp = date.getTime() / 1000;
                    const closestForecast = forecasts.reduce((closest, current) => {
                        const diff = Math.abs(current.dt - targetTimestamp);
                        return !closest || diff < Math.abs(closest.dt - targetTimestamp) ? current : closest;
                    });
                    if (closestForecast) {
                        realtime = {
                            temp: Math.round(closestForecast.main.temp),
                            tempMin: Math.round(closestForecast.main.temp_min),
                            tempMax: Math.round(closestForecast.main.temp_max),
                            feelsLike: Math.round(closestForecast.main.feels_like),
                            rain: Math.round(closestForecast.rain?.['3h'] || 0),
                            wind: Math.round(closestForecast.wind.speed * 3.6),
                            humidity: Math.round(closestForecast.main.humidity),
                            pressure: Math.round(closestForecast.main.pressure),
                            cloudiness: Math.round(closestForecast.clouds.all),
                            description: closestForecast.weather[0].description,
                            icon: closestForecast.weather[0].icon,
                            timeRange: new Date(closestForecast.dt * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        };
                        console.log('Dữ liệu thời tiết thực tế:', realtime);
                    }
                }
            } catch (err) {
                console.error("OpenWeather lỗi:", {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                });
                if (err.response?.status === 401) {
                    console.error("Lỗi 401: API key không hợp lệ. Vui lòng kiểm tra key hoặc tạo key mới tại https://openweathermap.org/api.");
                } else if (err.response?.status === 429) {
                    console.error("Lỗi 429: Vượt quá giới hạn gọi API (1,000 lần/ngày). Vui lòng thử lại sau 24 giờ.");
                }
            }
        } else {
            console.log('Không gọi API OpenWeather: thời gian không hợp lệ hoặc thiếu key');
            if (!OPENWEATHER_KEY) {
                console.warn("Thiếu OPENWEATHER_KEY trong biến môi trường");
            }
        }

        // 3. TÍNH RỦI RO
        let score = 0;
        let source = "";
        const isHighRisk = isHighRiskMonth(province, month) || false;
        console.log(`Tháng ${month} có rủi ro cao ở ${province}:`, isHighRisk);

        if (realtime) {
            source = "DỰ BÁO THỰC TẾ (OpenWeather Free)";
            if (realtime.rain > 100) score += 70;
            else if (realtime.rain > 50) score += 50;
            else if (realtime.rain > 20) score += 25;

            if (realtime.wind > 80) score += 50;
            else if (realtime.wind > 60) score += 30;

            if (realtime.description.toLowerCase().includes('storm') ||
                realtime.description.toLowerCase().includes('thunderstorm') ||
                realtime.description.toLowerCase().includes('heavy')) score += 80;
        } else {
            source = "DỰ BÁO DỰA TRÊN LỊCH SỬ + AI";
            if (avgRain > 350) score += 60;
            else if (avgRain > 250) score += 45;
            else if (avgRain > 150) score += 25;
            if (isHighRisk) score += 70;
        }

        console.log(`Điểm rủi ro tính được: ${score}, nguồn: ${source}`);

        // 4. PHÂN CẤP
        let result = {};
        if (score >= 120) result = { level: "CỰC KỲ NGUY HIỂM", color: "#7f1d1d", msg: "CẤM ĐI – BÃO LŨ CỰC MẠNH!" };
        else if (score >= 90) result = { level: "Rất cao", color: "#dc2626", msg: "KHÔNG NÊN ĐI – Nguy cơ bão lũ cao!" };
        else if (score >= 60) result = { level: "Cao", color: "#f97316", msg: "CẦN THẬN TRỌNG – Mưa to, gió mạnh" };
        else if (score >= 30) result = { level: "Trung bình", color: "#facc15", msg: "CÓ THỂ MƯA – Mang ô dù" };
        else result = { level: "An toàn", color: "#22c55e", msg: "THOẢI MÁI ĐI CHƠI – Thời tiết đẹp!" };

        const finalResult = {
            province,
            date: date.toLocaleDateString('vi-VN'),
            level: result.level,
            color: result.color,
            message: result.msg,
            source,
            isHighRiskMonth: isHighRisk,
            details: { avgRain: realtime ? null : avgRain, realtime, score }
        };
        console.log('Kết quả cuối cùng:', finalResult);
        return finalResult;

    } catch (err) {
        console.error("Lỗi predictRisk:", err);
        return { error: "Không thể tải dữ liệu" };
    }
};