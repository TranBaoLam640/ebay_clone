import { useState } from 'react';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format-date';
import { useShipmentActions, useShipperShipments } from '../hooks/use-shipments';
import type { Shipment } from '../types';
import { shipmentStatusLabel, shipmentStatusTone } from '../utils/shipment-status';

type Scope = 'available' | 'mine';

export default function ShipperShipmentsPage() {
  const [scope, setScope] = useState<Scope>('available');
  const available = useShipperShipments('available');
  const mine = useShipperShipments('mine');
  const active = scope === 'available' ? available : mine;
  const actions = useShipmentActions();
  const { notify } = useToast();

  const run = async (action: 'pickup' | 'deliver', shipmentId: string) => {
    try {
      await actions[action].mutateAsync(shipmentId);
      notify(action === 'pickup' ? 'Shipment picked up' : 'Shipment delivered', 'success');
    } catch (error) {
      notify(messageFromError(error), 'error');
    }
  };

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-5 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Shipment dashboard</h1>
          <p className="text-sm text-muted">Manage SBay Express pickup and delivery queues.</p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-border bg-surface p-1">
          <Tab active={scope === 'available'} onClick={() => setScope('available')}>
            Available
          </Tab>
          <Tab active={scope === 'mine'} onClick={() => setScope('mine')}>
            Mine
          </Tab>
        </div>
      </div>

      {active.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : active.isError ? (
        <EmptyState
          icon="icon-truck"
          title="Shipments could not be loaded"
          description={messageFromError(active.error)}
          action={
            <Button variant="secondary" onClick={() => active.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (active.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon="icon-truck"
          title={scope === 'available' ? 'No available shipments' : 'No assigned shipments'}
          description={
            scope === 'available'
              ? 'New paid orders ready for pickup will appear here.'
              : 'Picked up and delivered shipments assigned to you will appear here.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {active.data!.items.map((shipment) => (
            <ShipmentRow
              key={shipment.id}
              shipment={shipment}
              onPickup={() => run('pickup', shipment.id)}
              onDeliver={() => run('deliver', shipment.id)}
              pickupLoading={actions.pickup.isPending}
              deliverLoading={actions.deliver.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-accent text-on-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ShipmentRow({
  shipment,
  onPickup,
  onDeliver,
  pickupLoading,
  deliverLoading,
}: {
  shipment: Shipment;
  onPickup: () => void;
  onDeliver: () => void;
  pickupLoading: boolean;
  deliverLoading: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-text">
              #{shipment.orderId.slice(-8).toUpperCase()}
            </h2>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                shipmentStatusTone(shipment.status),
              )}
            >
              {shipmentStatusLabel(shipment.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {shipment.carrier} · {shipment.trackingNumber}
          </p>
          <p className="mt-1 text-xs text-muted">
            ETA {formatDateTime(shipment.estimatedDeliveryAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shipment.status === 'READY_FOR_PICKUP' && (
            <Button variant="accent" onClick={onPickup} loading={pickupLoading}>
              <Icon variant="icon-truck" size={16} />
              Pick up
            </Button>
          )}
          {shipment.status === 'IN_TRANSIT' && (
            <Button variant="accent" onClick={onDeliver} loading={deliverLoading}>
              <Icon variant="icon-check" size={16} />
              Mark delivered
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
