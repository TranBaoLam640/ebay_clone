import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n/languages';
import { Icon } from './icon';
import { cn } from '@/utils/cn';

/**
 * Header language switcher. Renders a globe button that opens a dropdown of the
 * supported languages (from `@/i18n/languages`). Selecting one calls
 * `i18n.changeLanguage`, which persists the choice and updates <html lang>.
 *
 * With a single language configured it still renders (as a scaffold), so adding
 * a `locales/<code>.json` + a LANGUAGES entry lights it up with no code change.
 */
interface LanguageSwitcherProps {
  /** Which way the menu opens. `up` + `left` suits the mobile drawer footer. */
  drop?: 'down' | 'up';
  align?: 'left' | 'right';
}

export function LanguageSwitcher({ drop = 'down', align = 'right' }: LanguageSwitcherProps = {}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const current =
    LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  const select = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center gap-1 rounded-md text-text outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-auto sm:px-2"
        aria-label={t('common.changeLanguage')}
        aria-expanded={open}
      >
        <Icon variant="icon-globe" size={20} />
        {/* Hide the code on mobile so the header row doesn't overflow; the globe
            alone is enough there. Show it from sm up. */}
        <span className="hidden text-xs font-semibold sm:inline">{current?.short}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label={t('common.language')}
            className={cn(
              'absolute z-20 w-44 rounded-lg border border-border bg-surface p-1.5 shadow-lift',
              align === 'right' ? 'right-0' : 'left-0',
              drop === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
          >
            {LANGUAGES.map((l) => {
              const active = l.code === current?.code;
              return (
                <button
                  key={l.code}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => select(l.code)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    active ? 'font-semibold text-primary' : 'text-text hover:bg-surface-2',
                  )}
                >
                  {l.label}
                  {active && <Icon variant="icon-check" size={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
