import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { Skeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { useSellerFeedbacks, useSellerFeedbackSummary } from '../hooks/use-seller-feedback';
import { SellerFeedbackDetail } from '../components/seller-feedback-detail';

type SellerUser = {
  sellerId?: string | null;
  sellerProfileId?: string | null;
  sellerProfile?: { id?: string | null; _id?: string | null } | null;
};

export default function SellerFeedbacksPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const sellerId = currentSellerId(user as SellerUser | null);
  const feedbacks = useSellerFeedbacks(sellerId, { page, limit: 10 });
  const summary = useSellerFeedbackSummary(sellerId);

  if (!sellerId) {
    return (
      <EmptyState
        icon="icon-star"
        title={t('sellerFeedback.receivedTitle')}
        description={t('sellerFeedback.noSellerProfile')}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-text">{t('sellerFeedback.receivedTitle')}</h2>
      {summary.data && (
        <p className="mb-5 text-sm text-muted">
          {t('sellerFeedback.receivedSummary', {
            total: summary.data.totalFeedbackCount,
            positive: summary.data.counts.POSITIVE,
            neutral: summary.data.counts.NEUTRAL,
            negative: summary.data.counts.NEGATIVE,
          })}
        </p>
      )}

      {feedbacks.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : feedbacks.isError ? (
        <EmptyState
          icon="icon-star"
          title={t('sellerFeedback.loadError')}
          description={messageFromError(feedbacks.error)}
          action={
            <Button variant="secondary" onClick={() => feedbacks.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (feedbacks.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="icon-star" title={t('sellerFeedback.noReceived')} />
      ) : (
        <ul className="flex flex-col gap-4">
          {feedbacks.data!.items.map((feedback) => (
            <li key={feedback.id}>
              <SellerFeedbackDetail feedback={feedback} sellerActions />
            </li>
          ))}
        </ul>
      )}

      {feedbacks.data?.meta && (
        <div className="mt-6">
          <Pagination
            page={feedbacks.data.meta.page}
            totalPages={feedbacks.data.meta.totalPages}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function currentSellerId(user: SellerUser | null): string | undefined {
  return (
    user?.sellerId ??
    user?.sellerProfileId ??
    user?.sellerProfile?.id ??
    user?.sellerProfile?._id ??
    undefined
  );
}
