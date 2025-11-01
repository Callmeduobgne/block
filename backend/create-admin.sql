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
    is_active,
    is_verified,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin',
    'admin@ibn.com',
    -- Password: admin123 (hashed with bcrypt)
    '$2b$12$r45yDWkvwo/YVBRdWcd98OdR4S0OwYTrrF7G2CW4fz98qHXqiYZ62',
    'ADMIN',
    'Org1MSP',
    'IBN Blockchain',
    'active',
    true,
    true,
    NOW(),
    NOW()
);

-- Verify admin user created
SELECT id, username, email, role, organization, status, created_at 
FROM users 
WHERE username = 'admin';
