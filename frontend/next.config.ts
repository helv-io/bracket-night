import type { NextConfig } from 'next'
import { config } from '../backend/src/config'

const nextConfig: NextConfig = {
  output: 'export'
}

const devConfig: NextConfig = {
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ]
  }
}

const exportConfig = config.dev ? devConfig : nextConfig

export default exportConfig