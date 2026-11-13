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
  console.log("Seeding roles, permissions, and staff credentials...");

  // 1. Ensure 'manager' role exists
  await pool.query(`
    INSERT INTO roles (id, name, description, is_system)
    VALUES ('manager', 'Store Manager', 'Manages store operations, table floor, voids, and inventory', true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
  `);
  console.log("✓ 'manager' role ready");

  // 2. Ensure manager role has permissions
  const permissionsRes = await pool.query(`SELECT id FROM permissions;`);
  for (const row of permissionsRes.rows) {
    // Give manager all permissions except system user/role administration
    if (!row.id.startsWith("users.") && !row.id.startsWith("roles.")) {
      await pool.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ('manager', $1)
        ON CONFLICT DO NOTHING;
      `, [row.id]);
    }
  }
  console.log("✓ 'manager' permissions configured");

  // 3. Hash 'Welcome123'
  const welcomeHash = hashPassword('Welcome123');

  // 4. Update / insert all staff users with Welcome123 hash
  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'alexa@lazysunday.com',
      full_name: 'Alexa Pheloung (Administrator)',
      role_id: 'admin',
      password_hash: welcomeHash,
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      username: 'manager',
      email: 'manager@lazysunday.com',
      full_name: 'Elena Rostova (Store Manager)',
      role_id: 'manager',
      password_hash: welcomeHash,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'cashier',
      email: 'cashier@lazysunday.com',
      full_name: 'Alex Rivera (Head Cashier)',
      role_id: 'cashier',
      password_hash: welcomeHash,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'kitchen',
      email: 'kitchen@lazysunday.com',
      full_name: 'Marco Silva (Kitchen Chef)',
      role_id: 'kitchen',
      password_hash: welcomeHash,
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      username: 'staff',
      email: 'staff@lazysunday.com',
      full_name: 'Floor Waiter',
      role_id: 'staff',
      password_hash: welcomeHash,
    },
  ];

  for (const u of users) {
    await pool.query(`
      INSERT INTO app_users (id, username, email, full_name, role_id, password_hash, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        password_hash = EXCLUDED.password_hash,
        is_active = true;
    `, [u.id, u.username, u.email, u.full_name, u.role_id, u.password_hash]);
    console.log(`✓ Seeded ${u.username} (${u.role_id}) with password 'Welcome123'`);
  }

  await pool.end();
  console.log("Staff credentials seeding complete!");
}

main().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
