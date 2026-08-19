import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { sellerApi } from '../services/seller-api';
import { useSellerFeedbacks, useSellerFeedbackSummary } from '../hooks/use-seller-feedback';
import { SellerFeedbackDetail } from '../components/seller-feedback-detail';
import { catalogApi } from '@/features/catalog/services/catalog-api';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Rating } from '@/components/rating';
import { Pagination } from '@/components/pagination';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ProductGrid } from '@/features/catalog/components/product-grid';

/** Seller storefront: profile header, their products, and buyer feedback. */
export default function SellerPage() {
  const { t } = useTranslation();
  const { sellerId } = useParams<{ sellerId: string }>();
  const [fbPage, setFbPage] = useState(1);

  const profileQuery = useQuery({
    queryKey: ['seller', sellerId],
    queryFn: () => sellerApi.profile(sellerId!),
    enabled: !!sellerId,
  });

  const productsQuery = useQuery({
    queryKey: ['seller-products', sellerId],
    queryFn: () => catalogApi.products({ sellerId, limit: 10 }),
    enabled: !!sellerId,
  });

  const feedbackQuery = useSellerFeedbacks(sellerId, { page: fbPage, limit: 10 });
  const summaryQuery = useSellerFeedbackSummary(sellerId);

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-16">
        <EmptyState title={t('seller.notFound')} />
      </div>
    );
  }

  const seller = profileQuery.data;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center">
        <Avatar src={seller.avatarUrl} name={seller.displayName} size={72} />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-text">{seller.displayName}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="primary">
              {t('sellerFeedback.totalCount', {
                count: summaryQuery.data?.totalFeedbackCount ?? seller.feedbackCount,
              })}
            </Badge>
            <Badge tone="success">
              {t('sellerFeedback.countPositive', {
                count: summaryQuery.data?.counts.POSITIVE ?? 0,
              })}
            </Badge>
            <Badge tone="neutral">
              {t('sellerFeedback.countNeutral', {
                count: summaryQuery.data?.counts.NEUTRAL ?? 0,
              })}
            </Badge>
            <Badge tone="danger">
              {t('sellerFeedback.countNegative', {
                count: summaryQuery.data?.counts.NEGATIVE ?? 0,
              })}
            </Badge>
          </div>
          {seller.description && <p className="mt-2 text-sm text-muted">{seller.description}</p>}
        </div>
      </header>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-text">{t('seller.shopProducts')}</h2>
        <ProductGrid products={productsQuery.data?.items ?? []} loading={productsQuery.isLoading} skeletonCount={5} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-text">{t('seller.sellerReviews')}</h2>
        {feedbackQuery.isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (feedbackQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon="icon-star" title={t('seller.noReviews')} />
        ) : (
          <ul className="flex flex-col gap-4">
            {feedbackQuery.data!.items.map((fb) => (
              <li key={fb.id}>
                <SellerFeedbackDetail feedback={fb} compact />
              </li>
            ))}
          </ul>
        )}

        {summaryQuery.data && (
          <div className="mt-6 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summaryQuery.data.averageDetailedSellerRatings).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t(`sellerFeedback.summary.${key}`)}</span>
                {value == null ? (
                  <span className="text-sm font-semibold text-muted">{t('sellerFeedback.noDsr')}</span>
                ) : (
                  <Rating value={value} size={14} showValue />
                )}
              </div>
            ))}
          </div>
        )}

        {feedbackQuery.data?.meta && (
          <div className="mt-6">
            <Pagination
              page={feedbackQuery.data.meta.page}
              totalPages={feedbackQuery.data.meta.totalPages}
              onChange={setFbPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
