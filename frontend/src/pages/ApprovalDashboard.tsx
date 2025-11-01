import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  User, 
  Calendar,
  Eye,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const ApprovalDashboard: React.FC = () => {
  const [selectedChaincode, setSelectedChaincode] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const queryClient = useQueryClient();

  const { data: chaincodesData, isLoading } = useQuery(
    'chaincodes-pending',
    () => apiClient.getChaincodes({ 
      status: 'uploaded',
      limit: 1000 
    }),
    {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  );

  const approveMutation = useMutation(
    (chaincodeId: string) => apiClient.approveChaincode(chaincodeId),
    {
      onSuccess: () => {
        toast.success('Chaincode đã được phê duyệt!');
        queryClient.invalidateQueries('chaincodes');
        queryClient.invalidateQueries('chaincodes-pending');
        setSelectedChaincode(null);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Phê duyệt thất bại');
      },
    }
  );

  const rejectMutation = useMutation(
    ({ chaincodeId, reason }: { chaincodeId: string; reason: string }) => 
      apiClient.rejectChaincode(chaincodeId, reason),
    {
      onSuccess: () => {
        toast.success('Chaincode đã bị từ chối!');
        queryClient.invalidateQueries('chaincodes');
        queryClient.invalidateQueries('chaincodes-pending');
        setSelectedChaincode(null);
        setRejectionReason('');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Từ chối thất bại');
      },
    }
  );

  const handleApprove = (chaincodeId: string) => {
    approveMutation.mutate(chaincodeId);
  };

  const handleReject = (chaincodeId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    rejectMutation.mutate({ chaincodeId, reason: rejectionReason });
  };

  const chaincodes = chaincodesData?.data?.chaincodes || [];

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Phê Duyệt</h1>
        <p className="mt-1 text-sm text-gray-500">
          Quản lý và phê duyệt các chaincode đang chờ
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Chờ Phê Duyệt</p>
              <p className="text-2xl font-semibold text-gray-900">{chaincodes.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Đã Phê Duyệt</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Đã Từ Chối</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chaincodes List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Chaincodes Chờ Phê Duyệt ({chaincodes.length})
          </h3>
        </div>
        
        <div className="overflow-hidden">
          {chaincodes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Không có chaincode nào</h3>
              <p className="mt-1 text-sm text-gray-500">
                Hiện tại không có chaincode nào đang chờ phê duyệt.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {chaincodes.map((chaincode: any) => (
                <div key={chaincode.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">
                          {chaincode.name}
                        </h4>
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          v{chaincode.version}
                        </span>
                        <span className="ml-2 status-uploaded">
                          {chaincode.status}
                        </span>
                      </div>
                      
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <User className="h-4 w-4 mr-1" />
                        <span>{chaincode.uploader?.username || 'Unknown'}</span>
                        <Calendar className="h-4 w-4 ml-4 mr-1" />
                        <span>
                          {format(new Date(chaincode.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </span>
                      </div>
                      
                      {chaincode.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {chaincode.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedChaincode(chaincode)}
                        className="btn-outline text-sm"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Xem chi tiết
                      </button>
                      
                      <button
                        onClick={() => handleApprove(chaincode.id)}
                        disabled={approveMutation.isLoading}
                        className="btn-success text-sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Phê duyệt
                      </button>
                      
                      <button
                        onClick={() => setSelectedChaincode({ ...chaincode, action: 'reject' })}
                        className="btn-error text-sm"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chaincode Detail Modal */}
      {selectedChaincode && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedChaincode.action === 'reject' ? 'Từ Chối Chaincode' : 'Chi Tiết Chaincode'}
                </h3>
                <button
                  onClick={() => {
                    setSelectedChaincode(null);
                    setRejectionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              {selectedChaincode.action === 'reject' ? (
                <div className="space-y-4">
                  <div>
                    <label className="label">Lý do từ chối</label>
                    <textarea
                      className="input"
                      rows={4}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Nhập lý do từ chối chaincode..."
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setSelectedChaincode(null)}
                      className="btn-outline"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => handleReject(selectedChaincode.id)}
                      disabled={rejectMutation.isLoading}
                      className="btn-error"
                    >
                      {rejectMutation.isLoading ? 'Đang xử lý...' : 'Từ chối'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Tên</label>
                      <p className="text-sm text-gray-900">{selectedChaincode.name}</p>
                    </div>
                    <div>
                      <label className="label">Phiên bản</label>
                      <p className="text-sm text-gray-900">{selectedChaincode.version}</p>
                    </div>
                    <div>
                      <label className="label">Ngôn ngữ</label>
                      <p className="text-sm text-gray-900">{selectedChaincode.language}</p>
                    </div>
                    <div>
                      <label className="label">Trạng thái</label>
                      <span className="status-uploaded">{selectedChaincode.status}</span>
                    </div>
                  </div>
                  
                  {selectedChaincode.description && (
                    <div>
                      <label className="label">Mô tả</label>
                      <p className="text-sm text-gray-900">{selectedChaincode.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="label">Source Code</label>
                    <div className="bg-gray-100 rounded-md p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                        {selectedChaincode.source_code}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setSelectedChaincode(null)}
                      className="btn-outline"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={() => handleApprove(selectedChaincode.id)}
                      disabled={approveMutation.isLoading}
                      className="btn-success"
                    >
                      {approveMutation.isLoading ? 'Đang xử lý...' : 'Phê duyệt'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalDashboard;
