import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../services/checkout-api';
import type { CheckoutGroupResult, PaymentMethod } from '../services/checkout-api';
import { usePayForOrder, useCapturePayPal } from '../hooks/use-checkout';
import { AddressPicker } from '../components/address-picker';
import { PaymentMethodPicker } from '../components/payment-method-picker';
import { PayPalApprovalModal } from '../components/paypal-approval-modal';
import { useAddresses } from '@/features/account/hooks/use-addresses';
import { Button } from '@/components/button';
import { Price } from '@/components/price';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { paths } from '@/routes/paths';

/**
 * Checkout for a single won order — the eBay-style "commit to buy" step after an
 * auction win or Buy It Now. The order already exists (priced, PENDING_PAYMENT,
 * no address yet); here the winner picks a saved address + payment method and
 * pays, reusing the same COD/PayPal flow as cart checkout.
 */
export default function CheckoutOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { list: addresses } = useAddresses();
  const payForOrder = usePayForOrder();
  const capturePayPal = useCapturePayPal();
  const [pendingPayPal, setPendingPayPal] = useState<CheckoutGroupResult | null>(null);

  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId!),
    enabled: !!orderId,
  });

  const [addressId, setAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');

  const defaultAddressId =
    addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id;
  const effectiveAddressId = addressId ?? defaultAddressId ?? null;

  // Only a still-payable order belongs here. We key off orderStatus, NOT the
  // presence of a shipping address: a PayPal attempt that was cancelled (or a
  // swallowed COD confirm) leaves the order PENDING_PAYMENT *with* an address,
  // and the buyer must still be able to retry payment. Payment endpoints are
  // idempotent, so re-running checkout on an already-wrapped order just replays
  // the same group and retries the payment.
  const alreadyCheckedOut =
    !!order.data && order.data.orderStatus !== 'PENDING_PAYMENT';
  useEffect(() => {
    if (orderId && alreadyCheckedOut)
      navigate(paths.order(orderId), { replace: true });
  }, [orderId, alreadyCheckedOut, navigate]);

  const goToOrder = async () => {
    // Refetch the order into cache *before* navigating so the detail page shows
    // the post-payment status immediately. Without this the mutation's
    // invalidation races the navigation: the detail page would mount on the
    // stale PENDING_PAYMENT snapshot and only correct itself on a manual
    // refresh. (The PayPal capture path never invalidated this key at all.)
    await queryClient
      .invalidateQueries({ queryKey: ['order', orderId] })
      .catch(() => undefined);
    notify(t('checkout.orderSuccess'), 'success');
    navigate(paths.order(orderId ?? ''), { replace: true });
  };

  const submit = async () => {
    if (!orderId || !effectiveAddressId) return;
    try {
      const group = await payForOrder.mutateAsync({
        orderId,
        addressId: effectiveAddressId,
        paymentMethod,
      });
      if (paymentMethod === 'PAYPAL') {
        setPendingPayPal(group);
        return;
      }
      await goToOrder();
    } catch (err) {
      notify(messageFromError(err, t('checkout.orderError')), 'error');
    }
  };

  const approvePayPal = async () => {
    if (!pendingPayPal) return;
    try {
      await capturePayPal.mutateAsync(pendingPayPal.id);
      setPendingPayPal(null);
      await goToOrder();
    } catch (err) {
      notify(messageFromError(err, t('checkout.orderError')), 'error');
    }
  };

  const cancelPayPal = () => {
    // The order stays PENDING_PAYMENT; the buyer can retry from their orders.
    setPendingPayPal(null);
    notify(t('checkout.paypalCancelled'), 'info');
    navigate(paths.order(orderId ?? ''), { replace: true });
  };

  if (order.isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (order.isError || !order.data) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-16">
        <EmptyState
          icon="icon-package"
          title={t('checkout.orderNotFound')}
          action={
            <Button variant="secondary" onClick={() => navigate(paths.orders)}>
              {t('checkout.backToOrders')}
            </Button>
          }
        />
      </div>
    );
  }

  // Redirect in flight — avoid flashing the form for an already-paid order.
  if (alreadyCheckedOut) return null;

  const o = order.data;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold text-text">
        {t('checkout.completePaymentTitle')}
      </h1>
      <p className="mb-6 text-sm text-muted">{t('checkout.completePaymentSubtitle')}</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <AddressPicker
            addresses={addresses.data ?? []}
            loading={addresses.isLoading}
            selectedId={effectiveAddressId}
            onSelect={setAddressId}
          />

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-text">
              <Icon variant="icon-lock" size={18} />
              {t('checkout.paymentMethod')}
            </h2>
            <PaymentMethodPicker
              available={['COD', 'PAYPAL']}
              selected={paymentMethod}
              onSelect={setPaymentMethod}
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 font-bold text-text">{t('checkout.orderSummary')}</h2>
            <ul className="flex flex-col gap-3">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {it.image ? (
                      <img src={it.image} alt={it.title ?? ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        <Icon variant="icon-package" size={20} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-text">{it.title ?? '—'}</p>
                    <p className="text-xs text-muted">{t('checkout.qty', { count: it.quantity })}</p>
                  </div>
                  {it.itemSubtotal != null && (
                    <Price cents={it.itemSubtotal} className="shrink-0 text-sm" />
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="font-semibold text-text">{t('checkout.total')}</span>
              <Price cents={o.total} className="text-lg" />
            </div>
            <Button
              variant="accent"
              size="lg"
              fullWidth
              className="mt-4"
              loading={payForOrder.isPending}
              disabled={!effectiveAddressId}
              onClick={submit}
            >
              {t('checkout.payNow')}
            </Button>
            {!effectiveAddressId && (
              <p className="mt-2 text-center text-xs text-muted">
                {t('checkout.addAddressFirst')}
              </p>
            )}
          </section>
        </div>
      </div>

      <PayPalApprovalModal
        open={!!pendingPayPal}
        amount={pendingPayPal?.total ?? o.total}
        approving={capturePayPal.isPending}
        onApprove={approvePayPal}
        onCancel={cancelPayPal}
      />
    </div>
  );
}
