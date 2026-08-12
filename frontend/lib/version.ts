/** App semver from build-time `NEXT_PUBLIC_APP_VERSION` (root package.json). */
export const APP_VERSION = (
  process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0'
).replace(/^v/i, '')

/** Display label with `v` prefix, e.g. `v0.1.0`. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`
