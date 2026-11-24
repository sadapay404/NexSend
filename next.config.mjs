/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keeps local `next build` runs from clobbering the `next dev` output that
  // serves the live preview.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["pg", "@electric-sql/pglite"],
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/@electric-sql/pglite/**"],
    },
  },
  async redirects() {
    return [{ source: "/incoming", destination: "/receive", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), clipboard-read=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
