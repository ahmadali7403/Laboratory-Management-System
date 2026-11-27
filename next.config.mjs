/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  compress: true,
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
