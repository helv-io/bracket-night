const apiSecret =
  import.meta.env.VITE_API_SECRET ||
  import.meta.env.VITE_BRACKET_API_SECRET ||
  ''

export const apiHeaders = (extra: HeadersInit = {}): HeadersInit => {
  if (!apiSecret) return extra
  return {
    ...extra,
    'X-API-Secret': apiSecret,
  }
}
