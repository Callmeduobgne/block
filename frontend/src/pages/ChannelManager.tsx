import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Eye, RefreshCw, Network } from 'lucide-react';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Modal } from '../components/ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table } from '../components/ui/table';
import type { TableColumn } from '../components/ui/table';
import Select from '../components/ui/select';

interface Channel {
  id: string;
  name: string;
  description?: string;
  status: string;
  organizations: string[];
  created_at: string;
  updated_at: string;
}

interface ChannelCreate {
  name: string;
  description?: string;
  organizations?: string[];
}

interface ChannelStats {
  total_channels: number;
  active_channels: number;
  pending_channels: number;
}

const ChannelManager: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [newChannel, setNewChannel] = useState<ChannelCreate>({
    name: '',
    description: '',
    organizations: []
  });
  const [editChannel, setEditChannel] = useState<ChannelCreate>({
    name: '',
    description: '',
    organizations: []
  });

  const queryClient = useQueryClient();

  // Fetch channels
  const { data: channelsData, isLoading: isLoadingChannels, refetch: refetchChannels } = useQuery(
    'channels',
    () => apiClient.get('/channels'),
    {
      refetchInterval: 30000,
      onError: (error: any) => {
        toast.error(`Failed to fetch channels: ${error.message}`);
      },
    }
  );

  // Fetch channel stats
  const { data: statsData, isLoading: isLoadingStats } = useQuery(
    'channelStats',
    () => apiClient.get('/channels/stats'),
    {
      refetchInterval: 60000,
      onError: (error: any) => {
        toast.error(`Failed to fetch channel stats: ${error.message}`);
      },
    }
  );

  // Create channel mutation
  const createChannelMutation = useMutation(
    (channelData: ChannelCreate) => apiClient.post('/channels', channelData),
    {
      onSuccess: () => {
        toast.success('Channel created successfully!');
        setIsCreateModalOpen(false);
        setNewChannel({ name: '', description: '', organizations: [] });
        queryClient.invalidateQueries('channels');
        queryClient.invalidateQueries('channelStats');
      },
      onError: (error: any) => {
        toast.error(`Failed to create channel: ${error.message}`);
      },
    }
  );

  // Update channel mutation
  const updateChannelMutation = useMutation(
    ({ id, data }: { id: string; data: ChannelCreate }) => 
      apiClient.put(`/channels/${id}`, data),
    {
      onSuccess: () => {
        toast.success('Channel updated successfully!');
        setIsEditModalOpen(false);
        setSelectedChannel(null);
        queryClient.invalidateQueries('channels');
        queryClient.invalidateQueries('channelStats');
      },
      onError: (error: any) => {
        toast.error(`Failed to update channel: ${error.message}`);
      },
    }
  );

  // Delete channel mutation
  const deleteChannelMutation = useMutation(
    (id: string) => apiClient.delete(`/channels/${id}`),
    {
      onSuccess: () => {
        toast.success('Channel deleted successfully!');
        queryClient.invalidateQueries('channels');
        queryClient.invalidateQueries('channelStats');
      },
      onError: (error: any) => {
        toast.error(`Failed to delete channel: ${error.message}`);
      },
    }
  );

  const handleCreateChannel = () => {
    if (!newChannel.name.trim()) {
      toast.error('Channel name is required');
      return;
    }
    createChannelMutation.mutate(newChannel);
  };

  const handleEditChannel = () => {
    if (!selectedChannel || !editChannel.name.trim()) {
      toast.error('Channel name is required');
      return;
    }
    updateChannelMutation.mutate({ id: selectedChannel.id, data: editChannel });
  };

  const handleDeleteChannel = (channel: Channel) => {
    if (window.confirm(`Are you sure you want to delete channel "${channel.name}"?`)) {
      deleteChannelMutation.mutate(channel.id);
    }
  };

  const openEditModal = (channel: Channel) => {
    setSelectedChannel(channel);
    setEditChannel({
      name: channel.name,
      description: channel.description || '',
      organizations: channel.organizations || []
    });
    setIsEditModalOpen(true);
  };

  const openDetailsModal = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsDetailsModalOpen(true);
  };

  const handleRefresh = () => {
    refetchChannels();
    toast.success('Channel data refreshed!');
  };

  if (isLoadingChannels || isLoadingStats) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const channels = ((channelsData?.data as any)?.channels || []) as Channel[];
  const stats = statsData?.data as any || { total_channels: 0, active_channels: 0, pending_channels: 0 };

  const columns: TableColumn<Channel>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-medium',
    },
    {
      key: 'description',
      header: 'Description',
      className: 'text-sm text-gray-600 dark:text-gray-300',
      render: (value) => (value as string)?.trim() || 'No description',
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, channel) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            channel.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : channel.status === 'pending'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {channel.status}
        </span>
      ),
    },
    {
      key: 'organizations',
      header: 'Organizations',
      className: 'text-sm',
      render: (_, channel) => `${channel.organizations?.length || 0} orgs`,
    },
    {
      key: 'created_at',
      header: 'Created',
      className: 'text-sm text-gray-600 dark:text-gray-300',
      render: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-[160px]',
      render: (_, channel) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => openDetailsModal(channel)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(channel)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteChannel(channel)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Channel Manager</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Channel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center">
              <Network className="h-5 w-5 mr-2" /> Total Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total_channels}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-200">Active Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">{stats.active_channels}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-200">Pending Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending_channels}</p>
          </CardContent>
        </Card>
      </div>

      {/* Channels Table */}
      <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-200">Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={channels}
            keyExtractor={(channel) => channel.id}
            emptyMessage="No channels found."
            striped
            hoverable
          />
        </CardContent>
      </Card>

      {/* Create Channel Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Channel">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Channel Name</Label>
            <Input
              id="name"
              value={newChannel.name}
              onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
              placeholder="Enter channel name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newChannel.description}
              onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
              placeholder="Enter channel description"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateChannel}
              disabled={createChannelMutation.isLoading}
            >
              {createChannelMutation.isLoading ? 'Creating...' : 'Create Channel'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Channel Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Channel">
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Channel Name</Label>
            <Input
              id="edit-name"
              value={editChannel.name}
              onChange={(e) => setEditChannel({ ...editChannel, name: e.target.value })}
              placeholder="Enter channel name"
            />
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={editChannel.description}
              onChange={(e) => setEditChannel({ ...editChannel, description: e.target.value })}
              placeholder="Enter channel description"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditChannel}
              disabled={updateChannelMutation.isLoading}
            >
              {updateChannelMutation.isLoading ? 'Updating...' : 'Update Channel'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Channel Details Modal */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`Channel Details: ${selectedChannel?.name}`}>
        {selectedChannel && (
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <Label className="font-semibold">Name:</Label>
              <p className="text-sm">{selectedChannel.name}</p>
            </div>
            <div>
              <Label className="font-semibold">Description:</Label>
              <p className="text-sm">{selectedChannel.description || 'No description'}</p>
            </div>
            <div>
              <Label className="font-semibold">Status:</Label>
              <p className="text-sm">{selectedChannel.status}</p>
            </div>
            <div>
              <Label className="font-semibold">Organizations:</Label>
              <p className="text-sm">{selectedChannel.organizations?.join(', ') || 'None'}</p>
            </div>
            <div>
              <Label className="font-semibold">Created:</Label>
              <p className="text-sm">{new Date(selectedChannel.created_at).toLocaleString()}</p>
            </div>
            <div>
              <Label className="font-semibold">Last Updated:</Label>
              <p className="text-sm">{new Date(selectedChannel.updated_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChannelManager;
