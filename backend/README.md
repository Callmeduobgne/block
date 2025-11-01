# Backend Phase 3 - Python FastAPI + PostgreSQL
# Chaincode Lifecycle Orchestration với RBAC

## 📁 Cấu trúc dự án

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration management
│   ├── database.py             # Database connection
│   ├── dependencies.py         # FastAPI dependencies
│   │
│   ├── models/                 # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── chaincode.py
│   │   ├── deployment.py
│   │   ├── approval.py
│   │   └── audit.py
│   │
│   ├── schemas/                # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── chaincode.py
│   │   ├── deployment.py
│   │   └── auth.py
│   │
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── chaincodes.py
│   │   ├── deployments.py
│   │   └── approvals.py
│   │
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── chaincode_service.py
│   │   ├── deployment_service.py
│   │   ├── workflow_service.py
│   │   ├── certificate_service.py
│   │   └── audit_service.py
│   │
│   ├── middleware/             # Custom middleware
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── rbac.py
│   │   └── logging.py
│   │
│   └── utils/                  # Utilities
│       ├── __init__.py
│       ├── security.py
│       ├── validators.py
│       └── helpers.py
│
├── migrations/                 # Database migrations
│   ├── versions/
│   └── alembic.ini
│
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_chaincodes.py
│   └── test_deployments.py
│
├── docs/                       # Documentation
│   ├── api-spec.yaml
│   ├── database-schema.md
│   └── deployment-guide.md
│
├── scripts/                    # Utility scripts
│   ├── init_db.py
│   ├── create_admin.py
│   └── sync_certificates.py
│
├── docker/                     # Docker configurations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
│
├── requirements.txt            # Python dependencies
├── requirements-dev.txt        # Development dependencies
├── .env.example               # Environment variables template
├── .gitignore
└── README.md
```
