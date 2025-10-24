import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Token } from '../types';
import apiClient from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
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

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          // Verify token and get user info
          const response = await apiClient.get('/auth/me');
          setUser(response.data);
        } catch (error) {
          // Token is invalid, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiClient.login(username, password);
      const { access_token, refresh_token }: Token = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      // Get user info
      const userResponse = await apiClient.get('/auth/me');
      setUser(userResponse.data);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
  };

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

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
