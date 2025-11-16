// src/pages/ItineraryDemo.js
import React, { useState } from 'react';
import { createCompleteItinerary } from '../services/completeItineraryService';
import { generatePersonalizedRecommendations } from '../ml/hybridRecommendationEngine';
import { trainAllAIModels, generateSyntheticData } from '../services/aiTrainingService';

const ItineraryDemo = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [demoType, setDemoType] = useState('complete');

    const runCompleteItineraryDemo = async () => {
        setLoading(true);
        try {
            const samplePreferences = {
                destination: 'Đà Nẵng',
                departureCity: 'Hà Nội',
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
                duration: 4,
                travelers: 2,
                budget: 8000000,
                travelStyle: 'comfort',
                interests: ['culture', 'food', 'photography']
            };

            console.log('🚀 Creating complete itinerary with REAL data...');
            const itinerary = await createCompleteItinerary(samplePreferences, 'demo_user');
            
            // Thêm thông tin về chất lượng dữ liệu
            console.log('📊 Data quality:', itinerary.dataQuality);
            
            setResult(itinerary);
        } catch (error) {
            console.error('Demo error:', error);
            setResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const runAIRecommendationDemo = async () => {
        setLoading(true);
        try {
            const recommendations = await generatePersonalizedRecommendations('demo_user', {
                month: 6,
                budget: 'medium',
                type: 'Nghỉ dưỡng',
                adventureLevel: 'medium',
                ecoFriendly: false,
                provinces: ['Đà Nẵng', 'Quảng Nam']
            }, {
                topK: 5,
                includeExplanations: true
            });

            setResult({ recommendations });
        } catch (error) {
            console.error('AI Demo error:', error);
            setResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const runTrainingDemo = async () => {
        setLoading(true);
        try {
            // Generate synthetic data first
            await generateSyntheticData(10, 50);
            
            // Train models
            const trainingResult = await trainAllAIModels();
            
            setResult({ trainingResult });
        } catch (error) {
            console.error('Training Demo error:', error);
            setResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const formatJSON = (obj) => {
        return JSON.stringify(obj, null, 2);
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
                    🧪 Zizoo System Demo
                </h1>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <button
                        onClick={() => setDemoType('complete')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                            demoType === 'complete' 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-gray-300 hover:border-blue-300'
                        }`}
                    >
                        <h3 className="font-bold">📋 Complete Itinerary</h3>
                        <p className="text-sm">Lịch trình hoàn chỉnh 8 phần</p>
                    </button>

                    <button
                        onClick={() => setDemoType('ai')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                            demoType === 'ai' 
                                ? 'border-green-500 bg-green-50 text-green-700' 
                                : 'border-gray-300 hover:border-green-300'
                        }`}
                    >
                        <h3 className="font-bold">🤖 AI Recommendations</h3>
                        <p className="text-sm">Gợi ý cá nhân hóa bằng AI</p>
                    </button>

                    <button
                        onClick={() => setDemoType('training')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                            demoType === 'training' 
                                ? 'border-purple-500 bg-purple-50 text-purple-700' 
                                : 'border-gray-300 hover:border-purple-300'
                        }`}
                    >
                        <h3 className="font-bold">🎯 AI Training</h3>
                        <p className="text-sm">Training ML models</p>
                    </button>
                </div>

                <div className="text-center">
                    <button
                        onClick={() => {
                            if (demoType === 'complete') runCompleteItineraryDemo();
                            else if (demoType === 'ai') runAIRecommendationDemo();
                            else if (demoType === 'training') runTrainingDemo();
                        }}
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Running Demo...
                            </div>
                        ) : (
                            `🚀 Run ${demoType.charAt(0).toUpperCase() + demoType.slice(1)} Demo`
                        )}
                    </button>
                </div>
            </div>

            {result && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">
                            📊 Demo Results
                        </h2>
                        <button
                            onClick={() => setResult(null)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕ Close
                        </button>
                    </div>

                    {result.error ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <h3 className="text-red-800 font-bold mb-2">❌ Error</h3>
                            <p className="text-red-700">{result.error}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Complete Itinerary Results */}
                            {demoType === 'complete' && result.header && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <h3 className="font-bold text-blue-800 mb-3">📋 Trip Header</h3>
                                        <div className="space-y-2 text-sm">
                                            <p><strong>Trip:</strong> {result.header.tripName}</p>
                                            <p><strong>Duration:</strong> {result.header.duration.days} days, {result.header.duration.nights} nights</p>
                                            <p><strong>Travelers:</strong> {result.header.travelers.total}</p>
                                            <p><strong>Budget:</strong> {result.header.budget.total.toLocaleString()} VNĐ</p>
                                            <p><strong>Style:</strong> {result.header.travelStyle.name}</p>
                                        </div>
                                    </div>

                                    <div className="bg-green-50 rounded-lg p-4">
                                        <h3 className="font-bold text-green-800 mb-3">💰 Cost Summary</h3>
                                        <div className="space-y-2 text-sm">
                                            <p><strong>Total:</strong> {result.costBreakdown.grandTotal.toLocaleString()} VNĐ</p>
                                            <p><strong>Per Person:</strong> {result.costBreakdown.perPerson.toLocaleString()} VNĐ</p>
                                            <p><strong>Transport:</strong> {result.costBreakdown.transport.total.toLocaleString()} VNĐ</p>
                                            <p><strong>Accommodation:</strong> {result.costBreakdown.accommodation.total.toLocaleString()} VNĐ</p>
                                            <p><strong>Food:</strong> {result.costBreakdown.food.total.toLocaleString()} VNĐ</p>
                                            <p><strong>Budget Status:</strong> 
                                                <span className={result.costBreakdown.budgetStatus.withinBudget ? 'text-green-600' : 'text-red-600'}>
                                                    {result.costBreakdown.budgetStatus.withinBudget ? ' ✅ Within Budget' : ' ⚠️ Over Budget'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-purple-50 rounded-lg p-4 lg:col-span-2">
                                        <h3 className="font-bold text-purple-800 mb-3">📅 Daily Itinerary ({result.dailyItinerary.length} days)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {result.dailyItinerary.slice(0, 4).map((day, index) => (
                                                <div key={index} className="bg-white rounded p-3 border">
                                                    <h4 className="font-semibold">Day {day.day}: {day.theme}</h4>
                                                    <p className="text-sm text-gray-600">{day.date}</p>
                                                    <p className="text-sm">Destinations: {day.destinations?.length || 0}</p>
                                                    <p className="text-sm">Cost: {day.estimatedCost?.toLocaleString() || 'N/A'} VNĐ</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Recommendations Results */}
                            {demoType === 'ai' && result.recommendations && (
                                <div className="bg-green-50 rounded-lg p-4">
                                    <h3 className="font-bold text-green-800 mb-3">🤖 AI Recommendations ({result.recommendations.length})</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {result.recommendations.slice(0, 4).map((rec, index) => (
                                            <div key={index} className="bg-white rounded p-3 border">
                                                <h4 className="font-semibold">{rec.destination.MainDestination}</h4>
                                                <p className="text-sm text-gray-600">{rec.destination.Province}</p>
                                                <p className="text-sm">AI Score: {(rec.score * 100).toFixed(1)}%</p>
                                                <p className="text-sm">Confidence: {(rec.confidence * 100).toFixed(1)}%</p>
                                                {rec.explanation && (
                                                    <p className="text-xs text-blue-600 mt-1">{rec.explanation}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Training Results */}
                            {demoType === 'training' && result.trainingResult && (
                                <div className="bg-purple-50 rounded-lg p-4">
                                    <h3 className="font-bold text-purple-800 mb-3">🎯 Training Results</h3>
                                    <div className="space-y-2 text-sm">
                                        <p><strong>Success:</strong> {result.trainingResult.success ? '✅ Yes' : '❌ No'}</p>
                                        <p><strong>Timestamp:</strong> {new Date(result.trainingResult.timestamp).toLocaleString()}</p>
                                        {result.trainingResult.models && (
                                            <p><strong>Models Trained:</strong> {result.trainingResult.models.join(', ')}</p>
                                        )}
                                        {result.trainingResult.error && (
                                            <p className="text-red-600"><strong>Error:</strong> {result.trainingResult.error}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Raw JSON Output */}
                            <details className="bg-gray-50 rounded-lg p-4">
                                <summary className="font-bold text-gray-800 cursor-pointer">
                                    🔍 Raw JSON Output (Click to expand)
                                </summary>
                                <pre className="mt-4 text-xs bg-gray-800 text-green-400 p-4 rounded overflow-auto max-h-96">
                                    {formatJSON(result)}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                <h3 className="font-bold text-yellow-800 mb-2">💡 Demo Information</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• <strong>Complete Itinerary:</strong> Tạo lịch trình 8 phần hoàn chỉnh theo cấu trúc chuẩn</li>
                    <li>• <strong>AI Recommendations:</strong> Sử dụng Hybrid AI (CF + CB + DL) để gợi ý cá nhân hóa</li>
                    <li>• <strong>AI Training:</strong> Tạo synthetic data và train các ML models</li>
                    <li>• Tất cả demo sử dụng dữ liệu mẫu và có thể mất vài giây để hoàn thành</li>
                </ul>
            </div>
        </div>
    );
};

export default ItineraryDemo;