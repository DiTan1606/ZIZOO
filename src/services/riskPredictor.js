// src/services/riskPredictor.js
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';
import provinceCoords from '../assets/provinceCoord.json';
import { predictRiskScore } from '../ml/riskModel'; // Mô hình ML

// Lấy API key từ biến môi trường
const OPENWEATHER_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;

// Mô hình dự đoán rủi ro dựa trên quy tắc
const RISK_MODEL = {
    predict: (weather, province, month) => {
        const { temp, humidity, wind_speed, rain = 0, description } = weather;
        let score = 0;

        // Điều kiện mưa và gió mạnh
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

        // Từ khóa nguy hiểm trong mô tả thời tiết
        const keywords = ['storm', 'typhoon', 'flood', 'heavy rain', 'bão', 'lũ', 'mưa lớn'];
        if (keywords.some(k => description.toLowerCase().includes(k))) score += 40;

        return Math.min(100, score);
    }
};

// Dữ liệu thời tiết dự phòng
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

// Hàm dự đoán và lưu rủi ro cho 7 ngày
export const predictAndSaveRisk = async (province, center) => {
    try {
        let weatherData;
        const month = new Date().getMonth() + 1;

        // Lấy tọa độ từ provinceCoord.json hoặc center
        const coord = provinceCoords[province] || center || { lat: 10.7769, lng: 106.7009 };
        console.log(`Lấy dữ liệu thời tiết cho ${province} tại tọa độ:`, coord);

        // Gọi API OpenWeather
        if (OPENWEATHER_KEY) {
            try {
                const res = await axios.get(
                    `https://api.openweathermap.org/data/2.5/onecall?lat=${coord.lat}&lon=${coord.lng}&exclude=current,minutely,hourly,alerts&units=metric&appid=${OPENWEATHER_KEY}`
                );
                weatherData = res.data;
                console.log('Phản hồi từ OpenWeather API:', weatherData);
            } catch (apiError) {
                console.error('Lỗi API OpenWeather:', apiError.response?.data || apiError.message);
                weatherData = { daily: [] };
            }
        } else {
            console.warn('Thiếu khóa API OpenWeather');
            weatherData = { daily: [] };
        }

        // Nếu API thất bại hoặc dữ liệu không đủ, dùng dự phòng
        if (!weatherData.daily || weatherData.daily.length < 7) {
            console.warn('Dữ liệu OpenWeather không hợp lệ, sử dụng dữ liệu dự phòng');
            weatherData.daily = Array.from({ length: 7 }, (_, i) => {
                const fallback = getFallbackWeather(province, month);
                return {
                    temp: { day: fallback.temp + Math.random() * 5 - 2.5 },
                    humidity: 70 + Math.random() * 20 - 10,
                    wind_speed: 5 + Math.random() * 10,
                    rain: fallback.rain + Math.random() * 20 - 10,
                    weather: [{ description: fallback.description }],
                };
            });
        }

        // Dự báo rủi ro cho 7 ngày
        const forecast = await Promise.all(
            weatherData.daily.map(async (day, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dayData = {
                    temp: Math.round(day.temp.day),
                    humidity: day.humidity,
                    wind_speed: Math.round(day.wind_speed * 3.6),
                    rain: day.rain || 0,
                    description: day.weather[0].description,
                };

                // Tính điểm rủi ro từ ML và mô hình quy tắc
                const features = [dayData.temp, dayData.humidity, dayData.wind_speed, dayData.rain];
                const mlScore = await predictRiskScore(month, province, [], features);
                console.log(`Điểm ML cho ${province} ngày ${date.toLocaleDateString('vi-VN')}:`, mlScore);
                const modelScore = RISK_MODEL.predict(dayData, province, month);

                return {
                    date: date.toLocaleDateString('vi-VN'),
                    ...dayData,
                    risk_score: (modelScore + mlScore * 100) / 2, // Kết hợp ML và quy tắc
                };
            })
        );

        // Lưu vào Firestore
        const docRef = doc(db, 'riskForecasts', province.replace(/ /g, '_'));
        await setDoc(
            docRef,
            {
                province,
                center: coord,
                updatedAt: serverTimestamp(),
                forecast,
                overall_risk: Math.max(...forecast.map(d => d.risk_score)),
            },
            { merge: true }
        );

        return forecast;
    } catch (error) {
        console.error('Lỗi dự báo rủi ro:', error);
        return generateDefaultForecast(province);
    }
};

// Hàm dự đoán rủi ro cho một ngày du lịch cụ thể
export const predictRiskForTravel = async (province, travelDate, center) => {
    try {
        let weatherData;
        const month = new Date(travelDate).getMonth() + 1;
        const targetDate = new Date(travelDate).toLocaleDateString('vi-VN');

        // Lấy tọa độ
        const coord = provinceCoords[province] || center || { lat: 10.7769, lng: 106.7009 };
        console.log(`Dự đoán rủi ro cho ${province} vào ngày ${targetDate} tại tọa độ:`, coord);

        // Gọi API OpenWeather
        if (OPENWEATHER_KEY) {
            try {
                const res = await axios.get(
                    `https://api.openweathermap.org/data/2.5/onecall?lat=${coord.lat}&lon=${coord.lng}&exclude=current,minutely,hourly,alerts&units=metric&appid=${OPENWEATHER_KEY}`
                );
                weatherData = res.data;
                console.log('Phản hồi từ OpenWeather API:', weatherData);
            } catch (apiError) {
                console.error('Lỗi API OpenWeather:', apiError.response?.data || apiError.message);
                weatherData = { daily: [] };
            }
        } else {
            console.warn('Thiếu khóa API OpenWeather');
            weatherData = { daily: [] };
        }

        // Tìm dữ liệu thời tiết cho ngày cụ thể
        let dayData;
        if (weatherData.daily && weatherData.daily.length > 0) {
            const dayIndex = Math.min(
                Math.floor((new Date(travelDate) - new Date()) / (1000 * 60 * 60 * 24)),
                weatherData.daily.length - 1
            );
            if (dayIndex >= 0) {
                const day = weatherData.daily[dayIndex];
                dayData = {
                    temp: Math.round(day.temp.day),
                    humidity: day.humidity,
                    wind_speed: Math.round(day.wind_speed * 3.6),
                    rain: day.rain || 0,
                    description: day.weather[0].description,
                };
            }
        }

        // Dữ liệu dự phòng nếu không có dữ liệu API
        if (!dayData) {
            console.warn('Không có dữ liệu thời tiết cho ngày này, sử dụng dự phòng');
            const fallback = getFallbackWeather(province, month);
            dayData = {
                temp: fallback.temp + Math.random() * 5 - 2.5,
                humidity: 70 + Math.random() * 20 - 10,
                wind_speed: 5 + Math.random() * 10,
                rain: fallback.rain + Math.random() * 20 - 10,
                description: fallback.description,
            };
        }

        // Tính điểm rủi ro
        const features = [dayData.temp, dayData.humidity, dayData.wind_speed, dayData.rain];
        const mlScore = await predictRiskScore(month, province, [], features);
        console.log(`Điểm ML cho ${province} vào ngày ${targetDate}:`, mlScore);
        const modelScore = RISK_MODEL.predict(dayData, province, month);

        const forecast = {
            date: targetDate,
            ...dayData,
            risk_score: (modelScore + mlScore * 100) / 2,
        };

        // Lưu vào Firestore (tùy chọn)
        const docRef = doc(db, 'riskForecasts', province.replace(/ /g, '_'));
        await setDoc(
            docRef,
            {
                province,
                center: coord,
                updatedAt: serverTimestamp(),
                forecast: [forecast],
                overall_risk: forecast.risk_score,
            },
            { merge: true }
        );

        return forecast;
    } catch (error) {
        console.error('Lỗi dự đoán rủi ro du lịch:', error);
        const month = new Date(travelDate).getMonth() + 1;
        return {
            date: new Date(travelDate).toLocaleDateString('vi-VN'),
            ...getFallbackWeather(province, month),
            risk_score: 10 + Math.random() * 30,
        };
    }
};

// Tạo dự báo mặc định nếu lỗi
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
            risk_score: 10 + Math.random() * 30,
        });
    }
    return forecast;
};

// Lấy dự báo từ Firestore
export const getRiskForecast = async (province) => {
    try {
        const docRef = doc(db, 'riskForecasts', province.replace(/ /g, '_'));
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            console.warn(`Không tìm thấy dự báo cho ${province}`);
            return null;
        }
        return snap.data().forecast;
    } catch (error) {
        console.error('Lỗi lấy dự báo:', error);
        return null;
    }
};