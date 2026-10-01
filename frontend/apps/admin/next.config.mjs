/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@grpc/grpc-js', 'protobufjs'],
  // `<Image>` loads its `src` as given. Nothing resizes an image: the storage pull zone runs no
  // Optimizer, and Next's own `/_next/image` would pull every original through this server.
  images: { unoptimized: true },
};

export default nextConfig;
