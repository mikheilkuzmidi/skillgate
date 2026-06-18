import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The app reads all data from Sepolia in the browser, so it ships as a static
  // export (plain HTML/JS, no server, no keys in the bundle).
  output: "export",
  images: { unoptimized: true }
};

export default nextConfig;
