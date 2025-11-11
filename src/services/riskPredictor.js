// src/services/riskPredictor.js
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const RISK_MODEL = {
    predict: (weather, province, month) => {
        const { temp, humidity, wind_speed, rain = 0, description } = weather;
        let score = 0;

        // Mưa + gió mạnh
        if (rain > 100 && wind_speed > 60) score += 50;
        else if (rain > 50) score += 30;
        else if (rain > 20) score += 15;

        // Nhiệt độ bất thường
        if (temp > 36 || temp < 12) score += 25;

        // Mùa mưa/bão theo tỉnh
        const highRiskMonths = {
            'Quảng Ninh': [7, 8, 9],
            'Thừa Thiên Huế': [9, 10, 11],
            'Kiên Giang': [6, 7, 8],
            'Hà Nội': [7, 8],
            'Hồ Chí Minh': [6, 7, 8, 9],
            'Lâm Đồng': [6, 7, 8, 9],
            'Khánh Hòa': [10, 11, 12],
        };
        if (highRiskMonths[province]?.includes(month)) score += 30;

        // Từ khóa nguy hiểm
        const keywords = ['storm', 'typhoon', 'flood', 'heavy rain', 'bão', 'lũ', 'mưa lớn'];
        if (keywords.some(k => description.toLowerCase().includes(k))) score += 40;

        return Math.min(100, score);
    }
};

// Fallback weather data khi API fail
const getFallbackWeather = (province, month) => {
    const seasonalData = {
        'Lâm Đồng': { temp: 18, rain: 20, description: 'mưa nhẹ' },
        'Hồ Chí Minh': { temp: 30, rain: 10, description: 'nắng nhẹ' },
        'Hà Nội': { temp: 25, rain: 15, description: 'mây rải rác' },
        'Đà Nẵng': { temp: 28, rain: 5, description: 'quang mây' },
        'Khánh Hòa': { temp: 29, rain: 8, description: 'nắng' },
    };

    return seasonalData[province] || { temp: 26, rain: 10, description: 'thời tiết ôn hòa' };
};

export const predictAndSaveRisk = async (province, center) => {
    try {
        let weatherData;

        // Thử lấy dữ liệu thời tiết thực tế
        if (process.env.REACT_APP_OPENWEATHER_KEY && process.env.REACT_APP_OPENWEATHER_KEY !== 'undefined') {
            try {
                const res = await fetch(
                    `https://api.openweathermap.org/data/2.5/onecall?lat=${center.lat}&lon=${center.lng}&exclude=current,minutely,hourly,alerts&units=metric&appid=${process.env.REACT_APP_OPENWEATHER_KEY}`
                );
                if (res.ok) {
                    weatherData = await res.json();
                }
            } catch (error) {
                console.warn('Weather API failed, using fallback data');
            }
        }

        const now = new Date();
        const month = now.getMonth() + 1;

        // Tạo forecast 7 ngày
        const forecast = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() + i);

            let dayData;
            if (weatherData?.daily?.[i]) {
                const day = weatherData.daily[i];
                dayData = {
                    temp: Math.round(day.temp.day),
                    humidity: day.humidity,
                    wind_speed: Math.round(day.wind_speed * 3.6),
                    rain: day.rain || 0,
                    description: day.weather[0].description
                };
            } else {
                // Fallback data
                const fallback = getFallbackWeather(province, month);
                dayData = {
                    temp: fallback.temp + Math.random() * 4 - 2, // Biến đổi nhẹ
                    humidity: 60 + Math.random() * 30,
                    wind_speed: 5 + Math.random() * 15,
                    rain: fallback.rain + Math.random() * 10,
                    description: fallback.description
                };
            }

            return {
                date: date.toLocaleDateString('vi-VN'),
                ...dayData,
                risk_score: RISK_MODEL.predict(dayData, province, month)
            };
        });

        // Lưu vào Firestore
        const docRef = doc(db, 'riskForecasts', province.replace(/ /g, '_'));
        await setDoc(docRef, {
            province,
            center,
            updatedAt: serverTimestamp(),
            forecast,
            overall_risk: Math.max(...forecast.map(d => d.risk_score))
        }, { merge: true });

        return forecast;
    } catch (error) {
        console.error('Lỗi dự đoán rủi ro:', error);
        // Trả về forecast mặc định
        return generateDefaultForecast(province);
    }
};

const generateDefaultForecast = (province) => {
    const forecast = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        forecast.push({
            date: date.toLocaleDateString('vi-VN'),
            temp: 25 + Math.random() * 10,
            humidity: 60 + Math.random() * 30,
            wind_speed: 5 + Math.random() * 20,
            rain: Math.random() * 50,
            description: 'thời tiết ổn định',
            risk_score: 10 + Math.random() * 30
        });
    }
    return forecast;
};

export const getRiskForecast = async (province) => {
    try {
        const docRef = doc(db, 'riskForecasts', province.replace(/ /g, '_'));
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return snap.data().forecast;
    } catch (error) {
        console.error('Lỗi lấy risk forecast:', error);
        return null;
    }
};