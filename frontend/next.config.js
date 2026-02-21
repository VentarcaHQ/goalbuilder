/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",   // Required for Docker build
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_BMAC_URL: process.env.NEXT_PUBLIC_BMAC_URL || "https://buymeacoffee.com/goalbuilder",
  },
};

module.exports = nextConfig;
