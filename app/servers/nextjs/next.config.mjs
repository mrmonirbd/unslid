
// Internal URL used by Next.js server-side rewrites to reach FastAPI.
// Inside Docker this must be the container-to-container address.
// Falls back to localhost:8000 for local bare-metal dev (outside Docker).
const FASTAPI_INTERNAL = process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000";
const isProd = process.env.NODE_ENV === "production";

// Security headers — applied to all routes in production
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS — only in production (prevents HTTPS downgrade attacks)
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next-build",
  output: "standalone",

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // /api/v1/* and /app_data/* are handled by explicit route handlers.
  // The app_data handler protects generated images while preserving static
  // proxying for other app_data assets.

  images: {
    remotePatterns: [
      // Wasabi S3 geo buckets
      {
        protocol: "https",
        hostname: "s3.eu-central-1.wasabisys.com",
      },
      {
        protocol: "https",
        hostname: "s3.us-east-1.wasabisys.com",
      },
      {
        protocol: "https",
        hostname: "s3.ap-southeast-1.wasabisys.com",
      },
      {
        protocol: "https",
        hostname: "s3.ap-northeast-1.wasabisys.com",
      },
      // Icon and stock image providers
      {
        protocol: "https",
        hostname: "img.icons8.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  
};

export default nextConfig;
