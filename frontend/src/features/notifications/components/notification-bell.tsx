import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icon';
import { useNotifications, useNotificationActions, useUnreadCount } from '../hooks/use-notifications';
import { formatRelative } from '@/utils/format-date';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

/** Header bell with unread badge and a recent-notifications dropdown. */
export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  const { data } = useNotifications({ limit: 6 });
  const { markRead, markAllRead } = useNotificationActions();
  const count = unread?.count ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2"
        aria-label={count > 0 ? t('notifications.bellUnread', { count }) : t('notifications.bell')}
      >
        <Icon variant="icon-bell" size={20} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Anchor to the viewport edges on mobile so the wide panel never
              spills off-screen; switch to bell-anchored dropdown from sm up. */}
          <div className="fixed inset-x-2 top-16 z-20 overflow-hidden rounded-lg border border-border bg-surface shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="font-semibold text-text">{t('notifications.title')}</span>
              {count > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {(data?.items.length ?? 0) === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{t('notifications.empty')}</p>
              ) : (
                data!.items.map((n, i) => (
                  <button
                    key={n.id ?? i}
                    onClick={() => n.id && !n.isRead && markRead.mutate(n.id)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left hover:bg-surface-2',
                      !n.isRead && 'bg-primary/5',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-text">
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                      {n.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted">{n.message}</span>
                    <span className="text-[11px] text-muted">{formatRelative(n.createdAt)}</span>
                  </button>
                ))
              )}
            </div>

            <Link
              to={paths.account.notifications}
              onClick={() => setOpen(false)}
              className="block border-t border-border px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-surface-2"
            >
              {t('common.seeAll')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
