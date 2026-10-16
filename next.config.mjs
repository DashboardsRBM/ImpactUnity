/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  generateBuildId: async () => "rbm-impact-hub",
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer && config.output) {
      config.output.chunkLoadTimeout = 300000;
    }
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/.next-prod/**",
        "**/.next-build/**",
        "**/dist/**",
        "**/build/**",
        "**/out/**",
      ],
    };
    return config;
  },
};

export default nextConfig;
