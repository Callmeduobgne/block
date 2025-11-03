import React, { useState, useEffect, useCallback } from 'react';
import { Box, Hash, Clock, FileText, Search, ChevronRight, ExternalLink } from 'lucide-react';
import { Card, Input, Button, Badge, Table, Modal } from './ui';
import apiClient from '../services/api';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface Block {
  block_number: number;
  block_hash: string;
  previous_hash: string;
  data_hash: string;
  tx_count: number;
  timestamp: string;
}

interface Transaction {
  tx_id: string;
  type: string;
  chaincode_name?: string;
  timestamp: string;
  creator: string;
  status: 'VALID' | 'INVALID';
}

const BlockExplorer: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [blockTransactions, setBlockTransactions] = useState<Transaction[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [ledgerInfo, setLedgerInfo] = useState<any>(null);

  const fetchLedgerInfo = useCallback(async () => {
    try {
      const response = await apiClient.getLedgerInfo();
      setLedgerInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch ledger info:', error);
    }
  }, []);

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getLatestBlocks(20);
      setBlocks(response.data.blocks || []);
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
      toast.error('Không thể tải danh sách block');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedgerInfo();
    fetchBlocks();
    
    // Auto refresh every 10 seconds
    const interval = setInterval(() => {
      fetchBlocks();
      fetchLedgerInfo();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchBlocks, fetchLedgerInfo]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Vui lòng nhập block number hoặc hash');
      return;
    }

    try {
      let response;
      
      // Check if search term is a number (block number)
      if (/^\d+$/.test(searchTerm)) {
        response = await apiClient.getBlockByNumber(parseInt(searchTerm));
      } else {
        response = await apiClient.getBlockByHash(searchTerm);
      }

      const block = response.data;
      setSelectedBlock(block);
      setBlockTransactions(block.transactions || []);
      setShowBlockModal(true);
    } catch (error: any) {
      toast.error('Không tìm thấy block');
    }
  };

  const handleViewBlock = async (block: Block) => {
    try {
      const response = await apiClient.getBlockByNumber(block.block_number);
      setSelectedBlock(response.data);
      setBlockTransactions(response.data.transactions || []);
      setShowBlockModal(true);
    } catch (error) {
      toast.error('Không thể tải chi tiết block');
    }
  };

  const formatHash = (hash: string, length: number = 16) => {
    if (!hash) return 'N/A';
    if (hash.length <= length) return hash;
    return `${hash.substring(0, length / 2)}...${hash.substring(hash.length - length / 2)}`;
  };

  const columns = [
    {
      key: 'block_number',
      header: 'Block',
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-primary-600" />
          <span className="font-mono font-medium">#{value}</span>
        </div>
      ),
    },
    {
      key: 'block_hash',
      header: 'Hash',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-gray-400" />
          <code className="text-xs font-mono text-gray-600 dark:text-gray-400">
            {formatHash(value)}
          </code>
        </div>
      ),
    },
    {
      key: 'tx_count',
      header: 'Transactions',
      sortable: true,
      render: (value: number) => (
        <Badge variant={value > 0 ? 'info' : 'secondary'} size="sm">
          {value} TX
        </Badge>
      ),
    },
    {
      key: 'timestamp',
      header: 'Time',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="h-4 w-4" />
          {new Date(value).toLocaleString('vi-VN')}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (_: any, row: Block) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleViewBlock(row)}
          rightIcon={<ChevronRight className="h-4 w-4" />}
        >
          View
        </Button>
      ),
    },
  ];

  const transactionColumns = [
    {
      key: 'tx_id',
      header: 'Transaction ID',
      render: (value: string) => (
        <code className="text-xs font-mono">{formatHash(value, 24)}</code>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (value: string) => (
        <Badge variant="secondary" size="sm">{value}</Badge>
      ),
    },
    {
      key: 'chaincode_name',
      header: 'Chaincode',
      render: (value: string) => value || 'N/A',
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => (
        <Badge 
          variant={value === 'VALID' ? 'success' : 'error'} 
          size="sm"
        >
          {value}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Ledger Stats */}
      {ledgerInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                <Box className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Block Height</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {ledgerInfo.height || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {blocks.reduce((sum, block) => sum + block.tx_count, 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Hash className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Hash</p>
                <code className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {formatHash(ledgerInfo.currentBlockHash || '', 12)}
                </code>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date().toLocaleTimeString('vi-VN')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card className="p-6">
        <div className="flex gap-3">
          <Input
            placeholder="Search by block number or hash..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1"
          />
          <Button onClick={handleSearch}>
            Search
          </Button>
        </div>
      </Card>

      {/* Blocks Table */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Recent Blocks
            </h2>
            <Badge variant="info" size="sm">
              Auto-refresh: 10s
            </Badge>
          </div>

          <Table
            columns={columns}
            data={blocks}
            keyExtractor={(row) => row.block_number.toString()}
            loading={loading}
            emptyMessage="No blocks found"
            striped
            hoverable
          />
        </div>
      </Card>

      {/* Block Details Modal */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={`Block #${selectedBlock?.block_number}`}
        size="xl"
      >
        {selectedBlock && (
          <div className="space-y-6">
            {/* Block Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Block Number
                </label>
                <p className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                  #{selectedBlock.block_number}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Transactions
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedBlock.tx_count}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Block Hash
                </label>
                <code className="mt-1 block text-xs font-mono text-gray-600 dark:text-gray-400 break-all bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {selectedBlock.block_hash}
                </code>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Previous Hash
                </label>
                <code className="mt-1 block text-xs font-mono text-gray-600 dark:text-gray-400 break-all bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {selectedBlock.previous_hash}
                </code>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Data Hash
                </label>
                <code className="mt-1 block text-xs font-mono text-gray-600 dark:text-gray-400 break-all bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {selectedBlock.data_hash}
                </code>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Timestamp
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {new Date(selectedBlock.timestamp).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>

            {/* Transactions */}
            {blockTransactions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Transactions ({blockTransactions.length})
                </h4>
                <Table
                  columns={transactionColumns}
                  data={blockTransactions}
                  keyExtractor={(row) => row.tx_id}
                  emptyMessage="No transactions in this block"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BlockExplorer;

