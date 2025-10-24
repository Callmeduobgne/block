import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Shield,
  Mail,
  Calendar,
  UserCheck,
  UserX
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const UserManagement: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'USER',
    organization: '',
  });
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useQuery(
    'users',
    () => apiClient.getUsers({ limit: 1000 })
  );

  const createUserMutation = useMutation(
    (data: any) => apiClient.createUser(data),
    {
      onSuccess: () => {
        toast.success('Tạo user thành công!');
        queryClient.invalidateQueries('users');
        setIsCreating(false);
        setNewUser({
          username: '',
          email: '',
          password: '',
          role: 'USER',
          organization: '',
        });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Tạo user thất bại');
      },
    }
  );

  const updateUserMutation = useMutation(
    ({ id, data }: { id: string; data: any }) => apiClient.updateUser(id, data),
    {
      onSuccess: () => {
        toast.success('Cập nhật user thành công!');
        queryClient.invalidateQueries('users');
        setSelectedUser(null);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Cập nhật user thất bại');
      },
    }
  );

  const deleteUserMutation = useMutation(
    (id: string) => apiClient.deleteUser(id),
    {
      onSuccess: () => {
        toast.success('Xóa user thành công!');
        queryClient.invalidateQueries('users');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Xóa user thất bại');
      },
    }
  );

  const users = usersData?.data?.users || [];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'ORG_ADMIN':
        return 'bg-blue-100 text-blue-800';
      case 'USER':
        return 'bg-green-100 text-green-800';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(newUser);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    updateUserMutation.mutate({ id: selectedUser.id, data });
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa user này?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  if (!hasPermission('user.manage')) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Không có quyền truy cập</h3>
        <p className="mt-1 text-sm text-gray-500">
          Bạn không có quyền quản lý user.
        </p>
      </div>
    );
  }

  if (isLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Quản Lý User</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý người dùng và phân quyền trong hệ thống
          </p>
        </div>
        
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tạo User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Tổng User</p>
              <p className="text-2xl font-semibold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <UserCheck className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users.filter((u: any) => u.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Admin</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users.filter((u: any) => u.role === 'ADMIN').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <UserX className="h-8 w-8 text-gray-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users.filter((u: any) => u.status !== 'active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Danh Sách User ({users.length})
          </h3>
        </div>
        
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ngày tạo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.username}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.organization || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="btn-outline text-sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Xem
                        </button>
                        <button
                          onClick={() => setSelectedUser({ ...user, action: 'edit' })}
                          className="btn-outline text-sm"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="btn-error text-sm"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Tạo User Mới</h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    name="username"
                    className="input"
                    value={newUser.username}
                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    name="email"
                    className="input"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    name="password"
                    className="input"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Role</label>
                  <select
                    name="role"
                    className="input"
                    value={newUser.role}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="USER">User</option>
                    <option value="ORG_ADMIN">Org Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
                
                <div>
                  <label className="label">Organization</label>
                  <input
                    type="text"
                    name="organization"
                    className="input"
                    value={newUser.organization}
                    onChange={(e) => setNewUser(prev => ({ ...prev, organization: e.target.value }))}
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="btn-outline"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isLoading}
                    className="btn-primary"
                  >
                    {createUserMutation.isLoading ? 'Đang tạo...' : 'Tạo User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Detail/Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedUser.action === 'edit' ? 'Chỉnh Sửa User' : 'Chi Tiết User'}
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              {selectedUser.action === 'edit' ? (
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div>
                    <label className="label">Username</label>
                    <input
                      type="text"
                      name="username"
                      className="input"
                      defaultValue={selectedUser.username}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      name="email"
                      className="input"
                      defaultValue={selectedUser.email}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">Role</label>
                    <select
                      name="role"
                      className="input"
                      defaultValue={selectedUser.role}
                    >
                      <option value="USER">User</option>
                      <option value="ORG_ADMIN">Org Admin</option>
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Status</label>
                    <select
                      name="status"
                      className="input"
                      defaultValue={selectedUser.status}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Organization</label>
                    <input
                      type="text"
                      name="organization"
                      className="input"
                      defaultValue={selectedUser.organization || ''}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="btn-outline"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={updateUserMutation.isLoading}
                      className="btn-primary"
                    >
                      {updateUserMutation.isLoading ? 'Đang cập nhật...' : 'Cập nhật'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Username</label>
                      <p className="text-sm text-gray-900">{selectedUser.username}</p>
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <p className="text-sm text-gray-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="label">Role</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                        {selectedUser.role}
                      </span>
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedUser.status)}`}>
                        {selectedUser.status}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">Organization</label>
                    <p className="text-sm text-gray-900">{selectedUser.organization || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="label">Ngày tạo</label>
                    <p className="text-sm text-gray-900">
                      {format(new Date(selectedUser.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </p>
                  </div>
                  
                  {selectedUser.last_login && (
                    <div>
                      <label className="label">Lần đăng nhập cuối</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedUser.last_login), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="btn-outline"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
