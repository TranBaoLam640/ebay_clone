import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconVariant } from '@/components/icon';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextId = 1;

const KIND_ICON: Record<ToastKind, IconVariant> = {
  success: 'icon-check',
  error: 'icon-close',
  info: 'icon-bell',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Mobile: top-center (thumb-reachable, out of the way of bottom CTAs).
          Desktop: top-right — more visible than the bottom corner, and frees the
          bottom-right for the floating mini-cart. */}
      <div
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Sonner-style: a small tinted icon sits inline with the text — no heavy icon
// chip. Color is carried by the icon alone, keeping each toast calm and compact.
const KIND_ICON_COLOR: Record<ToastKind, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-primary',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="toast-enter group pointer-events-auto flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 sm:w-[356px]"
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
    >
      <Icon
        variant={KIND_ICON[toast.kind]}
        size={18}
        className={`shrink-0 ${KIND_ICON_COLOR[toast.kind]}`}
      />
      <span className="flex-1 text-[13px] font-medium leading-snug text-text">{toast.message}</span>
      <button
        onClick={onClose}
        aria-label={t('common.closeNotification')}
        className="-mr-1 shrink-0 rounded-md p-1 text-muted outline-none transition-opacity hover:text-text focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Icon variant="icon-close" size={15} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
