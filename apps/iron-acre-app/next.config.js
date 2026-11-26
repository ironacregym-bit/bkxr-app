const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
  transpilePackages: ["@pt/email-engine"],
};

module.exports = nextConfig;
