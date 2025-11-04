import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  Search, 
  Hash, 
  Calendar, 
  Users, 
  FileText,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  Clock,
  Code
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const BlockExplorer: React.FC = () => {
  const [searchType, setSearchType] = useState<'number' | 'hash'>('number');
  const [searchValue, setSearchValue] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [blockCount, setBlockCount] = useState(10);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [loadingRawJson, setLoadingRawJson] = useState(false);

  // Fetch ledger info
  const { data: ledgerInfo, isLoading: ledgerLoading } = useQuery(
    'ledger-info',
    () => apiClient.getLedgerInfo(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Fetch latest blocks
  const { data: blocksData, isLoading: blocksLoading, refetch: refetchBlocks } = useQuery(
    ['latest-blocks', blockCount],
    () => apiClient.getLatestBlocks(blockCount),
    {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  );

  // Fetch specific block
  const { data: blockData, isLoading: blockLoading, refetch: refetchBlock } = useQuery(
    ['block', searchType, searchValue],
    () => {
      if (!searchValue) return null;
      if (searchType === 'number') {
        return apiClient.getBlockByNumber(parseInt(searchValue));
      } else {
        return apiClient.getBlockByHash(searchValue);
      }
    },
    {
      enabled: !!searchValue,
    }
  );

  const handleSearch = () => {
    if (!searchValue.trim()) {
      toast.error('Vui lòng nhập giá trị tìm kiếm');
      return;
    }
    refetchBlock();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã copy vào clipboard');
  };

  const viewTransactionDetails = async (txId: string) => {
    try {
      const response = await apiClient.getTransactionDetails(txId);
      setSelectedTransaction(response.data.data);
      toast.success('Đã tải chi tiết transaction');
    } catch (error) {
      toast.error('Không thể tải chi tiết transaction');
    }
  };

  const viewRawJson = async (blockNumber: number) => {
    try {
      setLoadingRawJson(true);
      const response = await apiClient.getRawBlockJson(blockNumber);
      setRawJson(response.data);
      setShowRawJson(true);
      toast.success('Đã tải raw JSON của block');
    } catch (error) {
      toast.error('Không thể tải raw JSON');
    } finally {
      setLoadingRawJson(false);
    }
  };

  const formatHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp.seconds * 1000);
      return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: vi });
    } catch {
      return 'N/A';
    }
  };

  // Parse blocks - simplified (axios wraps response in .data)
  const blocks = blocksData?.data?.data && Array.isArray(blocksData.data.data)
    ? blocksData.data.data
    : [];
  
  const currentBlock = blockData?.data;

  if (ledgerLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Block Explorer</h1>
          <p className="mt-1 text-sm text-gray-500">
            Khám phá và theo dõi các block trong blockchain
          </p>
        </div>
        <button
          onClick={() => refetchBlocks()}
          className="btn btn-outline btn-sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Ledger Info */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Thông tin Ledger</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Hash className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <p className="text-sm text-blue-600 font-medium">Block Height</p>
                <p className="text-xl font-bold text-blue-900">
                  {ledgerInfo?.data?.height || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-green-600 mr-2" />
              <div>
                <p className="text-sm text-green-600 font-medium">Current Block Hash</p>
                <p className="text-sm font-mono text-green-900 break-all">
                  {formatHash(ledgerInfo?.data?.currentBlockHash || '')}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-purple-600 mr-2" />
              <div>
                <p className="text-sm text-purple-600 font-medium">Previous Block Hash</p>
                <p className="text-sm font-mono text-purple-900 break-all">
                  {formatHash(ledgerInfo?.data?.previousBlockHash || '')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Block */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tìm kiếm Block</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="flex">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as 'number' | 'hash')}
                className="select select-bordered rounded-r-none"
              >
                <option value="number">Block Number</option>
                <option value="hash">Block Hash</option>
              </select>
              <input
                type={searchType === 'number' ? 'number' : 'text'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={searchType === 'number' ? 'Nhập số block' : 'Nhập hash block'}
                className="input input-bordered rounded-l-none flex-1"
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={blockLoading}
            className="btn btn-primary"
          >
            {blockLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Tìm kiếm
              </>
            )}
          </button>
        </div>

        {/* Search Results */}
        {currentBlock && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3">Kết quả tìm kiếm:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Block Number:</p>
                <p className="font-mono text-lg">{currentBlock.blockNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Data Hash:</p>
                <p className="font-mono text-sm break-all">{formatHash(currentBlock.dataHash)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Previous Hash:</p>
                <p className="font-mono text-sm break-all">{formatHash(currentBlock.previousHash)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Số giao dịch:</p>
                <p className="font-semibold">{currentBlock.transactions?.length || 0}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedBlock(currentBlock)}
              className="btn btn-outline btn-sm mt-3"
            >
              <Eye className="h-4 w-4 mr-2" />
              Xem chi tiết
            </button>
          </div>
        )}
      </div>

      {/* Latest Blocks */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Latest Blocks</h3>
          <select
            value={blockCount}
            onChange={(e) => setBlockCount(parseInt(e.target.value))}
            className="select select-bordered select-sm"
          >
            <option value={5}>5 blocks</option>
            <option value={10}>10 blocks</option>
            <option value={20}>20 blocks</option>
            <option value={50}>50 blocks</option>
          </select>
        </div>

        {blocksLoading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Block #</th>
                  <th>Data Hash</th>
                  <th>Previous Hash</th>
                  <th>Transactions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block: any) => (
                  <tr key={block.blockNumber} className="hover:bg-gray-50">
                    <td>
                      <div className="font-mono font-semibold">
                        #{block.blockNumber}
                      </div>
                    </td>
                    <td>
                      <div className="font-mono text-sm">
                        {formatHash(block.dataHash)}
                        <button
                          onClick={() => copyToClipboard(block.dataHash)}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="font-mono text-sm">
                        {formatHash(block.previousHash)}
                        <button
                          onClick={() => copyToClipboard(block.previousHash)}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-outline">
                        {block.transactions?.length || 0} txs
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedBlock(block)}
                          className="btn btn-ghost btn-sm"
                          title="Chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => viewRawJson(block.blockNumber)}
                          disabled={loadingRawJson}
                          className="btn btn-ghost btn-sm"
                          title="Raw JSON"
                        >
                          {loadingRawJson ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Code className="h-4 w-4" />
                          )}
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

      {/* Block Detail Modal */}
      {selectedBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Block #{selectedBlock.blockNumber}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => viewRawJson(selectedBlock.blockNumber)}
                  disabled={loadingRawJson}
                  className="btn btn-outline btn-sm"
                >
                  {loadingRawJson ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Code className="h-4 w-4 mr-2" />
                      Xem Raw JSON
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="btn btn-ghost btn-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Block Number</label>
                  <p className="font-mono text-lg">{selectedBlock.blockNumber}</p>
                </div>
                <div>
                  <label className="label">Data Hash</label>
                  <div className="flex items-center">
                    <p className="font-mono text-sm break-all flex-1">
                      {selectedBlock.dataHash}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedBlock.dataHash)}
                      className="btn btn-ghost btn-sm ml-2"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Previous Hash</label>
                  <div className="flex items-center">
                    <p className="font-mono text-sm break-all flex-1">
                      {selectedBlock.previousHash}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedBlock.previousHash)}
                      className="btn btn-ghost btn-sm ml-2"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Số giao dịch</label>
                  <p className="text-lg font-semibold">
                    {selectedBlock.transactions?.length || 0}
                  </p>
                </div>
              </div>

              {/* Transactions */}
              {selectedBlock.transactions && selectedBlock.transactions.length > 0 && (
                <div>
                  <label className="label">Giao dịch</label>
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr>
                          <th>Transaction ID</th>
                          <th>Type</th>
                          <th>Creator</th>
                          <th>Timestamp</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBlock.transactions.map((tx: any, index: number) => (
                          <tr key={index}>
                            <td>
                              <div className="font-mono text-sm">
                                {formatHash(tx.transactionId)}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-outline">
                                {tx.type}
                              </span>
                            </td>
                            <td>
                              <span className="text-sm">{tx.creator}</span>
                            </td>
                            <td>
                              <span className="text-sm">
                                {formatTimestamp(tx.timestamp)}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => viewTransactionDetails(tx.transactionId)}
                                className="btn btn-ghost btn-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Transaction Details
              </h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="btn btn-ghost btn-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h4 className="font-semibold text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">Transaction ID</label>
                      <div className="flex items-center mt-1">
                        <p className="font-mono text-sm break-all flex-1">
                          {selectedTransaction.transactionId}
                        </p>
                        <button
                          onClick={() => copyToClipboard(selectedTransaction.transactionId)}
                          className="btn btn-ghost btn-xs ml-2"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Type</label>
                      <p className="mt-1">
                        <span className="badge badge-primary">
                          {selectedTransaction.type}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Creator MSP</label>
                      <p className="font-mono text-sm mt-1">{selectedTransaction.creator}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Timestamp</label>
                      <p className="text-sm mt-1">{formatTimestamp(selectedTransaction.timestamp)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Channel ID</label>
                      <p className="text-sm mt-1">{selectedTransaction.channelId}</p>
                    </div>
                    {selectedTransaction.blockNumber !== undefined && (
                      <div>
                        <label className="text-sm text-gray-600">Block Number</label>
                        <p className="font-mono text-sm mt-1">#{selectedTransaction.blockNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chaincode Info */}
              {selectedTransaction.chaincode && (
                <div className="card bg-green-50 shadow-sm">
                  <div className="card-body">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Chaincode Invocation
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-green-700 font-medium">Chaincode Name</label>
                          <p className="font-mono text-sm mt-1 text-green-900">
                            {selectedTransaction.chaincode.chaincodeName}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-green-700 font-medium">Function Name</label>
                          <p className="font-mono text-sm mt-1 text-green-900 font-bold">
                            {selectedTransaction.chaincode.functionName}
                          </p>
                        </div>
                      </div>
                      
                      {selectedTransaction.chaincode.args && selectedTransaction.chaincode.args.length > 0 && (
                        <div>
                          <label className="text-sm text-green-700 font-medium">Arguments</label>
                          <div className="bg-white rounded-lg p-3 mt-1">
                            <pre className="text-xs overflow-x-auto text-green-900">
                              {JSON.stringify(selectedTransaction.chaincode.args, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Read/Write Sets */}
              {selectedTransaction.readWriteSets && selectedTransaction.readWriteSets.length > 0 && (
                <div className="card bg-blue-50 shadow-sm">
                  <div className="card-body">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                      <Hash className="h-5 w-5 mr-2" />
                      Read/Write Sets
                    </h4>
                    {selectedTransaction.readWriteSets.map((rwSet: any, idx: number) => (
                      <div key={idx} className="mb-4 last:mb-0">
                        <div className="font-medium text-blue-800 mb-2">
                          Namespace: {rwSet.namespace}
                        </div>
                        
                        {/* Reads */}
                        {rwSet.reads && rwSet.reads.length > 0 && (
                          <div className="mb-3">
                            <label className="text-sm text-blue-700 font-medium">Reads:</label>
                            <div className="bg-white rounded-lg p-3 mt-1">
                              <div className="overflow-x-auto">
                                <table className="table table-xs w-full">
                                  <thead>
                                    <tr>
                                      <th>Key</th>
                                      <th>Version</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rwSet.reads.map((read: any, readIdx: number) => (
                                      <tr key={readIdx}>
                                        <td className="font-mono text-xs">{read.key}</td>
                                        <td className="font-mono text-xs">
                                          {read.version ? JSON.stringify(read.version) : 'N/A'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Writes */}
                        {rwSet.writes && rwSet.writes.length > 0 && (
                          <div>
                            <label className="text-sm text-blue-700 font-medium">Writes:</label>
                            <div className="bg-white rounded-lg p-3 mt-1">
                              <div className="space-y-2">
                                {rwSet.writes.map((write: any, writeIdx: number) => (
                                  <div key={writeIdx} className="border-b last:border-0 pb-2 last:pb-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-mono text-xs font-bold text-blue-900">
                                        {write.key}
                                      </span>
                                      {write.isDelete && (
                                        <span className="badge badge-error badge-xs">DELETE</span>
                                      )}
                                    </div>
                                    <div className="bg-gray-50 rounded p-2">
                                      <pre className="text-xs overflow-x-auto">
                                        {typeof write.value === 'object' 
                                          ? JSON.stringify(write.value, null, 2)
                                          : write.value}
                                      </pre>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Endorsements */}
              {selectedTransaction.endorsements && selectedTransaction.endorsements.length > 0 && (
                <div className="card bg-purple-50 shadow-sm">
                  <div className="card-body">
                    <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Endorsements ({selectedTransaction.endorsements.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedTransaction.endorsements.map((endorsement: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <label className="text-sm text-purple-700 font-medium">MSP ID</label>
                            <p className="font-mono text-sm mt-1">{endorsement.mspid}</p>
                          </div>
                          <div className="flex-1 ml-4">
                            <label className="text-sm text-purple-700 font-medium">Signature</label>
                            <p className="font-mono text-xs mt-1 text-gray-600">{endorsement.signature}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Modal */}
      {showRawJson && rawJson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Block Raw JSON
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(rawJson)}
                  className="btn btn-outline btn-sm"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </button>
                <button
                  onClick={() => {
                    setShowRawJson(false);
                    setRawJson(null);
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-xs whitespace-pre-wrap break-words">
                {rawJson}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockExplorer;


