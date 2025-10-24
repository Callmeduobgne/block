import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Users,
  FileText,
  Activity
} from 'lucide-react';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalChaincodes: 0,
    pendingApprovals: 0,
    activeDeployments: 0,
    totalUsers: 0,
  });

  // Fetch chaincodes
  const { data: chaincodesData, isLoading: chaincodesLoading } = useQuery(
    'chaincodes',
    () => apiClient.getChaincodes({ limit: 1000 }),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Fetch deployments
  const { data: deploymentsData, isLoading: deploymentsLoading } = useQuery(
    'deployments',
    () => apiClient.getDeployments({ limit: 1000 }),
    {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  );

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery(
    'users',
    () => apiClient.getUsers({ limit: 1000 }),
    {
      refetchInterval: 60000, // Refetch every minute
    }
  );

  useEffect(() => {
    if (chaincodesData?.data) {
      const chaincodes = chaincodesData.data.chaincodes || [];
      const pendingApprovals = chaincodes.filter(
        (cc: any) => cc.status === 'uploaded' || cc.status === 'validated'
      ).length;

      setStats(prev => ({
        ...prev,
        totalChaincodes: chaincodes.length,
        pendingApprovals,
      }));
    }
  }, [chaincodesData]);

  useEffect(() => {
    if (deploymentsData?.data) {
      const deployments = deploymentsData.data || [];
      const activeDeployments = deployments.filter(
        (dep: any) => dep.deployment_status === 'pending' || dep.deployment_status === 'deploying'
      ).length;

      setStats(prev => ({
        ...prev,
        activeDeployments,
      }));
    }
  }, [deploymentsData]);

  useEffect(() => {
    if (usersData?.data) {
      const users = usersData.data.users || [];
      setStats(prev => ({
        ...prev,
        totalUsers: users.length,
      }));
    }
  }, [usersData]);

  const isLoading = chaincodesLoading || deploymentsLoading || usersLoading;

  const statCards = [
    {
      name: 'Tổng Chaincodes',
      value: stats.totalChaincodes,
      icon: FileText,
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'increase',
    },
    {
      name: 'Chờ Phê Duyệt',
      value: stats.pendingApprovals,
      icon: Clock,
      color: 'bg-yellow-500',
      change: '+3',
      changeType: 'increase',
    },
    {
      name: 'Đang Triển Khai',
      value: stats.activeDeployments,
      icon: Activity,
      color: 'bg-green-500',
      change: '-2',
      changeType: 'decrease',
    },
    {
      name: 'Tổng Người Dùng',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-purple-500',
      change: '+5%',
      changeType: 'increase',
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'upload',
      message: 'Chaincode "asset-transfer" v2.0 đã được upload',
      timestamp: '2 phút trước',
      icon: Upload,
      color: 'text-blue-500',
    },
    {
      id: 2,
      type: 'approval',
      message: 'Chaincode "basic" v1.0 đã được phê duyệt',
      timestamp: '15 phút trước',
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      id: 3,
      type: 'deployment',
      message: 'Triển khai chaincode "auction" đã hoàn thành',
      timestamp: '1 giờ trước',
      icon: Activity,
      color: 'text-purple-500',
    },
    {
      id: 4,
      type: 'error',
      message: 'Lỗi triển khai chaincode "token" trên peer1',
      timestamp: '2 giờ trước',
      icon: AlertCircle,
      color: 'text-red-500',
    },
  ];

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tổng quan hệ thống quản lý chaincode lifecycle
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.name} className="card p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`${card.color} rounded-md p-3`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {card.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {card.value}
                    </div>
                    <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                      card.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {card.change}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Hoạt Động Gần Đây
          </h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start">
                <div className="flex-shrink-0">
                  <activity.icon className={`h-5 w-5 ${activity.color}`} />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Trạng Thái Hệ Thống
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Backend API</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Fabric Network</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Redis Cache</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
