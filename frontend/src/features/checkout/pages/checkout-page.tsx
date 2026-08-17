import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAddresses } from '@/features/account/hooks/use-addresses';
import { cartApi } from '@/features/cart/services/cart-api';
import { useQuery } from '@tanstack/react-query';
import { useCheckoutPreview, usePlaceOrder, useCapturePayPal } from '../hooks/use-checkout';
import type { CheckoutGroupResult, PaymentMethod } from '../services/checkout-api';
import { CheckoutSummary } from '../components/checkout-summary';
import { AddressPicker } from '../components/address-picker';
import { PaymentMethodPicker } from '../components/payment-method-picker';
import { PayPalApprovalModal } from '../components/paypal-approval-modal';
import { CouponField } from '../components/coupon-field';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { paths } from '@/routes/paths';

/**
 * Buyer checkout: pick address → review server-priced summary → apply coupon →
 * place a COD order. All line pricing/discounts come from the server preview so
 * the client never computes totals it can't trust.
 */
export default function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const offerId = searchParams.get('offerId') ?? undefined;
  const { notify } = useToast();
  const { list: addresses } = useAddresses();
  const placeOrder = usePlaceOrder();
  const capturePayPal = useCapturePayPal();
  // The placed group awaiting PayPal approval (null = no pending approval).
  const [pendingPayPal, setPendingPayPal] = useState<CheckoutGroupResult | null>(null);

  // The server cart drives which items are being checked out.
  const serverCart = useQuery({ queryKey: ['cart'], queryFn: cartApi.get });
  const cartItemIds = useMemo(
    () => (serverCart.data?.items ?? []).map((i) => i.id),
    [serverCart.data],
  );

  const [addressId, setAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [couponCode, setCouponCode] = useState<string | undefined>(undefined);

  // Default to the user's default address once loaded.
  const defaultAddressId = addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id;
  const effectiveAddressId = addressId ?? defaultAddressId ?? null;

  const previewInput =
    effectiveAddressId && cartItemIds.length > 0
      ? {
          selectedCartItemIds: cartItemIds,
          addressId: effectiveAddressId,
          paymentMethod,
          couponCode,
          offerId,
        }
      : null;

  const preview = useCheckoutPreview(previewInput);

  const goToOrder = (group: CheckoutGroupResult) => {
    notify(t('checkout.orderSuccess'), 'success');
    navigate(paths.order(group.orderIds[0] ?? ''), { replace: true });
  };

  const submit = async () => {
    if (!previewInput) return;
    try {
      const group = await placeOrder.mutateAsync(previewInput);
      // PayPal: order placed + provider order created — now await approval.
      if (previewInput.paymentMethod === 'PAYPAL') {
        setPendingPayPal(group);
        return;
      }
      goToOrder(group);
    } catch (err) {
      notify(messageFromError(err, t('checkout.orderError')), 'error');
    }
  };

  const approvePayPal = async () => {
    if (!pendingPayPal) return;
    try {
      await capturePayPal.mutateAsync(pendingPayPal.id);
      setPendingPayPal(null);
      goToOrder(pendingPayPal);
    } catch (err) {
      notify(messageFromError(err, t('checkout.orderError')), 'error');
    }
  };

  const cancelPayPal = () => {
    // The order stays PENDING_PAYMENT; the buyer can retry from their orders.
    setPendingPayPal(null);
    notify(t('checkout.paypalCancelled'), 'info');
    if (pendingPayPal) navigate(paths.order(pendingPayPal.orderIds[0] ?? ''), { replace: true });
  };

  if (serverCart.isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  // The cart is emptied the moment a PayPal order is placed; while its approval
  // modal is pending, keep the page mounted instead of flashing the empty state.
  if ((serverCart.data?.items.length ?? 0) === 0 && !pendingPayPal) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-16">
        <EmptyState
          icon="icon-cart"
          title={t('checkout.emptyCartTitle')}
          description={t('checkout.emptyCartDescription')}
          action={
            <Button variant="secondary" onClick={() => navigate(paths.products)}>
              {t('checkout.exploreProducts')}
            </Button>
          }
        />
      </div>
    );
  }

  // PayPal approval pending after the cart was emptied — show just the modal.
  if (pendingPayPal && (serverCart.data?.items.length ?? 0) === 0) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <PayPalApprovalModal
          open
          amount={pendingPayPal.total}
          approving={capturePayPal.isPending}
          onApprove={approvePayPal}
          onCancel={cancelPayPal}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t('checkout.pageTitle')}</h1>

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
              available={preview.data?.paymentMethods ?? ['COD']}
              selected={paymentMethod}
              onSelect={setPaymentMethod}
            />
          </section>

          <CouponField
            itemIds={cartItemIds}
            appliedCode={couponCode}
            onApply={setCouponCode}
          />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummary
            preview={preview.data}
            loading={preview.isLoading || preview.isFetching}
            error={preview.isError ? messageFromError(preview.error) : null}
            placing={placeOrder.isPending}
            canPlace={!!previewInput && !preview.isError}
            onPlace={submit}
          />
        </div>
      </div>

      <PayPalApprovalModal
        open={!!pendingPayPal}
        amount={pendingPayPal?.total ?? preview.data?.total ?? 0}
        approving={capturePayPal.isPending}
        onApprove={approvePayPal}
        onCancel={cancelPayPal}
      />
    </div>
  );
}
