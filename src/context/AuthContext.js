import React, { useContext, useState, useEffect } from 'react';
import { auth } from '../firebase'; // Import từ file firebase.js
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hàm đăng ký (ví dụ)
  // function signup(email, password) {
  //   return createUserWithEmailAndPassword(auth, email, password);
  // }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe; // Dọn dẹp khi component unmount
  }, []);

  const value = {
    currentUser,
    // signup
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}