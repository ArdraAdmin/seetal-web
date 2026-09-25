import type { NextConfig } from "next";

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  // iCloud Drive skips folders named *.nosync; Vercel still expects ".next"
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
  serverExternalPackages: ["tesseract.js"],
  async rewrites() {
    return [
      {
        source: "/stl-api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
