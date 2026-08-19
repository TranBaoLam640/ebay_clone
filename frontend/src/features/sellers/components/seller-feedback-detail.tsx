import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Modal } from '@/components/modal';
import { Rating } from '@/components/rating';
import { Textarea } from '@/components/textarea';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { formatDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';
import { useSellerFeedbackMutations } from '../hooks/use-seller-feedback';
import {
  type SellerFeedback,
  type SellerFeedbackCommentType,
  type SellerFeedbackFields,
} from '../services/seller-feedback-api';
import { SellerFeedbackForm, type SellerFeedbackValue } from './seller-feedback-form';

interface SellerFeedbackDetailProps {
  feedback: SellerFeedback;
  buyerActions?: boolean;
  sellerActions?: boolean;
  compact?: boolean;
}

export function SellerFeedbackDetail({
  feedback,
  buyerActions,
  sellerActions,
  compact,
}: SellerFeedbackDetailProps) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const mutations = useSellerFeedbackMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [responseText, setResponseText] = useState('');

  const revision = feedback.revisionRequest;
  const pendingRevision = revision?.status === 'PENDING';
  const buyerEditable = buyerActions && feedback.source === 'BUYER' && !pendingRevision;
  const sellerCanRequestRevision =
    sellerActions &&
    feedback.source === 'BUYER' &&
    !revision &&
    ['NEUTRAL', 'NEGATIVE'].includes(feedback.commentType);

  const submitEdit = async (value: SellerFeedbackValue) => {
    try {
      await mutations.update.mutateAsync({
        feedbackId: feedback.id,
        payload: toPatchPayload(value),
        orderId: feedback.orderId,
        orderItemId: feedback.orderItemId,
        sellerId: feedback.sellerId,
      });
      notify(t('sellerFeedback.updatedToast'), 'success');
      setEditOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitDelete = async () => {
    try {
      await mutations.remove.mutateAsync({
        feedbackId: feedback.id,
        orderId: feedback.orderId,
        orderItemId: feedback.orderItemId,
        sellerId: feedback.sellerId,
      });
      notify(t('sellerFeedback.deletedToast'), 'success');
      setDeleteOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitResponse = async () => {
    try {
      await mutations.respond.mutateAsync({
        feedbackId: feedback.id,
        commentText: responseText.trim(),
        sellerId: feedback.sellerId,
      });
      notify(t('sellerFeedback.respondedToast'), 'success');
      setResponseText('');
      setRespondOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitRevisionRequest = async () => {
    try {
      await mutations.requestRevision.mutateAsync({
        feedbackId: feedback.id,
        sellerId: feedback.sellerId,
      });
      notify(t('sellerFeedback.revisionRequestedToast'), 'success');
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitRevisionAccept = async (value: SellerFeedbackValue) => {
    try {
      await mutations.respondRevision.mutateAsync({
        feedbackId: feedback.id,
        sellerId: feedback.sellerId,
        orderId: feedback.orderId,
        orderItemId: feedback.orderItemId,
        payload: { decision: 'ACCEPT', feedback: toPatchPayload(value) as SellerFeedbackFields },
      });
      notify(t('sellerFeedback.revisionAcceptedToast'), 'success');
      setRevisionOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitRevisionDecline = async () => {
    try {
      await mutations.respondRevision.mutateAsync({
        feedbackId: feedback.id,
        sellerId: feedback.sellerId,
        orderId: feedback.orderId,
        orderItemId: feedback.orderItemId,
        payload: { decision: 'DECLINE' },
      });
      notify(t('sellerFeedback.revisionDeclinedToast'), 'success');
      setDeclineOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', !compact && 'rounded-lg border border-border bg-surface p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {feedback.buyer && (
            <Avatar src={feedback.buyer.avatarUrl} name={feedback.buyer.fullName} size={36} />
          )}
          <div className="min-w-0">
            {feedback.buyer && <p className="font-semibold text-text">{feedback.buyer.fullName}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={toneFor(feedback.commentType)}>
                {t(`sellerFeedback.commentType.${feedback.commentType}`)}
              </Badge>
              {feedback.source === 'AUTOMATED' && (
                <Badge tone="neutral">{t('sellerFeedback.automatedFeedback')}</Badge>
              )}
              {revision && (
                <Badge tone={revision.status === 'PENDING' ? 'accent' : 'neutral'}>
                  {t(`sellerFeedback.revisionStatus.${revision.status}`)}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <span className="text-xs text-muted">{formatDate(feedback.submittedAt ?? feedback.createdAt)}</span>
      </div>

      {(feedback.commentText || feedback.comment) && (
        <p className="text-sm leading-relaxed text-text">{feedback.commentText ?? feedback.comment}</p>
      )}

      <DsrList feedback={feedback} />

      {!!feedback.images?.length && (
        <div className="grid grid-cols-5 gap-2">
          {feedback.images.map((image) => (
            <a
              key={image.key}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              className="aspect-square overflow-hidden rounded-md border border-border bg-surface-2"
            >
              <img src={image.url} alt="" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {feedback.sellerResponse && (
        <div className="rounded-md bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-text">{t('sellerFeedback.sellerResponse')}</p>
          <p className="mt-1 text-text">{feedback.sellerResponse.commentText}</p>
        </div>
      )}

      {buyerActions && pendingRevision && (
        <div className="rounded-md border border-accent/30 bg-accent/10 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-text">{t('sellerFeedback.revisionRequested')}</p>
              {revision?.expiresAt && (
                <p className="text-xs text-muted">
                  {t('sellerFeedback.revisionExpires', { date: formatDate(revision.expiresAt) })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setRevisionOpen(true)}>
                {t('sellerFeedback.acceptRevision')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDeclineOpen(true)}>
                {t('sellerFeedback.declineRevision')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {(buyerEditable || sellerActions) && (
        <div className="flex flex-wrap gap-2">
          {buyerEditable && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                {t('sellerFeedback.editFeedback')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
                {t('sellerFeedback.deleteFeedback')}
              </Button>
            </>
          )}
          {sellerActions && !feedback.sellerResponse && (
            <Button size="sm" variant="secondary" onClick={() => setRespondOpen(true)}>
              {t('sellerFeedback.respond')}
            </Button>
          )}
          {sellerCanRequestRevision && (
            <Button
              size="sm"
              variant="secondary"
              loading={mutations.requestRevision.isPending}
              onClick={submitRevisionRequest}
            >
              {t('sellerFeedback.requestRevision')}
            </Button>
          )}
          {sellerActions && revision?.status === 'PENDING' && (
            <span className="self-center text-xs text-muted">{t('sellerFeedback.waitingForBuyer')}</span>
          )}
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('sellerFeedback.editFeedback')} size="lg">
        <SellerFeedbackForm
          mode="edit"
          initialValue={feedback}
          allowImages={false}
          submitting={mutations.update.isPending}
          onSubmit={submitEdit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <Modal open={revisionOpen} onClose={() => setRevisionOpen(false)} title={t('sellerFeedback.acceptRevision')} size="lg">
        <SellerFeedbackForm
          mode="revision"
          initialValue={feedback}
          allowImages={false}
          submitting={mutations.respondRevision.isPending}
          onSubmit={submitRevisionAccept}
          onCancel={() => setRevisionOpen(false)}
        />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('sellerFeedback.deleteFeedback')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={mutations.remove.isPending} onClick={submitDelete}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('sellerFeedback.deleteConfirm')}</p>
      </Modal>

      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title={t('sellerFeedback.declineRevision')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="secondary" loading={mutations.respondRevision.isPending} onClick={submitRevisionDecline}>
              {t('sellerFeedback.declineRevision')}
            </Button>
          </>
        }
      >
        <p>{t('sellerFeedback.declineConfirm')}</p>
      </Modal>

      <Modal
        open={respondOpen}
        onClose={() => setRespondOpen(false)}
        title={t('sellerFeedback.respond')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRespondOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={mutations.respond.isPending}
              disabled={!responseText.trim()}
              onClick={submitResponse}
            >
              {t('sellerFeedback.respond')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('sellerFeedback.responseLabel')}
          value={responseText}
          maxLength={500}
          onChange={(e) => setResponseText(e.target.value)}
        />
      </Modal>
    </div>
  );
}

function DsrList({ feedback }: { feedback: SellerFeedback }) {
  const { t } = useTranslation();
  const rows = [
    ['itemAsDescribed', feedback.itemAsDescribedRating],
    ['communication', feedback.communicationRating],
    ['shippingTime', feedback.shippingTimeRating],
    ['shippingAndHandlingCharges', feedback.shippingAndHandlingChargesRating],
  ] as const;
  const visible = rows.filter(([, value]) => typeof value === 'number');
  if (!visible.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visible.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
          <span className="text-xs text-muted">{t(`sellerFeedback.summary.${key}`)}</span>
          <Rating value={value ?? 0} size={13} showValue />
        </div>
      ))}
    </div>
  );
}

function toneFor(commentType: SellerFeedbackCommentType) {
  if (commentType === 'POSITIVE') return 'success';
  if (commentType === 'NEGATIVE') return 'danger';
  return 'neutral';
}

function toPatchPayload(value: SellerFeedbackValue) {
  const fields = { ...value };
  delete fields.images;
  return fields;
}
