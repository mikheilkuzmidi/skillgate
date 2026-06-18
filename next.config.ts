import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fully static client-rendered app (all data is read from Sepolia in the browser),
  // so we export to plain HTML/JS for Cloudflare Pages. No server runtime, no keys in the bundle.
  output: "export",
  images: { unoptimized: true }
};

export default nextConfig;
