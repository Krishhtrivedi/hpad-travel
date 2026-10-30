import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
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
