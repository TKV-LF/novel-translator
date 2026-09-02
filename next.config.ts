import type { NextConfig } from "next";
// next-pwa has no official types for Next 16
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);
