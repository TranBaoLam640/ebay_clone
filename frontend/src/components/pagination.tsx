import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Icon } from './icon';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** Numbered pager with prev/next. Renders nothing for single-page results. */
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  const pages = buildRange(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label={t('common.pagination')}>
      <PagerButton
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        ariaLabel={t('common.prevPage')}
      >
        <Icon variant="icon-arrow-left" size={16} />
      </PagerButton>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-9 rounded-md px-3 text-sm font-medium transition-colors',
              p === page
                ? 'bg-primary text-on-primary'
                : 'text-text hover:bg-surface-2',
            )}
          >
            {p}
          </button>
        ),
      )}

      <PagerButton
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        ariaLabel={t('common.nextPage')}
      >
        <span className="rotate-180">
          <Icon variant="icon-arrow-left" size={16} />
        </span>
      </PagerButton>
    </nav>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Compact page list with ellipses around the current page. */
function buildRange(page: number, total: number): Array<number | '…'> {
  const delta = 1;
  const range: Array<number | '…'> = [];
  const left = Math.max(2, page - delta);
  const right = Math.min(total - 1, page + delta);

  range.push(1);
  if (left > 2) range.push('…');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('…');
  if (total > 1) range.push(total);
  return range;
}
