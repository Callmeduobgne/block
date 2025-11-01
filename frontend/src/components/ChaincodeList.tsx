import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Filter, Download, Eye, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button, Input, Select, Badge, Card, Table, Modal } from './ui';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/api';
import toast from 'react-hot-toast';

interface Chaincode {
  id: string;
  name: string;
  version: string;
  language: string;
  status: 'uploaded' | 'validated' | 'approved' | 'rejected' | 'deployed' | 'active' | 'deprecated';
  description?: string;
  uploaded_by: string;
  uploaded_at: string;
  approved_by?: string;
  approved_at?: string;
}

const ChaincodeList: React.FC = () => {
  const [chaincodes, setChaincodes] = useState<Chaincode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedChaincode, setSelectedChaincode] = useState<Chaincode | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [sortBy, setSortBy] = useState<string>('uploaded_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({ skip: 0, limit: 20, total: 0 });

  const { user, hasPermission } = useAuth();
  const { isConnected, on, off } = useWebSocket({ autoConnect: true });

  const fetchChaincodes = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      
      const params: any = {
        skip: pagination.skip,
        limit: pagination.limit,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await apiClient.getChaincodes(params);
      setChaincodes(response.data.chaincodes || []);
      setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
    } catch (error: any) {
      console.error('Failed to fetch chaincodes:', error);
      toast.error('Không thể tải danh sách chaincode');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pagination.skip, pagination.limit, statusFilter]);

  useEffect(() => {
    fetchChaincodes();
  }, [fetchChaincodes]);

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!isConnected) return;

    const handleChaincodeUpdate = (data: any) => {
      console.log('Chaincode update received:', data);
      
      if (data.action === 'created' || data.action === 'updated') {
        setChaincodes(prev => {
          const index = prev.findIndex(cc => cc.id === data.chaincode.id);
          if (index >= 0) {
            // Update existing
            const updated = [...prev];
            updated[index] = data.chaincode;
            return updated;
          } else {
            // Add new
            return [data.chaincode, ...prev];
          }
        });
        
        toast.success(`Chaincode ${data.chaincode.name} đã được ${data.action === 'created' ? 'tạo' : 'cập nhật'}`);
      } else if (data.action === 'deleted') {
        setChaincodes(prev => prev.filter(cc => cc.id !== data.chaincode_id));
        toast.info('Chaincode đã được xóa');
      }
    };

    on('chaincode_update', handleChaincodeUpdate);

    return () => {
      off('chaincode_update', handleChaincodeUpdate);
    };
  }, [isConnected, on, off]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchChaincodes(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortDirection('asc');
    }
  };

  const handleViewDetails = (chaincode: Chaincode) => {
    setSelectedChaincode(chaincode);
    setShowDetailsModal(true);
  };

  const handleApprove = async (chaincodeId: string) => {
    try {
      await apiClient.approveChaincode(chaincodeId);
      toast.success('Chaincode đã được phê duyệt');
      fetchChaincodes(false);
    } catch (error) {
      toast.error('Không thể phê duyệt chaincode');
    }
  };

  const handleReject = async (chaincodeId: string) => {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;

    try {
      await apiClient.rejectChaincode(chaincodeId, reason);
      toast.success('Chaincode đã bị từ chối');
      fetchChaincodes(false);
    } catch (error) {
      toast.error('Không thể từ chối chaincode');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      uploaded: { variant: 'secondary', icon: <Clock className="h-3 w-3 mr-1" /> },
      validated: { variant: 'info', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      approved: { variant: 'success', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      rejected: { variant: 'error', icon: <XCircle className="h-3 w-3 mr-1" /> },
      deployed: { variant: 'success', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      active: { variant: 'success', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      deprecated: { variant: 'warning', icon: <XCircle className="h-3 w-3 mr-1" /> },
    };

    const config = variants[status] || variants.uploaded;

    return (
      <Badge variant={config.variant} size="sm">
        <span className="flex items-center">
          {config.icon}
          {status.toUpperCase()}
        </span>
      </Badge>
    );
  };

  // Filter and sort data
  const filteredChaincodes = chaincodes
    .filter(cc => {
      const matchesSearch = 
        cc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cc.version.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (value: string, row: Chaincode) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {value}
          <div className="text-xs text-gray-500 dark:text-gray-400">v{row.version}</div>
        </div>
      ),
    },
    {
      key: 'language',
      header: 'Language',
      sortable: true,
      render: (value: string) => (
        <Badge variant="secondary" size="sm">{value}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: 'uploaded_by',
      header: 'Uploaded By',
      sortable: true,
    },
    {
      key: 'uploaded_at',
      header: 'Uploaded At',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, row: Chaincode) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewDetails(row)}
            leftIcon={<Eye className="h-4 w-4" />}
          >
            View
          </Button>
          {hasPermission('chaincode.approve') && row.status === 'validated' && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleApprove(row.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(row.id)}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Chaincodes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isConnected ? (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    Real-time updates active
                  </span>
                ) : (
                  'Loading updates...'
                )}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              loading={refreshing}
              leftIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              placeholder="Search by name or version..."
              value={searchTerm}
              onChange={handleSearch}
              leftIcon={<Search className="h-4 w-4" />}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'uploaded', label: 'Uploaded' },
                { value: 'validated', label: 'Validated' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'deployed', label: 'Deployed' },
                { value: 'active', label: 'Active' },
              ]}
              leftIcon={<Filter className="h-4 w-4" />}
            />
          </div>

          {/* Table */}
          <Table
            columns={columns}
            data={filteredChaincodes}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => handleViewDetails(row)}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            loading={loading}
            emptyMessage="No chaincodes found"
            striped
            hoverable
          />

          {/* Pagination Info */}
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredChaincodes.length} of {pagination.total} chaincodes
          </div>
        </div>
      </Card>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={`${selectedChaincode?.name} v${selectedChaincode?.version}`}
        size="lg"
      >
        {selectedChaincode && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Language</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedChaincode.language}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <div className="mt-1">{getStatusBadge(selectedChaincode.status)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Uploaded By</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedChaincode.uploaded_by}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Uploaded At</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {new Date(selectedChaincode.uploaded_at).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
            {selectedChaincode.description && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedChaincode.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChaincodeList;

