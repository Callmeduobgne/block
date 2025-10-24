-- Backend Phase 3 - Database Initialization Script
-- This script is run when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database if not exists (this is handled by POSTGRES_DB)
-- The database is created automatically by PostgreSQL container

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE blockchain_gateway TO gateway_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO gateway_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gateway_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gateway_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gateway_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gateway_user;
