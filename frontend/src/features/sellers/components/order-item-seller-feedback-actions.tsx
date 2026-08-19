import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { formatDate } from '@/utils/format-date';
import {
  useOrderItemSellerFeedback,
  useSellerFeedbackMutations,
} from '../hooks/use-seller-feedback';
import { SellerFeedbackDetail } from './seller-feedback-detail';
import { SellerFeedbackForm, type SellerFeedbackValue } from './seller-feedback-form';

interface OrderItemSellerFeedbackActionsProps {
  orderId: string;
  orderItemId: string;
  sellerId?: string;
  feedbackDeadline?: string | null;
}

export function OrderItemSellerFeedbackActions({
  orderId,
  orderItemId,
  sellerId,
  feedbackDeadline,
}: OrderItemSellerFeedbackActionsProps) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const query = useOrderItemSellerFeedback(orderId, orderItemId);
  const mutations = useSellerFeedbackMutations();
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const feedback = query.data?.feedback;
  const automated = feedback?.source === 'AUTOMATED';

  const submitFeedback = async (value: SellerFeedbackValue) => {
    try {
      const { images, ...payload } = value;
      await mutations.leave.mutateAsync({
        orderId,
        orderItemId,
        sellerId,
        payload,
        images,
      });
      notify(t('sellerFeedback.submittedToast'), 'success');
      setFormOpen(false);
      setDetailOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
      query.refetch();
    }
  };

  if (query.isLoading) {
    return (
      <div className="h-9 w-36 animate-pulse rounded-md bg-surface-2" aria-label={t('common.loading')} />
    );
  }

  if (query.isError) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {!feedback && (
          <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
            <Icon variant="icon-star" size={14} />
            {t('sellerFeedback.leaveFeedback')}
          </Button>
        )}
        {feedback && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setDetailOpen(true)}>
              <Icon variant={automated ? 'icon-sparkles' : 'icon-check'} size={14} />
              {automated ? t('sellerFeedback.automatedFeedback') : t('sellerFeedback.feedbackSubmitted')}
            </Button>
            {automated && (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                {t('sellerFeedback.leaveYourOwnFeedback')}
              </Button>
            )}
            {feedback.revisionRequest?.status === 'PENDING' && (
              <Badge tone="accent">{t('sellerFeedback.revisionRequested')}</Badge>
            )}
          </>
        )}
      </div>
      {!feedback && feedbackDeadline && (
        <p className="text-xs text-muted">
          {t('sellerFeedback.feedbackAvailableUntil', { date: formatDate(feedbackDeadline) })}
        </p>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('sellerFeedback.modalTitle')} size="lg">
        <SellerFeedbackForm
          submitting={mutations.leave.isPending}
          onSubmit={submitFeedback}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={t('sellerFeedback.feedbackDetail')} size="lg">
        {feedback && <SellerFeedbackDetail feedback={feedback} buyerActions />}
      </Modal>
    </div>
  );
}
