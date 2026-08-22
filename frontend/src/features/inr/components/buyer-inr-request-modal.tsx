import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Input } from '@/components/input';
import { Modal } from '@/components/modal';
import { Price } from '@/components/price';
import { ProductImage } from '@/components/product-image';
import { Textarea } from '@/components/textarea';
import type { OrderDetail, OrderItem } from '@/features/checkout/services/checkout-api';
import { useInrActions } from '../hooks/use-inr-requests';
import type { InrBuyerRequest, InrResolution } from '../types/inr.types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/format-date';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';

const INR_OPEN_DELAY_MINUTES = 10;
const INR_OPEN_DELAY_MS = INR_OPEN_DELAY_MINUTES * 60_000;

interface BuyerInrRequestModalProps {
  open: boolean;
  order: OrderDetail;
  item: OrderItem | null;
  existingRequest?: InrBuyerRequest | null;
  onClose: () => void;
}

export function BuyerInrRequestModal({
  open,
  order,
  item,
  existingRequest,
  onClose,
}: BuyerInrRequestModalProps) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { create } = useInrActions();
  const [step, setStep] = useState<'info' | 'form'>('info');
  const [resolution, setResolution] = useState<InrResolution>('WANT_ITEM');
  const [quantityMissing, setQuantityMissing] = useState(1);
  const [details, setDetails] = useState('');

  const eligibility = useMemo(() => {
    if (!item) return { eligible: false, message: 'Choose an order item first.' };
    if (!order.shipment) return { eligible: false, message: 'Shipment details are not available yet.' };
    const eta = new Date(order.shipment.estimatedDeliveryAt);
    if (Number.isNaN(eta.getTime())) return { eligible: false, message: 'Estimated delivery date is unavailable.' };
    const eligibleAt = eta.getTime() + INR_OPEN_DELAY_MS;
    if (Date.now() <= eligibleAt) {
      return {
        eligible: false,
        message: `You can open this request ${INR_OPEN_DELAY_MINUTES} minutes after the estimated delivery time: ${formatDateTime(order.shipment.estimatedDeliveryAt)}.`,
      };
    }
    const windowEnd = eta.getTime() + 30 * 86_400_000;
    if (Date.now() > windowEnd) {
      return { eligible: false, message: 'The item-not-received reporting window has ended.' };
    }
    return { eligible: true, message: 'You can send a request to the seller for this item.' };
  }, [item, order.shipment]);

  if (!item) return null;

  const lineAmount = item.itemSubtotal ?? (item.unitPrice != null ? item.unitPrice * item.quantity : 0);
  const requestAmount = Math.round((lineAmount * quantityMissing) / Math.max(item.quantity, 1));

  const submit = async () => {
    try {
      const created = await create.mutateAsync({
        orderId: order.id,
        orderItemId: item.id,
        quantityMissing,
        requestedResolution: resolution,
        details: details.trim() || undefined,
      });
      notify('Item-not-received request sent to the seller.', 'success');
      onClose();
      navigate(paths.inrRequest(created.id));
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Item not received"
      size="lg"
      footer={
        existingRequest ? (
          <Link to={paths.inrRequest(existingRequest.id)}>
            <Button>View request</Button>
          </Link>
        ) : step === 'info' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button disabled={!eligibility.eligible} onClick={() => setStep('form')}>Continue</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep('info')}>Back</Button>
            <Button loading={create.isPending} onClick={submit}>Send request</Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-border bg-surface-2 p-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface">
            <ProductImage src={item.image} alt={item.title ?? 'Order item'} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold text-text">{item.title ?? 'Order item'}</p>
            <p className="mt-1 text-xs text-muted">Order #{order.id.slice(-8).toUpperCase()}</p>
            <p className="mt-1 text-xs text-muted">Quantity ordered: {item.quantity}</p>
            {order.shipment && (
              <p className="mt-1 text-xs text-muted">Estimated delivery: {formatDateTime(order.shipment.estimatedDeliveryAt)}</p>
            )}
          </div>
        </div>

        {existingRequest ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-semibold text-text">
              <Icon variant="icon-check" size={16} className="text-primary" />
              An open request already exists for this item.
            </p>
            <p className="mt-1 text-sm text-muted">You can review the status or message the seller from the request detail page.</p>
          </div>
        ) : step === 'info' ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="font-semibold text-text">We hope you get your item soon</p>
              <p className="mt-1 text-sm text-muted">
                Send this request to the seller so they can help with the missing item. SBay records the request and keeps the seller conversation linked to it.
              </p>
            </div>
            <p className={eligibility.eligible ? 'text-sm text-success' : 'text-sm text-muted'}>{eligibility.message}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-text">Tell the seller what you prefer</legend>
              <RadioOption label="I still want the item" checked={resolution === 'WANT_ITEM'} onChange={() => setResolution('WANT_ITEM')} />
              <RadioOption label="I want a refund" checked={resolution === 'REFUND'} onChange={() => setResolution('REFUND')} />
            </fieldset>
            <Input
              label="Quantity missing"
              type="number"
              min={1}
              max={item.quantity}
              value={quantityMissing}
              onChange={(e) => setQuantityMissing(Math.min(item.quantity, Math.max(1, Number(e.target.value) || 1)))}
            />
            <Textarea
              label="Message to seller"
              rows={4}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add details that help the seller understand what happened."
            />
            <div className="flex items-center justify-between rounded-lg bg-surface-2 p-3 text-sm">
              <span className="text-muted">Request amount snapshot</span>
              <Price cents={requestAmount} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RadioOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-surface-2">
      <input type="radio" checked={checked} onChange={onChange} className="h-4 w-4 accent-current" />
      {label}
    </label>
  );
}
