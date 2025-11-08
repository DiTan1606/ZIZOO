// src/services/weatherService.js
import axios from 'axios';

export const getWeather = async (province) => {
    if (!process.env.REACT_APP_OPENWEATHER_API_KEY) {
        console.warn('OpenWeather API key chưa có → Fallback');
        return { temp: 25, condition: 'Sunny', description: 'Thời tiết đẹp' };
    }

    try {
        const res = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${province},VN&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}&units=metric`
        );
        return {
            temp: Math.round(res.data.main.temp),
            condition: res.data.weather[0].main,
            description: res.data.weather[0].description,
        };
    } catch (err) {
        console.error('Weather API lỗi:', err.response?.status || err.message);
        return { temp: 25, condition: 'Sunny', description: 'Thời tiết đẹp' }; // Fallback
    }
};