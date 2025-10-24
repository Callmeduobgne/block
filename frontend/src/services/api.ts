import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              const { access_token } = response.data;
              
              localStorage.setItem('access_token', access_token);
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Show error toast for non-401 errors
        if (error.response?.status !== 401) {
          const message = error.response?.data?.detail || error.message || 'Có lỗi xảy ra';
          toast.error(message);
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    return this.client.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async refreshToken(refreshToken: string) {
    return this.client.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
  }

  async logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Chaincode endpoints
  async uploadChaincode(data: any) {
    return this.client.post('/chaincode/upload', data);
  }

  async getChaincodes(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    uploaded_by?: string;
  }) {
    return this.client.get('/chaincode', { params });
  }

  async getChaincode(id: string) {
    return this.client.get(`/chaincode/${id}`);
  }

  async updateChaincode(id: string, data: any) {
    return this.client.put(`/chaincode/${id}`, data);
  }

  async approveChaincode(id: string) {
    return this.client.post(`/chaincode/${id}/approve`);
  }

  async rejectChaincode(id: string, reason: string) {
    return this.client.post(`/chaincode/${id}/reject`, { reason });
  }

  // Deployment endpoints
  async deployChaincode(data: any) {
    return this.client.post('/deploy/deploy', data);
  }

  async invokeChaincode(data: any) {
    return this.client.post('/deploy/invoke', data);
  }

  async queryChaincode(data: any) {
    return this.client.post('/deploy/query', data);
  }

  async getDeployments(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    deployed_by?: string;
  }) {
    return this.client.get('/deploy', { params });
  }

  async getDeployment(id: string) {
    return this.client.get(`/deploy/${id}`);
  }

  // User management endpoints
  async getUsers(params?: {
    skip?: number;
    limit?: number;
    role?: string;
    status?: string;
  }) {
    return this.client.get('/users', { params });
  }

  async createUser(data: any) {
    return this.client.post('/users', data);
  }

  async updateUser(id: string, data: any) {
    return this.client.put(`/users/${id}`, data);
  }

  async deleteUser(id: string) {
    return this.client.delete(`/users/${id}`);
  }

  // Audit logs
  async getAuditLogs(params?: {
    skip?: number;
    limit?: number;
    user_id?: string;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
  }) {
    return this.client.get('/audit/logs', { params });
  }

  // Generic methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
