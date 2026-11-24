const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
  transpilePackages: [
    "@pt/firebase",
    "@pt/agents",
    "@pt/tools",
    "@pt/types",
  ],
};

module.exports = nextConfig;
