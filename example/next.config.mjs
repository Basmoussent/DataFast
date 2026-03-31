/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["creem-datafast"],
  allowedDevOrigins: [
    "http://localhost:3000",
    "https://suddenly-tender-buses-regression.trycloudflare.com",
  ],
};

export default nextConfig;
