import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { APIResponse, PaginatedResponse } from '../types';

export class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshed: ((token: string) => void) | null = null;

  constructor(baseURL: string = '/api/v1') {
    let finalBaseURL = baseURL;
    if (typeof window !== 'undefined') {
      const isNextDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '3002';
      if (isNextDev) {
        finalBaseURL = 'http://localhost:8000/api/v1';
      }
    }
    this.client = axios.create({
      baseURL: finalBaseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sw_access_token', access);
      localStorage.setItem('sw_refresh_token', refresh);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sw_access_token');
      localStorage.removeItem('sw_refresh_token');
    }
  }

  loadTokensFromStorage() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('sw_access_token');
      this.refreshToken = localStorage.getItem('sw_refresh_token');
    }
  }

  private setupInterceptors() {
    // Request interceptor to attach access token
    this.client.interceptors.request.use(
      (config) => {
        // Load tokens if null (e.g. initial reload)
        if (!this.accessToken && typeof window !== 'undefined') {
          this.loadTokensFromStorage();
        }
        
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          if (!this.refreshToken && typeof window !== 'undefined') {
            this.loadTokensFromStorage();
          }

          if (this.refreshToken) {
            try {
              // Call token refresh endpoint
              const res = await axios.post<APIResponse>('/api/v1/auth/refresh', {
                refresh_token: this.refreshToken,
              });
              
              if (res.data.success && res.data.meta) {
                const newAccess = res.data.meta.access_token;
                const newRefresh = res.data.meta.refresh_token;
                this.setTokens(newAccess, newRefresh);
                
                // Retry original request
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return this.client(originalRequest);
              }
            } catch (refreshError) {
              this.clearTokens();
              // Trigger redirect to login in frontend if handler registered
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Generic Request methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    const res = await this.client.get<APIResponse<T>>(url, config);
    return res.data;
  }

  async getPaginated<T = any>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
    const res = await this.client.get<PaginatedResponse<T>>(url, config);
    return res.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    const res = await this.client.post<APIResponse<T>>(url, data, config);
    return res.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    const res = await this.client.patch<APIResponse<T>>(url, data, config);
    return res.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    const res = await this.client.put<APIResponse<T>>(url, data, config);
    return res.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    const res = await this.client.delete<APIResponse<T>>(url, config);
    return res.data;
  }
}

export const api = new ApiClient();
export default api;
