import { useCallback } from 'react';
import api from '../api';

type LoginResponse = {
  success: boolean;
  user?: {
    UserId: number;
    FullName: string;
    UserRole: string;
    OrgUserId: string;
    UserEmail: string;
    Status?: string;
  };
  message?: string;
};

export function useAuth() {
  const login = useCallback(async (identifier: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { identifier, password });
    if (data.success && data.user) {
      const status = String(data.user.Status || '').trim();
      if (status && status.toLowerCase() !== 'active') {
        return {
          ok: false,
          message: 'Your account is inactive. Please contact your faculty or administrator to request access.',
          user: data.user,
        };
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      return { ok: true, user: data.user };
    }
    return { ok: false, message: data.message || 'Login failed' };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
  }, []);

  const getCurrentUser = useCallback(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  return { login, logout, getCurrentUser };
}