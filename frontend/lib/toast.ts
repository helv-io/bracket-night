// Simple global toast helper (works from socket handlers, etc.)
export const toast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
  const win = window as unknown as { __showToast?: (msg: string, t?: string) => void }
  if (typeof window !== 'undefined' && win.__showToast) {
    win.__showToast(message, type)
  } else {
    console[type === 'error' ? 'error' : 'log'](`[Toast] ${message}`)
  }
}
