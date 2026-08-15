import { Link } from 'react-router-dom';
import type { SellerSummary } from '@/features/catalog/types/catalog.types';
import { paths } from '@/routes/paths';
import { Avatar } from '@/components/avatar';
import { Rating } from '@/components/rating';
import { Button } from '@/components/button';

/** Compact seller identity block linking to the seller storefront/profile. */
export function SellerCard({ seller }: { seller: SellerSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
      <Avatar src={seller.avatarUrl} name={seller.displayName} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">{seller.displayName}</p>
        <Rating value={seller.averageFeedbackRating} count={seller.feedbackCount} size={14} />
      </div>
      <Link to={paths.seller(seller.id)}>
        <Button variant="secondary" size="sm">
          Xem shop
        </Button>
      </Link>
    </div>
  );
}
