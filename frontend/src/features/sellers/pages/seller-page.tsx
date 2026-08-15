import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { sellerApi } from '../services/seller-api';
import { catalogApi } from '@/features/catalog/services/catalog-api';
import { Avatar } from '@/components/avatar';
import { Rating } from '@/components/rating';
import { Pagination } from '@/components/pagination';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import { formatRelative } from '@/utils/format-date';

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

  const feedbackQuery = useQuery({
    queryKey: ['seller-feedbacks', sellerId, fbPage],
    queryFn: () => sellerApi.feedbacks(sellerId!, { page: fbPage, limit: 10 }),
    enabled: !!sellerId,
  });

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
          <Rating value={seller.averageFeedbackRating} count={seller.feedbackCount} showValue className="mt-1" />
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
          <ul className="flex flex-col divide-y divide-border">
            {feedbackQuery.data!.items.map((fb) => (
              <li key={fb.id} className="flex gap-3 py-4">
                <Avatar src={fb.buyer.avatarUrl} name={fb.buyer.fullName} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text">{fb.buyer.fullName}</span>
                    <span className="text-xs text-muted">{formatRelative(fb.createdAt)}</span>
                  </div>
                  <Rating value={fb.rating} size={14} className="my-1" />
                  {fb.comment && <p className="text-sm text-text">{fb.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
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
