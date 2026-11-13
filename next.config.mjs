const isExplicitDemo = process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true"
const isExplicitProd = process.env.DEMO_MODE === "false" || process.env.NEXT_PUBLIC_DEMO_MODE === "false"

const isDemo = isExplicitProd ? false : isExplicitDemo

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_DEMO_MODE: isDemo ? "true" : "false",
    DEMO_MODE: isDemo ? "true" : "false",
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
}

export default nextConfig
