import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true,
})({
  turbopack: {},
  images: {
    unoptimized: true,
  },
});

export default nextConfig;
