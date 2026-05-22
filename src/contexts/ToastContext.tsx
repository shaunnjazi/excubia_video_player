import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

export type ToastType = 'error' | 'warning' | 'success'

export interface Toast {
  id: number
  type: ToastType
  message: string
  persistent?: boolean
  actionLabel?: string
  actionFn?: () => void
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (type: ToastType, message: string, opts?: { persistent?: boolean; actionLabel?: string; actionFn?: () => void }) => void
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue>(null!)

export function useToast() { return useContext(ToastContext) }

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const showToast = useCallback((type: ToastType, message: string, opts?: { persistent?: boolean; actionLabel?: string; actionFn?: () => void }) => {
    const id = nextId++
    const toast: Toast = { id, type, message, ...opts }
    setToasts(prev => {
      const filtered = prev.length >= 5 ? prev.filter(t => t.persistent).slice(-4) : prev
      return [...filtered, toast]
    })
    if (!opts?.persistent) {
      const ms = type === 'error' ? 5000 : type === 'warning' ? 8000 : 3000
      timers.current.set(id, setTimeout(() => dismissToast(id), ms))
    }
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}
