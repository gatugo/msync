import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle (.next/standalone) for the Docker image
  output: "standalone",
  turbopack: {},
  async rewrites() {
    // Same-origin proxy for the PocketBase sync backend: keeps browser traffic
    // on this origin ('self' in the CSP below already allows it) and means
    // phones/LAN clients need no extra host config. PB_INTERNAL_URL is a
    // runtime env var of the server process (default: local dev instance).
    const pbInternal = (process.env.PB_INTERNAL_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
    return [
      {
        source: '/pb/:path*',
        destination: `${pbInternal}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.stepfun.ai https://fonts.googleapis.com https://fonts.gstatic.com;"
          }
        ]
      }
    ]
  }
};

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig);
