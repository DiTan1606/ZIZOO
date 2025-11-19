// src/services/chatbotTrainingService.js
/**
 * Service để train Gemini chatbot với context về app và user
 */

import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

/**
 * System Instructions cho Gemini Chatbot
 * Định nghĩa vai trò và khả năng của chatbot
 */
export const CHATBOT_SYSTEM_INSTRUCTIONS = `
Bạn là trợ lý du lịch thông minh của ứng dụng "ZIZOO".

## VAI TRÒ CỦA BẠN:
- Tư vấn lịch trình du lịch trong nước Việt Nam
- Gợi ý địa điểm, nhà hàng, khách sạn
- Giúp người dùng quản lý lịch trình của họ
- Trả lời câu hỏi về du lịch, văn hóa, ẩm thực Việt Nam
- Hỗ trợ tính toán chi phí, thời gian di chuyển

## KHẢ NĂNG CỦA BẠN:
1. **Xem lịch trình của user:** Bạn có thể truy cập và tóm tắt các chuyến đi đã lưu
2. **Gợi ý địa điểm:** Dựa trên sở thích và lịch sử của user
3. **Tính toán chi phí:** Ước tính ngân sách cho chuyến đi
4. **Tư vấn thời tiết:** Gợi ý thời điểm tốt nhất để đi
5. **Giải đáp thắc mắc:** Về visa, giao thông, văn hóa địa phương

## PHONG CÁCH GIAO TIẾP:
- Thân thiện, nhiệt tình
- Ngắn gọn, súc tích
- Sử dụng emoji phù hợp (🏖️, 🍜, 🏨, ✈️)
- Luôn hỏi thêm thông tin nếu cần để tư vấn tốt hơn

## GIỚI HẠN:
- Chỉ tư vấn du lịch trong Việt Nam
- Không đặt vé, không thanh toán (chỉ gợi ý)
- Không cung cấp thông tin cá nhân nhạy cảm của user

## KHI NGƯỜI DÙNG HỎI VỀ LỊCH TRÌNH:
- Tóm tắt các chuyến đi đã lưu
- Gợi ý chỉnh sửa hoặc tối ưu
- So sánh các options khác nhau

Hãy luôn hữu ích và tạo trải nghiệm tốt nhất cho người dùng!
`;

/**
 * Lấy thông tin user để cung cấp context cho chatbot
 */
export const getUserContext = async (userId) => {
    if (!userId) return null;

    try {
        const context = {
            userId,
            itineraries: [],
            preferences: {},
            recentSearches: []
        };

        // 1. Lấy lịch trình của user
        const itinerariesRef = collection(db, 'complete_itineraries');
        
        // Thử query với index, nếu lỗi thì fallback
        let snapshot;
        try {
            const q = query(
                itinerariesRef,
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(5)
            );
            snapshot = await getDocs(q);
        } catch (indexError) {
            console.warn('Index not available, using simple query:', indexError);
            // Fallback: Query đơn giản không cần index
            const simpleQ = query(
                itinerariesRef,
                where('userId', '==', userId),
                limit(5)
            );
            snapshot = await getDocs(simpleQ);
        }
        context.itineraries = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                destination: data.destination,
                startDate: data.startDate,
                duration: data.duration,
                budget: data.budget,
                travelers: data.travelers,
                status: data.status || 'planning'
            };
        });

        // 2. Phân tích preferences từ lịch sử
        if (context.itineraries.length > 0) {
            const destinations = context.itineraries.map(i => i.destination);
            const avgBudget = context.itineraries.reduce((sum, i) => sum + (i.budget || 0), 0) / context.itineraries.length;
            
            context.preferences = {
                favoriteDestinations: [...new Set(destinations)],
                averageBudget: Math.round(avgBudget),
                averageDuration: Math.round(
                    context.itineraries.reduce((sum, i) => sum + (i.duration || 0), 0) / context.itineraries.length
                ),
                travelStyle: 'standard' // Có thể phân tích từ budget
            };
        }

        return context;
    } catch (error) {
        console.error('Error getting user context:', error);
        return null;
    }
};

/**
 * Format user context thành prompt cho Gemini
 */
export const formatUserContextForPrompt = (userContext) => {
    if (!userContext) return '';

    let contextPrompt = '\n\n## THÔNG TIN NGƯỜI DÙNG:\n';

    // Lịch trình đã lưu
    if (userContext.itineraries && userContext.itineraries.length > 0) {
        contextPrompt += '\n### Các chuyến đi đã lưu:\n';
        userContext.itineraries.forEach((trip, index) => {
            contextPrompt += `${index + 1}. ${trip.destination} - ${trip.duration} ngày (${trip.startDate})\n`;
            contextPrompt += `   - Ngân sách: ${trip.budget?.toLocaleString('vi-VN')}đ\n`;
            contextPrompt += `   - Số người: ${trip.travelers}\n`;
            contextPrompt += `   - Trạng thái: ${trip.status}\n`;
        });
    }

    // Preferences
    if (userContext.preferences && Object.keys(userContext.preferences).length > 0) {
        contextPrompt += '\n### Sở thích du lịch:\n';
        if (userContext.preferences.favoriteDestinations) {
            contextPrompt += `- Địa điểm yêu thích: ${userContext.preferences.favoriteDestinations.join(', ')}\n`;
        }
        if (userContext.preferences.averageBudget) {
            contextPrompt += `- Ngân sách trung bình: ${userContext.preferences.averageBudget.toLocaleString('vi-VN')}đ/chuyến\n`;
        }
        if (userContext.preferences.averageDuration) {
            contextPrompt += `- Thời gian trung bình: ${userContext.preferences.averageDuration} ngày\n`;
        }
    }

    return contextPrompt;
};

/**
 * Tạo prompt đầy đủ cho chatbot với system instructions + user context
 */
export const buildChatbotPrompt = async (userMessage, userId) => {
    let fullPrompt = CHATBOT_SYSTEM_INSTRUCTIONS;

    // Thêm user context nếu có userId
    if (userId) {
        const userContext = await getUserContext(userId);
        if (userContext) {
            fullPrompt += formatUserContextForPrompt(userContext);
        }
    }

    // Thêm tin nhắn của user
    fullPrompt += `\n\n## CÂU HỎI CỦA NGƯỜI DÙNG:\n${userMessage}`;

    return fullPrompt;
};

/**
 * Phân tích intent của user để xử lý đặc biệt
 */
export const analyzeUserIntent = (message) => {
    const lowerMessage = message.toLowerCase();

    const intents = {
        viewItineraries: ['lịch trình', 'chuyến đi', 'xem lịch', 'các chuyến'],
        createItinerary: ['tạo lịch', 'lên lịch', 'lập kế hoạch', 'đi du lịch'],
        budgetQuery: ['chi phí', 'ngân sách', 'giá', 'bao nhiêu tiền'],
        destinationQuery: ['địa điểm', 'đi đâu', 'nơi nào', 'gợi ý'],
        weatherQuery: ['thời tiết', 'mưa', 'nắng', 'khí hậu'],
        foodQuery: ['ăn gì', 'món ăn', 'nhà hàng', 'quán ăn', 'ẩm thực'],
        hotelQuery: ['khách sạn', 'chỗ ở', 'homestay', 'resort']
    };

    for (const [intent, keywords] of Object.entries(intents)) {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
            return intent;
        }
    }

    return 'general';
};

/**
 * Xử lý response dựa trên intent
 */
export const enhanceResponseByIntent = async (intent, userContext) => {
    const enhancements = {
        viewItineraries: () => {
            if (userContext?.itineraries?.length > 0) {
                return `\n\n📋 **Bạn có ${userContext.itineraries.length} chuyến đi đã lưu:**\n` +
                    userContext.itineraries.map((trip, i) => 
                        `${i + 1}. ${trip.destination} (${trip.duration} ngày) - ${trip.status}`
                    ).join('\n');
            }
            return '\n\n📋 Bạn chưa có chuyến đi nào được lưu.';
        },
        
        createItinerary: () => {
            return '\n\n✨ **Để tạo lịch trình mới:**\n' +
                '1. Nhấn vào "Tạo lịch trình" ở menu\n' +
                '2. Chọn điểm đến, ngày đi, ngân sách\n' +
                '3. Hệ thống sẽ tự động tạo lịch trình chi tiết cho bạn!';
        },
        
        budgetQuery: () => {
            if (userContext?.preferences?.averageBudget) {
                return `\n\n💰 Ngân sách trung bình của bạn: ${userContext.preferences.averageBudget.toLocaleString('vi-VN')}đ/chuyến`;
            }
            return '';
        }
    };

    return enhancements[intent] ? enhancements[intent]() : '';
};

export default {
    CHATBOT_SYSTEM_INSTRUCTIONS,
    getUserContext,
    formatUserContextForPrompt,
    buildChatbotPrompt,
    analyzeUserIntent,
    enhanceResponseByIntent
};
