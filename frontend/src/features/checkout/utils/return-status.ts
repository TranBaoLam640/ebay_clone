import i18n from '@/i18n';
import type { ReturnStatus } from '../services/return-api';

/** Return status → i18n label key + badge tone classes. */
const STATUS_KEYS: Record<ReturnStatus, string> = {
  REQUESTED: 'returns.status.requested',
  APPROVED: 'returns.status.approved',
  REJECTED: 'returns.status.rejected',
  COMPLETED: 'returns.status.completed',
  CANCELLED: 'returns.status.cancelled',
};

const TONES: Record<ReturnStatus, string> = {
  REQUESTED: 'bg-rating/15 text-rating',
  APPROVED: 'bg-primary/10 text-primary',
  REJECTED: 'bg-danger/12 text-danger',
  COMPLETED: 'bg-success/12 text-success',
  CANCELLED: 'bg-muted/15 text-muted',
};

export function returnStatusLabel(status: ReturnStatus): string {
  return i18n.t(STATUS_KEYS[status] ?? 'returns.status.requested');
}

export function returnStatusTone(status: ReturnStatus): string {
  return TONES[status] ?? 'bg-surface-2 text-muted';
}
