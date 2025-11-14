// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ItineraryPlanner from './pages/PersonalItineraryPlanner';
import MyTrips from './pages/MyTrips';

// IMPORT ML trainer
import { retrainAllModels } from './ml/trainer';
import RiskMapGoogle from './pages/RiskMapGoogle';

function App() {
    // Chỉ retrain ML models khi app khởi động
    useEffect(() => {
        retrainAllModels().catch(err => console.error('Retraining failed:', err));
    }, []); // empty deps → chỉ chạy 1 lần

    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                    <Navbar />
                    <main className="container mx-auto px-4 py-8">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/risk-map" element={<RiskMapGoogle />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route
                                path="/planner"
                                element={
                                    <ProtectedRoute>
                                        <ItineraryPlanner />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/mytrips"
                                element={
                                    <ProtectedRoute>
                                        <MyTrips />
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                    </main>
                    <ToastContainer
                        position="top-right"
                        autoClose={3000}
                        pauseOnHover={false}
                        theme="light"
                    />
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;