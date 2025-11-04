import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { 
  Leaf,
  Plus,
  Search,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  Eye,
  Hash,
  Filter,
  RefreshCw,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';

interface TeaBatch {
  batchId: string;
  farmLocation: string;
  harvestDate: string;
  processingInfo: string;
  qualityCert: string;
  hashValue: string;
  owner: string;
  timestamp: string;
  status: 'CREATED' | 'VERIFIED' | 'EXPIRED';
}

interface TeaTraceDashboardProps {
  chaincode: any;
}

const TeaTraceDashboard: React.FC<TeaTraceDashboardProps> = ({ chaincode }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<TeaBatch | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batches, setBatches] = useState<TeaBatch[]>([]);
  const [loadingBatch, setLoadingBatch] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    batchId: '',
    farmLocation: '',
    harvestDate: '',
    processingInfo: '',
    qualityCert: ''
  });

  // Create batch mutation
  const createBatchMutation = useMutation(
    async (data: typeof formData) => {
      return apiClient.invokeChaincode({
        chaincode_id: chaincode.id,
        channel_name: 'ibnchannel',
        function_name: 'createBatch',
        args: [
          data.batchId,
          data.farmLocation,
          data.harvestDate,
          data.processingInfo,
          data.qualityCert
        ]
      });
    },
    {
      onSuccess: () => {
        toast.success('Tạo lô trà thành công!');
        setShowCreateForm(false);
        const batchId = formData.batchId;
        setFormData({
          batchId: '',
          farmLocation: '',
          harvestDate: '',
          processingInfo: '',
          qualityCert: ''
        });
        setTimeout(() => {
          if (batchId) queryBatch(batchId);
        }, 2000);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Tạo lô trà thất bại');
      }
    }
  );

  // Query single batch
  const queryBatch = async (batchId: string) => {
    setLoadingBatch(batchId);
    try {
      const response = await apiClient.queryChaincode({
        chaincode_id: chaincode.id,
        channel_name: 'ibnchannel',
        function_name: 'getBatchInfo',
        args: [batchId]
      });

      // Try different response structures
      const result = response.data?.result?.result || response.data?.result || response.data?.data?.result;
      console.log('Query response:', response.data);
      console.log('Extracted result:', result);
      
      if (result) {
        const batch = typeof result === 'string' ? JSON.parse(result) : result;
        setBatches(prev => {
          const filtered = prev.filter(b => b.batchId !== batch.batchId);
          return [batch, ...filtered];
        });
        toast.success('Tải thông tin lô trà thành công');
      } else {
        toast.error('Không nhận được dữ liệu từ blockchain');
      }
    } catch (error: any) {
      console.error('Query error:', error);
      toast.error(error.response?.data?.detail || 'Không tìm thấy lô trà');
    } finally {
      setLoadingBatch(null);
    }
  };

  // Update batch status
  const updateStatusMutation = useMutation(
    async ({ batchId, status }: { batchId: string; status: string }) => {
      return apiClient.invokeChaincode({
        chaincode_id: chaincode.id,
        channel_name: 'ibnchannel',
        function_name: 'updateBatchStatus',
        args: [batchId, status]
      });
    },
    {
      onSuccess: (_, variables) => {
        toast.success('Cập nhật trạng thái thành công!');
        setTimeout(() => queryBatch(variables.batchId), 1500);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Cập nhật thất bại');
      }
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBatchMutation.mutate(formData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CREATED': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'VERIFIED': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'EXPIRED': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Package className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-yellow-100 text-yellow-800';
      case 'VERIFIED': return 'bg-green-100 text-green-800';
      case 'EXPIRED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      batch.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.farmLocation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: batches.length,
    created: batches.filter(b => b.status === 'CREATED').length,
    verified: batches.filter(b => b.status === 'VERIFIED').length,
    expired: batches.filter(b => b.status === 'EXPIRED').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <Leaf className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{chaincode.name}</h1>
              <p className="text-sm text-gray-500">Quản lý và theo dõi nguồn gốc trà trên Blockchain</p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowCreateForm(true)} className="btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Tạo Lô Trà Mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng số lô</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <Package className="h-10 w-10 text-blue-500 opacity-75" />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đang chờ</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.created}</p>
            </div>
            <Clock className="h-10 w-10 text-yellow-500 opacity-75" />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đã xác minh</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.verified}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500 opacity-75" />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đã hết hạn</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.expired}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-500 opacity-75" />
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo Batch ID hoặc địa điểm..."
                className="input pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="CREATED">Đang chờ</option>
              <option value="VERIFIED">Đã xác minh</option>
              <option value="EXPIRED">Hết hạn</option>
            </select>
          </div>

          <button
            onClick={() => {
              const batchId = prompt('Nhập Batch ID để tải:');
              if (batchId) queryBatch(batchId);
            }}
            className="btn-outline flex items-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Tải Batch
          </button>
        </div>
      </div>

      {/* Batches List */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Danh sách lô trà</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-12">
              <Leaf className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có lô trà nào</h3>
              <p className="mt-1 text-sm text-gray-500">Tạo lô trà mới hoặc tải một lô trà hiện có.</p>
            </div>
          ) : (
            filteredBatches.map((batch) => (
              <div key={batch.batchId} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedBatch(batch)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">{batch.batchId}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </span>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        {batch.farmLocation}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {batch.harvestDate}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        {format(new Date(batch.timestamp), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <Hash className="h-4 w-4 mr-2" />
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {batch.hashValue.substring(0, 16)}...
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusIcon(batch.status)}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedBatch(batch); }} className="btn-outline btn-sm">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Tạo Lô Trà Mới</h2>
              <p className="mt-1 text-sm text-gray-500">Nhập thông tin lô trà để lưu vào blockchain</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Batch ID *</label>
                <input type="text" required className="input" value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  placeholder="VD: teaBatch_001" />
              </div>

              <div>
                <label className="label">Địa điểm trang trại *</label>
                <input type="text" required className="input" value={formData.farmLocation}
                  onChange={(e) => setFormData({ ...formData, farmLocation: e.target.value })}
                  placeholder="VD: Mộc Châu, Sơn La" />
              </div>

              <div>
                <label className="label">Ngày thu hoạch *</label>
                <input type="date" required className="input" value={formData.harvestDate}
                  onChange={(e) => setFormData({ ...formData, harvestDate: e.target.value })} />
              </div>

              <div>
                <label className="label">Thông tin xử lý *</label>
                <textarea required rows={3} className="input" value={formData.processingInfo}
                  onChange={(e) => setFormData({ ...formData, processingInfo: e.target.value })}
                  placeholder="VD: Sấy khô tự nhiên, lên men 24 giờ..." />
              </div>

              <div>
                <label className="label">Chứng nhận chất lượng *</label>
                <input type="text" required className="input" value={formData.qualityCert}
                  onChange={(e) => setFormData({ ...formData, qualityCert: e.target.value })}
                  placeholder="VD: VietGAP, Organic Certification" />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-outline"
                  disabled={createBatchMutation.isLoading}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={createBatchMutation.isLoading}>
                  {createBatchMutation.isLoading ? (
                    <><RefreshCw className="animate-spin h-5 w-5 mr-2" />Đang tạo...</>
                  ) : (
                    <><Plus className="h-5 w-5 mr-2" />Tạo Lô Trà</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedBatch.batchId}</h2>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedBatch.status)}`}>
                    {selectedBatch.status}
                  </span>
                </div>
                <button onClick={() => setSelectedBatch(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Địa điểm trang trại</label>
                  <div className="flex items-center text-gray-900">
                    <MapPin className="h-5 w-5 mr-2 text-gray-400" />{selectedBatch.farmLocation}
                  </div>
                </div>
                <div>
                  <label className="label">Ngày thu hoạch</label>
                  <div className="flex items-center text-gray-900">
                    <Calendar className="h-5 w-5 mr-2 text-gray-400" />{selectedBatch.harvestDate}
                  </div>
                </div>
                <div>
                  <label className="label">Thời gian tạo</label>
                  <div className="flex items-center text-gray-900">
                    <Clock className="h-5 w-5 mr-2 text-gray-400" />
                    {format(new Date(selectedBatch.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                  </div>
                </div>
                <div>
                  <label className="label">Chủ sở hữu</label>
                  <div className="flex items-center text-gray-900">
                    <Shield className="h-5 w-5 mr-2 text-gray-400" />{selectedBatch.owner}
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Thông tin xử lý</label>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-900">{selectedBatch.processingInfo}</p>
                </div>
              </div>

              <div>
                <label className="label">Chứng nhận chất lượng</label>
                <div className="bg-green-50 rounded-md p-4">
                  <p className="text-sm text-gray-900">{selectedBatch.qualityCert}</p>
                </div>
              </div>

              <div>
                <label className="label">Hash Value (SHA-256)</label>
                <div className="bg-gray-900 rounded-md p-4">
                  <code className="text-xs text-green-400 break-all">{selectedBatch.hashValue}</code>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                {selectedBatch.status === 'CREATED' && (
                  <button onClick={() => {
                      if (window.confirm('Xác nhận đánh dấu lô trà này là đã xác minh?')) {
                        updateStatusMutation.mutate({ batchId: selectedBatch.batchId, status: 'VERIFIED' });
                      }
                    }} className="btn-primary" disabled={updateStatusMutation.isLoading}>
                    <CheckCircle className="h-5 w-5 mr-2" />Xác minh
                  </button>
                )}
                
                {selectedBatch.status !== 'EXPIRED' && (
                  <button onClick={() => {
                      if (window.confirm('Xác nhận đánh dấu lô trà này là hết hạn?')) {
                        updateStatusMutation.mutate({ batchId: selectedBatch.batchId, status: 'EXPIRED' });
                      }
                    }} className="btn-outline text-red-600 border-red-300 hover:bg-red-50"
                    disabled={updateStatusMutation.isLoading}>
                    <AlertCircle className="h-5 w-5 mr-2" />Đánh dấu hết hạn
                  </button>
                )}

                <button onClick={() => setSelectedBatch(null)} className="btn-outline">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeaTraceDashboard;

