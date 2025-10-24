// Types for API responses
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'ORG_ADMIN' | 'USER' | 'VIEWER';
  msp_id?: string;
  organization?: string;
  status: 'active' | 'inactive' | 'suspended';
  is_active: boolean;
  is_verified: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface Chaincode {
  id: string;
  name: string;
  version: string;
  source_code: string;
  description?: string;
  language: string;
  status: 'uploaded' | 'validated' | 'approved' | 'rejected' | 'deployed' | 'active' | 'deprecated';
  uploaded_by: string;
  approved_by?: string;
  approval_date?: string;
  rejection_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChaincodeUpload {
  name: string;
  version: string;
  source_code: string;
  description?: string;
  language: string;
}

export interface ChaincodeDeploy {
  chaincode_id: string;
  channel_name: string;
  target_peers: string[];
}

export interface ChaincodeInvoke {
  chaincode_id: string;
  channel_name: string;
  function_name: string;
  args: string[];
}

export interface ChaincodeQuery {
  chaincode_id: string;
  channel_name: string;
  function_name: string;
  args: string[];
}

export interface Deployment {
  id: string;
  chaincode_id: string;
  channel_name: string;
  target_peers: string[];
  deployment_status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  deployed_by: string;
  deployment_date?: string;
  completion_date?: string;
  error_message?: string;
  deployment_logs?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}

// Role permissions mapping
export const ROLE_PERMISSIONS = {
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
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;
export type Permission = typeof ROLE_PERMISSIONS[Role][number];
