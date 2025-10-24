import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface DeploymentUpdate {
  deployment_id: string;
  status: string;
  progress?: number;
  message?: string;
  error?: string;
}

export interface ChaincodeUpdate {
  chaincode_id: string;
  status: string;
  message?: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:4000', {
      auth: {
        token: token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Listen for deployment updates
    this.socket.on('deployment_update', (data: DeploymentUpdate) => {
      this.notifyListeners('deployment_update', data);
    });

    // Listen for chaincode updates
    this.socket.on('chaincode_update', (data: ChaincodeUpdate) => {
      this.notifyListeners('chaincode_update', data);
    });

    // Listen for general notifications
    this.socket.on('notification', (data: WebSocketMessage) => {
      this.notifyListeners('notification', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  private notifyListeners(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Join deployment room for real-time updates
  joinDeploymentRoom(deploymentId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_deployment', { deployment_id: deploymentId });
    }
  }

  // Leave deployment room
  leaveDeploymentRoom(deploymentId: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave_deployment', { deployment_id: deploymentId });
    }
  }

  // Join chaincode room for real-time updates
  joinChaincodeRoom(chaincodeId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_chaincode', { chaincode_id: chaincodeId });
    }
  }

  // Leave chaincode room
  leaveChaincodeRoom(chaincodeId: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave_chaincode', { chaincode_id: chaincodeId });
    }
  }

  // Send custom message
  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
