import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Set Turbopack root to monorepo root
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  
  // Don't fail build on ESLint errors (warnings are allowed)
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
  },
  
  // Treat warnings as warnings, not errors
  typescript: {
    // Warning: This dangerously allows production builds to successfully complete
    // even if your project has type errors.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
