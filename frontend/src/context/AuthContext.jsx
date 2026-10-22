import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('valuo_user') || localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('valuo_token') || localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      const currentToken = localStorage.getItem('valuo_token') || localStorage.getItem('token');
      if (currentToken) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('valuo_user', JSON.stringify(res.data));
          localStorage.setItem('user', JSON.stringify(res.data));
        } catch {
          // Token invalid or expired
          logout();
        }
      }
      setLoading(false);
    }
    verifyAuth();
  }, []);

  const login = async (email, password, rememberMe = false) => {
    const res = await api.post('/auth/login', {
      email,
      password,
      remember_me: rememberMe
    });
    const { user: userData, token: jwtToken } = res.data;
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('valuo_token', jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('valuo_user', JSON.stringify(userData));
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const signup = async (name, email, password) => {
    const res = await api.post('/auth/signup', {
      name,
      email,
      password
    });
    const { user: userData, token: jwtToken } = res.data;
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('valuo_token', jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('valuo_user', JSON.stringify(userData));
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('valuo_token');
      localStorage.removeItem('token');
      localStorage.removeItem('valuo_user');
      localStorage.removeItem('user');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!user,
      login,
      signup,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
