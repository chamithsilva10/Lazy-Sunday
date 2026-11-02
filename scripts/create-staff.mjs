import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const emailDomain = process.env.STAFF_AUTH_EMAIL_DOMAIN?.trim().toLowerCase()
const username = process.env.STAFF_USERNAME?.trim()
const password = process.env.STAFF_PASSWORD
const role = process.env.STAFF_ROLE

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ["STAFF_AUTH_EMAIL_DOMAIN", emailDomain],
  ["STAFF_USERNAME", username],
  ["STAFF_PASSWORD", password],
  ["STAFF_ROLE", role],
].filter(([, value]) => !value).map(([name]) => name)

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`)
  process.exit(1)
}

if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username) || username.includes("@")) {
  console.error("STAFF_USERNAME must be a username without an email address.")
  process.exit(1)
}

if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(emailDomain)) {
  console.error("STAFF_AUTH_EMAIL_DOMAIN must be a valid email domain.")
  process.exit(1)
}

if (password.length < 10 || password.length > 1024) {
  console.error("STAFF_PASSWORD must be between 10 and 1024 characters.")
  process.exit(1)
}

if (!["cashier", "manager", "admin"].includes(role)) {
  console.error("STAFF_ROLE must be cashier, manager, or admin.")
  process.exit(1)
}

const email = `${username.toLowerCase()}@${emailDomain}`
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error || !data.user) {
  console.error("Staff Auth user creation failed; no existing account was changed.")
  process.exit(1)
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({ id: data.user.id, role }, { onConflict: "id" })

if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id)
  console.error("Profile provisioning failed; the incomplete Auth user was removed.")
  process.exit(1)
}

console.log(`Staff account provisioned with role: ${role}`)