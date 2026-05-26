// Very simple in-memory rate limiter (per IP or socket id)
// Good enough for a party game — resets every window.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1

  if (bucket.count > max) {
    return false // rate limited
  }
  return true
}

// Helper to get a decent key for a socket
export function getClientKey(socket: any, req?: any): string {
  const ip = req?.ip || socket?.handshake?.address || 'unknown'
  return `${ip}:${socket?.id || 'no-socket'}`
}
