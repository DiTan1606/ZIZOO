// src/config/riskConfig.js
import { analyzeHighRiskMonths } from '../utils/disasterAnalyzer';

// Bộ nhớ đệm toàn cục – chỉ tính 1 lần duy nhất khi app khởi động
let HIGH_RISK_MONTHS = {};
let IS_INITIALIZED = false;

export const initRiskConfig = async () => {
    if (IS_INITIALIZED) {
        console.log('RiskConfig đã được khởi tạo trước đó');
        return HIGH_RISK_MONTHS;
    }

    try {
        console.log('Đang phân tích dữ liệu bão lũ 2022-2025 để tìm tháng nguy hiểm...');
        HIGH_RISK_MONTHS = await analyzeHighRiskMonths();
        IS_INITIALIZED = true;
        console.log('HOÀN TẤT! Đã xác định được', Object.keys(HIGH_RISK_MONTHS).length, 'tỉnh có tháng rủi ro cao');
        return HIGH_RISK_MONTHS;
    } catch (err) {
        console.error('Lỗi khởi tạo RiskConfig:', err);
        HIGH_RISK_MONTHS = {}; // fallback
        IS_INITIALIZED = true;
        return HIGH_RISK_MONTHS;
    }
};

// Kiểm tra tỉnh + tháng có nguy hiểm không
export const isHighRiskMonth = (province, month) => {
    if (!IS_INITIALIZED) return false;
    return HIGH_RISK_MONTHS[province]?.includes(month) || false;
};

// Trả về danh sách tháng nguy hiểm của tỉnh
export const getHighRiskMonths = (province) => {
    return HIGH_RISK_MONTHS[province] || [];
};

// Gọi ngay khi app khởi động (trong index.js hoặc App.js)
initRiskConfig();