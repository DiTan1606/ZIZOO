// src/pages/GeminiDemo.js
import React, { useState } from 'react';
import {
    generateDestinationDescription,
    suggestActivities,
    generateTravelAdvice,
    generateTravelStory,
    suggestLocalFood,
    generateDestinationFAQ,
    optimizeItinerary
} from '../services/geminiService';
import Footer from '../components/Footer';

const GeminiDemo = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [selectedDemo, setSelectedDemo] = useState('description');

    const demos = {
        description: {
            name: '📝 Mô tả địa điểm',
            action: async () => {
                const desc = await generateDestinationDescription('Vũng Tàu', 'Bà Rịa - Vũng Tàu');
                return { type: 'text', content: desc };
            }
        },
        activities: {
            name: '🎯 Gợi ý hoạt động',
            action: async () => {
                const activities = await suggestActivities('Đà Nẵng', ['photography', 'food', 'beach'], 5);
                return { type: 'json', content: activities };
            }
        },
        advice: {
            name: '💡 Lời khuyên du lịch',
            action: async () => {
                const advice = await generateTravelAdvice('Hà Nội', 'comfort', 5000000, 2);
                return { type: 'list', content: advice };
            }
        },
        story: {
            name: '📖 Câu chuyện du lịch',
            action: async () => {
                const mockItinerary = {
                    header: {
                        destination: { main: 'Đà Lạt' },
                        duration: { days: 3 }
                    },
                    dailyItinerary: [
                        { destinations: [{ name: 'Hồ Xuân Hương' }, { name: 'Chợ Đà Lạt' }] },
                        { destinations: [{ name: 'Thác Datanla' }, { name: 'Đồi Chè Cầu Đất' }] }
                    ]
                };
                const story = await generateTravelStory(mockItinerary);
                return { type: 'text', content: story };
            }
        },
        food: {
            name: '🍜 Món ăn địa phương',
            action: async () => {
                const foods = await suggestLocalFood('Nha Trang', 'all');
                return { type: 'json', content: foods };
            }
        },
        faq: {
            name: '❓ FAQ điểm đến',
            action: async () => {
                const faqs = await generateDestinationFAQ('Phú Quốc');
                return { type: 'json', content: faqs };
            }
        },
        optimize: {
            name: '⚡ Tối ưu lịch trình',
            action: async () => {
                const mockDailyItinerary = [
                    { day: 1, destinations: [{ name: 'Hồ Gươm' }, { name: 'Văn Miếu' }] },
                    { day: 2, destinations: [{ name: 'Chùa Một Cột' }, { name: 'Hoàng Thành' }] }
                ];
                const suggestions = await optimizeItinerary(mockDailyItinerary, {
                    interests: ['culture', 'food'],
                    travelStyle: 'standard'
                });
                return { type: 'list', content: suggestions };
            }
        }
    };

    const runDemo = async () => {
        setLoading(true);
        setResult(null);

        try {
            const demoResult = await demos[selectedDemo].action();
            setResult(demoResult);
        } catch (error) {
            setResult({
                type: 'error',
                content: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const renderResult = () => {
        if (!result) return null;

        if (result.type === 'error') {
            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">❌ Lỗi: {result.content}</p>
                </div>
            );
        }

        if (result.type === 'text') {
            return (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-800 whitespace-pre-wrap">{result.content}</p>
                </div>
            );
        }

        if (result.type === 'list') {
            return (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <ul className="space-y-2">
                        {result.content.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-600 font-bold">{index + 1}.</span>
                                <span className="text-gray-800">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }

        if (result.type === 'json') {
            return (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 overflow-auto">
                        {JSON.stringify(result.content, null, 2)}
                    </pre>
                </div>
            );
        }
    };

    return (
        <>
        <div className="max-w-6xl mx-auto p-6">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-8 mb-6 text-white">
                <h1 className="text-4xl font-bold mb-2">🤖 Gemini AI Demo</h1>
                <p className="text-lg opacity-90">
                    Trải nghiệm sức mạnh của Google Gemini AI trong ứng dụng du lịch
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {Object.entries(demos).map(([key, demo]) => (
                    <button
                        key={key}
                        onClick={() => setSelectedDemo(key)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedDemo === key
                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                : 'border-gray-300 hover:border-blue-300 bg-white'
                        }`}
                    >
                        <h3 className="font-bold text-lg">{demo.name}</h3>
                    </button>
                ))}
            </div>

            <div className="text-center mb-6">
                <button
                    onClick={runDemo}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Đang xử lý...
                        </div>
                    ) : (
                        `🚀 Chạy ${demos[selectedDemo].name}`
                    )}
                </button>
            </div>

            {result && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-800">Kết quả:</h2>
                    {renderResult()}
                </div>
            )}

            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-bold text-yellow-800 mb-2">💡 Lưu ý:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Gemini API key đã được cấu hình trong file .env</li>
                    <li>• Mỗi request có thể mất 2-5 giây để xử lý</li>
                    <li>• API có giới hạn số lượng request miễn phí</li>
                    <li>• Kết quả có thể khác nhau mỗi lần chạy</li>
                </ul>
            </div>
        </div>
        <Footer />
        </>
    );
};

export default GeminiDemo;
