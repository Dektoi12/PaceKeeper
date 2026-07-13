import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  tone: 'default' | 'success'
}

interface ToastCtx {
  show: (message: string, tone?: Toast['tone']) => void
}

const Ctx = createContext<ToastCtx>({ show: () => {} })

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, tone: Toast['tone'] = 'default') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed left-0 right-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full text-sm font-medium px-4 py-3 rounded-xl shadow-lg border ${
              t.tone === 'success'
                ? 'bg-session-easy/20 border-session-easy/40 text-session-easy'
                : 'bg-ink-700 border-ink-600 text-slate-100'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
