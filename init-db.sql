-- Create additional database (blockchain_gateway is created by POSTGRES_DB env var)
-- Check if gateway_db exists before creating
SELECT 'CREATE DATABASE gateway_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gateway_db')\gexec

-- Grant permissions
\c blockchain_gateway
GRANT ALL PRIVILEGES ON SCHEMA public TO gateway_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gateway_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gateway_user;

