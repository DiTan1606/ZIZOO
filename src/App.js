// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Feedback from './pages/Feedback';
import UserProfile from './pages/UserProfile';
import Login from './pages/Login';
import Register from './pages/Register';

import MyTrips from './pages/MyTrips';
import PersonalizedRecommendations from './components/PersonalizedRecommendations';
import CompleteItineraryPlanner from './components/CompleteItineraryPlanner';
import ItineraryDemo from './pages/ItineraryDemo';
import ChatbotTest from './pages/ChatbotTest';
import TravelChatbot from './components/TravelChatbot';

// IMPORT ML trainer và AI training service
import { retrainAllModels } from './ml/trainer';
import { startAutoTraining } from './services/aiTrainingService';
import RiskMapGoogle from './pages/RiskMapGoogle';

function App() {
    // Khởi động AI training system
    useEffect(() => {
        // Retrain models khi app khởi động
        retrainAllModels().catch(err => console.error('Initial retraining failed:', err));
        
        // Bắt đầu auto-training scheduler
        startAutoTraining();
        
        return () => {
            // Cleanup khi unmount (optional)
        };
    }, []); // empty deps → chỉ chạy 1 lần

    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                    <Navbar />
                    <main className="container mx-auto px-4 py-8">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/contact" element={<Contact />} />
                            <Route path="/feedback" element={<Feedback />} />
                            <Route path="/risk-map" element={<RiskMapGoogle />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />

                            <Route
                                path="/mytrips"
                                element={
                                    <ProtectedRoute>
                                        <MyTrips />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/ai-recommendations"
                                element={
                                    <ProtectedRoute>
                                        <PersonalizedRecommendations />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/complete-planner"
                                element={
                                    <ProtectedRoute>
                                        <CompleteItineraryPlanner />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <ProtectedRoute>
                                        <UserProfile />
                                    </ProtectedRoute>
                                }
                            />
                            <Route path="/demo" element={<ItineraryDemo />} />
                            <Route path="/chatbot-test" element={<ChatbotTest />} />
                        </Routes>
                    </main>
                    <ToastContainer
                        position="top-right"
                        autoClose={3000}
                        pauseOnHover={false}
                        theme="light"
                    />
                    
                    {/* AI Chatbot - Hiển thị ở mọi trang */}
                    <TravelChatbot />
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;