import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest } from '../lib/api';
import { disconnectSocket } from '../lib/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    rollNo?: string;
  }) => Promise<User>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('srusti_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('srusti_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    const savedToken = localStorage.getItem('srusti_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
      localStorage.setItem('srusti_user', JSON.stringify(data.user));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiRequest<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('srusti_token', res.accessToken);
    localStorage.setItem('srusti_user', JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    rollNo?: string;
  }): Promise<User> => {
    const res = await apiRequest<{ accessToken: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    localStorage.setItem('srusti_token', res.accessToken);
    localStorage.setItem('srusti_user', JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('srusti_token');
    localStorage.removeItem('srusti_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
