import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Icon, type IconVariant } from './icon';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Optional leading icon rendered inside the field (e.g. email, lock). */
  leadingIcon?: IconVariant;
}

const baseField =
  'h-11 w-full rounded-md border bg-surface px-3.5 text-sm text-text placeholder:text-muted ' +
  'transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

/** Labeled text input with error/hint slots. Password variant adds a reveal toggle. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, type = 'text', leadingIcon, ...props },
  ref,
) {
  const { t } = useTranslation();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && reveal ? 'text' : type;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon variant={leadingIcon} size={18} />
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          type={effectiveType}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn(
            baseField,
            error ? 'border-danger' : 'border-border',
            leadingIcon && 'pl-10',
            isPassword && 'pr-11',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-text"
            aria-label={reveal ? t('common.hidePassword') : t('common.showPassword')}
          >
            <Icon variant={reveal ? 'icon-eye-off' : 'icon-eye'} size={18} />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
