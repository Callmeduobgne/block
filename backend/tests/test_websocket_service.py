"""
Test suite for WebSocket Service
Tests real-time communication functionality
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from app.services.websocket_service import WebSocketService


class TestWebSocketService:
    """Test cases for WebSocketService"""
    
    @pytest.fixture
    def websocket_service(self):
        """Create websocket service instance"""
        with patch('app.services.websocket_service.settings') as mock_settings:
            mock_settings.BACKEND_CORS_ORIGINS = ["http://localhost:3000"]
            service = WebSocketService()
            service.setup_handlers()
            return service
    
    @pytest.mark.asyncio
    async def test_emit_deployment_update(self, websocket_service):
        """Test emitting deployment update"""
        # Arrange
        deployment_id = "test-deployment-123"
        update_data = {
            "status": "deploying",
            "progress": 50,
            "message": "Installing chaincode..."
        }
        
        # Mock the emit method
        websocket_service.sio.emit = AsyncMock()
        
        # Act
        await websocket_service.emit_deployment_update(deployment_id, update_data)
        
        # Assert
        websocket_service.sio.emit.assert_called_once_with(
            'deployment_update',
            update_data,
            room=f"deployment_{deployment_id}"
        )
    
    @pytest.mark.asyncio
    async def test_emit_chaincode_update(self, websocket_service):
        """Test emitting chaincode update"""
        # Arrange
        chaincode_id = "test-chaincode-456"
        update_data = {
            "status": "validated",
            "message": "Chaincode validation successful"
        }
        
        # Mock the emit method
        websocket_service.sio.emit = AsyncMock()
        
        # Act
        await websocket_service.emit_chaincode_update(chaincode_id, update_data)
        
        # Assert
        websocket_service.sio.emit.assert_called_once_with(
            'chaincode_update',
            update_data,
            room=f"chaincode_{chaincode_id}"
        )
    
    @pytest.mark.asyncio
    async def test_emit_notification(self, websocket_service):
        """Test emitting general notification"""
        # Arrange
        notification_data = {
            "title": "System Update",
            "message": "New feature available"
        }
        
        # Mock the emit method
        websocket_service.sio.emit = AsyncMock()
        
        # Act
        await websocket_service.emit_notification(notification_data, level="info")
        
        # Assert
        websocket_service.sio.emit.assert_called_once()
        call_args = websocket_service.sio.emit.call_args
        assert call_args[0][0] == 'notification'
        assert call_args[0][1]['level'] == 'info'
        assert call_args[0][1]['title'] == notification_data['title']
    
    @pytest.mark.asyncio
    async def test_emit_to_user(self, websocket_service):
        """Test emitting event to specific user"""
        # Arrange
        user_id = "user-789"
        sid = "session-123"
        event_name = "custom_event"
        event_data = {"key": "value"}
        
        # Add connected client
        websocket_service.connected_clients[sid] = {
            'user_id': user_id,
            'connected_at': 1234567890,
            'rooms': set()
        }
        
        # Mock the emit method
        websocket_service.sio.emit = AsyncMock()
        
        # Act
        await websocket_service.emit_to_user(user_id, event_name, event_data)
        
        # Assert
        websocket_service.sio.emit.assert_called_once_with(
            event_name,
            event_data,
            room=sid
        )
    
    @pytest.mark.asyncio
    async def test_emit_to_user_not_connected(self, websocket_service):
        """Test emitting to user who is not connected"""
        # Arrange
        user_id = "user-not-connected"
        event_name = "test_event"
        event_data = {"message": "test"}
        
        # Mock the emit method
        websocket_service.sio.emit = AsyncMock()
        
        # Act
        await websocket_service.emit_to_user(user_id, event_name, event_data)
        
        # Assert
        # Should not emit if user not connected
        websocket_service.sio.emit.assert_not_called()
    
    def test_get_connected_count(self, websocket_service):
        """Test getting connected client count"""
        # Arrange
        websocket_service.connected_clients = {
            'sid1': {'user_id': 'user1', 'rooms': set()},
            'sid2': {'user_id': 'user2', 'rooms': set()},
            'sid3': {'user_id': 'user3', 'rooms': set()},
        }
        
        # Act
        count = websocket_service.get_connected_count()
        
        # Assert
        assert count == 3
    
    def test_get_room_members(self, websocket_service):
        """Test getting room member count"""
        # Arrange
        room_name = "deployment_test-123"
        websocket_service.connected_clients = {
            'sid1': {'user_id': 'user1', 'rooms': {room_name, 'other_room'}},
            'sid2': {'user_id': 'user2', 'rooms': {room_name}},
            'sid3': {'user_id': 'user3', 'rooms': {'different_room'}},
        }
        
        # Act
        count = websocket_service.get_room_members(room_name)
        
        # Assert
        assert count == 2
    
    @pytest.mark.asyncio
    async def test_error_handling_in_emit(self, websocket_service):
        """Test error handling when emit fails"""
        # Arrange
        deployment_id = "test-deployment"
        update_data = {"status": "test"}
        
        # Mock emit to raise exception
        async def mock_emit_error(*args, **kwargs):
            raise Exception("Network error")
        
        websocket_service.sio.emit = mock_emit_error
        
        # Act & Assert
        # Should not raise exception, just log error
        try:
            await websocket_service.emit_deployment_update(deployment_id, update_data)
            # If we reach here, error was handled gracefully
            assert True
        except Exception:
            pytest.fail("Exception should have been caught and logged")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

