import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  /** Transpile workspace packages so Next.js can build them. */
  transpilePackages: [
    "@heatflow/api",
    "@heatflow/auth",
    "@heatflow/db",
    "@heatflow/schemas",
    "@heatflow/ui",
    "@heatflow/utils",
    "@heatflow/ai",
    "@heatflow/pdf",
    "@heatflow/integrations-zugferd",
    "@heatflow/integrations-email",
    "@heatflow/integrations-datev",
    "@heatflow/integrations-datanorm",
    "@heatflow/integrations-sepa",
    "@heatflow/integrations-heizlast",
  ],
  /** React-PDF needs `canvas` shimmed; mark Node-only packages as external. */
  serverExternalPackages: ["@react-pdf/renderer", "nodemailer"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lkngyjkrhgtxnebpepie.supabase.co" },
    ],
  },
};

export default nextConfig;
