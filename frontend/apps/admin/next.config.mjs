/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@grpc/grpc-js', 'protobufjs'],
};

export default nextConfig;
