import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileCode, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Input, Select, Textarea, Alert, Card, CardHeader, CardTitle, CardContent } from './ui';
import apiClient from '../services/api';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface UploadChaincodeProps {
  onSuccess?: () => void;
}

const UploadChaincode: React.FC<UploadChaincodeProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    version: '1.0.0',
    language: 'golang',
    description: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFile = (file: File): string | null => {
    const allowedExtensions = ['.go', '.js', '.ts', '.java', '.tar.gz', '.zip'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    
    if (!allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return `File type not supported. Allowed: ${allowedExtensions.join(', ')}`;
    }

    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const error = validateFile(droppedFile);
      if (error) {
        toast.error(error);
        return;
      }
      setFile(droppedFile);
      setValidationResult(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        toast.error(error);
        return;
      }
      setFile(selectedFile);
      setValidationResult(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!formData.name || !formData.version) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Read file content
      const fileContent = await file.text();

      // Create upload payload
      const payload = {
        name: formData.name,
        version: formData.version,
        language: formData.language,
        description: formData.description,
        source_code: fileContent,
        filename: file.name,
      };

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiClient.uploadChaincode(payload);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      setValidationResult(response.data);
      toast.success('Chaincode uploaded successfully!');
      
      // Reset form after a delay
      setTimeout(() => {
        setFile(null);
        setFormData({
          name: '',
          version: '1.0.0',
          language: 'golang',
          description: '',
        });
        setUploadProgress(0);
        setValidationResult(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess?.();
      }, 2000);

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Upload failed';
      toast.error(errorMessage);
      setValidationResult({ errors: [errorMessage] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Chaincode</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drag and Drop Area */}
          <div
            className={cn(
              'relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer',
              isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500',
              file && 'border-green-500 bg-green-50 dark:bg-green-900/20'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".go,.js,.ts,.java,.tar.gz,.zip"
            />

            {!file ? (
              <div className="flex flex-col items-center justify-center text-center">
                <Upload className={cn(
                  'h-12 w-12 mb-4 transition-colors',
                  isDragging ? 'text-primary-600' : 'text-gray-400'
                )} />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {isDragging ? 'Drop file here' : 'Drag & drop your chaincode file'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  or click to browse
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Supported: .go, .js, .ts, .java, .tar.gz, .zip (Max 10MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileCode className="h-8 w-8 text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-red-600" />
                </button>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                <span className="text-gray-600 dark:text-gray-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Chaincode Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., asset-transfer"
              required
              disabled={isUploading}
            />
            <Input
              label="Version"
              name="version"
              value={formData.version}
              onChange={handleInputChange}
              placeholder="e.g., 1.0.0"
              required
              disabled={isUploading}
            />
          </div>

          <Select
            label="Language"
            value={formData.language}
            onChange={(value) => setFormData({ ...formData, language: value })}
            options={[
              { value: 'golang', label: 'Go' },
              { value: 'javascript', label: 'JavaScript' },
              { value: 'typescript', label: 'TypeScript' },
              { value: 'java', label: 'Java' },
            ]}
            disabled={isUploading}
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe your chaincode..."
            rows={4}
            disabled={isUploading}
          />

          {/* Validation Result */}
          {validationResult && (
            <div className="space-y-2">
              {validationResult.is_valid ? (
                <Alert variant="success" title="Validation Passed">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <p>Your chaincode passed all validation checks and is ready for deployment.</p>
                      {validationResult.warnings && validationResult.warnings.length > 0 && (
                        <ul className="mt-2 text-sm list-disc list-inside">
                          {validationResult.warnings.map((warning: string, index: number) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </Alert>
              ) : (
                <Alert variant="error" title="Validation Failed">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <p>Please fix the following issues:</p>
                      {validationResult.errors && (
                        <ul className="mt-2 text-sm list-disc list-inside">
                          {validationResult.errors.map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </Alert>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null);
                setFormData({
                  name: '',
                  version: '1.0.0',
                  language: 'golang',
                  description: '',
                });
                setValidationResult(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={isUploading}
            >
              Clear
            </Button>
            <Button
              type="submit"
              loading={isUploading}
              disabled={!file || isUploading}
            >
              Upload Chaincode
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default UploadChaincode;

