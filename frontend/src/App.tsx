import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import ApprovalDashboard from './pages/ApprovalDashboard';
import DeploymentMonitor from './pages/DeploymentMonitor';
import TestConsole from './pages/TestConsole';
import ChaincodeList from './pages/ChaincodeList';
import UserManagement from './pages/UserManagement';
import AuditLogs from './pages/AuditLogs';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/chaincodes" element={<ChaincodeList />} />
        <Route path="/approvals" element={<ApprovalDashboard />} />
        <Route path="/deployments" element={<DeploymentMonitor />} />
        <Route path="/test-console" element={<TestConsole />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
