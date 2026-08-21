import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications, useNotificationActions } from '../hooks/use-notifications';
import type { NotificationType } from '../services/notification-api';
import { notificationTarget } from '../utils/notification-target';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Pagination } from '@/components/pagination';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { Select } from '@/components/select';
import { formatRelative } from '@/utils/format-date';
import { cn } from '@/utils/cn';

/** Full notification center with read/unread filter and mark-read actions. */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');

  const FILTER_OPTIONS = [
    { value: '', label: t('notifications.filterAll') },
    { value: 'unread', label: t('notifications.filterUnread') },
  ];

  const TYPE_LABEL: Record<NotificationType, string> = {
    ACCOUNT: t('notifications.typeAccount'),
    ORDER: t('notifications.typeOrder'),
    PAYMENT: t('notifications.typePayment'),
    RETURN: t('notifications.typeReturn'),
    DISPUTE: 'Dispute',
    PROMOTION: t('notifications.typePromotion'),
    SYSTEM: t('notifications.typeSystem'),
    AUCTION: t('notifications.typeAuction'),
  };
  const { data, isLoading } = useNotifications({
    page,
    limit: 15,
    isRead: filter === 'unread' ? false : undefined,
  });
  const { markRead, markAllRead } = useNotificationActions();

  return (
    <div>
      {/* Stack the title and controls on mobile so nothing wraps mid-word. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-text">{t('notifications.title')}</h2>
        <div className="flex items-center gap-2">
          <div className="flex-1 sm:w-36 sm:flex-none">
            <Select
              options={FILTER_OPTIONS}
              value={filter}
              onValueChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
              aria-label={t('notifications.filterLabel')}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => markAllRead.mutate()}
          >
            {t('notifications.markAllRead')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="icon-bell" title={t('notifications.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data!.items.map((n, i) => {
            const target = notificationTarget(n);
            const content = (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{TYPE_LABEL[n.type]}</Badge>
                  <span className="text-xs text-muted">{formatRelative(n.createdAt)}</span>
                </div>
                <p className="mt-1.5 font-semibold text-text">{n.title}</p>
                <p className="text-sm text-muted">{n.message}</p>
              </div>
            );
            return (
              <li
                key={n.id ?? i}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-border bg-surface p-4',
                  !n.isRead && 'border-primary/30 bg-primary/5',
                )}
              >
                {target ? (
                  <Link to={target} className="min-w-0 flex-1 hover:text-primary">
                    {content}
                  </Link>
                ) : (
                  content
                )}
                {!n.isRead && n.id && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>
                    {t('notifications.markRead')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data?.meta && (
        <div className="mt-6">
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
