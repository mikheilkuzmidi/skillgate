import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // The app reads all data from Sepolia in the browser, so it ships as a static
  // export. NEXT_PUBLIC_* settings, including the browser RPC endpoint, are public.
  output: "export",
  images: { unoptimized: true }
};

export default nextConfig;
