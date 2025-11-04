-- Insert teaTraceCC directly into database

-- First, get a user ID (use admin if exists, otherwise any user)
DO $$
DECLARE
    v_user_id UUID;
    v_source_code TEXT;
BEGIN
    -- Get admin user ID
    SELECT id INTO v_user_id FROM users WHERE role = 'ADMIN' LIMIT 1;
    
    -- If no admin, get any user
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM users LIMIT 1;
    END IF;
    
    -- If still no user, create one
    IF v_user_id IS NULL THEN
        INSERT INTO users (
            id, username, email, password_hash, role, organization,
            status, is_active, is_verified
        ) VALUES (
            gen_random_uuid(),
            'chaincode_uploader',
            'uploader@blockchain.com',
            '$2b$12$r45yDWkvwo/YVBRdWcd98OdR4S0OwYTrrF7G2CW4fz98qHXqiYZ62',
            'ADMIN',
            'Blockchain Gateway',
            'active',
            true,
            true
        ) RETURNING id INTO v_user_id;
    END IF;
    
    -- Read source code (simplified version)
    v_source_code := 'TeaTrace Chaincode - Tea Traceability System';
    
    -- Insert chaincode if not exists
    IF NOT EXISTS (SELECT 1 FROM chaincodes WHERE name = 'teaTraceCC' AND version = '1.0.1') THEN
        INSERT INTO chaincodes (
            id,
            name,
            version,
            source_code,
            description,
            language,
            status,
            uploaded_by,
            approved_by,
            approval_date,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'teaTraceCC',
            '1.0.1',
            v_source_code,
            'Tea Traceability Chaincode - Hệ thống truy xuất nguồn gốc trà trên Blockchain',
            'typescript',
            'active',  -- Set as active since it's already deployed
            v_user_id,
            v_user_id,
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'teaTraceCC v1.0.1 inserted successfully';
    ELSE
        RAISE NOTICE 'teaTraceCC v1.0.1 already exists';
    END IF;
END $$;

-- Verify
SELECT id, name, version, status, language, description 
FROM chaincodes 
WHERE name = 'teaTraceCC';

