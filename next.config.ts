import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
      "@supabase/ssr",
      "clsx",
      "tailwind-merge",
      "exceljs",
      "jspdf",
    ],
  },
};

export default nextConfig;
