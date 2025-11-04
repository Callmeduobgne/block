import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';

interface RetryConfig extends AxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

class ApiClient {
  private client: AxiosInstance;
  private blockchainClient: AxiosInstance;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Enable cookies for HttpOnly tokens
    });

    // Separate client for blockchain explorer (via API Gateway)
    this.blockchainClient = axios.create({
      baseURL: process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:8080',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldRetry(error: AxiosError): boolean {
    const config = error.config as RetryConfig;
    const retryCount = config?._retryCount || 0;
    const status = error.response?.status;
    
    return (
      retryCount < this.MAX_RETRIES &&
      (!status || this.RETRY_STATUS_CODES.includes(status)) &&
      error.code !== 'ECONNABORTED' // Don't retry timeouts
    );
  }

  private setupInterceptors() {
    // Request interceptor to add auth token for main client
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

    // Request interceptor for blockchain client (no auth needed for demo)
    this.blockchainClient.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling with retry logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetryConfig;

        if (!originalRequest) {
          return Promise.reject(error);
        }

        // Handle 401 Unauthorized - Token refresh
        // Skip refresh for refresh endpoint itself to prevent infinite loop
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              const { access_token } = response.data;
              
              localStorage.setItem('access_token', access_token);
              originalRequest.headers!.Authorization = `Bearer ${access_token}`;
              
              return this.client(originalRequest);
            } else {
              // No refresh token, redirect to login
              this.handleAuthError();
              return Promise.reject(error);
            }
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            this.handleAuthError();
            return Promise.reject(refreshError);
          }
        }

        // Retry logic for network errors and specific status codes
        if (this.shouldRetry(error)) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          const delayTime = this.RETRY_DELAY * originalRequest._retryCount;
          console.log(`Retrying request (${originalRequest._retryCount}/${this.MAX_RETRIES}) after ${delayTime}ms...`);
          
          await this.delay(delayTime);
          return this.client(originalRequest);
        }

        // Show error toast for final errors
        this.handleError(error);

        return Promise.reject(error);
      }
    );

    // Setup blockchain client interceptor
    this.blockchainClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetryConfig;
        
        // Retry logic for blockchain client
        if (originalRequest && this.shouldRetry(error)) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          const delayTime = this.RETRY_DELAY * originalRequest._retryCount;
          await this.delay(delayTime);
          return this.blockchainClient(originalRequest);
        }

        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleAuthError() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    
    // Redirect to login page
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  private handleError(error: AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as any;
    
    let message = 'Có lỗi xảy ra';
    
    if (status === 400) {
      message = data?.detail || 'Yêu cầu không hợp lệ';
    } else if (status === 403) {
      message = 'Bạn không có quyền thực hiện hành động này';
    } else if (status === 404) {
      message = 'Không tìm thấy tài nguyên';
    } else if (status === 429) {
      message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau';
    } else if (status && status >= 500) {
      message = 'Lỗi máy chủ. Vui lòng thử lại sau';
    } else if (error.code === 'ECONNABORTED') {
      message = 'Yêu cầu hết thời gian chờ';
    } else if (error.code === 'ERR_NETWORK') {
      message = 'Lỗi kết nối mạng';
    } else if (data?.detail) {
      message = data.detail;
    }

    // Don't show toast for 401 errors (handled by redirect)
    if (status !== 401) {
      toast.error(message);
    }
  }

  // Auth endpoints
  async login(username: string, password: string) {
    // Backend OAuth2 expects form data (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    return this.client.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async refreshToken(refreshToken: string) {
    return this.client.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
  }

  async getCurrentUser() {
    return this.client.get('/auth/me');
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
    return this.client.get('/chaincode/', { params });
  }

  async getChaincode(id: string) {
    return this.client.get(`/chaincode/${id}`);
  }

  async getChaincodeById(id: string) {
    return this.getChaincode(id);
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
    return this.client.post('/deployments/deploy', data);
  }

  async invokeChaincode(data: any) {
    return this.client.post('/deployments/invoke', data);
  }

  async queryChaincode(data: any) {
    return this.client.post('/deployments/query', data);
  }

  async getDeployments(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    deployed_by?: string;
  }) {
    return this.client.get('/deployments/', { params });
  }

  async getDeployment(id: string) {
    return this.client.get(`/deployments/${id}`);
  }

  // Blockchain Explorer endpoints
  // Blockchain Explorer APIs
  async getLedgerInfo(channel: string = 'ibnchannel') {
    return this.client.get(`/blockchain/channel-info`, {
      params: { channel_name: channel }
    });
  }

  async getLatestBlocks(count: number = 10, channel: string = 'ibnchannel') {
    // Backend uses pagination, convert count to page/limit
    return this.client.get('/blockchain/blocks', {
      params: { 
        channel_name: channel,
        page: 1,
        limit: count
      }
    });
  }

  async getBlockByNumber(blockNumber: number, channel: string = 'ibnchannel') {
    return this.client.get(`/blockchain/block/${blockNumber}`, {
      params: { channel_name: channel }
    });
  }

  async getBlockByHash(blockHash: string, channel: string = 'ibnchannel') {
    // Hash search not implemented yet - use number search
    return this.client.get(`/blockchain/blocks`, {
      params: { channel_name: channel, page: 1, limit: 100 }
    });
  }

  async getTransactionById(txId: string, channel: string = 'ibnchannel') {
    return this.client.get(`/blockchain/transaction/${txId}`, {
      params: { channel_name: channel }
    });
  }

  async getBlockchainStatistics(channel: string = 'ibnchannel') {
    return this.client.get('/blockchain/statistics', {
      params: { channel_name: channel }
    });
  }

  // Get transaction details
  async getTransactionDetails(txId: string) {
    return this.blockchainClient.get(`/fabric-gateway/transactions/${txId}`);
  }

  // Get raw block JSON
  async getRawBlockJson(blockNumber: number) {
    return this.blockchainClient.get(`/fabric-gateway/blocks/${blockNumber}/raw`, {
      responseType: 'text'
    });
  }

  // User management endpoints
  async getUsers(params?: {
    skip?: number;
    limit?: number;
    role?: string;
    status?: string;
  }) {
    return this.client.get('/users/', { params });
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

  // Certificate management
  async getUserCertificate(userId: string) {
    return this.client.get(`/certificates/user/${userId}`);
  }

  // Retry enrollment for a user (Admin only)
  async retryUserEnrollment(userId: string) {
    return this.client.post(`/users/${userId}/retry-enrollment`);
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
    return this.client.get('/audit/logs/', { params });
  }

  // Channel management
  async getChannels(params?: {
    skip?: number;
    limit?: number;
  }) {
    return this.client.get('/channels/', { params });
  }

  async getChannelStats() {
    return this.client.get('/channels/stats/');
  }

  async getChannelById(id: string) {
    return this.client.get(`/channels/${id}`);
  }

  async createChannel(data: any) {
    return this.client.post('/channels', data);
  }

  async updateChannel(id: string, data: any) {
    return this.client.put(`/channels/${id}`, data);
  }

  async deleteChannel(id: string) {
    return this.client.delete(`/channels/${id}`);
  }

  // Project management
  async getProjects(params?: {
    skip?: number;
    limit?: number;
  }) {
    return this.client.get('/projects/', { params });
  }

  async getProjectStats() {
    return this.client.get('/projects/stats/');
  }

  async getProjectById(id: string) {
    return this.client.get(`/projects/${id}`);
  }

  async createProject(data: any) {
    return this.client.post('/projects', data);
  }

  async updateProject(id: string, data: any) {
    return this.client.put(`/projects/${id}`, data);
  }

  async deleteProject(id: string) {
    return this.client.delete(`/projects/${id}`);
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

/**
 * Helper function to extract error message from API response
 * Handles both simple string errors and complex object errors {message, errors, warnings}
 */
export const getErrorMessage = (error: any, defaultMessage: string = 'Có lỗi xảy ra'): string => {
  const detail = error.response?.data?.detail;
  
  // Handle error response with {message, errors, warnings} structure
  if (detail && typeof detail === 'object' && detail.errors) {
    const errorMessages = Array.isArray(detail.errors) ? detail.errors.join(', ') : detail.errors;
    return `${detail.message || defaultMessage}: ${errorMessages}`;
  }
  
  // Handle simple string error
  if (typeof detail === 'string') {
    return detail;
  }
  
  // Default fallback
  return defaultMessage;
};
