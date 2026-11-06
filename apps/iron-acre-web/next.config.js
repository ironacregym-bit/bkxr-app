/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: [
    "@pt/firebase",
    "@pt/agents",
    "@pt/tools",
    "@pt/types",
  ],
};

module.exports = nextConfig;
