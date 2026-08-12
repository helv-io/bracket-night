/** Optional shared secret for AI / image routes (must match backend API_SECRET). */
const apiSecret =
  process.env.NEXT_PUBLIC_API_SECRET ||
  process.env.NEXT_PUBLIC_BRACKET_API_SECRET ||
  ''

export const apiHeaders = (extra: HeadersInit = {}): HeadersInit => {
  if (!apiSecret) return extra
  return {
    ...extra,
    'X-API-Secret': apiSecret
  }
}
