/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@frontend/grpc'],
};

export default nextConfig;
