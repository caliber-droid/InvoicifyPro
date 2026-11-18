import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { generateRandomId } from '../lib/money';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reduced = useReducedMotion();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = generateRandomId('tst');
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const iconFor = (kind: ToastKind) => {
    switch (kind) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />;
    }
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, x: 24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 flex items-start gap-3"
            >
              {iconFor(toast.kind)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#172033]">{toast.title}</p>
                {toast.message && <p className="text-xs text-slate-600 mt-0.5">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
