/**
 * Backend stores prices as integer VND (đồng), not cents — e.g. 25000000 is
 * 25.000.000 ₫. Format straight to a VND display string with no division.
 */
const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return vndFormatter.format(amount);
}

/** Plain grouped number without currency symbol (e.g. for inputs). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}
