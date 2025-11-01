"""
File Upload Security Utilities
Validates file uploads to prevent malicious files
"""
import os
import re
import magic
from typing import Tuple, List
from fastapi import UploadFile, HTTPException, status
from app.config import settings

class FileValidator:
    # MIME types allowed for chaincode
    ALLOWED_MIME_TYPES = {
        '.go': ['text/plain', 'text/x-go', 'application/octet-stream'],
        '.java': ['text/plain', 'text/x-java', 'application/octet-stream'],
        '.js': ['text/plain', 'text/javascript', 'application/javascript'],
        '.ts': ['text/plain', 'text/typescript', 'application/typescript']
    }
    
    # Dangerous file patterns to reject
    DANGEROUS_PATTERNS = [
        r'eval\s*\(',
        r'exec\s*\(',
        r'__import__',
        r'subprocess',
        r'os\.system',
        r'Runtime\.getRuntime\(\)',
        r'<script',
        r'javascript:',
        r'onload\s*=',
        r'onerror\s*=',
    ]
    
    @staticmethod
    def validate_extension(filename: str) -> bool:
        """Validate file extension"""
        ext = os.path.splitext(filename)[1].lower()
        allowed_extensions = settings.ALLOWED_EXTENSIONS.split(',')
        return ext in allowed_extensions
    
    @staticmethod
    def validate_size(file_size: int) -> bool:
        """Validate file size"""
        return file_size <= settings.MAX_FILE_SIZE
    
    @staticmethod
    def validate_filename(filename: str) -> bool:
        """Validate filename for path traversal and special characters"""
        # Check for path traversal attempts
        if '..' in filename or '/' in filename or '\\' in filename:
            return False
        
        # Check for valid filename pattern (alphanumeric, dots, dashes, underscores)
        if not re.match(r'^[a-zA-Z0-9._-]+$', filename):
            return False
        
        return True
    
    @staticmethod
    def validate_mime_type(file_content: bytes, extension: str) -> bool:
        """Validate MIME type matches extension"""
        try:
            mime = magic.from_buffer(file_content, mime=True)
            allowed_mimes = FileValidator.ALLOWED_MIME_TYPES.get(extension, [])
            return mime in allowed_mimes
        except Exception:
            # If magic fails, allow text files but log warning
            return extension in ['.go', '.java', '.js', '.ts']
    
    @staticmethod
    def scan_for_malicious_content(content: str) -> Tuple[bool, List[str]]:
        """
        Scan file content for potentially malicious patterns
        Returns (is_safe, list_of_issues)
        """
        issues = []
        
        for pattern in FileValidator.DANGEROUS_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                issues.append(f"Potentially dangerous pattern detected: {pattern}")
        
        return len(issues) == 0, issues
    
    @staticmethod
    async def validate_upload_file(file: UploadFile) -> Tuple[bool, str, bytes]:
        """
        Comprehensive file validation
        Returns (is_valid, error_message, file_content)
        """
        # Validate filename
        if not FileValidator.validate_filename(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename. Only alphanumeric characters, dots, dashes and underscores allowed."
            )
        
        # Validate extension
        if not FileValidator.validate_extension(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file extension. Allowed: {settings.ALLOWED_EXTENSIONS}"
            )
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate size
        if not FileValidator.validate_size(file_size):
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE} bytes"
            )
        
        # Validate MIME type
        extension = os.path.splitext(file.filename)[1].lower()
        if not FileValidator.validate_mime_type(content, extension):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match declared extension"
            )
        
        # Scan for malicious content
        try:
            content_str = content.decode('utf-8')
            is_safe, issues = FileValidator.scan_for_malicious_content(content_str)
            
            if not is_safe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File contains potentially malicious content: {', '.join(issues)}"
                )
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be valid UTF-8 encoded text"
            )
        
        # Reset file pointer for further processing
        await file.seek(0)
        
        return True, "File is valid", content


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing/replacing dangerous characters
    """
    # Remove any path components
    filename = os.path.basename(filename)
    
    # Replace spaces with underscores
    filename = filename.replace(' ', '_')
    
    # Remove any characters that aren't alphanumeric, dots, dashes or underscores
    filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    
    # Limit filename length
    name, ext = os.path.splitext(filename)
    if len(name) > 100:
        name = name[:100]
    
    return name + ext
