import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@stoa/shared'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig
