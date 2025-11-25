import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["ethers"],
  },
  // Static export for GitHub Pages
  output: "export",
  // Auto-respect base path set by CI via NEXT_PUBLIC_BASE_PATH
  basePath,
  assetPrefix: basePath,
  // Ensure image optimization does not rely on server
  images: {
    unoptimized: true,
  },
  // Make exported routes directory-based for better Pages compatibility
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/:path*.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;


