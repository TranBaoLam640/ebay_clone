import { Icon } from '@/components/icon';
import { formatDateTime } from '@/utils/format-date';
import { cn } from '@/utils/cn';
import type { Shipment } from '../types';
import { shipmentStatusLabel, shipmentStatusTone } from '../utils/shipment-status';

interface ShipmentTrackingCardProps {
  shipment: Shipment | null;
  title?: string;
  compact?: boolean;
}

export function ShipmentTrackingCard({
  shipment,
  title = 'Shipment tracking',
  compact = false,
}: ShipmentTrackingCardProps) {
  if (!shipment) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-text">
          <Icon variant="icon-truck" size={16} />
          {title}
        </h3>
        <p className="text-sm text-muted">
          Tracking information is not available for this legacy order.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-text">
            <Icon variant="icon-truck" size={16} />
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {shipment.carrier && shipment.trackingNumber
              ? `${shipment.carrier} | ${shipment.trackingNumber}`
              : 'Tracking details are protected for this buyer view.'}
          </p>
        </div>
        <span
          className={cn(
            'w-fit rounded-full px-3 py-1 text-xs font-semibold',
            shipmentStatusTone(shipment.status),
          )}
        >
          {shipmentStatusLabel(shipment.status)}
        </span>
      </div>
      <dl className={cn('mt-4 grid gap-3 text-sm', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
        <ShipmentField label="Estimated delivery" value={formatDateTime(shipment.estimatedDeliveryAt)} />
        <ShipmentField
          label="Picked up"
          value={shipment.pickedUpAt ? formatDateTime(shipment.pickedUpAt) : 'Pending'}
        />
        <ShipmentField
          label="Delivered"
          value={shipment.deliveredAt ? formatDateTime(shipment.deliveredAt) : 'Pending'}
        />
      </dl>
    </section>
  );
}

function ShipmentField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text">{value}</dd>
    </div>
  );
}
