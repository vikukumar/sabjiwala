import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { APIResponse, PaginatedResponse } from '../types';

declare const process: any;

export class ApiClient {
  public client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshed: ((token: string) => void) | null = null;

  constructor(baseURL: string = '/api/v1') {
    let finalBaseURL = baseURL;
    if (typeof window !== 'undefined') {
      const storedBaseUrl = localStorage.getItem('sw_api_base_url');
      if (storedBaseUrl) {
        finalBaseURL = storedBaseUrl;
      } else if (process.env.NEXT_PUBLIC_API_URL) {
        finalBaseURL = process.env.NEXT_PUBLIC_API_URL;
      } else {
        const isNextDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '3002' || window.location.port === '3003';
        const isCapacitor = window.location.hostname === 'localhost' && (window.location.port === '' || window.location.protocol.startsWith('capacitor'));

        if (isNextDev) {
          finalBaseURL = 'http://localhost:8000/api/v1';
        } else if (isCapacitor) {
          finalBaseURL = 'https://sbjiwala.qzz.io/api/v1';
        }
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

        if (config.data && typeof config.data === 'object' && '_rawPayload' in config.data) {
          (config as any)._rawPayload = (config.data as any)._rawPayload;
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

        // Check for E2EE decryption failure to retry with plain payload
        if (error.response?.status === 400 &&
          error.response?.data?.detail === "E2EE payload decryption failed" &&
          originalRequest &&
          (originalRequest as any)._rawPayload &&
          !(originalRequest as any)._retryE2EE) {

          (originalRequest as any)._retryE2EE = true;
          originalRequest.data = JSON.stringify((originalRequest as any)._rawPayload);
          originalRequest.headers['Content-Type'] = 'application/json';
          return this.client(originalRequest);
        }

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          if (!this.refreshToken && typeof window !== 'undefined') {
            this.loadTokensFromStorage();
          }

          if (this.refreshToken) {
            try {
              // Call token refresh endpoint
              const res = await axios.post<APIResponse>(`${this.client.defaults.baseURL}/auth/refresh`, {
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
                const pathname = window.location.pathname;
                // Never redirect if the user is on the root main page '/'
                if (pathname !== '/') {
                  if (pathname.startsWith('/vendor')) {
                    window.location.href = '/vendor/login';
                  } else if (pathname.startsWith('/delivery')) {
                    window.location.href = '/delivery/login';
                  } else if (pathname.startsWith('/admin')) {
                    window.location.href = '/admin/login';
                  } else if (pathname.startsWith('/app')) {
                    window.location.href = '/app/login';
                  } else {
                    // Public static pages should also not trigger redirect
                    const publicPaths = ['/about', '/privacy', '/terms', '/refund-policy', '/contact', '/faq'];
                    if (!publicPaths.includes(pathname)) {
                      window.location.href = '/login';
                    }
                  }
                }
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

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
    return url;
  }
  let origin = '';
  if (typeof window !== 'undefined') {
    const storedBaseUrl = localStorage.getItem('sw_api_base_url');
    if (storedBaseUrl && storedBaseUrl.startsWith('http')) {
      const match = storedBaseUrl.match(/^(https?:\/\/[^\/]+)/);
      if (match) origin = match[1];
    } else if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')) {
      const match = process.env.NEXT_PUBLIC_API_URL.match(/^(https?:\/\/[^\/]+)/);
      if (match) origin = match[1];
    } else {
      const isNextDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '3002' || window.location.port === '3003';
      const isCapacitor = window.location.hostname === 'localhost' && (window.location.port === '' || window.location.protocol.startsWith('capacitor'));
      if (isNextDev) {
        origin = 'http://localhost:8000';
      } else if (isCapacitor) {
        origin = 'https://sbjiwala.qzz.io';
      } else {
        origin = window.location.origin;
      }
    }
  }
  if (origin) {
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${origin}${cleanUrl}`;
  }
  return url;
}
