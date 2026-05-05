/** @type {import('next').NextConfig} */

const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:4000";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // The web app is purely a UI client. All server work lives in apps/api.
  // No dockerode/prisma/nodemailer here — they don't get imported.
  async rewrites() {
    // Always proxy /api/v1/* to the Fastify backend.
    // - Dev: API_PROXY_TARGET defaults to http://127.0.0.1:4000
    // - Prod (compose): API_PROXY_TARGET=http://api:4000 (set by docker-compose)
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
