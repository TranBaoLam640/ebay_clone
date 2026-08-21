import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { Price } from '@/components/price';
import { ProductImage } from '@/components/product-image';
import { Skeleton } from '@/components/skeleton';
import { ShipmentTrackingCard } from '@/features/shipping/components/shipment-tracking-card';
import { useInrActions, useInrRequest } from '../hooks/use-inr-requests';
import type { InrBuyerRequest } from '../types/inr.types';
import { inrResolutionLabel, inrStatusLabel, inrStatusTone } from '../utils/inr-status';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { useToast } from '@/contexts/toast-context';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/format-date';

export default function BuyerInrDetailPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const request = useInrRequest(requestId);
  const { close } = useInrActions();
  const [confirmClose, setConfirmClose] = useState(false);

  if (request.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (request.isError || !request.data) {
    return (
      <EmptyState
        icon="icon-package"
        title="Request could not be loaded"
        description={request.error ? messageFromError(request.error) : undefined}
        action={<Button variant="secondary" onClick={() => navigate(paths.orders)}>Back to orders</Button>}
      />
    );
  }

  const r = request.data as InrBuyerRequest;
  const shipment = r.shipment
    ? {
        id: r.shipment.id,
        orderId: r.orderId,
        buyerId: '',
        sellerId: r.item?.sellerId ?? '',
        shipperId: null,
        carrier: undefined,
        trackingNumber: undefined,
        status: r.shipment.status,
        estimatedDeliveryAt: r.shipment.estimatedDeliveryAt,
        pickedUpAt: r.shipment.pickedUpAt,
        deliveredAt: r.shipment.deliveredAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }
    : null;

  const closeRequest = async () => {
    try {
      await close.mutateAsync(r.id);
      notify('Request closed. Glad the item arrived.', 'success');
      setConfirmClose(false);
      request.refetch();
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={paths.order(r.orderId)} className="text-sm text-muted hover:text-primary">
            Back to order
          </Link>
          <h2 className="mt-1 text-xl font-bold text-text">Item not received</h2>
          <p className="text-xs text-muted">Request #{r.id.slice(-8).toUpperCase()}</p>
        </div>
        <Badge tone={inrStatusTone(r.status)}>{inrStatusLabel(r.status)}</Badge>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
            <ProductImage src={r.item?.image} alt={r.item?.title ?? 'Order item'} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold text-text">{r.item?.title ?? 'Order item'}</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Opened" value={formatDateTime(r.createdAt)} />
              <Field label="Preference" value={inrResolutionLabel(r.requestedResolution)} />
              <Field label="Quantity missing" value={String(r.quantityMissing)} />
              <Field label="Request amount" value={<Price cents={r.requestAmount} />} />
              {r.closedAt && <Field label="Closed" value={formatDateTime(r.closedAt)} />}
            </dl>
            {r.details && <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">{r.details}</p>}
          </div>
        </div>
      </section>

      <ShipmentTrackingCard shipment={shipment} title="Shipment status" compact />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-text">Work with the seller</p>
          <p className="text-sm text-muted">Keep messages in the linked conversation so the request history stays together.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to={paths.message(r.conversationId)}>
            <Button variant="secondary" fullWidth className="sm:w-auto">
              <Icon variant="icon-mail" size={16} />
              Message seller
            </Button>
          </Link>
          {r.status === 'OPEN' && (
            <Button variant="secondary" onClick={() => setConfirmClose(true)}>
              <Icon variant="icon-check" size={16} />
              Item arrived
            </Button>
          )}
        </div>
      </section>

      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Close request?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>Cancel</Button>
            <Button loading={close.isPending} onClick={closeRequest}>Close request</Button>
          </>
        }
      >
        <p className="text-sm text-muted">Close this request only if the missing item has arrived.</p>
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text">{value}</dd>
    </div>
  );
}
