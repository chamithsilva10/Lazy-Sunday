# Security Guide

## Current Audit

The original demo authentication compared a shared plaintext username/password and issued a seven-day signed timestamp cookie. The server also trusted `x-user-role: admin`, allowed unauthenticated traffic when auth configuration was missing, and exposed bill and report APIs without role checks. Bill APIs trusted client prices and totals; the coffee database policies allowed any authenticated account to read and mutate bills. Browser code performed duplicate database writes and could fall back to local storage or process memory.

The demo login endpoint is disabled. Authentication now uses Supabase Auth, server-only profile roles, HttpOnly/SameSite cookies, same-origin checks, TOTP enforcement for managers/admins, a signed 10-minute idle/8-hour absolute session marker, username/IP lockout state, and safe generic authentication errors. Coffee API handlers enforce roles and validate inputs server-side; prices and totals are recomputed on the server. A migration scopes coffee bill rows and line items with RLS and adds service-only audit and throttling tables. Coffee screens now use those APIs instead of browser-side writes.

## Authentication Flow

1. The staff login identifier is mapped to `STAFF_AUTH_EMAIL_DOMAIN` and authenticated by Supabase Auth. Existing email identifiers are passed through.
2. A server-only service role RPC checks HMAC-keyed username and IP lockout state. Five failures create a 15-minute lock, with exponential backoff on subsequent lockouts.
3. Cashiers receive an HttpOnly, Secure-in-production, SameSite=Strict Supabase session cookie. Managers and admins must have a verified TOTP factor and complete a TOTP challenge before the app grants access.
4. Middleware verifies the Supabase user and signed session marker on every matched request. The marker expires after 10 minutes idle or 8 hours absolute; an activity watcher redirects the POS to login after 10 idle minutes and heartbeats active use. Logout invalidates the local Supabase session and clears the marker.
5. Each API independently verifies the current user and `profiles.role`; UI state and headers are not authorization evidence.

Password hashing is delegated to Supabase Auth, not implemented by this application. Confirm the deployed Auth service uses bcrypt cost 12 or higher (or Argon2id). Configure minimum length 10 and leaked-password blocking in the Auth provider. Public sign-up must remain disabled. These provider-side controls are mandatory; do not provision production accounts using demo credentials.

## Roles And Permissions

| Capability | Cashier | Manager | Admin |
| --- | --- | --- | --- |
| Create coffee bills | Yes | Yes | Yes |
| Read own coffee bills | Yes | Yes | Yes |
| Read all bills and reports | No | Yes | Yes |
| Edit/void coffee bills | No | Yes | Yes |
| Create/edit/delete coffee products | No | No | Yes |
| View security audit logs | No | No | Yes |
| Change staff roles | No | No | Service-role administration only |

The role matrix above applies to the coffee APIs delivered here. The main POS screens still issue direct browser Supabase queries against other tables; their schema/policies are outside the available migrations and must receive equivalent server authorization and RLS before the whole POS can be considered production-ready. The app does not yet enforce a first-login password change, provide password-change/admin-reset screens, audit role changes made outside its APIs, offer fresh manager re-authentication per sensitive transaction, or implement recovery-code workflows and suspicious-activity alerts.

## Environment Variables

Copy `.env.example` into the deployment secret store and supply:

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible | Supabase publishable/anon key; rely on RLS |
| `STAFF_AUTH_EMAIL_DOMAIN` | Server | Maps staff usernames to provider email identities |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Lockout RPCs and immutable audit writes/reads |
| `LOGIN_RATE_LIMIT_SECRET` | Server only | HMAC pepper for username/IP throttle keys; use 32+ random characters |
| `SESSION_COOKIE_SECRET` | Server only | HMAC key for idle/absolute session marker; use a separate 32+ random secret |

Remove the old `DEMO_AUTH_USERNAME`, `DEMO_AUTH_PASSWORD`, `DEMO_AUTH_SECRET`, and `NEXT_PUBLIC_DEMO_AUTH_ENABLED` values from all environments and rotate any credentials that were used with them. Never commit `.env.local` or expose the service role key to client code.

## Production Hardening Checklist

- Apply all Supabase migrations, including `20261011000000_harden_coffee_security.sql`, and verify RLS is enabled on every business table.
- Disable public sign-up; create staff through a trusted administrative process. Require minimum 10-character passwords, breached-password blocking, forced first-login changes, and a verified recovery contact in the Auth provider.
- Verify the provider's password hashing cost meets the bcrypt-12/Argon2id requirement. If it cannot be configured, use an identity provider that can.
- Require TOTP and provider-managed recovery codes for every Manager/Admin account. Enroll and verify factors before assigning elevated roles.
- Configure Supabase access-token/session limits to 8 hours or less. Keep the application idle timeout at 10 minutes. Test expiry on the deployed runtime.
- Configure trusted reverse proxies to overwrite `X-Forwarded-For`; otherwise IP-based throttling and audit IP attribution can be spoofed. Restrict allowed origins at the hosting layer; do not add wildcard CORS.
- Serve production only over HTTPS. HSTS is emitted in production. Keep the service-role key, cookie secret, and rate-limit pepper in the deployment secret manager.
- Configure a supported payment provider. Store only provider tokens and non-sensitive transaction references; never send full PAN/CVV to this app.
- Schedule daily encrypted Supabase backups/PITR according to the hosting tier. Document restore credentials, restore into an isolated project, and test restore at least quarterly.
- Keep audit log table writes service-role-only; ship logs to an independently retained monitoring destination and alert on repeated lockouts, off-hours access, and refund/void anomalies.
- Run `npm audit` and the lockfile's package-manager audit in CI. Review remaining Tailwind 3 build-tool advisories before moving to Tailwind 4, because that is a major styling/toolchain migration.
- Test and secure the main POS tables and all non-coffee workflows before production. The current repository contains browser-direct data access for those areas.

### Backup Restore Runbook

1. Select the latest encrypted daily backup or PITR timestamp and record the incident/change ticket and target recovery point.
2. Restore into an isolated Supabase project; do not overwrite the live database during a test restore.
3. Apply the repository migrations in order, verify RLS and service-role secrets, then run the smoke checklist below against the isolated project.
4. Compare critical staff, product, bill, and audit counts with the restore point. Record measured RPO/RTO and obtain operator approval before cutover.
5. Preserve the original backup and audit export under the organization's retention policy. Perform and record a restore test at least quarterly.

## Verification Checklist

- Wrong password and unknown username return the same message/status shape; no account-existence signal is exposed.
- Five bad passwords for one username or source IP trigger a 15-minute lock; repeated lockouts increase the delay. Successful authentication clears username failures.
- Invalid TOTP codes are throttled; a manager/admin without a verified factor cannot use protected APIs.
- A valid session expires after 10 minutes without a request and after 8 hours absolute; logout clears Supabase and application cookies.
- Call product, bill, report, and audit APIs with no cookie, a cashier cookie, forged `x-user-role`, and another user's bill ID. Confirm server-side `401`/`403` and RLS isolation.
- Change bill `unit_price`, `line_total`, subtotal, discount, cashier ID, product status, or extra JSON fields in a request. Confirm prices come from the database and mass-assigned fields are rejected or ignored.
- Submit SQL metacharacters and oversized/malformed JSON to each API. Confirm parameterized Supabase queries, schema rejection, and safe errors.
- Submit HTML/script payloads as product/customer/notes data and verify they render as text; review the deployed CSP and remove any unsafe policy exceptions where possible.
- Send state-changing requests without a matching `Origin`, from a third-party origin, and with forged role headers. Confirm rejection and no state change.
- Copy only the browser-visible session/token data into another browser, replay expired cookies, and attempt localStorage/sessionStorage token injection. Confirm no token is stored there and expired/revoked server sessions fail.
- Verify audit entries include actor/action/time/IP/device for supported events and cannot be updated/deleted by `anon` or `authenticated` roles.