const explicitDemoEnv = process.env.DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE

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
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*", "./demo_schema.sql", "./demo_seed.sql"],
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:filename*",
        destination: "/api/uploads/:filename*",
      },
    ]
  },
  env: {
    ...(explicitDemoEnv !== undefined
      ? {
          NEXT_PUBLIC_DEMO_MODE: explicitDemoEnv,
          DEMO_MODE: explicitDemoEnv,
        }
      : {}),
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
}

export default nextConfig

