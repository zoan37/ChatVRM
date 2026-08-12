/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.BASE_PATH || "",
  basePath: process.env.BASE_PATH || "",
  trailingSlash: true,
  publicRuntimeConfig: {
    root: process.env.BASE_PATH || "",
  },
  // The avatar and its animation are multi-megabyte and change rarely, so let
  // repeat visits reuse them instead of revalidating on every page load.
  // Not `immutable`: the filenames aren't content-hashed, so a replaced avatar
  // still needs to reach people within the revalidation window.
  // (Ignored by `next export` — static hosts set their own headers.)
  async headers() {
    return [
      {
        source: "/:path*(.vrm|.vrma)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
