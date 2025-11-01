import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar,
  User,
  Activity,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const AuditLogs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const { hasPermission } = useAuth();

  const { data: auditLogsData, isLoading } = useQuery(
    ['audit-logs', actionFilter, userFilter, startDate, endDate],
    () => apiClient.getAuditLogs({
      action: actionFilter || undefined,
      user_id: userFilter || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      limit: 1000
    })
  );

  const auditLogs = auditLogsData?.data?.audit_logs || [];

  const filteredLogs = auditLogs.filter((log: any) =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionColor = (action: string) => {
    if (action.includes('UPLOAD') || action.includes('CREATE')) {
      return 'bg-blue-100 text-blue-800';
    } else if (action.includes('APPROVE') || action.includes('SUCCESS')) {
      return 'bg-green-100 text-green-800';
    } else if (action.includes('REJECT') || action.includes('FAILED')) {
      return 'bg-red-100 text-red-800';
    } else if (action.includes('DEPLOY') || action.includes('INVOKE')) {
      return 'bg-purple-100 text-purple-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('UPLOAD') || action.includes('CREATE')) {
      return '📤';
    } else if (action.includes('APPROVE')) {
      return '✅';
    } else if (action.includes('REJECT')) {
      return '❌';
    } else if (action.includes('DEPLOY')) {
      return '🚀';
    } else if (action.includes('INVOKE')) {
      return '⚡';
    } else if (action.includes('QUERY')) {
      return '🔍';
    } else {
      return '📝';
    }
  };

  if (!hasPermission('audit.view')) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Không có quyền truy cập</h3>
        <p className="mt-1 text-sm text-gray-500">
          Bạn không có quyền xem audit logs.
        </p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Theo dõi và kiểm tra tất cả hoạt động trong hệ thống
        </p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                placeholder="Tìm theo action, resource..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="label">Action</label>
            <select
              className="input"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="UPLOAD">Upload</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="DEPLOY">Deploy</option>
              <option value="INVOKE">Invoke</option>
              <option value="QUERY">Query</option>
            </select>
          </div>
          
          <div>
            <label className="label">User</label>
            <input
              type="text"
              className="input"
              placeholder="User ID"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">Từ ngày</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">Đến ngày</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Tổng Logs</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredLogs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Hôm nay</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredLogs.filter((log: any) => {
                  const today = new Date().toDateString();
                  return new Date(log.timestamp).toDateString() === today;
                }).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <User className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Unique Users</p>
              <p className="text-2xl font-semibold text-gray-900">
                {new Set(filteredLogs.map((log: any) => log.user_id)).size}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Tuần này</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredLogs.filter((log: any) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(log.timestamp) > weekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Audit Logs ({filteredLogs.length})
          </h3>
        </div>
        
        <div className="overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Không có logs nào</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || actionFilter || userFilter || startDate || endDate
                  ? 'Không tìm thấy logs phù hợp với bộ lọc.'
                  : 'Chưa có hoạt động nào được ghi lại.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getActionIcon(log.action)}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.action}
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                              {log.action}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.resource_type}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {log.resource_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {log.user_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn-outline text-sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Chi Tiết Audit Log
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Action</label>
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{getActionIcon(selectedLog.action)}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(selectedLog.action)}`}>
                        {selectedLog.action}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Resource Type</label>
                    <p className="text-sm text-gray-900">{selectedLog.resource_type}</p>
                  </div>
                  <div>
                    <label className="label">Resource ID</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.resource_id}</p>
                  </div>
                  <div>
                    <label className="label">User ID</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.user_id}</p>
                  </div>
                </div>
                
                <div>
                  <label className="label">Timestamp</label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                  </p>
                </div>
                
                {selectedLog.details && (
                  <div>
                    <label className="label">Details</label>
                    <div className="bg-gray-100 rounded-md p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedLog(null)}
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

export default AuditLogs;
