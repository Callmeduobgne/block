import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, Badge, Alert } from './ui';
import { useWebSocket } from '../hooks/useWebSocket';
import apiClient from '../services/api';
import { cn } from '../lib/utils';

interface Deployment {
  id: string;
  chaincode_id: string;
  chaincode_name: string;
  chaincode_version: string;
  channel_name: string;
  status: 'pending' | 'packaging' | 'installing' | 'approving' | 'committing' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  steps: DeploymentStep[];
  deployed_by: string;
  deployed_at: string;
  completed_at?: string;
  error_message?: string;
}

interface DeploymentStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  started_at?: string;
  completed_at?: string;
}

interface DeploymentMonitorProps {
  deploymentId?: string;
  autoRefresh?: boolean;
}

const DeploymentMonitor: React.FC<DeploymentMonitorProps> = ({ 
  deploymentId,
  autoRefresh = true 
}) => {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, on, off, joinRoom, leaveRoom } = useWebSocket({ autoConnect: true });

  const fetchDeployment = useCallback(async () => {
    if (!deploymentId) return;

    try {
      setLoading(true);
      const response = await apiClient.getDeployment(deploymentId);
      setDeployment(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch deployment:', err);
      setError('Không thể tải thông tin deployment');
    } finally {
      setLoading(false);
    }
  }, [deploymentId]);

  useEffect(() => {
    if (deploymentId) {
      fetchDeployment();
    }
  }, [deploymentId, fetchDeployment]);

  // Join deployment room for real-time updates
  useEffect(() => {
    if (!isConnected || !deploymentId) return;

    const room = `deployment_${deploymentId}`;
    joinRoom(room);

    const handleDeploymentUpdate = (data: any) => {
      console.log('Deployment update:', data);
      
      if (data.deployment_id === deploymentId) {
        setDeployment(prev => {
          if (!prev) return data.deployment;
          
          return {
            ...prev,
            status: data.status || prev.status,
            progress: data.progress ?? prev.progress,
            current_step: data.current_step || prev.current_step,
            steps: data.steps || prev.steps,
            completed_at: data.completed_at || prev.completed_at,
            error_message: data.error_message || prev.error_message,
          };
        });
      }
    };

    on('deployment_update', handleDeploymentUpdate);

    return () => {
      off('deployment_update', handleDeploymentUpdate);
      leaveRoom(room);
    };
  }, [isConnected, deploymentId, on, off, joinRoom, leaveRoom]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-400" />;
      default:
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'secondary', label: 'Pending' },
      packaging: { variant: 'info', label: 'Packaging' },
      installing: { variant: 'info', label: 'Installing' },
      approving: { variant: 'info', label: 'Approving' },
      committing: { variant: 'info', label: 'Committing' },
      completed: { variant: 'success', label: 'Completed' },
      failed: { variant: 'error', label: 'Failed' },
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} size="sm">
        {config.label}
      </Badge>
    );
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-3 text-gray-500">Loading deployment...</span>
        </div>
      </Card>
    );
  }

  if (error || !deployment) {
    return (
      <Alert variant="error" title="Error">
        {error || 'Deployment not found'}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {deployment.chaincode_name} v{deployment.chaincode_version}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Channel: {deployment.channel_name}
              </p>
            </div>
          </div>
          {getStatusBadge(deployment.status)}
        </div>

        {/* Connection Status */}
        {isConnected ? (
          <div className="flex items-center gap-2 text-sm text-green-600 mb-4">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            Real-time monitoring active
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <span className="h-2 w-2 bg-gray-400 rounded-full" />
            Connecting...
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {deployment.current_step}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {deployment.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 ease-out rounded-full',
                deployment.status === 'completed' && 'bg-green-600',
                deployment.status === 'failed' && 'bg-red-600',
                !['completed', 'failed'].includes(deployment.status) && 'bg-blue-600'
              )}
              style={{ width: `${deployment.progress}%` }}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Deployed By
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {deployment.deployed_by}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Started At
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {new Date(deployment.deployed_at).toLocaleString('vi-VN')}
            </p>
          </div>
          {deployment.completed_at && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Completed At
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {new Date(deployment.completed_at).toLocaleString('vi-VN')}
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {deployment.error_message && (
          <Alert variant="error" title="Deployment Failed" className="mt-6">
            {deployment.error_message}
          </Alert>
        )}
      </Card>

      {/* Steps Card */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Deployment Steps
        </h4>
        
        <div className="space-y-4">
          {deployment.steps.map((step, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border transition-all',
                step.status === 'completed' && 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                step.status === 'failed' && 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
                step.status === 'in_progress' && 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
                step.status === 'pending' && 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
              )}
            >
              <div className="flex-shrink-0 mt-1">
                {getStepIcon(step.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {step.name}
                  </h5>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {step.completed_at 
                      ? new Date(step.completed_at).toLocaleTimeString('vi-VN')
                      : step.started_at 
                      ? new Date(step.started_at).toLocaleTimeString('vi-VN')
                      : 'Waiting...'}
                  </span>
                </div>
                
                {step.message && (
                  <p className={cn(
                    'mt-1 text-sm',
                    step.status === 'failed' ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'
                  )}>
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Success Message */}
      {deployment.status === 'completed' && (
        <Alert variant="success" title="Deployment Successful">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p>
                Chaincode <strong>{deployment.chaincode_name} v{deployment.chaincode_version}</strong> has been successfully deployed to channel <strong>{deployment.channel_name}</strong>.
              </p>
              <p className="mt-2 text-sm">
                You can now invoke and query this chaincode on the network.
              </p>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
};

export default DeploymentMonitor;

