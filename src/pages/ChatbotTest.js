// src/pages/ChatbotTest.js
import React from 'react';
import aiIcon from '../icon/ai.png';
import chatIcon from '../icon/livechat.png';
import sendIcon from '../icon/guitinnhan.png';

const ChatbotTest = () => {
    return (
        <div style={{ 
            maxWidth: '800px', 
            margin: '50px auto', 
            padding: '40px',
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                marginBottom: '20px'
            }}>
                <img src={aiIcon} alt="AI" style={{ width: '60px', height: '60px' }} />
                <h1 style={{ 
                    fontSize: '48px', 
                    textAlign: 'center', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: 0
                }}>
                    AI Chatbot Test
                </h1>
            </div>
            
            <div style={{ 
                background: '#f5f7fa', 
                padding: '30px', 
                borderRadius: '15px',
                marginBottom: '30px'
            }}>
                <h2 style={{ color: '#667eea', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={chatIcon} alt="" style={{ width: '32px', height: '32px' }} />
                    Tìm nút chatbot:
                </h2>
                <ol style={{ fontSize: '18px', lineHeight: '2' }}>
                    <li>Nhìn xuống <strong>góc dưới bên phải</strong> màn hình</li>
                    <li>Tìm nút tròn màu tím với icon <strong>💬</strong></li>
                    <li><strong>Click vào nút đó</strong></li>
                    <li>Cửa sổ chat sẽ mở ra</li>
                    <li>Nhập câu hỏi vào ô input ở dưới cùng</li>
                </ol>
            </div>

            <div style={{ 
                background: '#e8f5e9', 
                padding: '30px', 
                borderRadius: '15px',
                marginBottom: '30px'
            }}>
                <h2 style={{ color: '#4caf50', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={sendIcon} alt="" style={{ width: '32px', height: '32px' }} />
                    Ví dụ câu hỏi:
                </h2>
                <ul style={{ fontSize: '18px', lineHeight: '2', listStyle: 'none', paddingLeft: 0 }}>
                    <li>🏖️ "Gợi ý điểm đến biển đẹp"</li>
                    <li>🍜 "Đà Nẵng có món gì ngon?"</li>
                    <li>💰 "Du lịch Hà Nội 3 ngày hết bao nhiêu?"</li>
                    <li>📅 "Tháng 12 nên đi đâu?"</li>
                    <li>🏔️ "Nơi nào có núi non hùng vĩ?"</li>
                </ul>
            </div>

            <div style={{ 
                background: '#fff3e0', 
                padding: '30px', 
                borderRadius: '15px',
                border: '2px solid #ff9800'
            }}>
                <h2 style={{ color: '#ff9800', marginBottom: '15px' }}>
                    ⚠️ Nếu không thấy nút chatbot:
                </h2>
                <ol style={{ fontSize: '16px', lineHeight: '1.8' }}>
                    <li>Mở Console (F12) → Xem có lỗi không</li>
                    <li>Restart server: <code style={{ background: '#333', color: '#0f0', padding: '2px 8px', borderRadius: '4px' }}>npm start</code></li>
                    <li>Clear cache: <code style={{ background: '#333', color: '#0f0', padding: '2px 8px', borderRadius: '4px' }}>Ctrl+Shift+R</code></li>
                    <li>Kiểm tra file <code>src/components/TravelChatbot.js</code> có tồn tại không</li>
                </ol>
            </div>

            <div style={{ 
                marginTop: '40px',
                textAlign: 'center',
                fontSize: '24px',
                color: '#667eea',
                fontWeight: 'bold'
            }}>
                👉 Hãy nhìn xuống góc dưới bên phải ngay bây giờ! 👈
            </div>

            <div style={{
                marginTop: '30px',
                textAlign: 'center',
                fontSize: '100px'
            }}>
                ↘️
            </div>
        </div>
    );
};

export default ChatbotTest;
