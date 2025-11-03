-- Create databases for the application
CREATE DATABASE IF NOT EXISTS blockchain_gateway;
CREATE DATABASE IF NOT EXISTS gateway_db;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE blockchain_gateway TO gateway_user;
GRANT ALL PRIVILEGES ON DATABASE gateway_db TO gateway_user;

