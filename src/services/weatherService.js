// src/services/weatherService.js
import axios from 'axios';
import provinceCoords from '../assets/provinceCoord.json';

const OPENWEATHER_API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY || null;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

export const getWeather = async (province) => {
    console.log(`Lấy thời tiết hiện tại cho ${province}`);
    if (!OPENWEATHER_API_KEY) {
        console.warn('OpenWeather API key chưa có → Fallback');
        return { temp: 25, condition: 'Sunny', description: 'Thời tiết đẹp' };
    }

    // Ưu tiên dùng tọa độ thay vì tên để chính xác hơn
    const coord = provinceCoords[province];
    
    try {
        let url;
        if (coord) {
            // Dùng tọa độ (chính xác hơn)
            url = `${OPENWEATHER_BASE_URL}/weather?lat=${coord.lat}&lon=${coord.lng}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`;
            console.log(`Dùng tọa độ cho ${province}:`, coord);
        } else {
            // Fallback: dùng tên tỉnh
            url = `${OPENWEATHER_BASE_URL}/weather?q=${province},VN&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`;
            console.log(`Dùng tên tỉnh cho ${province}`);
        }
        
        const res = await axios.get(url);
        const result = {
            temp: Math.round(res.data.main.temp),
            condition: res.data.weather[0].main,
            description: res.data.weather[0].description,
            icon: res.data.weather[0].icon,
        };
        console.log(`Kết quả thời tiết hiện tại cho ${province}:`, result);
        return result;
    } catch (err) {
        console.error('Weather API lỗi:', err.response?.status || err.message);
        if (err.response?.status === 401) {
            console.error("Lỗi 401: API key không hợp lệ");
        }
        return { temp: 25, condition: 'Sunny', description: 'Thời tiết đẹp', icon: '01d' };
    }
};

export const get7DayWeatherForecast = async (province, startDate = new Date()) => {
    console.log(`Lấy dự báo 7 ngày cho ${province} từ ${startDate.toISOString().split('T')[0]}`);
    if (!OPENWEATHER_API_KEY) {
        console.warn('OpenWeather API key chưa có → Fallback 7 ngày');
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            return {
                date: date.toISOString().split('T')[0],
                temp: 25,
                description: 'Thời tiết đẹp',
                rainChance: 0,
                icon: '01d',
            };
        });
    }

    const coord = provinceCoords[province];
    if (!coord) {
        console.warn(`Không có tọa độ cho ${province} → Fallback 7 ngày`);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            return {
                date: date.toISOString().split('T')[0],
                temp: 25,
                description: 'Thời tiết đẹp',
                rainChance: 0,
                icon: '01d',
            };
        });
    }

    try {
        console.log(`Gọi API OpenWeather cho ${province} với tọa độ:`, coord);
        const res = await axios.get(
            `${OPENWEATHER_BASE_URL}/forecast?lat=${coord.lat}&lon=${coord.lng}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=vi`
        );
        const forecast = res.data.list.slice(0, 40).reduce((acc, item) => {
            const date = new Date(item.dt * 1000).toISOString().split('T')[0];
            if (!acc[date]) acc[date] = { temp: 0, count: 0, rain: 0, description: '', icon: '' };
            acc[date].temp += item.main.temp;
            acc[date].count += 1;
            acc[date].rain += item.rain?.['3h'] || 0;
            acc[date].description = item.weather[0].description;
            acc[date].icon = item.weather[0].icon;
            return acc;
        }, {});
        const dailyForecast = Object.entries(forecast).slice(0, 7).map(([date, data]) => ({
            date,
            temp: Math.round(data.temp / data.count),
            description: data.description,
            rainChance: Math.round((data.rain / data.count) * 100 / 3), // Chuẩn hóa mưa 3h sang phần trăm
            icon: data.icon,
        }));
        console.log(`Dự báo 7 ngày cho ${province}:`, dailyForecast);
        return dailyForecast;
    } catch (err) {
        console.error(`Lỗi lấy dự báo 7 ngày cho ${province}:`, err.response?.status || err.message);
        if (err.response?.status === 401) {
            console.error("Lỗi 401: API key không hợp lệ");
        }
        try {
            const currentWeather = await getWeather(province);
            return Array.from({ length: 7 }, (_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                return {
                    date: date.toISOString().split('T')[0],
                    temp: currentWeather.temp,
                    description: currentWeather.description,
                    rainChance: 0,
                    icon: '01d',
                };
            });
        } catch {
            return Array.from({ length: 7 }, (_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                return {
                    date: date.toISOString().split('T')[0],
                    temp: 25,
                    description: 'Thời tiết đẹp',
                    rainChance: 0,
                    icon: '01d',
                };
            });
        }
    }
};