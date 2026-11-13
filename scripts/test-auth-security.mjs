import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3005';

// Read secret from .env.local
let secret = process.env.SESSION_COOKIE_SECRET;
if (!secret) {
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/SESSION_COOKIE_SECRET="?([^"\n\r]+)"?/);
    if (match) secret = match[1];
  } catch {}
}
if (!secret) secret = 'pos-secret-fallback';

function makeSignedCookie(payload, secretKey) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  return `v2.${data}.${sig}`;
}

async function run() {
  console.log('================================================================');
  console.log('🔒 VERIFYING AUTHENTICATION, RBAC & TAMPER RESISTANCE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function it(name, fn) {
    total++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     ${err.message}`);
        throw err;
      }
    })();
  }

  // 1. Valid login produces cryptographic HMAC v2 token
  let validCashierCookie = '';
  let validAdminCookie = '';

  await it('Valid login produces v2.<base64url>.<signature> HMAC session token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' })
    });
    assert.strictEqual(res.status, 200);
    const cookies = res.headers.getSetCookie();
    const sessionCookieStr = cookies.find(c => c.startsWith('pos-session-state='));
    assert(sessionCookieStr, 'Must set pos-session-state cookie');
    const token = sessionCookieStr.split(';')[0].replace('pos-session-state=', '');
    assert(token.startsWith('v2.'), 'Token must start with v2.');
    const parts = token.split('.');
    assert.strictEqual(parts.length, 3, 'Token must have exactly 3 parts: v2, payload, sig');
    validCashierCookie = `pos-session-state=${token}`;
  });

  await it('Valid admin login produces admin session token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.strictEqual(res.status, 200);
    const cookies = res.headers.getSetCookie();
    const sessionCookieStr = cookies.find(c => c.startsWith('pos-session-state='));
    const token = sessionCookieStr.split(';')[0].replace('pos-session-state=', '');
    validAdminCookie = `pos-session-state=${token}`;
  });

  // 2. Invalid password rejected
  await it('Invalid password returns HTTP 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert.strictEqual(res.status, 401);
  });

  // 3. Forged unsigned cookie privilege escalation rejected
  await it('Forged unsigned cookie (pos-staff-role=admin) is rejected with HTTP 401', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/next-number`, {
      headers: { 'Cookie': 'pos-staff-role=admin; pos-local-user=true; pos-staff-user=admin' }
    });
    assert.strictEqual(res.status, 401);
  });

  // 4. Tampered HMAC signature rejected
  await it('Tampered session token (payload modified) is rejected with HTTP 401', async () => {
    // Generate valid token then tamper with last character of signature
    const parts = validCashierCookie.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}ff`;
    const res = await fetch(`${BASE_URL}/api/orders/next-number`, {
      headers: { 'Cookie': tamperedToken }
    });
    assert.strictEqual(res.status, 401);
  });

  // 5. Forged role in payload with invalid key rejected
  await it('Forged token with wrong HMAC key is rejected with HTTP 401', async () => {
    const fakeToken = makeSignedCookie({
      uid: '00000000-0000-0000-0000-000000000001',
      usr: 'admin',
      rol: 'admin',
      iat: Date.now(),
      act: Date.now()
    }, 'attacker-wrong-secret');
    const res = await fetch(`${BASE_URL}/api/orders/next-number`, {
      headers: { 'Cookie': `pos-session-state=${fakeToken}` }
    });
    assert.strictEqual(res.status, 401);
  });

  // 6. Expired session rejected (idle > 30 min)
  await it('Expired session token (idle > 30 minutes) is rejected with HTTP 401', async () => {
    const thirtyOneMinAgo = Date.now() - (31 * 60 * 1000);
    const expiredToken = makeSignedCookie({
      uid: '00000000-0000-0000-0000-000000000001',
      usr: 'admin',
      rol: 'admin',
      iat: thirtyOneMinAgo,
      act: thirtyOneMinAgo
    }, secret);
    const res = await fetch(`${BASE_URL}/api/orders/next-number`, {
      headers: { 'Cookie': `pos-session-state=${expiredToken}` }
    });
    assert.strictEqual(res.status, 401);
  });

  // 7. Role-based Privilege Escalation Defense: Cashier attempting Manager void
  await it('Privilege Escalation Defense: Cashier attempting Manager void returns HTTP 403 Forbidden', async () => {
    // Create an order first
    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': validCashierCookie },
      body: JSON.stringify({
        table_name: 'Takeaway',
        subtotal: 100,
        total: 100,
        items: [{ name: 'Espresso', price: 100, quantity: 1, station: 'bar' }]
      })
    });
    const orderData = await createRes.json();
    const orderNum = orderData.order.order_number;

    // Cashier attempts to void (Manager-only)
    const voidAttemptRes = await fetch(`${BASE_URL}/api/orders/${orderNum}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': validCashierCookie },
      body: JSON.stringify({ action: 'void', reason: 'Attempted by cashier' })
    });
    assert.strictEqual(voidAttemptRes.status, 403, 'Cashier must be rejected with 403 Forbidden on void endpoint');
  });

  // 8. Manager role succeeds on Manager-only endpoint
  await it('Manager role succeeds on Manager-only void endpoint (HTTP 200)', async () => {
    // Create an order
    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': validAdminCookie },
      body: JSON.stringify({
        table_name: 'Takeaway',
        subtotal: 100,
        total: 100,
        items: [{ name: 'Espresso', price: 100, quantity: 1, station: 'bar' }]
      })
    });
    const orderData = await createRes.json();
    const orderNum = orderData.order.order_number;

    // Admin/Manager voids
    const voidRes = await fetch(`${BASE_URL}/api/orders/${orderNum}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': validAdminCookie },
      body: JSON.stringify({ action: 'void', reason: 'Manager approved refund' })
    });
    assert.strictEqual(voidRes.status, 200);
    const voidData = await voidRes.json();
    assert.strictEqual(voidData.success, true);
    assert.strictEqual(voidData.order.status, 'cancelled');
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed} / ${total} AUTHENTICATION & SECURITY TESTS PASSED!`);
  console.log('Zero trust of unsigned cookies, cryptographic HMAC tokens enforced!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
