"""
Backend Phase 3 - Sandbox Service
Implements safe chaincode validation environment from mainflow.md section 9
"""
import os
import subprocess
import tempfile
import shutil
from typing import Dict, Any
import json

from app.utils.archive_utils import (
    is_archive_source,
    extract_archive_source,
    find_first_source_file,
)


class SandboxService:
    """
    Provides isolated environment for chaincode validation
    Prevents malicious code from affecting production ledger
    """
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix="chaincode_sandbox_")
    
    def __del__(self):
        """Cleanup temporary directory"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def validate_chaincode_in_sandbox(
        self, 
        chaincode_name: str,
        chaincode_source: str,
        language: str = "golang"
    ) -> Dict[str, Any]:
        """
        Validate chaincode in isolated sandbox environment
        Returns validation result with detailed error messages
        """
        try:
            # Create temporary chaincode directory
            cc_dir = os.path.join(self.temp_dir, chaincode_name)
            os.makedirs(cc_dir, exist_ok=True)

            if language == "golang":
                source_file = os.path.join(cc_dir, "main.go")
                with open(source_file, 'w') as f:
                    f.write(chaincode_source)
                return self._validate_golang_chaincode(cc_dir, source_file)

            if language in {"javascript", "typescript"}:
                if is_archive_source(chaincode_source):
                    extract_archive_source(chaincode_source, cc_dir, clean=True)
                    preferred_dirs = ["src", "dist", "."]
                    extensions = [".ts", ".tsx"] if language == "typescript" else [".js"]
                    source_file = find_first_source_file(cc_dir, extensions, preferred_dirs)
                    if not source_file:
                        return {
                            "success": False,
                            "errors": ["Không tìm thấy file nguồn phù hợp trong gói chaincode"],
                            "language": language,
                        }
                else:
                    source_file = os.path.join(cc_dir, "index.ts" if language == "typescript" else "index.js")
                    with open(source_file, 'w') as f:
                        f.write(chaincode_source)

                if language == "javascript":
                    return self._validate_javascript_chaincode(cc_dir, source_file)
                if language == "typescript":
                    return self._validate_typescript_chaincode(cc_dir, source_file)

            return {
                "success": False,
                "error": f"Unsupported language: {language}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Sandbox validation error: {str(e)}"
            }
    
    def _validate_golang_chaincode(self, cc_dir: str, source_file: str) -> Dict[str, Any]:
        """Validate Go chaincode"""
        errors = []
        warnings = []
        
        try:
            # Check for required imports
            with open(source_file, 'r') as f:
                content = f.read()
                
                required_imports = [
                    'github.com/hyperledger/fabric-contract-api-go/contractapi'
                ]
                
                for imp in required_imports:
                    if imp not in content:
                        warnings.append(f"Missing recommended import: {imp}")
                
                # Check for required functions
                if 'type SmartContract struct' not in content:
                    errors.append("Missing SmartContract struct definition")
                
                if 'func (s *SmartContract)' not in content:
                    errors.append("No SmartContract methods found")
            
            # Try to compile (if Go is available)
            try:
                result = subprocess.run(
                    ['go', 'build', '-o', '/dev/null', source_file],
                    cwd=cc_dir,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode != 0:
                    errors.append(f"Compilation failed: {result.stderr}")
                
            except FileNotFoundError:
                warnings.append("Go compiler not available, skipping compilation check")
            except subprocess.TimeoutExpired:
                errors.append("Compilation timeout (30s exceeded)")
            
            return {
                "success": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "language": "golang"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Go validation error: {str(e)}"
            }
    
    def _validate_javascript_chaincode(self, cc_dir: str, source_file: str) -> Dict[str, Any]:
        """Validate JavaScript chaincode"""
        errors = []
        warnings = []
        
        try:
            with open(source_file, 'r') as f:
                content = f.read()
                
                # Check for required Fabric imports
                if 'fabric-contract-api' not in content:
                    warnings.append("Missing fabric-contract-api import")
                
                # Check for contract class
                if 'class' not in content or 'Contract' not in content:
                    errors.append("Missing Contract class definition")
                
                # Check for async methods
                if 'async' not in content:
                    warnings.append("No async methods found (recommended for Fabric)")
            
            # Check package.json if exists
            package_json = os.path.join(cc_dir, 'package.json')
            if not os.path.exists(package_json):
                warnings.append("Missing package.json file")
            
            return {
                "success": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "language": "javascript"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"JavaScript validation error: {str(e)}"
            }
    
    def _validate_typescript_chaincode(self, cc_dir: str, source_file: str) -> Dict[str, Any]:
        """Validate TypeScript chaincode"""
        errors = []
        warnings = []
        
        try:
            with open(source_file, 'r') as f:
                content = f.read()
                
                # Check for required imports
                if 'fabric-contract-api' not in content:
                    warnings.append("Missing fabric-contract-api import")
                
                # Check for contract class with proper typing
                if 'class' not in content or 'Contract' not in content:
                    errors.append("Missing Contract class definition")
                
                if 'Context' not in content:
                    warnings.append("Missing Context type (recommended for TypeScript)")
            
            # Check tsconfig.json
            tsconfig = os.path.join(cc_dir, 'tsconfig.json')
            if not os.path.exists(tsconfig):
                warnings.append("Missing tsconfig.json file")
            
            return {
                "success": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "language": "typescript"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"TypeScript validation error: {str(e)}"
            }
    
    def test_chaincode_package(
        self, 
        chaincode_name: str,
        chaincode_version: str,
        chaincode_path: str
    ) -> Dict[str, Any]:
        """
        Test chaincode packaging in sandbox
        Simulates peer lifecycle chaincode package command
        """
        try:
            output_path = os.path.join(self.temp_dir, f"{chaincode_name}_{chaincode_version}.tar.gz")
            
            # Try to package with peer command (if available)
            try:
                result = subprocess.run(
                    [
                        'peer', 'lifecycle', 'chaincode', 'package',
                        output_path,
                        '--path', chaincode_path,
                        '--lang', 'golang',
                        '--label', f"{chaincode_name}_{chaincode_version}"
                    ],
                    cwd=self.temp_dir,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode == 0:
                    # Check package file was created
                    if os.path.exists(output_path):
                        file_size = os.path.getsize(output_path)
                        return {
                            "success": True,
                            "message": "Package test successful",
                            "package_path": output_path,
                            "package_size": file_size
                        }
                    else:
                        return {
                            "success": False,
                            "error": "Package file not created"
                        }
                else:
                    return {
                        "success": False,
                        "error": f"Package command failed: {result.stderr}"
                    }
                    
            except FileNotFoundError:
                return {
                    "success": False,
                    "error": "Peer binary not available for packaging test"
                }
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "error": "Package test timeout (60s exceeded)"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Package test error: {str(e)}"
            }
