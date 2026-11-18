import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: { "/*": ["./.data/**/*", "./OWNER-ACCESS.txt", "./.env*", "./test-results/**/*", "./.screenshots/**/*"] },
};
export default nextConfig;
