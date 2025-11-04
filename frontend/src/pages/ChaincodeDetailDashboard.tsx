import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { getDashboardForChaincode, hasSpecializedDashboard } from './chaincodes/dashboardRegistry';

const ChaincodeDetailDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch chaincode details
  const { data: chaincodeData, isLoading, error } = useQuery(
    ['chaincode-detail', id],
    () => apiClient.getChaincodeById(id!),
    {
      enabled: !!id,
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !chaincodeData?.data) {
    return (
      <div className="card p-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Không tìm thấy chaincode</h2>
        <p className="text-gray-500 mb-4">Chaincode ID không tồn tại hoặc bạn không có quyền truy cập.</p>
        <button onClick={() => navigate('/chaincodes')} className="btn-primary">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const chaincode = chaincodeData.data;
  const dashboardInfo = getDashboardForChaincode(chaincode.name);
  const DashboardComponent = dashboardInfo.component;
  const isSpecialized = hasSpecializedDashboard(chaincode.name);

  return (
    <div className="space-y-6">
      {/* Back Button & Dashboard Type Badge */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/chaincodes')}
          className="btn-outline flex items-center"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Quay lại danh sách
        </button>

        {isSpecialized && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-200">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">
              Specialized Dashboard
            </span>
          </div>
        )}
      </div>

      {/* Dashboard Component */}
      <DashboardComponent chaincode={chaincode} />
    </div>
  );
};

export default ChaincodeDetailDashboard;

