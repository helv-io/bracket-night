import { Request, Response, NextFunction } from 'express'
import dns from 'dns/promises'
import net from 'net'
import { config } from './config'

export const MAX_TOPIC_LENGTH = 100

/**
 * Trim, strip control characters, and reject empty / oversized topics.
 * Returns null when the topic is invalid.
 */
export const sanitizeTopic = (raw: string | undefined): string | null => {
  if (typeof raw !== 'string') return null
  const topic = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
  if (!topic || topic.length > MAX_TOPIC_LENGTH) return null
  return topic
}

/**
 * Optional shared-secret gate. When API_SECRET / BRACKET_API_SECRET is set,
 * require it via X-API-Secret header or api_secret / secret query param.
 */
export const requireApiSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = config.apiSecret
  if (!secret) {
    next()
    return
  }

  const header = req.header('x-api-secret') || req.header('x-bracket-api-secret') || ''
  const query = typeof req.query.api_secret === 'string'
    ? req.query.api_secret
    : typeof req.query.secret === 'string'
      ? req.query.secret
      : ''

  if (header === secret || query === secret) {
    next()
    return
  }

  res.status(401).json({ error: 'Unauthorized: valid API secret required' })
}

/**
 * Socket.IO / HTTP CORS allowlist from FRONTEND_ORIGIN or CORS_ORIGIN.
 * Dev defaults to localhost Next.js; production defaults to same-origin only.
 */
export const getCorsOrigins = (): string[] | boolean => {
  const raw = config.corsOrigin
  if (raw) {
    const list = raw.split(',').map(s => s.trim()).filter(Boolean)
    return list.length ? list : false
  }
  if (config.dev) return ['http://localhost:3000']
  // Same-origin (Express serves the static frontend) — no cross-origin needed.
  return false
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes.default',
  'kubernetes.default.svc'
])

const isPrivateIp = (ip: string): boolean => {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast / reserved
    return false
  }
  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase()
    if (normalized === '::' || normalized === '::1') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local
    if (normalized.startsWith('fe80')) return true // link-local
    if (normalized.startsWith('ff')) return true // multicast
    // IPv4-mapped IPv6
    if (normalized.startsWith('::ffff:')) {
      const v4 = normalized.slice('::ffff:'.length)
      if (net.isIP(v4) === 4) return isPrivateIp(v4)
    }
    return false
  }
  return true
}

const isAllowedHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return false
  if (BLOCKED_HOSTNAMES.has(host)) return false
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (config.imgProxyHost && host === config.imgProxyHost.toLowerCase()) return true
  if (net.isIP(host)) return !isPrivateIp(host)
  return true
}

/**
 * Validate that a client-supplied image URL is safe to fetch (SSRF guard).
 * Allows http(s) only; blocks private/link-local/metadata targets.
 * Always allows the configured imgproxy host (normal create-bracket flow).
 */
export const assertSafeImageUrl = async (rawUrl: string): Promise<URL> => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid image URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) image URLs are allowed')
  }
  if (url.username || url.password) {
    throw new Error('Image URLs with credentials are not allowed')
  }
  if (!isAllowedHostname(url.hostname)) {
    throw new Error('Image URL host is not allowed')
  }

  // Literal IP in hostname already checked; resolve DNS for hostnames.
  if (net.isIP(url.hostname) === 0) {
    // Allowlisted imgproxy host skips DNS private-IP checks (operator-controlled).
    const isImgproxy = config.imgProxyHost
      && url.hostname.toLowerCase() === config.imgProxyHost.toLowerCase()
    if (!isImgproxy) {
      let addresses: { address: string, family: number }[]
      try {
        addresses = await dns.lookup(url.hostname, { all: true })
      } catch {
        throw new Error('Unable to resolve image URL host')
      }
      if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) {
        throw new Error('Image URL resolves to a private or disallowed address')
      }
    }
  }

  return url
}

/**
 * Fetch an image URL after SSRF checks, re-validating redirects.
 */
export const safeFetchImage = async (rawUrl: string): Promise<ArrayBuffer> => {
  let current = rawUrl
  for (let hop = 0; hop < 3; hop++) {
    const url = await assertSafeImageUrl(current)
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'bracket-night-image-fetch/1.0' }
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirect without Location header')
      current = new URL(location, url).toString()
      continue
    }

    if (!response.ok) {
      throw new Error(`Image fetch failed with status ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      throw new Error('URL did not return an image')
    }

    return response.arrayBuffer()
  }
  throw new Error('Too many redirects while fetching image')
}

/** Exported for unit tests */
export const _test = { isPrivateIp, isAllowedHostname }
