import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { 
  Code,
  Play,
  Search,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Hash,
  Clock,
  Database,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';

interface GenericChaincodeDashboardProps {
  chaincode: any;
}

const GenericChaincodeDashboard: React.FC<GenericChaincodeDashboardProps> = ({ chaincode }) => {
  const [functionName, setFunctionName] = useState('');
  const [args, setArgs] = useState('');
  const [channelName, setChannelName] = useState('ibnchannel');
  const [operationType, setOperationType] = useState<'invoke' | 'query'>('query');
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const invokeMutation = useMutation(
    (data: any) => apiClient.invokeChaincode(data),
    {
      onSuccess: (response) => {
        const newResult = {
          success: true,
          data: response.data,
          type: 'invoke',
          timestamp: new Date().toISOString(),
          function: functionName,
          args: args.split(',').map(a => a.trim())
        };
        setResult(newResult);
        setHistory(prev => [newResult, ...prev.slice(0, 9)]);
        toast.success('Invoke thành công!');
      },
      onError: (error: any) => {
        const newResult = {
          success: false,
          error: error.response?.data?.detail || 'Invoke thất bại',
          type: 'invoke',
          timestamp: new Date().toISOString(),
          function: functionName,
          args: args.split(',').map(a => a.trim())
        };
        setResult(newResult);
        setHistory(prev => [newResult, ...prev.slice(0, 9)]);
        toast.error('Invoke thất bại');
      },
    }
  );

  const queryMutation = useMutation(
    (data: any) => apiClient.queryChaincode(data),
    {
      onSuccess: (response) => {
        const newResult = {
          success: true,
          data: response.data,
          type: 'query',
          timestamp: new Date().toISOString(),
          function: functionName,
          args: args.split(',').map(a => a.trim())
        };
        setResult(newResult);
        setHistory(prev => [newResult, ...prev.slice(0, 9)]);
        toast.success('Query thành công!');
      },
      onError: (error: any) => {
        const newResult = {
          success: false,
          error: error.response?.data?.detail || 'Query thất bại',
          type: 'query',
          timestamp: new Date().toISOString(),
          function: functionName,
          args: args.split(',').map(a => a.trim())
        };
        setResult(newResult);
        setHistory(prev => [newResult, ...prev.slice(0, 9)]);
        toast.error('Query thất bại');
      },
    }
  );

  const handleExecute = async () => {
    if (!functionName.trim()) {
      toast.error('Vui lòng nhập tên function');
      return;
    }

    const argsArray = args.split(',').map(arg => arg.trim()).filter(arg => arg);

    const data = {
      chaincode_id: chaincode.id,
      channel_name: channelName,
      function_name: functionName,
      args: argsArray,
    };

    if (operationType === 'invoke') {
      await invokeMutation.mutateAsync(data);
    } else {
      await queryMutation.mutateAsync(data);
    }
  };

  const formatResult = (data: any) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  };

  const loadFromHistory = (item: any) => {
    setFunctionName(item.function);
    setArgs(item.args.join(', '));
    setOperationType(item.type);
    setResult(item);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <Database className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{chaincode.name}</h1>
              <p className="text-sm text-gray-500">
                v{chaincode.version} • {chaincode.language} • {chaincode.status}
              </p>
            </div>
          </div>
        </div>
        <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          Generic Dashboard
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chaincode ID</p>
              <p className="text-lg font-semibold text-gray-900 mt-1 truncate">
                {chaincode.id.substring(0, 16)}...
              </p>
            </div>
            <Hash className="h-10 w-10 text-blue-500 opacity-75" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ngôn ngữ</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{chaincode.language}</p>
            </div>
            <Code className="h-10 w-10 text-purple-500 opacity-75" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Trạng thái</p>
              <p className="text-lg font-semibold text-green-600 mt-1">{chaincode.status}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500 opacity-75" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operation Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Operation Config */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Zap className="h-5 w-5 mr-2 text-yellow-500" />
              Thực thi Function
            </h3>
            
            <div className="space-y-4">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setOperationType('query')}
                  className={`flex-1 btn ${
                    operationType === 'query' ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Query (Read)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType('invoke')}
                  className={`flex-1 btn ${
                    operationType === 'invoke' ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Invoke (Write)
                </button>
              </div>

              <div>
                <label className="label">Channel Name</label>
                <input
                  type="text"
                  className="input"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="ibnchannel"
                />
              </div>

              <div>
                <label className="label">Function Name *</label>
                <input
                  type="text"
                  className="input"
                  value={functionName}
                  onChange={(e) => setFunctionName(e.target.value)}
                  placeholder="VD: getBatchInfo, createBatch, queryAllAssets"
                />
              </div>

              <div>
                <label className="label">Arguments (comma-separated)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="arg1, arg2, arg3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mỗi argument cách nhau bằng dấu phẩy
                </p>
              </div>

              <button
                onClick={handleExecute}
                disabled={!functionName || invokeMutation.isLoading || queryMutation.isLoading}
                className="btn-primary w-full flex items-center justify-center"
              >
                {invokeMutation.isLoading || queryMutation.isLoading ? (
                  <>
                    <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                    Đang thực thi...
                  </>
                ) : (
                  <>
                    {operationType === 'query' ? (
                      <Search className="h-5 w-5 mr-2" />
                    ) : (
                      <Play className="h-5 w-5 mr-2" />
                    )}
                    Thực thi
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              Kết quả
            </h3>
            
            {!result ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Database className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có kết quả</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Thực thi function để xem kết quả
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  result.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className={`ml-2 text-sm font-medium ${
                        result.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.success ? 'Thành công' : 'Thất bại'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        result.type === 'query' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {result.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(result.timestamp), 'HH:mm:ss', { locale: vi })}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Response Data:</h4>
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <SyntaxHighlighter
                      language="json"
                      style={tomorrow}
                      customStyle={{
                        margin: 0,
                        fontSize: '12px',
                        maxHeight: '400px',
                      }}
                    >
                      {JSON.stringify(
                        result.success ? formatResult(result.data) : { error: result.error },
                        null,
                        2
                      )}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Sidebar */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-gray-500" />
            Lịch sử
          </h3>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Chưa có lịch sử
                </p>
              </div>
            ) : (
              history.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    item.success 
                      ? 'border-green-200 bg-green-50 hover:bg-green-100' 
                      : 'border-red-200 bg-red-50 hover:bg-red-100'
                  }`}
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-900">
                      {item.function}
                    </span>
                    {item.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.type === 'query' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {item.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(item.timestamp), 'HH:mm:ss', { locale: vi })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenericChaincodeDashboard;

