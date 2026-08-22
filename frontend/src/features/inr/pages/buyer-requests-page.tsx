import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Pagination } from '@/components/pagination';
import { Price } from '@/components/price';
import { ProductImage } from '@/components/product-image';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/format-date';
import { useBuyerInrRequests } from '../hooks/use-inr-requests';
import type { InrStatus } from '../types/inr.types';
import { inrCloseReasonLabel, inrResolutionLabel, inrStatusLabel, inrStatusTone } from '../utils/inr-status';

export default function BuyerRequestsPage() {
  const [status, setStatus] = useState<InrStatus | ''>('OPEN');
  const [page, setPage] = useState(1);
  const requests = useBuyerInrRequests({
    page,
    limit: 10,
    status: status || undefined,
  });

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Requests and disputes</h2>
          <p className="text-sm text-muted">Item-not-received requests for your purchases.</p>
        </div>
        <div className="w-full sm:w-44">
          <Select
            aria-label="Request status"
            value={status}
            onValueChange={(v) => {
              setStatus(v as InrStatus | '');
              setPage(1);
            }}
            options={[
              { value: 'OPEN', label: 'Open requests' },
              { value: 'CLOSED', label: 'Closed requests' },
              { value: '', label: 'All requests' },
            ]}
          />
        </div>
      </div>

      {requests.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : requests.isError ? (
        <EmptyState
          icon="icon-package"
          title="Requests could not be loaded"
          description={messageFromError(requests.error)}
          action={
            <Button variant="secondary" onClick={() => requests.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (requests.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="icon-package" title="No requests found" description="Your item-not-received requests will appear here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.data!.items.map((request) => (
            <li key={request.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                    <ProductImage src={request.item?.image} alt={request.item?.title ?? 'Order item'} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={inrStatusTone(request.status)}>{inrStatusLabel(request.status)}</Badge>
                      <span className="text-xs text-muted">Item not received</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-text">{request.item?.title ?? 'Order item'}</p>
                    <p className="mt-1 text-xs text-muted">Opened {formatDateTime(request.createdAt)}</p>
                    <p className="mt-1 text-xs text-muted">
                      {inrResolutionLabel(request.requestedResolution)} | Qty missing: {request.quantityMissing}
                    </p>
                    {request.closeReason && <p className="mt-1 text-xs font-medium text-success">{inrCloseReasonLabel(request.closeReason)}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                  <Price cents={request.requestAmount} className="text-sm" />
                  <Link to={paths.inrRequest(request.id)}>
                    <Button size="sm" variant="secondary" fullWidth className="sm:w-auto">
                      See details
                      <Icon variant="icon-chevron-right" size={14} />
                    </Button>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {requests.data?.meta && (
        <div className="mt-6">
          <Pagination page={requests.data.meta.page} totalPages={requests.data.meta.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
