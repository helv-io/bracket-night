import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'
import { config } from '../backend/src/config'

/** Single source of truth: root package.json, overridable via env at build time. */
function resolveAppVersion(): string {
  if (process.env.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION.replace(/^v/i, '')
  }
  try {
    const rootPkg = JSON.parse(
      readFileSync(join(process.cwd(), '..', 'package.json'), 'utf8')
    ) as { version?: string }
    return (rootPkg.version || '0.0.0').replace(/^v/i, '')
  } catch {
    return '0.0.0'
  }
}

const appVersion = resolveAppVersion()

const sharedEnv = {
  NEXT_PUBLIC_APP_VERSION: appVersion,
}

const nextConfig: NextConfig = {
  output: 'export',
  env: sharedEnv,
}

const devConfig: NextConfig = {
  env: sharedEnv,
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      },
      {
        source: '/data/:path*',
        destination: 'http://localhost:3001/data/:path*'
      }
    ]
  }
}

const exportConfig = config.dev ? devConfig : nextConfig

export default exportConfig