import { useEffect, useState } from 'react';
import webSocketService, { DeploymentUpdate, ChaincodeUpdate, WebSocketMessage } from '../services/websocket';
import { useAuth } from './useAuth';

export const useWebSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('access_token');
      if (token) {
        webSocketService.connect(token);
        setIsConnected(true);
      }
    } else {
      webSocketService.disconnect();
      setIsConnected(false);
    }

    return () => {
      webSocketService.disconnect();
    };
  }, [user]);

  return {
    isConnected,
    webSocketService,
  };
};

export const useDeploymentUpdates = (deploymentId?: string) => {
  const [updates, setUpdates] = useState<DeploymentUpdate[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<DeploymentUpdate | null>(null);

  useEffect(() => {
    if (!deploymentId) return;

    const unsubscribe = webSocketService.subscribe('deployment_update', (data: DeploymentUpdate) => {
      if (data.deployment_id === deploymentId) {
        setUpdates(prev => [...prev, data]);
        setLatestUpdate(data);
      }
    });

    // Join deployment room
    webSocketService.joinDeploymentRoom(deploymentId);

    return () => {
      unsubscribe();
      webSocketService.leaveDeploymentRoom(deploymentId);
    };
  }, [deploymentId]);

  return { updates, latestUpdate };
};

export const useChaincodeUpdates = (chaincodeId?: string) => {
  const [updates, setUpdates] = useState<ChaincodeUpdate[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<ChaincodeUpdate | null>(null);

  useEffect(() => {
    if (!chaincodeId) return;

    const unsubscribe = webSocketService.subscribe('chaincode_update', (data: ChaincodeUpdate) => {
      if (data.chaincode_id === chaincodeId) {
        setUpdates(prev => [...prev, data]);
        setLatestUpdate(data);
      }
    });

    // Join chaincode room
    webSocketService.joinChaincodeRoom(chaincodeId);

    return () => {
      unsubscribe();
      webSocketService.leaveChaincodeRoom(chaincodeId);
    };
  }, [chaincodeId]);

  return { updates, latestUpdate };
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<WebSocketMessage[]>([]);

  useEffect(() => {
    const unsubscribe = webSocketService.subscribe('notification', (data: WebSocketMessage) => {
      setNotifications(prev => [...prev, data]);
    });

    return unsubscribe;
  }, []);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return { notifications, clearNotifications };
};
