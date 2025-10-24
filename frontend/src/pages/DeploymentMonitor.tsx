import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { 
  Monitor, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const DeploymentMonitor: React.FC = () => {
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: deploymentsData, isLoading, refetch } = useQuery(
    'deployments',
    () => apiClient.getDeployments({ limit: 1000 }),
    {
      refetchInterval: autoRefresh ? 5000 : false, // Refetch every 5 seconds if auto-refresh is on
    }
  );

  const deployments = deploymentsData?.data || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'deploying':
        return <Activity className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'rolled_back':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'status-success';
      case 'failed':
        return 'status-failed';
      case 'deploying':
        return 'status-deploying';
      case 'pending':
        return 'status-pending';
      case 'rolled_back':
        return 'status-rolled_back';
      default:
        return 'status-pending';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Thành công';
      case 'failed':
        return 'Thất bại';
      case 'deploying':
        return 'Đang triển khai';
      case 'pending':
        return 'Chờ xử lý';
      case 'rolled_back':
        return 'Đã rollback';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitor Triển Khai</h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo dõi tiến trình triển khai chaincode
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Auto refresh</span>
          </label>
          
          <button
            onClick={() => refetch()}
            className="btn-outline flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Chờ xử lý</p>
              <p className="text-2xl font-semibold text-gray-900">
                {deployments.filter((d: any) => d.deployment_status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Đang triển khai</p>
              <p className="text-2xl font-semibold text-gray-900">
                {deployments.filter((d: any) => d.deployment_status === 'deploying').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Thành công</p>
              <p className="text-2xl font-semibold text-gray-900">
                {deployments.filter((d: any) => d.deployment_status === 'success').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Thất bại</p>
              <p className="text-2xl font-semibold text-gray-900">
                {deployments.filter((d: any) => d.deployment_status === 'failed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deployments List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Danh Sách Triển Khai ({deployments.length})
          </h3>
        </div>
        
        <div className="overflow-hidden">
          {deployments.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Không có deployment nào</h3>
              <p className="mt-1 text-sm text-gray-500">
                Chưa có chaincode nào được triển khai.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {deployments.map((deployment: any) => (
                <div key={deployment.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        {getStatusIcon(deployment.deployment_status)}
                        <h4 className="ml-2 text-sm font-medium text-gray-900">
                          {deployment.chaincode?.name || 'Unknown Chaincode'}
                        </h4>
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          v{deployment.chaincode?.version || '1.0'}
                        </span>
                        <span className={`ml-2 ${getStatusColor(deployment.deployment_status)}`}>
                          {getStatusText(deployment.deployment_status)}
                        </span>
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-500">
                        <span>Channel: {deployment.channel_name}</span>
                        <span className="mx-2">•</span>
                        <span>Peers: {deployment.target_peers?.length || 0}</span>
                        <span className="mx-2">•</span>
                        <span>
                          {deployment.deployment_date 
                            ? format(new Date(deployment.deployment_date), 'dd/MM/yyyy HH:mm', { locale: vi })
                            : 'Chưa bắt đầu'
                          }
                        </span>
                      </div>
                      
                      {deployment.error_message && (
                        <div className="mt-2 text-sm text-red-600">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          {deployment.error_message}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedDeployment(deployment)}
                        className="btn-outline text-sm"
                      >
                        <Monitor className="h-4 w-4 mr-1" />
                        Chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deployment Detail Modal */}
      {selectedDeployment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Chi Tiết Triển Khai
                </h3>
                <button
                  onClick={() => setSelectedDeployment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Chaincode</label>
                    <p className="text-sm text-gray-900">
                      {selectedDeployment.chaincode?.name || 'Unknown'} v{selectedDeployment.chaincode?.version || '1.0'}
                    </p>
                  </div>
                  <div>
                    <label className="label">Trạng thái</label>
                    <div className="flex items-center">
                      {getStatusIcon(selectedDeployment.deployment_status)}
                      <span className={`ml-2 ${getStatusColor(selectedDeployment.deployment_status)}`}>
                        {getStatusText(selectedDeployment.deployment_status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Channel</label>
                    <p className="text-sm text-gray-900">{selectedDeployment.channel_name}</p>
                  </div>
                  <div>
                    <label className="label">Target Peers</label>
                    <p className="text-sm text-gray-900">{selectedDeployment.target_peers?.length || 0}</p>
                  </div>
                </div>
                
                {selectedDeployment.target_peers && selectedDeployment.target_peers.length > 0 && (
                  <div>
                    <label className="label">Danh sách Peers</label>
                    <div className="bg-gray-100 rounded-md p-3">
                      <ul className="text-sm text-gray-800">
                        {selectedDeployment.target_peers.map((peer: string, index: number) => (
                          <li key={index} className="flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            {peer}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {selectedDeployment.deployment_logs && (
                  <div>
                    <label className="label">Deployment Logs</label>
                    <div className="bg-gray-900 text-green-400 rounded-md p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap">
                        {selectedDeployment.deployment_logs}
                      </pre>
                    </div>
                  </div>
                )}
                
                {selectedDeployment.error_message && (
                  <div>
                    <label className="label">Error Message</label>
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <p className="text-sm text-red-800">{selectedDeployment.error_message}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedDeployment(null)}
                    className="btn-outline"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentMonitor;
