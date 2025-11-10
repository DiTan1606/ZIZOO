// src/services/weatherService.js
import axios from 'axios';
import provinceCoords from '../assets/provinceCoord.json';

const OPENWEATHER_API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY || null;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

export const getWeather = async (province) => {
    if (!OPENWEATHER_API_KEY) {
        console.warn('OpenWeather API key chưa có → Fallback');
        return { temp: 25, condition: 'Sunny', description: 'Thời tiết đẹp' };
    }

    try {
        const res = await axios.get(
            `${OPENWEATHER_BASE_URL}/weather?q=${province},VN&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`
        );
        return {
            temp: Math.round(res.data.main.temp),
            condition: res.data.weather[0].main,
            description: res.data.weather[0].description,
        };
    } catch (err) {
        console.error('Weather API lỗi:', err.response?.status || err.message);
        return { temp: 25, condition: 'Sunny', description: 'Thời tiết đẹp' };
    }
};

export const get7DayWeatherForecast = async (province, startDate = new Date()) => {
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
        const res = await axios.get(
            `${OPENWEATHER_BASE_URL}/forecast/daily?lat=${coord.lat}&lon=${coord.lng}&cnt=7&units=metric&appid=${OPENWEATHER_API_KEY}&lang=vi`
        );

        if (res.data.cod !== '200' || !res.data.list) {
            throw new Error(`Dữ liệu dự báo không hợp lệ: ${res.data.message || 'Không có list'}`);
        }

        const forecast = res.data.list.map((day, index) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + index);
            return {
                date: date.toISOString().split('T')[0],
                temp: Math.round(day.temp?.day || 25),
                description: day.weather?.[0]?.description || 'Thời tiết đẹp',
                rainChance: Math.round((day.pop || 0) * 100),
                icon: day.weather?.[0]?.icon || '01d',
            };
        });

        console.log(`Dự báo 7 ngày cho ${province}:`, forecast);
        return forecast;
    } catch (err) {
        console.error(`Lỗi lấy dự báo 7 ngày cho ${province}:`, err.response?.status || err.message);
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