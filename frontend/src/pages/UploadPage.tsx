import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from 'react-query';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient, { getErrorMessage } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

interface ChaincodeUploadData {
  name: string;
  version: string;
  source_code: string;
  description: string;
  language: string;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return window.btoa(binary);
};

const UploadPage: React.FC = () => {
  const [formData, setFormData] = useState<ChaincodeUploadData>({
    name: '',
    version: '',
    source_code: '',
    description: '',
    language: 'golang',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPackageFile, setIsPackageFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation(
    (data: ChaincodeUploadData) => apiClient.uploadChaincode(data),
    {
      onSuccess: () => {
        toast.success('Chaincode đã được upload thành công!');
        queryClient.invalidateQueries('chaincodes');
        // Reset form
        setFormData({
          name: '',
          version: '',
          source_code: '',
          description: '',
          language: 'golang',
        });
        setUploadedFile(null);
        setValidationResult(null);
      },
      onError: (error: any) => {
        toast.error(getErrorMessage(error, 'Upload thất bại'));
      },
    }
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      const lowerName = file.name.toLowerCase();
      const isPkg = lowerName.endsWith('.tgz') || lowerName.endsWith('.tar.gz') || lowerName.endsWith('.zip');
      setIsPackageFile(isPkg);
      
      // Auto-detect language from file extension
      let detectedLanguage = 'javascript'; // default for packages (most common)
      if (!isPkg) {
        if (lowerName.endsWith('.go')) {
          detectedLanguage = 'golang';
        } else if (lowerName.endsWith('.js')) {
          detectedLanguage = 'javascript';
        } else if (lowerName.endsWith('.ts')) {
          detectedLanguage = 'typescript';
        } else if (lowerName.endsWith('.py')) {
          detectedLanguage = 'python';
        } else if (lowerName.endsWith('.java')) {
          detectedLanguage = 'java';
        }
      }
      // Note: For .tar.gz/.tgz packages, user should manually select the correct language
      
      // Auto-fill name from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setFormData(prev => ({
        ...prev,
        name: nameWithoutExt,
        language: detectedLanguage,
      }));

      // Read file content (text for source files; for package, set a placeholder)
      if (isPkg) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) return;
          const base64String = arrayBufferToBase64(buffer);
          setFormData(prev => ({
            ...prev,
            source_code: `ARCHIVE_TGZ:${base64String}`,
          }));
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setFormData(prev => ({
            ...prev,
            source_code: content,
          }));
        };
        reader.readAsText(file);
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDrop([file]);
    }
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Cho phép mọi loại file; tự kiểm tra ở onDrop để nhận dạng package/source
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  const validateChaincode = async () => {
    if (!formData.source_code) {
      toast.error('Vui lòng upload file chaincode trước');
      return;
    }

    setIsValidating(true);
    try {
      // Simulate validation - in real implementation, this would call backend validation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isValid = isPackageFile ? true : (formData.source_code.length > 100);
      setValidationResult({
        is_valid: isValid,
        errors: isValid ? [] : ['Source code quá ngắn'],
        warnings: [],
      });
      
      if (isValid) {
        toast.success('Chaincode hợp lệ!');
      } else {
        toast.error('Chaincode không hợp lệ');
      }
    } catch (error) {
      toast.error('Lỗi validation');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.version || !formData.source_code) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (!validationResult?.is_valid) {
      toast.error('Vui lòng validate chaincode trước khi upload');
      return;
    }

    uploadMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Chaincode</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload và validate chaincode mới vào hệ thống
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Upload File
          </h3>
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {isDragActive
                  ? 'Thả file vào đây...'
                  : 'Kéo thả file hoặc click để chọn'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Hỗ trợ: .go, .js, .java, .zip, .tgz, .tar.gz
              </p>
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Chọn file từ máy
                </button>
              </div>
            </div>
          </div>

          {uploadedFile && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Section */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Thông Tin Chaincode
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Tên Chaincode</label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="asset-transfer"
                required
              />
            </div>

            <div>
              <label className="label">Phiên Bản</label>
              <input
                type="text"
                className="input"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
                required
              />
            </div>

            <div>
              <label className="label">Ngôn Ngữ</label>
              <select
                className="input"
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
              >
                <option value="golang">Go</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
              </select>
              {isPackageFile && (
                <p className="mt-2 text-sm text-amber-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Lưu ý: Kiểm tra ngôn ngữ! Chọn JavaScript nếu package chứa compiled JS, TypeScript nếu chứa source .ts
                </p>
              )}
            </div>

            <div>
              <label className="label">Mô Tả</label>
              <textarea
                className="input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả chức năng của chaincode..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={validateChaincode}
                disabled={!formData.source_code || isValidating}
                className="btn-outline flex-1 flex items-center justify-center"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Đang validate...
                  </>
                ) : (
                  'Validate'
                )}
              </button>

              <button
                type="submit"
                disabled={!validationResult?.is_valid || uploadMutation.isLoading}
                className="btn-primary flex-1 flex items-center justify-center"
              >
                {uploadMutation.isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Đang upload...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Kết Quả Validation
          </h3>
          
          <div className={`p-4 rounded-md ${
            validationResult.is_valid 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              {validationResult.is_valid ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  validationResult.is_valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {validationResult.is_valid ? 'Chaincode hợp lệ' : 'Chaincode không hợp lệ'}
                </p>
              </div>
            </div>
            
            {validationResult.errors?.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-red-800">Lỗi:</p>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {validationResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validationResult.warnings?.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-yellow-800">Cảnh báo:</p>
                <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                  {validationResult.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
