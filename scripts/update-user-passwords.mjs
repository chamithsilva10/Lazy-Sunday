// scripts/update-user-passwords.mjs
import pg from 'pg';
import crypto from 'node:crypto';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/pos_test'
});

async function main() {
  const users = [
    { username: 'admin', pass: 'admin123' },
    { username: 'cashier', pass: 'cashier123' },
    { username: 'kitchen', pass: 'kitchen123' },
    { username: 'staff', pass: 'staff123' },
  ];

  for (const u of users) {
    const hash = hashPassword(u.pass);
    await pool.query('UPDATE app_users SET password_hash = $1 WHERE username = $2', [hash, u.username]);
    console.log(`Updated ${u.username} with scrypt hash`);
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
