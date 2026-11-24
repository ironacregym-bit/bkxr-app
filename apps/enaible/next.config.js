const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
  transpilePackages: ["@pt/firebase"],
};
