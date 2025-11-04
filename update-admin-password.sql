-- Update admin password
UPDATE users 
SET password_hash = '$2b$12$LpVjwOe0Nj1j/66F.TW7LuPgRECuEnj5Kmt.gbaztteic161e8TTW'
WHERE username = 'admin';

-- Verify
SELECT username, email, role, status FROM users WHERE username = 'admin';

