import { apiPost, apiGet } from './api';
import type { User } from '../store/slices/authSlice';

interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in?: number;
  };
}

export const authService = {
  login: (username: string, password: string) =>
    apiPost<AuthResponse>('/auth/login', { username, password }),

  register: (payload: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }) => apiPost<AuthResponse>('/auth/register', payload),

  me: () => apiGet<{ success: boolean; data: User }>('/auth/me'),

  logout: () => apiPost('/auth/logout'),

  refresh: (refreshToken: string) =>
    apiPost<AuthResponse>('/auth/refresh', { refresh_token: refreshToken }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiPost('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  forgotPassword: (email: string) =>
    apiPost('/auth/forgot-password', { email }),
};
