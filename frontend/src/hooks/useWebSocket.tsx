import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface WebSocketHookReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): WebSocketHookReturn => {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 3000,
  } = options;

  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      // WebSocket goes directly to Backend (not through API Gateway)
      // Backend has WebSocket service mounted at /ws
      const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:8000';
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        auth: {
          user_id: user?.id,
          token: localStorage.getItem('access_token'),
        },
        reconnection: true,
        reconnectionAttempts: reconnectAttempts,
        reconnectionDelay: reconnectDelay,
      });

      socket.on('connect', () => {
        console.log('WebSocket connected:', socket.id);
        setIsConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, manually reconnect
          if (reconnectCountRef.current < reconnectAttempts) {
            reconnectCountRef.current++;
            reconnectTimerRef.current = setTimeout(() => {
              socket.connect();
            }, reconnectDelay);
          } else {
            setError('Failed to reconnect to server');
          }
        }
      });

      socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err.message);
        setError(`Connection error: ${err.message}`);
        setIsConnected(false);
      });

      socket.on('error', (err) => {
        console.error('WebSocket error:', err);
        setError(`Socket error: ${err}`);
      });

      socketRef.current = socket;
    } catch (err: any) {
      console.error('Failed to create WebSocket connection:', err);
      setError(`Failed to connect: ${err.message}`);
    }
  }, [user, reconnectAttempts, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      console.log('WebSocket manually disconnected');
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Cannot emit event: WebSocket not connected');
    }
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_room', { room });
      console.log('Joined room:', room);
    }
  }, []);

  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_room', { room });
      console.log('Left room:', room);
    }
  }, []);

  // Auto connect/disconnect based on authentication
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
};

// Legacy export for backward compatibility
export default useWebSocket;

// Additional specialized hooks for specific use cases
export interface DeploymentUpdate {
  deployment_id: string;
  status: string;
  progress?: number;
  message?: string;
  error?: string;
}

export interface ChaincodeUpdate {
  chaincode_id: string;
  action: string;
  chaincode: any;
  message?: string;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export const useDeploymentUpdates = (deploymentId?: string) => {
  const [updates, setUpdates] = useState<DeploymentUpdate[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<DeploymentUpdate | null>(null);
  const { on, off, isConnected } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    if (!deploymentId || !isConnected) return;

    const handleUpdate = (data: DeploymentUpdate) => {
      if (data.deployment_id === deploymentId) {
        setUpdates(prev => [...prev, data]);
        setLatestUpdate(data);
      }
    };

    on('deployment_update', handleUpdate);

    return () => {
      off('deployment_update', handleUpdate);
    };
  }, [deploymentId, isConnected, on, off]);

  return { updates, latestUpdate };
};

export const useChaincodeUpdates = (chaincodeId?: string) => {
  const [updates, setUpdates] = useState<ChaincodeUpdate[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<ChaincodeUpdate | null>(null);
  const { on, off, isConnected } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    if (!chaincodeId || !isConnected) return;

    const handleUpdate = (data: ChaincodeUpdate) => {
      if (data.chaincode_id === chaincodeId) {
        setUpdates(prev => [...prev, data]);
        setLatestUpdate(data);
      }
    };

    on('chaincode_update', handleUpdate);

    return () => {
      off('chaincode_update', handleUpdate);
    };
  }, [chaincodeId, isConnected, on, off]);

  return { updates, latestUpdate };
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<WebSocketMessage[]>([]);
  const { on, off, isConnected } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    if (!isConnected) return;

    const handleNotification = (data: WebSocketMessage) => {
      setNotifications(prev => [...prev, data]);
    };

    on('notification', handleNotification);

    return () => {
      off('notification', handleNotification);
    };
  }, [isConnected, on, off]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return { notifications, clearNotifications };
};

