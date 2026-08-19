import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { Pagination } from '@/components/pagination';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { paths } from '@/routes/paths';
import { formatRelative } from '@/utils/format-date';
import { cn } from '@/utils/cn';
import { useSellerFeedbacks } from '../hooks/use-seller-feedback';
import type {
  SellerFeedback,
  SellerFeedbackCommentType,
  SellerFeedbackSummary,
} from '../services/seller-feedback-api';

export interface AboutSeller {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  description?: string | null;
}

interface AboutSellerModalProps {
  open: boolean;
  seller: AboutSeller;
  summary?: SellerFeedbackSummary;
  summaryLoading?: boolean;
  showMessage: boolean;
  messageLoading?: boolean;
  onMessage: () => void;
  onClose: () => void;
}

const FILTERS: Array<'ALL' | SellerFeedbackCommentType> = [
  'ALL',
  'POSITIVE',
  'NEUTRAL',
  'NEGATIVE',
];

const DSR_ROWS = [
  ['itemAsDescribed', 'accurateDescription'],
  ['shippingAndHandlingCharges', 'reasonableShippingCost'],
  ['shippingTime', 'shippingSpeed'],
  ['communication', 'communication'],
] as const;

export function AboutSellerModal({
  open,
  seller,
  summary,
  summaryLoading,
  showMessage,
  messageLoading,
  onMessage,
  onClose,
}: AboutSellerModalProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'ALL' | SellerFeedbackCommentType>('ALL');
  const params = useMemo(
    () => ({
      page,
      limit: 8,
      sort: 'newest' as const,
      ...(filter === 'ALL' ? {} : { commentType: filter }),
    }),
    [filter, page],
  );
  const feedbacks = useSellerFeedbacks(open ? seller.id : undefined, params);
  const feedbackCount = summary?.feedbackCount ?? summary?.totalFeedbackCount ?? 0;

  const changeFilter = (value: string) => {
    setFilter(value as 'ALL' | SellerFeedbackCommentType);
    setPage(1);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('sellerFeedback.aboutSeller')} size="xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <aside className="flex flex-col gap-5 border-border lg:border-r lg:pr-6">
          <div className="flex items-center gap-3">
            <Avatar src={seller.avatarUrl} name={seller.displayName} size={64} />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold text-text">{seller.displayName}</h3>
              <SellerReputationText summary={summary} loading={summaryLoading} />
              {feedbackCount > 0 && (
                <p className="mt-0.5 text-xs text-muted">
                  {t('sellerFeedback.totalCount', { count: feedbackCount })}
                </p>
              )}
            </div>
          </div>

          {seller.description && (
            <p className="text-sm leading-relaxed text-muted">{seller.description}</p>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Link to={paths.seller(seller.id)} onClick={onClose}>
              <Button fullWidth>{t('sellerFeedback.visitStore')}</Button>
            </Link>
            {showMessage && (
              <Button
                fullWidth
                variant="secondary"
                loading={messageLoading}
                onClick={onMessage}
              >
                <Icon variant="icon-mail" size={17} />
                {t('sellerFeedback.messageSeller')}
              </Button>
            )}
          </div>

          <section>
            <h4 className="mb-3 font-bold text-text">
              {t('sellerFeedback.detailedSellerRatings')}
            </h4>
            <div className="flex flex-col gap-2">
              {DSR_ROWS.map(([field, labelKey]) => (
                <DsrRow
                  key={field}
                  label={t(`sellerFeedback.${labelKey}`)}
                  value={summary?.averageDetailedSellerRatings[field] ?? null}
                  loading={summaryLoading}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{t('sellerFeedback.basedOnBuyerFeedback')}</p>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-extrabold text-text">
              {t('sellerFeedback.sellerFeedbackWithCount', { count: feedbackCount })}
            </h3>
            <Select
              aria-label={t('sellerFeedback.ratingFilter')}
              value={filter}
              onValueChange={changeFilter}
              options={FILTERS.map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t('sellerFeedback.allRatings')
                    : t(`sellerFeedback.commentType.${value}`),
              }))}
              className="sm:w-44"
            />
          </div>

          {feedbacks.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          ) : (feedbacks.data?.items.length ?? 0) === 0 ? (
            <EmptyState title={t('sellerFeedback.noSellerFeedbackYet')} />
          ) : (
            <ul className="flex max-h-[58vh] flex-col gap-4 overflow-y-auto pr-1" data-modal-scrollable>
              {feedbacks.data!.items.map((feedback) => (
                <li key={feedback.id}>
                  <SellerFeedbackRow feedback={feedback} />
                </li>
              ))}
            </ul>
          )}

          {feedbacks.data?.meta && (
            <div className="mt-5">
              <Pagination
                page={feedbacks.data.meta.page}
                totalPages={feedbacks.data.meta.totalPages}
                onChange={setPage}
              />
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

export function SellerReputationText({
  summary,
  loading,
}: {
  summary?: SellerFeedbackSummary;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  if (loading) return <span className="text-sm text-muted">{t('common.loading')}</span>;
  if (summary?.positiveFeedbackPercentage == null) {
    return <span className="text-sm font-semibold text-muted">{t('sellerFeedback.noFeedbackYet')}</span>;
  }
  return (
    <span className="text-sm font-semibold text-primary underline underline-offset-2">
      {t('sellerFeedback.positivePercent', {
        percent: formatPercent(summary.positiveFeedbackPercentage),
      })}
    </span>
  );
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function DsrRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-center gap-3">
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-border">
        <span
          className="block h-full rounded-full bg-text"
          style={{ width: `${value == null ? 0 : Math.min(100, (value / 5) * 100)}%` }}
        />
      </span>
      <span className="text-right text-xs font-semibold text-text">
        {loading ? '' : value == null ? '—' : value.toFixed(1)}
      </span>
    </div>
  );
}

function SellerFeedbackRow({ feedback }: { feedback: SellerFeedback }) {
  const { t } = useTranslation();
  const indicator = sentimentIndicator(feedback.commentType);
  return (
    <article className="border-b border-border pb-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
            indicator.className,
          )}
          aria-label={t(`sellerFeedback.commentType.${feedback.commentType}`)}
          title={t(`sellerFeedback.commentType.${feedback.commentType}`)}
        >
          {indicator.symbol}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {feedback.buyer?.fullName && (
              <span className="font-semibold text-text">{feedback.buyer.fullName}</span>
            )}
            <span>{formatRelative(feedback.submittedAt ?? feedback.createdAt)}</span>
            {feedback.verifiedPurchase && (
              <span className="font-semibold text-text">
                {t('sellerFeedback.verifiedPurchase')}
              </span>
            )}
          </div>
          {(feedback.commentText || feedback.comment) && (
            <p className="mt-2 text-sm leading-relaxed text-text">
              {feedback.commentText ?? feedback.comment}
            </p>
          )}
          {feedback.product && (
            <Link
              to={paths.product(feedback.product.id)}
              className="mt-1 block truncate text-xs text-muted hover:text-primary hover:underline"
            >
              {feedback.product.name}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function sentimentIndicator(commentType: SellerFeedbackCommentType) {
  if (commentType === 'POSITIVE') return { symbol: '+', className: 'bg-success' };
  if (commentType === 'NEGATIVE') return { symbol: '-', className: 'bg-danger' };
  return { symbol: '=', className: 'bg-muted' };
}
