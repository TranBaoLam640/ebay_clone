import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SellerSummary } from '@/features/catalog/types/catalog.types';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { messagingApi } from '@/features/messages/services/messaging-api';
import { useSellerFeedbackSummary } from '@/features/sellers/hooks/use-seller-feedback';
import {
  AboutSellerModal,
  SellerReputationText,
} from '@/features/sellers/components/about-seller-modal';
import { paths } from '@/routes/paths';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';

/** Compact seller identity block linking to the seller storefront/profile. */
export function SellerCard({ seller, productId }: { seller: SellerSummary; productId: string }) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [aboutOpen, setAboutOpen] = useState(false);
  const summary = useSellerFeedbackSummary(seller.id);
  const isOwnListing = user?.sellerProfile?.id === seller.id;
  const showMessage = !isOwnListing;
  const messageSeller = useMutation({
    mutationFn: () => messagingApi.createConversation({ productId }),
    onSuccess: (conversation) => navigate(paths.message(conversation.id)),
    onError: (err) => notify(messageFromError(err), 'error'),
  });

  const openMessage = () => {
    if (!isAuthenticated) {
      navigate(paths.login, { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    messageSeller.mutate();
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <Avatar src={seller.avatarUrl} name={seller.displayName} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">
          {seller.displayName}
          {(summary.data?.feedbackCount ?? summary.data?.totalFeedbackCount ?? 0) > 0 && (
            <span className="ml-1 text-muted">
              ({summary.data?.feedbackCount ?? summary.data?.totalFeedbackCount})
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="mt-0.5 text-left"
        >
          <SellerReputationText summary={summary.data} loading={summary.isLoading} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Link to={paths.seller(seller.id)}>
          <Button variant="secondary" size="sm">
            {t('sellerFeedback.visitStore')}
          </Button>
        </Link>
        {showMessage && (
          <Button
            variant="secondary"
            size="sm"
            loading={messageSeller.isPending}
            onClick={openMessage}
          >
            <Icon variant="icon-mail" size={16} />
            {t('sellerFeedback.message')}
          </Button>
        )}
      </div>
      <AboutSellerModal
        open={aboutOpen}
        seller={seller}
        summary={summary.data}
        summaryLoading={summary.isLoading}
        showMessage={showMessage}
        messageLoading={messageSeller.isPending}
        onMessage={openMessage}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  );
}
