import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './icon';
import { lockScroll, unlockScroll } from '@/hooks/scroll-lock';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width of the dialog. Defaults to `md`; use `lg`/`xl` for multi-column forms. */
  size?: 'md' | 'lg' | 'xl';
}

const SIZES: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
};

/** Accessible dialog rendered in a portal. Closes on Escape / backdrop click. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);

    // Freeze the background. This pauses Lenis smooth-scroll (which plain
    // overflow:hidden can't stop) and pins native scroll as a fallback.
    lockScroll();

    // Belt-and-braces: cancel any wheel/touch gesture that does NOT originate
    // inside a scrollable element within the modal (the panel or a portalled
    // dropdown carry data-modal-scrollable), so nothing bleeds to the page.
    const blockScroll = (e: WheelEvent | TouchEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest('[data-modal-scrollable]')) e.preventDefault();
    };
    document.addEventListener('wheel', blockScroll, { passive: false });
    document.addEventListener('touchmove', blockScroll, { passive: false });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('wheel', blockScroll);
      document.removeEventListener('touchmove', blockScroll);
      unlockScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        data-modal-scrollable
        className={`relative z-10 flex max-h-[90vh] w-full flex-col overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-6 ${SIZES[size]}`}
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.16)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {title && <h2 className="text-lg font-bold text-text">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text"
            aria-label={t('common.close')}
          >
            <Icon variant="icon-close" size={20} />
          </button>
        </div>
        <div className="text-sm text-text">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
