import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@stoa-agents/shared', '@stoa-agents/sdk'],
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
