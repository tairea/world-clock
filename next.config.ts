import type { NextConfig } from "next";

// Deployed to GitHub Pages under https://tairea.github.io/world-clock/.
// Static export at build time; basePath/assetPrefix only apply in CI builds
// (NEXT_PUBLIC_BASE_PATH is set by the workflow) so local dev stays at "/".
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
