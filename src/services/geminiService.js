// src/services/geminiService.js
/**
 * Service tích hợp Google Gemini AI
 * Sử dụng Gemini API để tạo nội dung, gợi ý, và phân tích
 */

import transportDataService from './transportDataService';

// ⚠️ CẢNH BÁO: Để API key ở đây (client-side) là RẤT NGUY HIỂM.
// Bất kỳ ai cũng có thể đánh cắp key của bạn.
// Bạn PHẢI chuyển logic này về một server (backend).
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
// Sử dụng model gemini-2.5-flash
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Cài đặt an toàn mặc định (Default Safety Settings)
 * MỚI: Thêm để tránh lỗi "No parts in content" do bị chặn
 */
const DEFAULT_SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

/**
 * Gọi Gemini API
 * Đã sửa lỗi MAX_TOKENS, SAFETY, và thêm JSON MODE
 */
const callGeminiAPI = async (prompt, options = {}) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not found. Please add REACT_APP_GEMINI_API_KEY to .env file');
    }

    const generationConfig = {
        temperature: options.temperature || 0.7,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
        maxOutputTokens: options.maxOutputTokens || 1024,
    };

    if (options.responseFormat === 'json') {
        generationConfig.responseMimeType = 'application/json';
    }

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: generationConfig,
                safetySettings: DEFAULT_SAFETY_SETTINGS,
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        console.log('Gemini API response:', data);
        
        if (data.promptFeedback && data.promptFeedback.blockReason) {
             console.error('Prompt was blocked:', data.promptFeedback.blockReason);
             throw new Error(`Câu hỏi của bạn bị chặn: ${data.promptFeedback.blockReason}`);
        }

        if (!data.candidates || data.candidates.length === 0) {
            console.error('No candidates in response:', data);
            throw new Error('Không có phản hồi từ Gemini. Có thể do cài đặt an toàn.');
        }

        const candidate = data.candidates[0];
        
        if (candidate.finishReason && candidate.finishReason === 'SAFETY') {
            console.error('Response was blocked due to safety:', candidate.safetyRatings);
            throw new Error('Câu trả lời bị chặn vì lý do an toàn. Vui lòng thử lại.');
        }

        if (candidate.finishReason === 'MAX_TOKENS') {
            console.warn('Response was truncated due to MAX_TOKENS');
            // Vẫn trả về nội dung bị cắt nếu có
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const text = candidate.content.parts[0].text;
                return text + '\n\n[Câu trả lời bị cắt ngắn do quá dài. Hãy hỏi ngắn gọn hơn.]';
            }
        }
        
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            console.error('No content/parts in candidate:', candidate);
            throw new Error('Cấu trúc phản hồi không hợp lệ từ Gemini API.');
        }

        const text = candidate.content.parts[0].text;
        return text;

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
    }
};

/**
 * Tạo mô tả địa điểm du lịch bằng AI
 */
export const generateDestinationDescription = async (destinationName, province) => {
    const prompt = `Viết một đoạn mô tả ngắn gọn (2-3 câu) về địa điểm du lịch "${destinationName}" ở ${province}, Việt Nam. 
    Tập trung vào điểm đặc biệt, lý do nên đến, và trải nghiệm nổi bật.
    Viết bằng tiếng Việt, giọng điệu thân thiện và hấp dẫn.`;

    try {
        const description = await callGeminiAPI(prompt, { temperature: 0.8, maxOutputTokens: 250 });
        return description.trim();
    } catch (error) {
        console.error('Error generating destination description:', error);
        return `${destinationName} là một địa điểm du lịch nổi tiếng tại ${province}.`;
    }
};

/**
 * Gợi ý hoạt động dựa trên sở thích
 */
export const suggestActivities = async (destination, interests, duration) => {
    const prompt = `Gợi ý ${duration} hoạt động du lịch thú vị tại ${destination}, Việt Nam phù hợp với người thích: ${interests.join(', ')}.
    
    Trả về dưới dạng JSON array với format:
    [
        {
            "name": "Tên hoạt động",
            "description": "Mô tả ngắn",
            "duration": "Thời gian ước tính",
            "cost": "Chi phí ước tính (VNĐ)"
        }
    ]
    
    Chỉ trả về JSON, không thêm text khác.`;

    // SỬA: Khai báo response bên ngoài để 'catch' có thể truy cập
    let response;
    try {
        response = await callGeminiAPI(prompt, {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseFormat: 'json'
        });
        
        return JSON.parse(response);
        
    } catch (error) {
        console.error('Error suggesting activities:', error);
        if (error instanceof SyntaxError) {
            // SỬA: 'response' bây giờ đã truy cập được ở đây
            console.error('Failed to parse JSON, response was:', response);
        }
        return [];
    }
};

/**
 * Tạo lời khuyên du lịch cá nhân hóa
 */
export const generateTravelAdvice = async (destination, travelStyle, budget, travelers) => {
    const prompt = `Tôi đang lên kế hoạch du lịch ${destination}, Việt Nam với thông tin sau:
    - Phong cách: ${travelStyle}
    - Ngân sách: ${budget.toLocaleString('vi-VN')} VNĐ
    - Số người: ${travelers} // SỬA: Lỗi gõ nhầm 'travelVlers' -> 'travelers'
    
    Hãy cho tôi 5 lời khuyên hữu ích và cụ thể để chuyến đi thành công.
    Viết ngắn gọn, mỗi lời khuyên 1-2 câu.`;

    try {
        const advice = await callGeminiAPI(prompt, { temperature: 0.8, maxOutputTokens: 500 });
        
        const lines = advice.split('\n').filter(line => line.trim());
        return lines.map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim());
    } catch (error) {
        console.error('Error generating travel advice:', error);
        return [
            'Đặt vé và khách sạn trước để có giá tốt',
            'Mang theo tiền mặt cho các giao dịch nhỏ',
            'Kiểm tra thời tiết trước khi đi',
            'Tải app bản đồ offline',
            'Mua bảo hiểm du lịch'
        ];
    }
};

/**
 * Phân tích feedback và tạo insights
 */
export const analyzeFeedback = async (feedbacks) => {
    const feedbackText = feedbacks.map(f => 
        `${f.destinationId}: ${f.rating}/5 - ${f.comment || 'Không có nhận xét'}`
    ).join('\n');

    const prompt = `Phân tích các feedback du lịch sau và đưa ra 3 insights quan trọng:
    
    ${feedbackText}
    
    Tập trung vào:
    1. Điểm đến được yêu thích nhất
    2. Vấn đề phổ biến cần cải thiện
    3. Xu hướng sở thích của du khách
    
    Viết ngắn gọn, mỗi insight 1-2 câu.`;

    try {
        const insights = await callGeminiAPI(prompt, { temperature: 0.7, maxOutputTokens: 400 });
        
        const lines = insights.split('\n').filter(line => line.trim());
        return lines.map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim());
    } catch (error) {
        console.error('Error analyzing feedback:', error);
        return [
            'Chưa đủ dữ liệu để phân tích',
            'Cần thu thập thêm feedback',
            'Hãy tiếp tục sử dụng để có insights tốt hơn'
        ];
    }
};

/**
 * Tạo câu chuyện du lịch từ lịch trình
 */
export const generateTravelStory = async (itinerary) => {
    const destination = itinerary.header?.destination?.main;
    const duration = itinerary.header?.duration?.days;
    const highlights = itinerary.dailyItinerary?.slice(0, 3).map(day => 
        day.destinations?.slice(0, 2).map(d => d.name).join(', ')
    ).join('; ');

    const prompt = `Viết một đoạn giới thiệu hấp dẫn (3-4 câu) về chuyến du lịch ${duration} ngày tại ${destination}, Việt Nam.
    
    Các điểm nổi bật: ${highlights}
    
    Viết theo phong cách blog du lịch, thu hút người đọc muốn đi ngay.`;

    try {
        const story = await callGeminiAPI(prompt, { temperature: 0.9, maxOutputTokens: 300 });
        return story.trim();
    } catch (error) {
        console.error('Error generating travel story:', error);
        return `Khám phá ${destination} trong ${duration} ngày với những trải nghiệm tuyệt vời!`;
    }
};

/**
 * Gợi ý món ăn địa phương
 */
export const suggestLocalFood = async (destination, mealType = 'all') => {
    const mealTypeText = mealType === 'all' ? 'các món ăn đặc sản' : 
                         mealType === 'breakfast' ? 'món ăn sáng' :
                         mealType === 'lunch' ? 'món ăn trưa' : 'món ăn tối';

    const prompt = `Gợi ý 5 ${mealTypeText} nổi tiếng nhất tại ${destination}, Việt Nam.
    
    Trả về dưới dạng JSON array:
    [
        {
            "name": "Tên món",
            "description": "Mô tả ngắn",
            "priceRange": "Khoảng giá (VNĐ)",
            "whereToFind": "Nơi tìm thấy"
        }
    ]
    
    Chỉ trả về JSON, không thêm text khác.`;

    // SỬA: Khai báo response bên ngoài để 'catch' có thể truy cập
    let response;
    try {
        response = await callGeminiAPI(prompt, {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseFormat: 'json'
        });
        
        return JSON.parse(response);

    } catch (error) {
        console.error('Error suggesting local food:', error);
        if (error instanceof SyntaxError) {
            // SỬA: 'response' bây giờ đã truy cập được ở đây
            console.error('Failed to parse JSON, response was:', response);
        }
        return [];
    }
};

/**
 * Tạo câu hỏi thường gặp (FAQ) cho điểm đến
 */
export const generateDestinationFAQ = async (destination) => {
    const prompt = `Tạo 5 câu hỏi thường gặp (FAQ) về du lịch ${destination}, Việt Nam kèm câu trả lời ngắn gọn.
    
    Trả về dưới dạng JSON array:
    [
        {
            "question": "Câu hỏi",
            "answer": "Câu trả lời"
        }
    ]
    
    Chỉ trả về JSON, không thêm text khác.`;

    // SỬA: Khai báo response bên ngoài để 'catch' có thể truy cập
    let response;
    try {
        response = await callGeminiAPI(prompt, {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseFormat: 'json'
        });
        
        return JSON.parse(response);

    } catch (error) {
        console.error('Error generating FAQ:', error);
        if (error instanceof SyntaxError) {
            // SỬA: 'response' bây giờ đã truy cập được ở đây
            console.error('Failed to parse JSON, response was:', response);
        }
        return [];
    }
};

/**
 * Chatbot AI - Trả lời câu hỏi về du lịch
 */
export const askTravelQuestion = async (question, context = {}) => {
    const { destination, interests, budget } = context;
    
    let contextText = '';
    if (destination) contextText += `Điểm đến: ${destination}\n`;
    if (interests) contextText += `Sở thích: ${interests.join(', ')}\n`;
    if (budget) contextText += `Ngân sách: ${budget.toLocaleString('vi-VN')} VNĐ\n`;

    const prompt = `Trợ lý du lịch Việt Nam.

${contextText}Câu hỏi: ${question}

Trả lời CỰC NGẮN (tối đa 100 từ), súc tích, tiếng Việt.`;

    try {
        const answer = await callGeminiAPI(prompt, { temperature: 0.7, maxOutputTokens: 2048 });
        return answer.trim();
    } catch (error) {
        console.error('Error asking travel question:', error);
        return 'Xin lỗi, tôi không thể trả lời câu hỏi này lúc này. Vui lòng thử lại sau.';
    }
};

/**
 * Gợi ý điểm đến dựa trên mô tả của khách hàng
 */
export const suggestDestinationFromDescription = async (description, preferences = {}) => {
    const { budget, duration, travelers, interests } = preferences;
    
    let preferencesText = '';
    if (budget) preferencesText += `- Ngân sách: ${budget.toLocaleString('vi-VN')} VNĐ\n`;
    if (duration) preferencesText += `- Thời gian: ${duration} ngày\n`;
    if (travelers) preferencesText += `- Số người: ${travelers}\n`;
    if (interests) preferencesText += `- Sở thích: ${interests.join(', ')}\n`;

    const prompt = `Mô tả: "${description}"
${preferencesText}
Gợi ý 3 điểm đến CỤ THỂ ở Việt Nam (chỉ 1 thành phố/địa điểm, KHÔNG gộp nhiều địa điểm).

VÍ DỤ ĐÚNG: "Đà Nẵng", "Nha Trang", "Phú Quốc"
VÍ DỤ SAI: "Đà Nẵng - Hội An", "Quảng Nam - Đà Nẵng"

Trả về JSON:
[{"name":"Tên thành phố","province":"Tỉnh","reason":"Lý do ngắn (1 câu)","highlights":["Điểm 1","Điểm 2","Điểm 3"],"estimatedCost":"Chi phí ước tính","bestTime":"Thời điểm tốt nhất"}]

CHỈ JSON, không text khác.`;

    // SỬA: Khai báo response bên ngoài để 'catch' có thể truy cập
    let response;
    try {
        response = await callGeminiAPI(prompt, {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseFormat: 'json'
        });
        
        return JSON.parse(response);

    } catch (error) {
        console.error('Error suggesting destination:', error);
        if (error instanceof SyntaxError) {
            // SỬA: 'response' bâyB giờ đã truy cập được ở đây
            console.error('Failed to parse JSON, response was:', response);
        }
        return [];
    }
};

/**
 * Tối ưu hóa lịch trình bằng AI với dữ liệu giao thông thực tế
 */
export const optimizeItinerary = async (dailyItinerary, preferences) => {
    const itineraryText = dailyItinerary.map(day => 
        `Ngày ${day.day}: ${day.destinations?.map(d => d.name).join(', ')}`
    ).join('\n');
    
    // Thêm thông tin giao thông thực tế
    let transportInfo = '';
    if (preferences.departureCity && preferences.destination) {
        const info = transportDataService.formatForAI(preferences.departureCity, preferences.destination);
        if (info) {
            transportInfo = `\n\nThông tin giao thông:\n${info}`;
        }
    }

    const prompt = `Phân tích lịch trình du lịch sau và đưa ra 3 gợi ý cải thiện:
    
    ${itineraryText}
    ${transportInfo}
    
    Sở thích: ${preferences.interests?.join(', ')}
    Phong cách: ${preferences.travelStyle}
    
    Tập trung vào:
    1. Tối ưu thời gian di chuyển dựa trên dữ liệu thực tế
    2. Cân bằng hoạt động và nghỉ ngơi
    3. Thêm trải nghiệm độc đáo
    
    Viết ngắn gọn, mỗi gợi ý 1-2 câu.`;

    try {
        const suggestions = await callGeminiAPI(prompt, { temperature: 0.7, maxOutputTokens: 400 });
        
        const lines = suggestions.split('\n').filter(line => line.trim());
        return lines.map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim());
    } catch (error) {
        console.error('Error optimizing itinerary:', error);
        return [
            'Lịch trình của bạn đã được tối ưu tốt',
            'Hãy linh hoạt điều chỉnh theo thời tiết',
            'Để thời gian tự do khám phá'
        ];
    }
};

/**
 * Gợi ý phương tiện và giá xe dựa trên dữ liệu thực tế
 */
export const suggestTransportWithPrice = async (from, to, travelers, budget) => {
    const transportInfo = transportDataService.getTransportSuggestion(from, to);
    
    if (!transportInfo) {
        return {
            suggestion: `Không tìm thấy thông tin xe từ ${from} đến ${to}. Vui lòng kiểm tra lại tên địa điểm.`,
            options: []
        };
    }
    
    const budgetPerPerson = budget / travelers;
    const formattedInfo = transportDataService.formatForAI(from, to);
    
    const prompt = `Dựa trên thông tin sau, gợi ý phương tiện phù hợp:

${formattedInfo}

Số người: ${travelers}
Ngân sách/người: ${budgetPerPerson.toLocaleString('vi-VN')}đ

Đưa ra gợi ý NGẮN GỌN (2-3 câu) về:
1. Nhà xe nào phù hợp nhất
2. Loại xe nên chọn (giường nằm/ghế ngồi/limousine)
3. Lưu ý khi đặt vé`;

    try {
        const suggestion = await callGeminiAPI(prompt, { temperature: 0.7, maxOutputTokens: 300 });
        
        return {
            suggestion: suggestion.trim(),
            options: transportInfo.allOptions,
            cheapest: transportInfo.cheapest,
            fastest: transportInfo.fastest,
            from: transportInfo.from,
            to: transportInfo.to
        };
    } catch (error) {
        console.error('Error suggesting transport:', error);
        return {
            suggestion: formattedInfo,
            options: transportInfo.allOptions,
            cheapest: transportInfo.cheapest,
            fastest: transportInfo.fastest
        };
    }
};

// SỬA: Gán vào biến trước khi export default để fix cảnh báo ESLint
const geminiService = {
    generateDestinationDescription,
    suggestActivities,
    generateTravelAdvice,
    analyzeFeedback,
    generateTravelStory,
    suggestLocalFood,
    generateDestinationFAQ,
    optimizeItinerary,
    askTravelQuestion,
    suggestDestinationFromDescription,
    suggestTransportWithPrice
};

export default geminiService;