"""
Chaincode Source Code Validator
Performs static analysis and security checks on chaincode before upload
"""
import re
from typing import Dict, List, Tuple

class ChaincodeValidator:
    """
    Validates chaincode source code for security issues and best practices
    """
    
    # Dangerous patterns that should be blocked
    DANGEROUS_PATTERNS = {
        'go': [
            (r'os\.Exec|exec\.Command', 'System command execution detected'),
            (r'syscall\.', 'Direct syscall usage detected'),
            (r'unsafe\.Pointer', 'Unsafe pointer usage detected'),
            (r'os\.Remove|os\.RemoveAll', 'File deletion detected'),
            (r'http\.Get|http\.Post', 'HTTP client usage detected (use fabric APIs)'),
            (r'net\.Dial|net\.Listen', 'Network operations detected'),
            (r'os\.Getenv', 'Environment variable access detected'),
            (r'\\.\\./', 'Path traversal attempt detected'),
        ],
        'javascript': [
            (r'eval\s*\(', 'eval() function usage detected'),
            (r'Function\s*\(', 'Function constructor detected'),
            (r'require\s*\(\s*[\'"]child_process', 'child_process module detected'),
            (r'require\s*\(\s*[\'"]fs[\'"]', 'File system module detected'),
            (r'require\s*\(\s*[\'"]http[s]?', 'HTTP module detected'),
            (r'process\.exit', 'process.exit() detected'),
            (r'__dirname|__filename', 'File system path access detected'),
        ],
        'java': [
            (r'Runtime\.getRuntime\(\)', 'Runtime.getRuntime() detected'),
            (r'ProcessBuilder', 'ProcessBuilder usage detected'),
            (r'System\.exit', 'System.exit() detected'),
            (r'File\.delete|Files\.delete', 'File deletion detected'),
            (r'Socket|ServerSocket', 'Network socket usage detected'),
            (r'java\.net\.URL', 'URL/HTTP client detected'),
            (r'System\.getProperty|System\.getenv', 'Environment access detected'),
        ]
    }
    
    # Required imports/patterns for valid chaincode
    REQUIRED_PATTERNS = {
        'go': [
            r'github\.com/hyperledger/fabric',  # Must import Fabric SDK
            r'func\s+\w+\s*\([^)]*\)\s*\([^)]*\)',  # Must have function definitions
        ],
        'javascript': [
            r'fabric-contract-api',  # Must import Fabric contract API
            r'class\s+\w+\s+extends\s+Contract',  # Must extend Contract
        ],
        'java': [
            r'org\.hyperledger\.fabric',  # Must import Fabric SDK
            r'@Transaction',  # Must have Transaction annotations
        ]
    }
    
    @staticmethod
    def detect_language(filename: str, code: str) -> str:
        """Detect chaincode language from filename and content"""
        if filename.endswith('.go'):
            return 'go'
        elif filename.endswith('.js') or filename.endswith('.ts'):
            return 'javascript'
        elif filename.endswith('.java'):
            return 'java'
        else:
            return 'unknown'
    
    @staticmethod
    def check_dangerous_patterns(code: str, language: str) -> List[str]:
        """Check for dangerous patterns in code"""
        issues = []
        
        if language not in ChaincodeValidator.DANGEROUS_PATTERNS:
            return issues
        
        for pattern, message in ChaincodeValidator.DANGEROUS_PATTERNS[language]:
            if re.search(pattern, code, re.IGNORECASE | re.MULTILINE):
                issues.append(f"Security issue: {message}")
        
        return issues
    
    @staticmethod
    def check_required_patterns(code: str, language: str) -> List[str]:
        """Check for required patterns in chaincode"""
        issues = []
        
        if language not in ChaincodeValidator.REQUIRED_PATTERNS:
            return issues
        
        for pattern in ChaincodeValidator.REQUIRED_PATTERNS[language]:
            if not re.search(pattern, code, re.MULTILINE):
                issues.append(f"Missing required pattern: {pattern}")
        
        return issues
    
    @staticmethod
    def check_size_limits(code: str) -> List[str]:
        """Check if code exceeds size limits"""
        issues = []
        
        # Check total size (max 1MB)
        if len(code.encode('utf-8')) > 1024 * 1024:
            issues.append("Chaincode size exceeds 1MB limit")
        
        # Check line count (max 10000 lines)
        lines = code.split('\n')
        if len(lines) > 10000:
            issues.append(f"Chaincode has too many lines: {len(lines)} (max 10000)")
        
        # Check individual line length (max 500 chars)
        for i, line in enumerate(lines[:100], 1):  # Check first 100 lines
            if len(line) > 500:
                issues.append(f"Line {i} exceeds 500 characters")
                break
        
        return issues
    
    @staticmethod
    def check_code_quality(code: str, language: str) -> List[str]:
        """Basic code quality checks"""
        warnings = []
        
        # Check for TODO/FIXME comments
        if re.search(r'TODO|FIXME', code, re.IGNORECASE):
            warnings.append("Code contains TODO/FIXME comments")
        
        # Check for hardcoded credentials
        cred_patterns = [
            r'password\s*=\s*["\'][^"\']+["\']',
            r'api[_-]?key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
            r'token\s*=\s*["\'][^"\']+["\']',
        ]
        
        for pattern in cred_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                warnings.append("Potential hardcoded credentials detected")
                break
        
        return warnings
    
    @staticmethod
    def validate_chaincode(filename: str, code: str) -> Dict[str, any]:
        """
        Comprehensive chaincode validation
        Returns dict with validation results
        """
        language = ChaincodeValidator.detect_language(filename, code)
        
        if language == 'unknown':
            return {
                'is_valid': False,
                'errors': ['Unsupported file type. Only .go, .js, .ts, .java are allowed'],
                'warnings': []
            }
        
        errors = []
        warnings = []
        
        # Check for dangerous patterns
        dangerous_issues = ChaincodeValidator.check_dangerous_patterns(code, language)
        errors.extend(dangerous_issues)
        
        # Check for required patterns
        required_issues = ChaincodeValidator.check_required_patterns(code, language)
        errors.extend(required_issues)
        
        # Check size limits
        size_issues = ChaincodeValidator.check_size_limits(code)
        errors.extend(size_issues)
        
        # Check code quality (warnings only)
        quality_warnings = ChaincodeValidator.check_code_quality(code, language)
        warnings.extend(quality_warnings)
        
        return {
            'is_valid': len(errors) == 0,
            'language': language,
            'errors': errors,
            'warnings': warnings,
            'line_count': len(code.split('\n')),
            'size_bytes': len(code.encode('utf-8'))
        }
