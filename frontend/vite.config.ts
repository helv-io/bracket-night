import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function appVersion(): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION.replace(/^v/i, '')
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version?: string }
    return (pkg.version || '0.0.0').replace(/^v/i, '')
  } catch {
    return '0.0.0'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  resolve: {
    alias: {
      engine: join(__dirname, '..', 'engine', 'src'),
    },
  },
  server: {
    fs: { allow: [join(__dirname, '..')] },
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
      '/data': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
