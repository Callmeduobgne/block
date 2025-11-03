import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Token } from '../types';
import apiClient from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data as User);
      setError(null);
    } catch (err: any) {
      console.error('Failed to refresh user:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          await refreshUser();
        } catch (error) {
          // Token is invalid, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.login(username, password);
      
      // API Gateway response format: { success, data: { user, tokens } }
      if (response.data.success && response.data.data) {
        const { tokens, user } = response.data.data;
        
        localStorage.setItem('access_token', tokens.accessToken);
        localStorage.setItem('refresh_token', tokens.refreshToken);
        
        // Set user directly from response
        setUser(user);
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.response?.data?.detail || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await apiClient.post('/auth/register', { username, email, password });
      
      // Auto login after register
      await login(username, password);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setError(null);
    }
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    const rolePermissions = {
      ADMIN: [
        'chaincode.upload',
        'chaincode.deploy',
        'chaincode.approve',
        'chaincode.reject',
        'chaincode.invoke',
        'chaincode.query',
        'user.manage',
        'user.view',
        'system.configure',
        'audit.view'
      ],
      ORG_ADMIN: [
        'chaincode.upload',
        'chaincode.deploy',
        'chaincode.invoke',
        'chaincode.query',
        'user.view'
      ],
      USER: [
        'chaincode.invoke',
        'chaincode.query',
        'asset.manage'
      ],
      VIEWER: [
        'chaincode.query',
        'asset.view'
      ]
    };

    return rolePermissions[user.role as keyof typeof rolePermissions]?.includes(permission) || false;
  };

  const hasRole = useCallback((role: string): boolean => {
    return user?.role === role;
  }, [user]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    register,
    refreshUser,
    hasPermission,
    hasRole,
    hasAnyRole,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
