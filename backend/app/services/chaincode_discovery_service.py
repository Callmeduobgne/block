"""
Auto-Discovery Service for Chaincodes deployed via CLI
Discovers chaincodes from blockchain and syncs to database
"""
import httpx
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import uuid4

from app.models.chaincode import Chaincode
from app.config import settings

logger = logging.getLogger(__name__)


class ChaincodeDiscoveryService:
    def __init__(self, db: Session):
        self.db = db
        self.gateway_url = settings.FABRIC_GATEWAY_URL or "http://fabric-gateway:3001"
        self.channel_name = "ibnchannel"
        self.peer_endpoint = "peer0.org1.example.com:7051"
    
    async def discover_and_sync(self) -> Dict[str, Any]:
        """
        Discover chaincodes from blockchain and sync to database
        
        Returns:
            Dict with discovered chaincode info
        """
        try:
            logger.info("Starting chaincode discovery from blockchain...")
            
            # Query committed chaincodes from blockchain via Gateway
            committed_chaincodes = await self._query_committed_chaincodes()
            
            if not committed_chaincodes:
                logger.info("No committed chaincodes found on blockchain")
                return {
                    "success": True,
                    "discovered": [],
                    "count": 0,
                    "message": "No new chaincodes discovered"
                }
            
            # Sync with database
            discovered = []
            for cc in committed_chaincodes:
                synced = await self._sync_chaincode_to_db(cc)
                if synced:
                    discovered.append({
                        "name": cc["name"],
                        "version": cc["version"],
                        "sequence": cc.get("sequence")
                    })
            
            logger.info(f"Discovery complete. Found {len(discovered)} new chaincodes")
            
            return {
                "success": True,
                "discovered": discovered,
                "count": len(discovered),
                "message": f"Discovered {len(discovered)} new chaincode(s)"
            }
            
        except Exception as e:
            logger.error(f"Chaincode discovery failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Discovery failed"
            }
    
    async def _query_committed_chaincodes(self) -> List[Dict[str, Any]]:
        """Query committed chaincodes from Gateway"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.gateway_url}/api/chaincode/committed",
                    params={
                        "channelName": self.channel_name,
                        "peerEndpoint": self.peer_endpoint
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Gateway returned status {response.status_code}")
                    return []
                
                data = response.json()
                
                if not data.get("success"):
                    logger.error(f"Gateway returned error: {data.get('error')}")
                    return []
                
                chaincodes = data.get("data", {}).get("chaincodes", [])
                logger.info(f"Found {len(chaincodes)} committed chaincodes on blockchain")
                
                return chaincodes
                
        except httpx.TimeoutException:
            logger.error("Timeout connecting to Gateway")
            return []
        except Exception as e:
            logger.error(f"Failed to query committed chaincodes: {str(e)}")
            return []
    
    async def _sync_chaincode_to_db(self, chaincode_info: Dict[str, Any]) -> bool:
        """
        Sync chaincode from blockchain to database
        
        Returns:
            True if new chaincode was added, False if already exists
        """
        try:
            name = chaincode_info["name"]
            version = chaincode_info["version"]
            sequence = chaincode_info.get("sequence")
            
            # Check if already exists
            existing = self.db.query(Chaincode).filter(
                Chaincode.name == name,
                Chaincode.version == version
            ).first()
            
            if existing:
                logger.info(f"Chaincode {name} v{version} already exists in database")
                
                # Update status if different
                if existing.status != "active":
                    logger.info(f"Updating status of {name} to 'active'")
                    existing.status = "active"
                    existing.updated_at = datetime.now()
                    self.db.commit()
                
                return False
            
            # Create new chaincode record
            logger.info(f"Adding new chaincode {name} v{version} to database")
            
            new_chaincode = Chaincode(
                id=uuid4(),
                name=name,
                version=version,
                source_code="# Auto-discovered from blockchain",
                description=f"Chaincode discovered from blockchain channel '{self.channel_name}'",
                language=self._detect_language(name),
                status="active",
                uploaded_by=None,  # System-discovered
                approved_by=None,
                chaincode_metadata={
                    "discovered": True,
                    "channel": self.channel_name,
                    "sequence": sequence,
                    "peer": self.peer_endpoint,
                    "discovered_at": datetime.now().isoformat(),
                    "endorsement_plugin": chaincode_info.get("endorsement_plugin"),
                    "validation_plugin": chaincode_info.get("validation_plugin")
                },
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            self.db.add(new_chaincode)
            self.db.commit()
            
            logger.info(f"Successfully added {name} v{version} to database")
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync chaincode {chaincode_info.get('name')}: {str(e)}")
            self.db.rollback()
            return False
    
    def _detect_language(self, chaincode_name: str) -> str:
        """Detect chaincode language from name (heuristic)"""
        name_lower = chaincode_name.lower()
        
        if "go" in name_lower or "basic" in name_lower:
            return "golang"
        elif "node" in name_lower or "js" in name_lower or "grade" in name_lower:
            return "node"
        elif "java" in name_lower:
            return "java"
        else:
            return "node"  # default


