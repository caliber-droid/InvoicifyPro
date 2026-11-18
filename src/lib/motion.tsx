import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  PauseCircle,
  Send,
  X,
  XCircle,
} from 'lucide-react';

export const TRANSITION_FAST = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };
export const TRANSITION_PAGE = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

export const PageTransition: React.FC<{ children: React.ReactNode; routeKey: string; className?: string }> = ({
  children,
  routeKey,
  className = '',
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={routeKey}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -6 }}
      transition={TRANSITION_PAGE}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : 0.045,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: TRANSITION_PAGE },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedCounter: React.FC<{
  value: number;
  formatter: (v: number) => string;
  className?: string;
}> = ({ value, formatter, className = '' }) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const startVal = 0;
    const duration = 520;
    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startVal + (value - startVal) * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, reduced]);

  return <span className={`tabular-nums ${className}`}>{formatter(display)}</span>;
};

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  success?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const reduced = useReducedMotion();
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants: Record<NonNullable<AnimatedButtonProps['variant']>, string> = {
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm hover:shadow-md',
    secondary: 'bg-white text-[#172033] border border-slate-200 hover:border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:text-[#172B4D] hover:bg-slate-100/80',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  };

  const sizes: Record<NonNullable<AnimatedButtonProps['size']>, string> = {
    sm: 'px-3 py-1.5 text-xs min-h-[34px]',
    md: 'px-4 py-2 text-sm min-h-[40px]',
    lg: 'px-5 py-2.5 text-sm min-h-[44px]',
  };

  return (
    <motion.button
      whileHover={reduced || disabled || loading ? undefined : { y: -1, scale: 1.01 }}
      whileTap={reduced || disabled || loading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...(rest as any)}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {!loading && success && <CheckCircle2 className="w-4 h-4 shrink-0" />}
      {children}
    </motion.button>
  );
};

export const AnimatedModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, maxWidth = 'max-w-2xl', children }) => {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F1D36]/45 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
            transition={TRANSITION_FAST}
            className={`relative z-10 w-full ${maxWidth} bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-auto`}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#172033]">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 max-h-[82vh] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const AnimatedDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children }) => {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F1D36]/40 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={reduced ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduced ? undefined : { x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#172033]">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = status.toLowerCase();
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    paid: {
      label: 'Paid',
      cls: 'text-[#15803D] bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    accepted: {
      label: 'Accepted',
      cls: 'text-[#15803D] bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    active: {
      label: 'Active',
      cls: 'text-[#15803D] bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    completed: {
      label: 'Completed',
      cls: 'text-[#15803D] bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    converted: {
      label: 'Converted',
      cls: 'text-[#1D4ED8] bg-blue-50 border-blue-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    sent: {
      label: 'Sent',
      cls: 'text-[#1D4ED8] bg-blue-50 border-blue-200',
      icon: <Send className="w-3.5 h-3.5" />,
    },
    viewed: {
      label: 'Viewed',
      cls: 'text-sky-700 bg-sky-50 border-sky-200',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    scheduled: {
      label: 'Scheduled',
      cls: 'text-[#1D4ED8] bg-blue-50 border-blue-200',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    partially_paid: {
      label: 'Partial',
      cls: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    paused: {
      label: 'Paused',
      cls: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <PauseCircle className="w-3.5 h-3.5" />,
    },
    overdue: {
      label: 'Overdue',
      cls: 'text-red-700 bg-red-50 border-red-200',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    rejected: {
      label: 'Rejected',
      cls: 'text-red-700 bg-red-50 border-red-200',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    cancelled: {
      label: 'Cancelled',
      cls: 'text-slate-600 bg-slate-100 border-slate-200',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    void: {
      label: 'Void',
      cls: 'text-slate-600 bg-slate-100 border-slate-200',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    refunded: {
      label: 'Refunded',
      cls: 'text-slate-600 bg-slate-100 border-slate-200',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    expired: {
      label: 'Expired',
      cls: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    draft: {
      label: 'Draft',
      cls: 'text-slate-600 bg-slate-100 border-slate-200',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
  };

  const cfg = map[normalized] || {
    label: status.replace(/_/g, ' '),
    cls: 'text-slate-600 bg-slate-100 border-slate-200',
    icon: <FileText className="w-3.5 h-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
    <div className="h-3.5 w-24 rounded skeleton-shimmer mb-3" />
    <div className="h-7 w-36 rounded skeleton-shimmer mb-2" />
    <div className="h-3 w-28 rounded skeleton-shimmer" />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div className="h-11 bg-slate-50 border-b border-slate-200 px-4 flex items-center gap-6">
      <div className="h-3 w-20 rounded skeleton-shimmer" />
      <div className="h-3 w-32 rounded skeleton-shimmer" />
      <div className="h-3 w-24 rounded skeleton-shimmer" />
      <div className="h-3 w-16 rounded skeleton-shimmer ml-auto" />
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 px-4 flex items-center gap-6">
          <div className="h-3.5 w-20 rounded skeleton-shimmer" />
          <div className="h-3.5 w-40 rounded skeleton-shimmer" />
          <div className="h-3.5 w-24 rounded skeleton-shimmer" />
          <div className="h-4 w-16 rounded skeleton-shimmer ml-auto" />
        </div>
      ))}
    </div>
  </div>
);
