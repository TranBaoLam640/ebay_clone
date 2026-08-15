import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { Icon } from './icon';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
}

/**
 * Custom dropdown (button + listbox popup) fully themed for light/dark — unlike
 * a native <select>, whose open option list is drawn by the OS and can't be
 * styled. Supports keyboard: Enter/Space/↓ to open, ↑/↓ to move, Enter to pick,
 * Esc to close. Closes on outside click / blur.
 */
export function Select({
  label,
  options,
  value,
  onValueChange,
  id,
  className,
  disabled,
  ...aria
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // highlighted index while open
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Fixed-position box for the portal-rendered listbox, so it escapes any
  // scroll/overflow clipping from an ancestor (e.g. a modal panel).
  const [box, setBox] = useState<{ left: number; top: number; width: number }>();

  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? options[0]?.label ?? '';

  // Measure the trigger and place the listbox right below it (viewport coords,
  // since the portal renders at document.body under position: fixed).
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const measure = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) setBox({ left: r.left, top: r.bottom + 6, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Close on click outside (trigger or the portal listbox).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // When opening, highlight the current selection.
  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, value, options]);

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onValueChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={aria['aria-label']}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface pl-3.5 pr-3 text-sm text-text',
            'outline-none transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <span className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}>
            <Icon variant="icon-chevron-down" size={18} />
          </span>
        </button>

        {open &&
          box &&
          createPortal(
            <ul
              ref={listRef}
              role="listbox"
              data-modal-scrollable
              aria-activedescendant={`${fieldId}-opt-${active}`}
              style={{ left: box.left, top: box.top, width: box.width }}
              className="fixed z-[100] max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-1 shadow-lift"
            >
              {options.map((o, i) => {
                const isSelected = o.value === value;
                const isActive = i === active;
                return (
                  <li
                    key={o.value}
                    id={`${fieldId}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm',
                      isActive ? 'bg-primary-soft text-text' : 'text-text',
                      isSelected && 'font-semibold',
                    )}
                  >
                    {o.label}
                    {isSelected && <Icon variant="icon-check" size={16} className="text-accent" />}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )}
      </div>
    </div>
  );
}
