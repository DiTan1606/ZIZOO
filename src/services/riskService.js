// src/services/riskService.js
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import axios from 'axios';
import provinceCoords from '../assets/provinceCoord.json';
import { isHighRiskMonth } from '../utils/riskConfig';

const OPENWEATHER_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;

console.log("OPENWEATHER KEY ĐANG DÙNG:", process.env.REACT_APP_OPENWEATHER_API_KEY);

export const predictRisk = async (province, selectedDate) => {
    const date = new Date(selectedDate);
    const month = date.getMonth() + 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    const isFuture = diffDays >= 0;
    const isRealtime = isFuture && diffDays <= 5; // Free: 5 ngày (3h/lần)

    try {
        // 1. DỮ LIỆU LỊCH SỬ (backup)
        const q = query(
            collection(db, 'weather_monthly'),
            where('TinhThanh', '==', province),
            where('Tháng', '==', month)
        );
        const snap = await getDocs(q);
        let avgRain = 120;
        if (!snap.empty) {
            const total = snap.docs.reduce((s, d) => s + (d.data().LuongMua || 0), 0);
            avgRain = Math.round(total / snap.size);
        }

        // 2. DỰ BÁO THỰC TẾ – DÙNG ENDPOINT FREE (HÔM NAY + 5 NGÀY TỚI)
        let realtime = null;
        if (isRealtime && OPENWEATHER_KEY && OPENWEATHER_KEY !== "YOUR_KEY_HERE") {
            const coord = provinceCoords[province] || provinceCoords["Hà Nội"];
            try {
                const res = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
                    params: {
                        lat: coord.lat,
                        lon: coord.lng,
                        units: 'metric',
                        appid: OPENWEATHER_KEY
                    }
                });

                const targetDateStr = date.toISOString().split('T')[0];
                const dayData = res.data.list.filter(item => item.dt_txt.startsWith(targetDateStr));

                if (dayData.length > 0) {
                    const temps = dayData.map(d => d.main.temp);
                    const feels = dayData.map(d => d.main.feels_like);
                    const rains = dayData.map(d => d.rain?.['3h'] || 0);
                    const winds = dayData.map(d => d.wind.speed * 3.6);
                    const humidity = dayData.map(d => d.main.humidity);
                    const pressure = dayData.map(d => d.main.pressure);
                    const clouds = dayData.map(d => d.clouds.all);

                    realtime = {
                        temp: Math.round(temps.reduce((a, b) => a + b) / temps.length),
                        tempMin: Math.round(Math.min(...temps)),
                        tempMax: Math.round(Math.max(...temps)),
                        feelsLike: Math.round(feels.reduce((a, b) => a + b) / feels.length),
                        rain: Math.round(rains.reduce((a, b) => a + b, 0)),
                        wind: Math.round(Math.max(...winds)),
                        humidity: Math.round(humidity.reduce((a, b) => a + b) / humidity.length),
                        pressure: Math.round(pressure.reduce((a, b) => a + b) / pressure.length),
                        cloudiness: Math.round(clouds.reduce((a, b) => a + b) / clouds.length),
                        description: dayData[dayData.length - 1].weather[0].description,
                        icon: dayData[dayData.length - 1].weather[0].icon,
                        timeRange: `${dayData[0].dt_txt.split(' ')[1].slice(0, 5)} - ${dayData[dayData.length - 1].dt_txt.split(' ')[1].slice(0, 5)}`
                    };
                }
            } catch (err) {
                console.warn("OpenWeather lỗi, dùng lịch sử", err.message);
            }
        }

        // 3. TÍNH RỦI RO
        let score = 0;
        let source = "";

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
            if (isHighRiskMonth(province, month)) score += 70;
        }

        // 4. PHÂN CẤP
        let result = {};
        if (score >= 120) result = { level: "CỰC KỲ NGUY HIỂM", color: "#7f1d1d", msg: "CẤM ĐI – BÃO LŨ CỰC MẠNH!" };
        else if (score >= 90) result = { level: "Rất cao", color: "#dc2626", msg: "KHÔNG NÊN ĐI – Nguy cơ bão lũ cao!" };
        else if (score >= 60) result = { level: "Cao", color: "#f97316", msg: "CẦN THẬN TRỌNG – Mưa to, gió mạnh" };
        else if (score >= 30) result = { level: "Trung bình", color: "#facc15", msg: "CÓ THỂ MƯA – Mang ô dù" };
        else result = { level: "An toàn", color: "#22c55e", msg: "THOẢI MÁI ĐI CHƠI – Thời tiết đẹp!" };

        return {
            province,
            date: date.toLocaleDateString('vi-VN'),
            level: result.level,
            color: result.color,
            message: result.msg,
            source,
            isHighRiskMonth: isHighRiskMonth(province, month),
            details: { avgRain: realtime ? null : avgRain, realtime, score }
        };

    } catch (err) {
        console.error("Lỗi predictRisk:", err);
        return { error: "Không thể tải dữ liệu" };
    }
};