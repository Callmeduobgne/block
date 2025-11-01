import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

class ApiClient {
  private client: AxiosInstance;
  private blockchainClient: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
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
            // Refresh failed, clear tokens and prevent further retries
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            originalRequest._retry = true; // Prevent infinite retry
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
    return this.client.get('/deployments', { params });
  }

  async getDeployment(id: string) {
    return this.client.get(`/deployments/${id}`);
  }

  // Blockchain Explorer endpoints
  async getLedgerInfo() {
    return this.blockchainClient.get('/fabric-gateway/ledger/info');
  }

  async getLatestBlocks(count: number = 10, channel?: string) {
    return this.blockchainClient.get('/fabric-gateway/blocks/latest', {
      params: { count, channel }
    });
  }

  async getBlockByNumber(blockNumber: number, channel?: string) {
    return this.blockchainClient.get(`/fabric-gateway/blocks/${blockNumber}`, {
      params: { channel }
    });
  }

  async getBlockByHash(blockHash: string, channel?: string) {
    return this.blockchainClient.get(`/fabric-gateway/blocks/hash/${blockHash}`, {
      params: { channel }
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
    return this.client.get('/audit/logs', { params });
  }

  // Channel management
  async getChannels(params?: {
    skip?: number;
    limit?: number;
  }) {
    return this.client.get('/channels', { params });
  }

  async getChannelStats() {
    return this.client.get('/channels/stats');
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
    return this.client.get('/projects', { params });
  }

  async getProjectStats() {
    return this.client.get('/projects/stats');
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
