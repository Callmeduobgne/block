import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Filter, 
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  LayoutDashboard
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const ChaincodeList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedChaincode, setSelectedChaincode] = useState<any>(null);
  const [channelName, setChannelName] = useState<string>('mychannel');
  const [targetPeersText, setTargetPeersText] = useState<string>('');
  const [deployLoading, setDeployLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const { data: chaincodesData, isLoading } = useQuery(
    ['chaincodes', statusFilter],
    () => apiClient.getChaincodes({ 
      status: statusFilter || undefined,
      limit: 1000 
    }),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const chaincodes = chaincodesData?.data?.chaincodes || [];

  const filteredChaincodes = chaincodes.filter((chaincode: any) =>
    chaincode.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chaincode.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'status-uploaded';
      case 'validated':
        return 'status-validated';
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      case 'deployed':
        return 'status-deployed';
      case 'active':
        return 'status-active';
      case 'deprecated':
        return 'status-deprecated';
      default:
        return 'status-uploaded';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'Đã upload';
      case 'validated':
        return 'Đã validate';
      case 'approved':
        return 'Đã phê duyệt';
      case 'rejected':
        return 'Đã từ chối';
      case 'deployed':
        return 'Đã triển khai';
      case 'active':
        return 'Hoạt động';
      case 'deprecated':
        return 'Lỗi thời';
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Danh Sách Chaincode</h1>
        <p className="mt-1 text-sm text-gray-500">
          Quản lý và theo dõi tất cả chaincode trong hệ thống
        </p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                placeholder="Tìm theo tên hoặc mô tả..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="label">Trạng thái</label>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="uploaded">Đã upload</option>
              <option value="validated">Đã validate</option>
              <option value="approved">Đã phê duyệt</option>
              <option value="rejected">Đã từ chối</option>
              <option value="deployed">Đã triển khai</option>
              <option value="active">Hoạt động</option>
              <option value="deprecated">Lỗi thời</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button className="btn-outline flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Chaincodes Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Chaincodes ({filteredChaincodes.length})
          </h3>
        </div>
        
        <div className="overflow-hidden">
          {filteredChaincodes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Không có chaincode nào</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter 
                  ? 'Không tìm thấy chaincode phù hợp với bộ lọc.'
                  : 'Chưa có chaincode nào được upload.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chaincode
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ngôn ngữ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploader
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredChaincodes.map((chaincode: any) => (
                    <tr key={chaincode.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {chaincode.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            v{chaincode.version}
                          </div>
                          {chaincode.description && (
                            <div className="text-xs text-gray-400 mt-1">
                              {chaincode.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusColor(chaincode.status)}>
                          {getStatusText(chaincode.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Tag className="h-3 w-3 mr-1" />
                          {chaincode.language}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {chaincode.uploader?.username || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {format(new Date(chaincode.created_at), 'dd/MM/yyyy', { locale: vi })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => navigate(`/chaincodes/${chaincode.id}/dashboard`)}
                            className="btn-primary text-sm"
                            title="Mở Dashboard"
                          >
                            <LayoutDashboard className="h-4 w-4 mr-1" />
                            Dashboard
                          </button>
                          <button
                            onClick={() => setSelectedChaincode(chaincode)}
                            className="btn-outline text-sm"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  Chi Tiết Chaincode
                </h3>
                <button
                  onClick={() => setSelectedChaincode(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
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
                    <span className={getStatusColor(selectedChaincode.status)}>
                      {getStatusText(selectedChaincode.status)}
                    </span>
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
                
                <div className="flex justify-end">
                  {selectedChaincode.status === 'approved' && (
                    <button
                      onClick={async () => {
                        // Open simple inline deploy form by toggling default values
                        if (!channelName) setChannelName('mychannel');
                        if (!targetPeersText) setTargetPeersText('peer0.org1.example.com:7051');
                      }}
                      className="btn mr-2"
                    >
                      Triển khai
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedChaincode(null)}
                    className="btn-outline"
                  >
                    Đóng
                  </button>
                </div>

                {selectedChaincode.status === 'approved' && (
                  <div className="mt-6 p-4 border rounded-md bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Thực hiện triển khai</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Channel Name</label>
                        <input
                          className="input"
                          placeholder="mychannel"
                          value={channelName}
                          onChange={(e) => setChannelName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Target Peers (phân tách bằng dấu phẩy)</label>
                        <input
                          className="input"
                          placeholder="peer0.org1.example.com:7051,peer0.org2.example.com:9051"
                          value={targetPeersText}
                          onChange={(e) => setTargetPeersText(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className="btn"
                        disabled={deployLoading}
                        onClick={async () => {
                          if (!channelName || !targetPeersText) return;
                          const target_peers = targetPeersText
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                          if (target_peers.length === 0) return;
                          setDeployLoading(true);
                          try {
                            await apiClient.deployChaincode({
                              chaincode_id: selectedChaincode.id,
                              channel_name: channelName,
                              target_peers,
                            });
                            // Điều hướng sang trang theo dõi triển khai
                            navigate('/deployments');
                          } catch (e) {
                            // lỗi đã được hiển thị bởi interceptor
                          } finally {
                            setDeployLoading(false);
                          }
                        }}
                      >
                        {deployLoading ? 'Đang triển khai...' : 'Xác nhận triển khai'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChaincodeList;
