import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Lightweight bottom sheet (spec: exercise info; reused by the future session player).
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md bg-ink-800 border-t border-ink-600 rounded-t-2xl px-5 pt-3 pb-8 safe-bottom max-h-[80vh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-ink-500 mb-3" />
            {title && <h3 className="text-lg font-display font-bold mb-3">{title}</h3>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
