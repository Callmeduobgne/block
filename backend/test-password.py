from app.utils.security import get_password_hash, verify_password
import psycopg2

# Test hashing
hashed = get_password_hash('Admin@123')
print('New hash:', hashed[:60] + '...')

# Verify
result = verify_password('Admin@123', hashed)
print('Verify new hash:', result)

# Check DB
conn = psycopg2.connect('postgresql://gateway_user:gateway_password@postgres:5432/blockchain_gateway')
cur = conn.cursor()
cur.execute("SELECT password_hash FROM users WHERE username='admin'")
db_hash = cur.fetchone()[0]
print('DB hash:', db_hash[:60] + '...')

# Verify against DB
result2 = verify_password('Admin@123', db_hash)
print('Verify DB hash:', result2)

if not result2:
    print('\n❌ PASSWORD HASH IN DB IS WRONG!')
    print('Updating admin password...')
    cur.execute("UPDATE users SET password_hash=%s WHERE username='admin'", (hashed,))
    conn.commit()
    print('✅ Password updated successfully')
else:
    print('\n✅ Password hash is correct')

cur.close()
conn.close()

