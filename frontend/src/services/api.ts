import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = '/api/v1';  // Same origin - served by Flask backend in production

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('congestion_auth');
  if (raw) {
    try {
      const { accessToken } = JSON.parse(raw);
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch {}
  }
  return config;
});

// Response interceptor: handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const msg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Network error';

    if (error.response?.status === 401) {
      // Auto-logout on unauthorized
      localStorage.removeItem('congestion_auth');
      if (window.location.pathname !== '/login') {
        toast.error('Session expired. Please login again.');
        setTimeout(() => (window.location.href = '/login'), 1500);
      }
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.status !== 401) {
      toast.error(msg);
    }
    return Promise.reject(error);
  }
);

export default api;

// API helpers
export const apiGet = <T = any>(url: string, config?: AxiosRequestConfig) =>
  api.get<T>(url, config).then((r) => r.data);

export const apiPost = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
  api.post<T>(url, data, config).then((r) => r.data);

export const apiPatch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
  api.patch<T>(url, data, config).then((r) => r.data);

export const apiDelete = <T = any>(url: string, config?: AxiosRequestConfig) =>
  api.delete<T>(url, config).then((r) => r.data);
