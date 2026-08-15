import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductReviews } from '@/features/catalog/hooks/use-catalog';
import { useReviewEligibility } from '../hooks/use-review-eligibility';
import { useReviewMutations } from '../hooks/use-review-mutations';
import { ReviewForm } from './review-form';
import { Rating } from '@/components/rating';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { Pagination } from '@/components/pagination';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { formatRelative } from '@/utils/format-date';

/** Paginated, filterable list of product reviews + a write-review entry point. */
export function ReviewList({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [rating, setRating] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: eligibility } = useReviewEligibility(productId);
  const { create: createReview } = useReviewMutations();

  const submitReview = async (value: { rating: number; comment?: string }) => {
    if (!eligibility) return;
    try {
      await createReview.mutateAsync({
        productId,
        orderId: eligibility.orderId,
        orderItemId: eligibility.orderItemId,
        rating: value.rating,
        comment: value.comment,
      });
      notify(t('reviews.submittedToast'), 'success');
      setShowForm(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const SORT_OPTIONS = [
    { value: 'newest', label: t('productDetail.sortNewest') },
    { value: 'oldest', label: t('productDetail.sortOldest') },
    { value: 'rating_desc', label: t('productDetail.sortRatingHigh') },
    { value: 'rating_asc', label: t('productDetail.sortRatingLow') },
  ];

  const RATING_OPTIONS = [
    { value: '', label: t('productDetail.filterAllStars') },
    { value: '5', label: t('productDetail.filterStars', { count: 5 }) },
    { value: '4', label: t('productDetail.filterStars', { count: 4 }) },
    { value: '3', label: t('productDetail.filterStars', { count: 3 }) },
    { value: '2', label: t('productDetail.filterStars', { count: 2 }) },
    { value: '1', label: t('productDetail.filterStars', { count: 1 }) },
  ];

  const { data, isLoading } = useProductReviews(productId, {
    page,
    limit: 10,
    sort,
    rating: rating ? Number(rating) : undefined,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-text">{t('productDetail.reviews')}</h2>
          {eligibility && (
            <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
              <Icon variant="icon-star" size={14} />
              {t('reviews.writeReview')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="w-36">
            <Select
              options={RATING_OPTIONS}
              value={rating}
              onValueChange={(v) => {
                setRating(v);
                setPage(1);
              }}
              aria-label={t('productDetail.filterByStarLabel')}
            />
          </div>
          <div className="w-40">
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
              aria-label={t('productDetail.sortReviewsLabel')}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon="icon-star"
          title={t('productDetail.noReviewsTitle')}
          description={t('productDetail.noReviewsDescription')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {data!.items.map((r) => (
            <li key={r.id} className="flex gap-3 py-4">
              <Avatar src={r.reviewer.avatarUrl} name={r.reviewer.fullName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">{r.reviewer.fullName}</span>
                  <span className="text-xs text-muted">{formatRelative(r.createdAt)}</span>
                </div>
                <Rating value={r.rating} size={14} className="my-1" />
                {r.comment && <p className="text-sm text-text">{r.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data?.meta && (
        <div className="mt-6">
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('reviews.modalTitle')}>
        <ReviewForm
          submitting={createReview.isPending}
          onSubmit={submitReview}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
