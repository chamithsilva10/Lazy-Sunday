const isDemo = process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("dysnpzrmppcmqdebgtzt")

const supabaseUrl = isDemo
  ? ""
  : (process.env.NEXT_PUBLIC_SUPABASE_URL || "")

const supabaseAnonKey = isDemo
  ? ""
  : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")

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
