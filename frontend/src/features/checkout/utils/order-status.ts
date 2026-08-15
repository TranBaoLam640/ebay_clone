/**
 * Order status → English label + badge tone classes. Covers the backend's
 * known states with a neutral fallback so an unseen status never breaks the UI.
 *
 * Labels are i18n key strings; callers use t() to resolve them, or pass them
 * through orderStatusLabel() which resolves via the i18n singleton so this util
 * can be used in both component and non-component contexts.
 */
import i18n from '@/i18n';

/** Maps backend status codes to i18n translation keys under checkout.status.* */
const STATUS_KEYS: Record<string, string> = {
  PENDING_PAYMENT: 'checkout.status.pendingPayment',
  PAYMENT_PENDING: 'checkout.status.pendingPayment',
  CONFIRMED: 'checkout.status.confirmed',
  PROCESSING: 'checkout.status.processing',
  SHIPPED: 'checkout.status.shipped',
  DELIVERED: 'checkout.status.delivered',
  COMPLETED: 'checkout.status.completed',
  CANCELLED: 'checkout.status.cancelled',
  PAYMENT_FAILED: 'checkout.status.paymentFailed',
  REFUNDED: 'checkout.status.refunded',
};

const TONES: Record<string, string> = {
  PENDING_PAYMENT: 'bg-rating/15 text-rating',
  PAYMENT_PENDING: 'bg-rating/15 text-rating',
  CONFIRMED: 'bg-primary/10 text-primary',
  PROCESSING: 'bg-primary/10 text-primary',
  SHIPPED: 'bg-primary/10 text-primary',
  DELIVERED: 'bg-success/12 text-success',
  COMPLETED: 'bg-success/12 text-success',
  CANCELLED: 'bg-danger/12 text-danger',
  PAYMENT_FAILED: 'bg-danger/12 text-danger',
  REFUNDED: 'bg-muted/15 text-muted',
};

export function orderStatusLabel(status: string): string {
  const key = STATUS_KEYS[status];
  return key ? i18n.t(key) : status;
}

export function orderStatusTone(status: string): string {
  return TONES[status] ?? 'bg-surface-2 text-muted';
}
