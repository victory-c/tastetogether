import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  poweredByHeader: false,
};

export default nextConfig;
