// src/components/TravelChatbot.js
import React, { useState, useRef, useEffect } from 'react';
import { askTravelQuestion, suggestDestinationFromDescription } from '../services/geminiService';
import './TravelChatbot.css';

// Import icons
import livechatIcon from '../icon/livechat.png';
import aiIcon from '../icon/ai.png';
import sendIcon from '../icon/guitinnhan.png';

const TravelChatbot = () => {
    const [messages, setMessages] = useState([
        {
            type: 'bot',
            text: 'Xin chào! 👋 Tôi là trợ lý du lịch AI của ZIZOO. Tôi có thể giúp bạn:\n\n• Tìm điểm đến phù hợp\n• Gợi ý lịch trình\n• Tư vấn chi phí\n• Trả lời mọi câu hỏi về du lịch Việt Nam\n\nBạn muốn đi du lịch ở đâu? 🌍',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = {
            type: 'user',
            text: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Phát hiện intent
            const lowerInput = input.toLowerCase();
            let response;

            if (lowerInput.includes('gợi ý') || lowerInput.includes('tìm') || lowerInput.includes('nên đi')) {
                // Gợi ý điểm đến
                const suggestions = await suggestDestinationFromDescription(input);
                
                if (suggestions.length > 0) {
                    response = '🎯 Dựa trên mô tả của bạn, tôi gợi ý:\n\n';
                    suggestions.forEach((dest, index) => {
                        response += `${index + 1}. **${dest.name}** (${dest.province})\n`;
                        response += `   ${dest.reason}\n`;
                        response += `   ✨ Điểm nổi bật: ${dest.highlights.join(', ')}\n`;
                        response += `   💰 Chi phí: ${dest.estimatedCost}\n`;
                        response += `   📅 Thời điểm đẹp: ${dest.bestTime}\n\n`;
                    });
                    response += 'Bạn muốn biết thêm chi tiết về điểm nào không? 😊';
                } else {
                    response = await askTravelQuestion(input);
                }
            } else {
                // Trả lời câu hỏi thông thường
                response = await askTravelQuestion(input);
            }

            const botMessage = {
                type: 'bot',
                text: response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            const errorMessage = {
                type: 'bot',
                text: '😔 Xin lỗi, tôi gặp sự cố kỹ thuật. Vui lòng thử lại sau.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const quickQuestions = [
        '🏖️ Gợi ý điểm đến biển đẹp',
        '🏔️ Nơi nào có núi non hùng vĩ?',
        '🍜 Đà Nẵng có món gì ngon?',
        '💰 Du lịch Hà Nội 3 ngày hết bao nhiêu?',
        '📅 Tháng 12 nên đi đâu?'
    ];

    const handleQuickQuestion = (question) => {
        setInput(question);
    };

    return (
        <>
            {/* Floating Button */}
            <button 
                className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? '✕' : <img src={livechatIcon} alt="Chat" className="toggle-icon" />}
            </button>

            {/* Chatbot Window */}
            {isOpen && (
                <div className="chatbot-window">
                    <div className="chatbot-header">
                        <div className="chatbot-header-content">
                            <div className="chatbot-avatar">
                                <img src={aiIcon} alt="AI" className="avatar-icon" />
                            </div>
                            <div>
                                <h3>Trợ lý Du lịch AI</h3>
                                <p>Powered by Gemini</p>
                            </div>
                        </div>
                        <button className="chatbot-close" onClick={() => setIsOpen(false)}>✕</button>
                    </div>

                    <div className="chatbot-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.type}`}>
                                <div className="message-content">
                                    {msg.text.split('\n').map((line, i) => {
                                        // Parse markdown-style bold
                                        const parts = line.split(/(\*\*.*?\*\*)/g);
                                        return (
                                            <p key={i}>
                                                {parts.map((part, j) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                })}
                                            </p>
                                        );
                                    })}
                                </div>
                                <div className="message-time">
                                    {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="message bot">
                                <div className="message-content">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Questions */}
                    {messages.length <= 1 && (
                        <div className="quick-questions">
                            <p>Câu hỏi gợi ý:</p>
                            {quickQuestions.map((q, index) => (
                                <button
                                    key={index}
                                    className="quick-question-btn"
                                    onClick={() => handleQuickQuestion(q)}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="chatbot-input">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Hỏi tôi về du lịch Việt Nam..."
                            rows="2"
                            disabled={loading}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="send-btn"
                        >
                            {loading ? '⏳' : <img src={sendIcon} alt="Send" />}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default TravelChatbot;
