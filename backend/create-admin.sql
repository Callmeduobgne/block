-- Create IBN Admin User directly in PostgreSQL
-- Run this SQL in your database

INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    role,
    msp_id,
    organization,
    status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin',
    'admin@ibn.com',
    -- Password: admin123 (hashed with bcrypt)
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7LHHHwKYaa',
    'ADMIN',
    'Org1MSP',
    'IBN Blockchain',
    'active',
    NOW(),
    NOW()
);

-- Verify admin user created
SELECT id, username, email, role, organization, status, created_at 
FROM users 
WHERE username = 'admin';
