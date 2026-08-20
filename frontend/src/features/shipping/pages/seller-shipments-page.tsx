import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/skeleton';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { useSellerShipments } from '../hooks/use-shipments';
import { ShipmentTrackingCard } from '../components/shipment-tracking-card';

export default function SellerShipmentsPage() {
  const shipments = useSellerShipments();

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-text">Sold item shipments</h2>
      {shipments.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : shipments.isError ? (
        <EmptyState
          icon="icon-truck"
          title="Shipments could not be loaded"
          description={messageFromError(shipments.error)}
          action={
            <Button variant="secondary" onClick={() => shipments.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (shipments.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon="icon-truck"
          title="No seller shipments yet"
          description="Confirmed orders for your products will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {shipments.data!.items.map((shipment) => (
            <ShipmentTrackingCard
              key={shipment.id}
              shipment={shipment}
              title={`Order #${shipment.orderId.slice(-8).toUpperCase()}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
