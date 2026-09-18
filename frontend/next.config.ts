import type { NextConfig } from 'next';

/**
 * The browser only ever calls same-origin /api/v1 (client.ts), so the session cookie travels
 * automatically and sameSite: 'lax' still applies. This rewrite is what makes that true when the
 * backend is deployed separately (e.g. Render) — Next.js proxies the request server-side, and the
 * browser never sees the backend's origin.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${BACKEND_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
