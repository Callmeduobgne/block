"""
Backend Phase 3 - WebSocket Service for Real-time Updates
"""
import socketio
from typing import Dict, Any
import asyncio
from app.config import settings

class WebSocketService:
    def __init__(self):
        self.sio = socketio.AsyncServer(
            cors_allowed_origins=settings.BACKEND_CORS_ORIGINS,
            logger=True,
            engineio_logger=True
        )
        self.app = socketio.ASGIApp(self.sio)
        self.connected_clients: Dict[str, Any] = {}
        
    def setup_handlers(self):
        """Setup WebSocket event handlers"""
        
        @self.sio.event
        async def connect(sid, environ, auth):
            """Handle client connection"""
            print(f"Client {sid} connected")
            self.connected_clients[sid] = {
                'connected_at': asyncio.get_event_loop().time(),
                'user_id': None
            }
            
        @self.sio.event
        async def disconnect(sid):
            """Handle client disconnection"""
            print(f"Client {sid} disconnected")
            if sid in self.connected_clients:
                del self.connected_clients[sid]
                
        @self.sio.event
        async def join_deployment(sid, data):
            """Join deployment room for real-time updates"""
            deployment_id = data.get('deployment_id')
            if deployment_id:
                await self.sio.enter_room(sid, f"deployment_{deployment_id}")
                print(f"Client {sid} joined deployment room {deployment_id}")
                
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
        """Emit deployment update to all clients in the deployment room"""
        await self.sio.emit(
            'deployment_update',
            data,
            room=f"deployment_{deployment_id}"
        )
        
    async def emit_chaincode_update(self, chaincode_id: str, data: Dict[str, Any]):
        """Emit chaincode update to all clients in the chaincode room"""
        await self.sio.emit(
            'chaincode_update',
            data,
            room=f"chaincode_{chaincode_id}"
        )
        
    async def emit_notification(self, data: Dict[str, Any]):
        """Emit general notification to all connected clients"""
        await self.sio.emit('notification', data)
        
    async def emit_to_user(self, user_id: str, event: str, data: Dict[str, Any]):
        """Emit event to specific user"""
        # Find client by user_id (would need to implement user tracking)
        for sid, client_info in self.connected_clients.items():
            if client_info.get('user_id') == user_id:
                await self.sio.emit(event, data, room=sid)
                break

# Global WebSocket service instance
websocket_service = WebSocketService()
websocket_service.setup_handlers()
