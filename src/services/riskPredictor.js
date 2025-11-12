// src/services/riskPredictor.js
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';



const RISK_MODEL = {
    predict: (weather, province, month) => {
        const { temp, humidity, wind_speed, rain = 0, description } = weather;
        let score = 0;

        // TP.HCM và các tỉnh miền Nam ít rủi ro thiên tai hơn
        const lowRiskProvinces = [
            'Hồ Chí Minh', 'Bình Dương', 'Đồng Nai', 'Long An',
            'Tiền Giang', 'Bến Tre', 'Vĩnh Long', 'Đồng Tháp',
            'An Giang', 'Kiên Giang', 'Cần Thơ', 'Hậu Giang',
            'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'
        ];

        // Giảm điểm rủi ro cho các tỉnh miền Nam
        if (lowRiskProvinces.includes(province)) {
            score -= 20; // Giảm đáng kể rủi ro cơ bản
        }

        // Mưa + gió mạnh (chỉ áp dụng nghiêm trọng)
        if (rain > 150 && wind_speed > 80) score += 40;
        else if (rain > 100 && wind_speed > 60) score += 25;
        else if (rain > 50) score += 10;

        // Nhiệt độ bất thường
        if (temp > 38 || temp < 15) score += 20;

        // Mùa mưa/bão theo tỉnh - CẬP NHẬT CHÍNH XÁC
        const highRiskMonths = {
            // Miền Bắc: mùa mưa bão
            'Quảng Ninh': [7, 8, 9],
            'Hải Phòng': [7, 8, 9],
            'Thái Bình': [7, 8, 9],
            'Nam Định': [7, 8, 9],
            'Ninh Bình': [7, 8, 9],

            // Miền Trung: mùa mưa lũ
            'Thừa Thiên Huế': [9, 10, 11],
            'Quảng Nam': [9, 10, 11],
            'Quảng Ngãi': [9, 10, 11],
            'Bình Định': [9, 10, 11],
            'Phú Yên': [9, 10, 11],
            'Khánh Hòa': [10, 11, 12],

            // Tây Nguyên: mùa mưa
            'Lâm Đồng': [6, 7, 8, 9],
            'Đắk Lắk': [6, 7, 8, 9],
            'Gia Lai': [6, 7, 8, 9],
            'Kon Tum': [6, 7, 8, 9],

            // Miền Nam: mùa mưa nhẹ
            'Hồ Chí Minh': [6, 7, 8, 9],
            'Đồng Nai': [6, 7, 8, 9],
            'Bà Rịa - Vũng Tàu': [6, 7, 8, 9]
        };

        if (highRiskMonths[province]?.includes(month)) {
            // Giảm hệ số rủi ro cho TP.HCM và miền Nam
            const riskMultiplier = lowRiskProvinces.includes(province) ? 0.3 : 1.0;
            score += 30 * riskMultiplier;
        }

        // Từ khóa nguy hiểm
        const dangerousKeywords = ['storm', 'typhoon', 'flood', 'heavy rain', 'bão', 'lũ', 'mưa lớn'];
        const warningKeywords = ['rain', 'shower', 'mưa', 'drizzle'];

        if (dangerousKeywords.some(k => description.toLowerCase().includes(k))) {
            score += lowRiskProvinces.includes(province) ? 20 : 40;
        } else if (warningKeywords.some(k => description.toLowerCase().includes(k))) {
            score += lowRiskProvinces.includes(province) ? 5 : 15;
        }

        // Đảm bảo điểm số trong khoảng 0-100
        return Math.max(0, Math.min(100, score));
    }
};
// Fallback weather data khi API fail
const getFallbackWeather = (province, month) => {
    const seasonalData = {
        // Miền Nam: thời tiết ổn định quanh năm
        'Hồ Chí Minh': { temp: 28 + Math.random() * 4, rain: Math.random() * 20, description: 'nắng nhẹ' },
        'Bình Dương': { temp: 28 + Math.random() * 4, rain: Math.random() * 20, description: 'nắng nhẹ' },
        'Đồng Nai': { temp: 28 + Math.random() * 4, rain: Math.random() * 20, description: 'nắng nhẹ' },
        'Bà Rịa - Vũng Tàu': { temp: 29 + Math.random() * 3, rain: Math.random() * 15, description: 'nắng' },

        // Miền Bắc: biến đổi theo mùa
        'Hà Nội': { temp: month >= 10 || month <= 3 ? 18 + Math.random() * 8 : 28 + Math.random() * 6,
            rain: month >= 5 && month <= 8 ? 30 + Math.random() * 40 : Math.random() * 20,
            description: month >= 5 && month <= 8 ? 'mưa rào' : 'mây rải rác' },

        // Miền Trung: mưa nhiều
        'Thừa Thiên Huế': { temp: 26 + Math.random() * 6,
            rain: month >= 9 && month <= 12 ? 50 + Math.random() * 50 : Math.random() * 30,
            description: month >= 9 && month <= 12 ? 'mưa nhiều' : 'mây thay đổi' },

        // Tây Nguyên: mát mẻ
        'Lâm Đồng': { temp: 18 + Math.random() * 4,
            rain: month >= 5 && month <= 10 ? 20 + Math.random() * 30 : Math.random() * 10,
            description: 'mát mẻ' }
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
