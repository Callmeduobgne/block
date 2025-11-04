-- Create test user if not exists
DO $$
BEGIN
    -- Check if test user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'testuser') THEN
        INSERT INTO users (
            id, username, email, password_hash, role, organization,
            msp_id, status, is_active, is_verified
        ) VALUES (
            gen_random_uuid(),
            'testuser',
            'test@blockchain.com',
            -- Password: test123 (hashed with bcrypt)
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU2GZJQW7aGW',
            'USER',
            'Blockchain Gateway',
            'Org1MSP',
            'active',
            true,
            true
        );
        RAISE NOTICE 'Test user created: testuser / test123';
    ELSE
        RAISE NOTICE 'Test user already exists';
    END IF;
    
    -- Check if admin exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
        INSERT INTO users (
            id, username, email, password_hash, role, organization,
            msp_id, status, is_active, is_verified
        ) VALUES (
            gen_random_uuid(),
            'admin',
            'admin@blockchain.com',
            -- Password: admin123 (hashed with bcrypt)
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU2GZJQW7aGW',
            'ADMIN',
            'Blockchain Gateway',
            'Org1MSP',
            'active',
            true,
            true
        );
        RAISE NOTICE 'Admin user created: admin / admin123';
    ELSE
        RAISE NOTICE 'Admin user already exists';
    END IF;
END $$;

-- Show all users
SELECT username, email, role, status FROM users ORDER BY created_at;

