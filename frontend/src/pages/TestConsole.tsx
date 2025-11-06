import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { 
  Terminal, 
  Play, 
  Search, 
  FileText, 
  Loader2,
  CheckCircle,
  XCircle,
  Code
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const TestConsole: React.FC = () => {
  const [selectedChaincode, setSelectedChaincode] = useState<any>(null);
  const [functionName, setFunctionName] = useState('');
  const [args, setArgs] = useState('');
  const [channelName, setChannelName] = useState('ibnchannel');
  const [operationType, setOperationType] = useState<'invoke' | 'query'>('query');
  const [result, setResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Function Registry - Hybrid Approach
  const [availableFunctions, setAvailableFunctions] = useState<any[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<any>(null);
  const [quickTemplates, setQuickTemplates] = useState<any[]>([]);
  const [showFunctionList, setShowFunctionList] = useState(false);

  const { data: chaincodesData, isLoading: chaincodesLoading } = useQuery(
    'chaincodes-active',
    () => apiClient.getChaincodes({ 
      status: 'active',
      limit: 1000 
    })
  );

  const invokeMutation = useMutation(
    (data: any) => apiClient.invokeChaincode(data),
    {
      onSuccess: (response) => {
        setResult({
          success: true,
          data: response.data,
          type: 'invoke'
        });
        toast.success('Invoke thành công!');
      },
      onError: (error: any) => {
        setResult({
          success: false,
          error: error.response?.data?.detail || 'Invoke thất bại',
          type: 'invoke'
        });
        toast.error('Invoke thất bại');
      },
    }
  );

  const queryMutation = useMutation(
    (data: any) => apiClient.queryChaincode(data),
    {
      onSuccess: (response) => {
        setResult({
          success: true,
          data: response.data,
          type: 'query'
        });
        toast.success('Query thành công!');
      },
      onError: (error: any) => {
        setResult({
          success: false,
          error: error.response?.data?.detail || 'Query thất bại',
          type: 'query'
        });
        toast.error('Query thất bại');
      },
    }
  );

  const chaincodes = chaincodesData?.data?.chaincodes || [];

  // Load functions when chaincode is selected
  React.useEffect(() => {
    const loadFunctions = async () => {
      if (selectedChaincode) {
        try {
          const response = await apiClient.get(`/chaincode/${selectedChaincode.id}/functions`);
          const data: any = response.data;
          setAvailableFunctions(data.all_functions || []);
          setQuickTemplates(data.quick_templates || []);
          
          // Reset function selection when changing chaincode
          setFunctionName('');
          setSelectedFunction(null);
          setArgs('');
        } catch (error) {
          console.error('Failed to load functions:', error);
          setAvailableFunctions([]);
        }
      } else {
        setAvailableFunctions([]);
        setQuickTemplates([]);
      }
    };
    
    loadFunctions();
  }, [selectedChaincode]);

  // Handle function selection - Auto-fill arguments with examples
  const handleFunctionSelect = (fnName: string) => {
    setFunctionName(fnName);
    
    // Find full function object
    const fn = availableFunctions.find(f => f.name === fnName);
    setSelectedFunction(fn);
    
    if (fn && fn.parameters && fn.parameters.length > 0) {
      // Auto-fill with example values
      const exampleArgs = fn.parameters.map((p: any) => p.example || '').join(', ');
      setArgs(exampleArgs);
      
      // Auto-set operation type
      setOperationType(fn.is_query ? 'query' : 'invoke');
    } else {
      setArgs('');
    }
  };
  
  // Handle quick template selection
  const handleTemplateSelect = (template: any) => {
    setFunctionName(template.function_name);
    setArgs(template.arguments.join(', '));
    setSelectedFunction(null);
  };

  const handleExecute = async () => {
    if (!selectedChaincode) {
      toast.error('Vui lòng chọn chaincode');
      return;
    }

    if (!functionName.trim()) {
      toast.error('Vui lòng nhập tên function');
      return;
    }

    const argsArray = args.split(',').map(arg => arg.trim()).filter(arg => arg);

    const data = {
      chaincode_id: selectedChaincode.id,
      channel_name: channelName,
      function_name: functionName,
      args: argsArray,
    };

    setIsExecuting(true);
    const startTime = Date.now();
    
    try {
      if (operationType === 'invoke') {
        await invokeMutation.mutateAsync(data);
      } else {
        await queryMutation.mutateAsync(data);
      }
      
      // Record successful call to history (for learning)
      const executionTime = Date.now() - startTime;
      try {
        await apiClient.post(`/chaincode/${selectedChaincode.id}/functions/history`, {
          function_name: functionName,
          arguments: argsArray,
          success: true,
          execution_time_ms: executionTime
        });
      } catch (historyError) {
        console.warn('Failed to record history:', historyError);
      }
      
    } catch (error: any) {
      console.error('Execution error:', error);
      
      // Record failed call to history
      try {
        await apiClient.post(`/chaincode/${selectedChaincode.id}/functions/history`, {
          function_name: functionName,
          arguments: argsArray,
          success: false,
          error_message: error.response?.data?.detail || error.message
        });
      } catch (historyError) {
        console.warn('Failed to record history:', historyError);
      }
    } finally {
      setIsExecuting(false);
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

  if (chaincodesLoading) {
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
        <h1 className="text-2xl font-bold text-gray-900">Test Console</h1>
        <p className="mt-1 text-sm text-gray-500">
          Test và debug chaincode với invoke/query operations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chaincode Selection */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Chọn Chaincode
          </h3>
          
          <div className="space-y-3">
            {chaincodes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Không có chaincode active</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Cần có chaincode đã được triển khai và active.
                </p>
              </div>
            ) : (
              chaincodes.map((chaincode: any) => (
                <div
                  key={chaincode.id}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedChaincode?.id === chaincode.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedChaincode(chaincode)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {chaincode.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        v{chaincode.version} • {chaincode.language}
                      </p>
                    </div>
                    {selectedChaincode?.id === chaincode.id && (
                      <CheckCircle className="h-5 w-5 text-primary-500" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operation Configuration */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Cấu Hình Operation
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="label">Loại Operation</label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setOperationType('query')}
                  className={`flex-1 btn ${
                    operationType === 'query' ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Query
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType('invoke')}
                  className={`flex-1 btn ${
                    operationType === 'invoke' ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Invoke
                </button>
              </div>
            </div>

            <div>
              <label className="label">Channel Name</label>
              <input
                type="text"
                className="input"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="mychannel"
              />
            </div>

            <div>
              <label className="label">Function Name</label>
              
              {/* Function Selector - Hybrid Approach */}
              {availableFunctions.length > 0 ? (
                <div className="relative">
                  <select
                    className="input pr-10"
                    value={functionName}
                    onChange={(e) => handleFunctionSelect(e.target.value)}
                  >
                    <option value="">-- Chọn function --</option>
                    
                    {/* Available Functions */}
                    <optgroup label="📦 Available Functions">
                      {availableFunctions.map((fn: any) => (
                        <option key={fn.name} value={fn.name}>
                          {fn.name} {fn.is_query ? '(Query)' : '(Invoke)'} - {fn.description}
                        </option>
                      ))}
                    </optgroup>
                    
                    {/* Quick Templates */}
                    {quickTemplates.length > 0 && (
                      <optgroup label="⚡ Quick Actions">
                        {quickTemplates.map((tpl: any) => (
                          <option key={tpl.name} value={tpl.function_name}>
                            {tpl.icon} {tpl.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  
                  {/* Show function details when selected */}
                  {selectedFunction && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="font-semibold text-blue-900">{selectedFunction.name}</div>
                      {selectedFunction.description && (
                        <div className="text-blue-700 mt-1">{selectedFunction.description}</div>
                      )}
                      {selectedFunction.parameters && selectedFunction.parameters.length > 0 && (
                        <div className="mt-2">
                          <div className="text-blue-800 font-medium">Parameters:</div>
                          <ul className="ml-4 mt-1 space-y-1">
                            {selectedFunction.parameters.map((param: any, idx: number) => (
                              <li key={idx} className="text-blue-700">
                                <code className="bg-blue-100 px-1 rounded">{param.name}</code>
                                <span className="text-gray-600"> ({param.type})</span>
                                {param.example && (
                                  <span className="text-gray-500"> - e.g., "{param.example}"</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Fallback: Manual input if no functions loaded
                <input
                  type="text"
                  className="input"
                  value={functionName}
                  onChange={(e) => setFunctionName(e.target.value)}
                  placeholder="Nhập tên function (e.g., GetAllAssets)"
                />
              )}
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
            </div>

            <button
              onClick={handleExecute}
              disabled={!selectedChaincode || !functionName || isExecuting}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Đang thực thi...
                </>
              ) : (
                <>
                  {operationType === 'query' ? (
                    <Search className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {operationType === 'query' ? 'Query' : 'Invoke'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Kết Quả
          </h3>
          
          <div className="h-96 overflow-y-auto">
            {!result ? (
              <div className="text-center py-12">
                <Terminal className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có kết quả</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Thực thi operation để xem kết quả.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-3 rounded-md ${
                  result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
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
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                      result.type === 'query' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {result.type}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Response:</h4>
                  <div className="bg-gray-900 rounded-md overflow-hidden">
                    <SyntaxHighlighter
                      language="json"
                      style={tomorrow}
                      customStyle={{
                        margin: 0,
                        fontSize: '12px',
                        maxHeight: '200px',
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

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Request:</h4>
                  <div className="bg-gray-100 rounded-md p-3">
                    <div className="text-xs text-gray-700">
                      <div><strong>Chaincode:</strong> {selectedChaincode?.name}</div>
                      <div><strong>Function:</strong> {functionName}</div>
                      <div><strong>Args:</strong> [{args.split(',').map(arg => `"${arg.trim()}"`).join(', ')}]</div>
                      <div><strong>Channel:</strong> {channelName}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestConsole;
