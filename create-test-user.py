"""Create a test user for uploading chaincode"""
import sys
import psycopg2
import bcrypt

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    port="5432",
    database="blockchain_db",
    user="blockchain_user",
    password="blockchain_password"
)

cursor = conn.cursor()

# Check if admin user exists
cursor.execute("SELECT username FROM users WHERE username = 'admin'")
existing = cursor.fetchone()

if existing:
    print("✅ Admin user already exists")
    print("Username: admin")
    print("Password: admin123")
else:
    # Hash password
    password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
    
    # Create admin user
    cursor.execute("""
        INSERT INTO users (
            id, username, email, password_hash, role, organization,
            status, is_active, is_verified, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            'admin',
            'admin@blockchain.com',
            %s,
            'ADMIN',
            'Blockchain Gateway',
            'active',
            true,
            true,
            NOW(),
            NOW()
        )
    """, (password_hash,))
    
    conn.commit()
    print("✅ Admin user created!")
    print("Username: admin")
    print("Password: admin123")

cursor.close()
conn.close()

