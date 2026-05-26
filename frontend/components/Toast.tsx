import React, { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'error' | 'success' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    // Fallback to console if used outside provider (should not happen)
    return { showToast: (msg: string) => console.error('Toast:', msg) }
  }
  return context
}

export const Toaster = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  // Expose via global for easy replacement of alert()
  const win = window as unknown as { __showToast?: (msg: string, type?: ToastType) => void }
  win.__showToast = showToast

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs border
            ${toast.type === 'error' ? 'bg-red-600 text-white border-red-700' : ''}
            ${toast.type === 'success' ? 'bg-green-600 text-white border-green-700' : ''}
            ${toast.type === 'info' ? 'bg-zinc-800 text-[var(--text)] border-zinc-700' : ''}
          `}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  // Make toast globally available for legacy alert() replacements and socket handlers
  if (typeof window !== 'undefined') {
    const win = window as unknown as { __showToast?: (msg: string, type?: ToastType) => void }
    win.__showToast = showToast
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-xl text-sm max-w-xs border pointer-events-auto
              ${toast.type === 'error' ? 'bg-red-600/95 text-white border-red-700' : ''}
              ${toast.type === 'success' ? 'bg-emerald-600/95 text-white border-emerald-700' : ''}
              ${toast.type === 'info' ? 'bg-zinc-900/95 text-[var(--text)] border-zinc-700' : ''}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
