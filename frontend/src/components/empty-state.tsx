import type { ReactNode } from 'react';
import { Icon, type IconVariant } from './icon';

interface EmptyStateProps {
  icon?: IconVariant;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Centered placeholder for empty lists / no-results / error fallbacks. */
export function EmptyState({ icon = 'icon-package', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon variant={icon} size={26} />
      </span>
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
