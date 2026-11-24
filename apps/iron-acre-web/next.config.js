const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    externalDir: true,
  },
  transpilePackages: [
    "@pt/firebase",
    "@pt/agents",
    "@pt/tools",
    "@pt/types",
  ],
};

module.exports = nextConfig;
