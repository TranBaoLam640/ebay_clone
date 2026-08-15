import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ordersApi, type OrderItem } from '../services/checkout-api';
import { orderStatusLabel, orderStatusTone } from '../utils/order-status';
import { returnStatusLabel, returnStatusTone } from '../utils/return-status';
import { useReturns } from '../hooks/use-returns';
import { ReturnRequestForm, type ReturnFormValue } from '../components/return-request-form';
import { useReviewMutations } from '@/features/product-detail/hooks/use-review-mutations';
import { ReviewForm } from '@/features/product-detail/components/review-form';
import { sellerApi } from '@/features/sellers/services/seller-api';
import {
  SellerFeedbackForm,
  type SellerFeedbackValue,
} from '@/features/sellers/components/seller-feedback-form';
import { Price } from '@/components/price';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/button';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { formatDate } from '@/utils/format-date';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

/** Full order view: status, shipping address, priced line items, totals. */
export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const { notify } = useToast();
  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId!),
    enabled: !!orderId,
  });

  const { create: createReview } = useReviewMutations();
  const { list: returns, create: createReturn } = useReturns();
  // Review modal targets one item; return & seller feedback are per-order.
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Track a just-submitted feedback so the section flips to "rated" instantly.
  const [feedbackDone, setFeedbackDone] = useState(false);
  const createFeedback = useMutation({
    mutationFn: (input: SellerFeedbackValue) =>
      sellerApi.createFeedback(orderId!, input),
  });

  if (order.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (order.isError || !order.data) {
    return (
      <EmptyState
        icon="icon-package"
        title={t('checkout.orderNotFound')}
        action={
          <Link to={paths.orders}>
            <Button variant="secondary">{t('checkout.backToOrders')}</Button>
          </Link>
        }
      />
    );
  }

  const o = order.data;
  // Reviews & returns are only actionable once the order is delivered.
  const canReviewOrReturn = o.orderStatus === 'DELIVERED';
  // The backend allows one return request per order — find this order's, if any.
  const existingReturn = returns.data?.find((r) => r.orderId === o.id) ?? null;

  const submitReview = async (value: { rating: number; comment?: string }) => {
    if (!reviewItem) return;
    try {
      await createReview.mutateAsync({
        // Reviews address the product by its public uuid.
        productId: reviewItem.productUuid!,
        orderId: o.id,
        orderItemId: reviewItem.id,
        rating: value.rating,
        comment: value.comment,
      });
      notify(t('reviews.submittedToast'), 'success');
      setReviewItem(null);
      // Refresh so the item flips to a "reviewed" badge.
      order.refetch();
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitReturn = async (value: ReturnFormValue) => {
    try {
      await createReturn.mutateAsync({
        orderId: o.id,
        orderItemId: value.orderItemId,
        quantity: value.quantity,
        reason: value.reason,
        details: value.details,
      });
      notify(t('returns.submittedToast'), 'success');
      setReturnOpen(false);
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  const submitFeedback = async (value: SellerFeedbackValue) => {
    try {
      await createFeedback.mutateAsync(value);
      notify(t('sellerFeedback.submittedToast'), 'success');
      setFeedbackDone(true);
      setFeedbackOpen(false);
      // Refresh so `sellerRated` persists the disabled state across reloads.
      order.refetch();
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={paths.orders} className="text-sm text-muted hover:text-primary">
            ← {t('checkout.ordersLink')}
          </Link>
          <h2 className="mt-1 text-xl font-bold text-text">#{o.id.slice(-8).toUpperCase()}</h2>
          <p className="text-xs text-muted">{formatDate(o.createdAt)}</p>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            orderStatusTone(o.orderStatus),
          )}
        >
          {orderStatusLabel(o.orderStatus)}
        </span>
      </div>

      {/* Awaiting-payment prompt. Shown for ANY still-unpaid order (keyed off
          status, not address presence) so a cancelled/failed payment can always
          be retried — a not-yet-paid auction / Buy-It-Now win has no address yet,
          while a retry after a cancelled PayPal already has one. */}
      {o.orderStatus === 'PENDING_PAYMENT' && (
        <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Icon variant="icon-lock" size={18} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold text-text">{t('checkout.awaitingPaymentTitle')}</p>
              <p className="text-sm text-muted">{t('checkout.awaitingPaymentDescription')}</p>
            </div>
          </div>
          <Link to={paths.orderCheckout(o.id)} className="shrink-0">
            <Button variant="accent" fullWidth className="sm:w-auto">
              {t('checkout.completeCheckout')}
            </Button>
          </Link>
        </section>
      )}

      {/* Shipping address — absent on a not-yet-paid auction / Buy-It-Now win
          (the winner picks it during checkout), present once chosen. */}
      {o.shippingAddress && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-text">
            <Icon variant="icon-map-pin" size={16} />
            {t('checkout.shipTo')}
          </h3>
          <p className="text-sm text-text">
            {o.shippingAddress.fullName} · {o.shippingAddress.phone}
          </p>
          <p className="text-sm text-muted">
            {o.shippingAddress.addressLine}, {o.shippingAddress.ward}, {o.shippingAddress.district},{' '}
            {o.shippingAddress.province}
          </p>
        </section>
      )}

      {/* Items */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-bold text-text">{t('checkout.items')}</h3>
        <ul className="flex flex-col gap-4">
          {o.items.map((it) => {
            // Render entirely from the order's stored snapshot — no per-item
            // product fetch. Title, image, and price are captured at checkout.
            const title = it.title ?? '';
            const lineTotal =
              it.itemSubtotal ?? (it.unitPrice != null ? it.unitPrice * it.quantity : null);
            const image = it.image ?? null;
            return (
              <li key={it.id} className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {image ? (
                    <img src={image} alt={title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      <Icon variant="icon-package" size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Link to the product only when we have its public uuid. */}
                  {it.productUuid ? (
                    <Link
                      to={paths.product(it.productUuid)}
                      className="line-clamp-2 text-sm font-medium text-text hover:text-primary"
                    >
                      {title || t('checkout.items')}
                    </Link>
                  ) : (
                    <span className="line-clamp-2 text-sm font-medium text-text">{title || '—'}</span>
                  )}
                  <p className="mt-0.5 text-xs text-muted">{t('checkout.qty', { count: it.quantity })}</p>
                  {/* Reviewing is per-item (one review each); returns are per-order.
                      Once reviewed, keep the button but disable it (label flips). */}
                  {canReviewOrReturn && it.productUuid && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={it.reviewed}
                      onClick={() => setReviewItem(it)}
                      className="mt-2"
                    >
                      <Icon variant={it.reviewed ? 'icon-check' : 'icon-star'} size={14} />
                      {it.reviewed ? t('reviews.reviewed') : t('reviews.writeReview')}
                    </Button>
                  )}
                </div>
                {lineTotal != null && <Price cents={lineTotal} className="shrink-0 text-sm" />}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{t('checkout.subtotal')}</span>
            <Price cents={o.subtotal} />
          </div>
          {o.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">{t('checkout.discount')}</span>
              <span className="text-success">−{formatVnd(o.discount)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
            <span className="font-semibold text-text">{t('checkout.total')}</span>
            <Price cents={o.total} className="text-lg" />
          </div>
        </div>
      </section>

      {/* Return: one request per order. Show status once requested, else a button. */}
      {canReviewOrReturn && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-text">
              <Icon variant="icon-package" size={16} />
              {t('returns.sectionTitle')}
            </div>
            {existingReturn ? (
              <span
                className={cn(
                  'w-fit rounded-full px-3 py-1 text-xs font-semibold',
                  returnStatusTone(existingReturn.status),
                )}
              >
                {returnStatusLabel(existingReturn.status)}
              </span>
            ) : (
              <Button size="sm" variant="secondary" fullWidth className="sm:w-auto" onClick={() => setReturnOpen(true)}>
                <Icon variant="icon-package" size={14} />
                {t('returns.requestReturn')}
              </Button>
            )}
          </div>

          {/* Full detail of the submitted return request. */}
          {existingReturn && (
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <ReturnField
                label={t('returns.fieldProduct')}
                value={
                  o.items.find((it) => it.id === existingReturn.orderItemId)?.title ??
                  t('checkout.items')
                }
              />
              <ReturnField label={t('returns.fieldReason')} value={t(`returns.reason.${existingReturn.reason}`)} />
              <ReturnField label={t('returns.fieldQuantity')} value={String(existingReturn.quantity)} />
              <ReturnField label={t('returns.fieldRequestedAt')} value={formatDate(existingReturn.createdAt)} />
              {existingReturn.details && (
                <div className="sm:col-span-2">
                  <ReturnField label={t('returns.fieldDetails')} value={existingReturn.details} />
                </div>
              )}
              {existingReturn.cancelledAt && (
                <ReturnField label={t('returns.fieldCancelledAt')} value={formatDate(existingReturn.cancelledAt)} />
              )}
              <div className="sm:col-span-2">
                <p className="text-xs text-muted">{t('returns.alreadyRequested')}</p>
              </div>
            </dl>
          )}
        </section>
      )}

      {/* Seller feedback: one per order once delivered. Keep the button after
          rating but disable it — `sellerRated` (backend) survives a reload,
          `feedbackDone` flips it the instant this session submits. */}
      {canReviewOrReturn && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <Icon variant="icon-user" size={16} />
            {t('sellerFeedback.sectionTitle')}
          </div>
          {(() => {
            const rated = feedbackDone || o.sellerRated;
            return (
              <div className="flex flex-col gap-1 sm:items-end">
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  className="sm:w-auto"
                  disabled={rated}
                  onClick={() => setFeedbackOpen(true)}
                >
                  <Icon variant={rated ? 'icon-check' : 'icon-star'} size={14} />
                  {rated ? t('sellerFeedback.rated') : t('sellerFeedback.rateSeller')}
                </Button>
                {rated && <p className="text-xs text-muted">{t('sellerFeedback.thanks')}</p>}
              </div>
            );
          })()}
        </section>
      )}

      <Modal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={t('sellerFeedback.modalTitle')}
      >
        <SellerFeedbackForm
          submitting={createFeedback.isPending}
          onSubmit={submitFeedback}
          onCancel={() => setFeedbackOpen(false)}
        />
      </Modal>

      <Modal
        open={!!reviewItem}
        onClose={() => setReviewItem(null)}
        title={t('reviews.modalTitle')}
      >
        <ReviewForm
          submitting={createReview.isPending}
          onSubmit={submitReview}
          onCancel={() => setReviewItem(null)}
        />
      </Modal>

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title={t('returns.modalTitle')}
      >
        <ReturnRequestForm
          items={o.items}
          submitting={createReturn.isPending}
          onSubmit={submitReturn}
          onCancel={() => setReturnOpen(false)}
        />
      </Modal>
    </div>
  );
}

function formatVnd(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cents);
}

/** A labeled read-only field (term + description) for the return detail list. */
function ReturnField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
