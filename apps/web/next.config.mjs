/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output so the production Docker image is small/self-contained.
  output: "standalone",
  // Build the Next root from this app while keeping the monorepo root for
  // workspace package resolution (standalone tracing).
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  // Allow MUI / Emotion to be transpiled cleanly.
  transpilePackages: ["@sql-edu/contracts"],
};

export default nextConfig;
