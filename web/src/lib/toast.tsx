import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const typeStyles: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
  error: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  info: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const s = typeStyles[toast.type]
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto"
      style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text, minWidth: 240, maxWidth: 360 }}
      role="alert"
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container — top right */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
