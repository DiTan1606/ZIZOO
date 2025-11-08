// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Thêm error state

  const register = async (email, password) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Đăng ký thành công:', userCredential.user.email);
      return userCredential;
    } catch (err) {
      setError(err.message);
      console.error('Lỗi đăng ký:', err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Đăng nhập thành công:', userCredential.user.email);
      return userCredential;
    } catch (err) {
      setError(err.message);
      console.error('Lỗi đăng nhập:', err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      console.log('Đăng xuất thành công');
    } catch (err) {
      console.error('Lỗi đăng xuất:', err);
      throw err;
    }
  };

  useEffect(() => {
    console.log('Bắt đầu lắng nghe Auth state...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user) {
        console.log('User đang đăng nhập:', user.email);
      } else {
        console.log('Không có user nào đăng nhập');
      }
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    error,
    register,
    login,
    logout
  };

  return (
      <AuthContext.Provider value={value}>
        {!loading && children}
      </AuthContext.Provider>
  );
};