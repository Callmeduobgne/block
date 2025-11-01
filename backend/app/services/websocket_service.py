"""
Backend Phase 3 - WebSocket Service for Real-time Updates

Features:
- Real-time deployment progress updates
- Chaincode status notifications
- User-specific event broadcasting
- Room-based event management
- Automatic reconnection support
"""
import socketio
from typing import Dict, Any, Optional
import asyncio
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class WebSocketService:
    def __init__(self):
        self.sio = socketio.AsyncServer(
            cors_allowed_origins=settings.BACKEND_CORS_ORIGINS,
            logger=False,  # Use our custom logger
            engineio_logger=False,
            async_mode='asgi',
            ping_timeout=60,
            ping_interval=25
        )
        self.app = socketio.ASGIApp(self.sio)
        self.connected_clients: Dict[str, Dict[str, Any]] = {}
        logger.info("WebSocket service initialized")
        
    def setup_handlers(self):
        """Setup WebSocket event handlers"""
        
        @self.sio.event
        async def connect(sid, environ, auth):
            """Handle client connection"""
            user_id = auth.get('user_id') if auth else None
            logger.info(f"Client {sid} connected (user_id: {user_id})")
            self.connected_clients[sid] = {
                'connected_at': asyncio.get_event_loop().time(),
                'user_id': user_id,
                'rooms': set()
            }
            await self.sio.emit('connected', {'sid': sid, 'status': 'success'}, room=sid)
            
        @self.sio.event
        async def disconnect(sid):
            """Handle client disconnection"""
            client_info = self.connected_clients.get(sid, {})
            logger.info(f"Client {sid} disconnected (user_id: {client_info.get('user_id')})")
            if sid in self.connected_clients:
                del self.connected_clients[sid]
                
        @self.sio.event
        async def join_deployment(sid, data):
            """Join deployment room for real-time updates"""
            deployment_id = data.get('deployment_id')
            if deployment_id:
                room_name = f"deployment_{deployment_id}"
                await self.sio.enter_room(sid, room_name)
                if sid in self.connected_clients:
                    self.connected_clients[sid]['rooms'].add(room_name)
                logger.info(f"Client {sid} joined deployment room {deployment_id}")
                
        @self.sio.event
        async def leave_deployment(sid, data):
            """Leave deployment room"""
            deployment_id = data.get('deployment_id')
            if deployment_id:
                await self.sio.leave_room(sid, f"deployment_{deployment_id}")
                print(f"Client {sid} left deployment room {deployment_id}")
                
        @self.sio.event
        async def join_chaincode(sid, data):
            """Join chaincode room for real-time updates"""
            chaincode_id = data.get('chaincode_id')
            if chaincode_id:
                await self.sio.enter_room(sid, f"chaincode_{chaincode_id}")
                print(f"Client {sid} joined chaincode room {chaincode_id}")
                
        @self.sio.event
        async def leave_chaincode(sid, data):
            """Leave chaincode room"""
            chaincode_id = data.get('chaincode_id')
            if chaincode_id:
                await self.sio.leave_room(sid, f"chaincode_{chaincode_id}")
                print(f"Client {sid} left chaincode room {chaincode_id}")
    
    async def emit_deployment_update(self, deployment_id: str, data: Dict[str, Any]):
        """
        Emit deployment update to all clients in the deployment room
        
        Args:
            deployment_id: Deployment UUID
            data: Update payload including status, progress, logs
        """
        try:
            room = f"deployment_{deployment_id}"
            await self.sio.emit('deployment_update', data, room=room)
            logger.debug(f"Emitted deployment update to room {room}")
        except Exception as e:
            logger.error(f"Failed to emit deployment update: {str(e)}")
        
    async def emit_chaincode_update(self, chaincode_id: str, data: Dict[str, Any]):
        """
        Emit chaincode update to all clients in the chaincode room
        
        Args:
            chaincode_id: Chaincode UUID
            data: Update payload including status, validation results
        """
        try:
            room = f"chaincode_{chaincode_id}"
            await self.sio.emit('chaincode_update', data, room=room)
            logger.debug(f"Emitted chaincode update to room {room}")
        except Exception as e:
            logger.error(f"Failed to emit chaincode update: {str(e)}")
        
    async def emit_notification(self, data: Dict[str, Any], level: str = "info"):
        """
        Emit general notification to all connected clients
        
        Args:
            data: Notification payload
            level: Notification level (info, warning, error, success)
        """
        try:
            payload = {**data, "level": level}
            await self.sio.emit('notification', payload)
            logger.debug(f"Emitted notification (level: {level})")
        except Exception as e:
            logger.error(f"Failed to emit notification: {str(e)}")
        
    async def emit_to_user(self, user_id: str, event: str, data: Dict[str, Any]):
        """
        Emit event to specific user
        
        Args:
            user_id: Target user UUID
            event: Event name
            data: Event payload
        """
        try:
            sent = False
            for sid, client_info in self.connected_clients.items():
                if client_info.get('user_id') == user_id:
                    await self.sio.emit(event, data, room=sid)
                    sent = True
                    logger.debug(f"Emitted {event} to user {user_id} (sid: {sid})")
                    break
            
            if not sent:
                logger.warning(f"User {user_id} not connected, event {event} not sent")
        except Exception as e:
            logger.error(f"Failed to emit to user: {str(e)}")
    
    def get_connected_count(self) -> int:
        """Get number of connected clients"""
        return len(self.connected_clients)
    
    def get_room_members(self, room_name: str) -> int:
        """Get number of clients in a specific room"""
        count = sum(1 for client in self.connected_clients.values() 
                   if room_name in client.get('rooms', set()))
        return count

# Global WebSocket service instance
websocket_service = WebSocketService()
websocket_service.setup_handlers()
