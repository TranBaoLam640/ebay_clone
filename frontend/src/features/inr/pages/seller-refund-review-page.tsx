import { Link, useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Price } from "@/components/price";
import { ProductImage } from "@/components/product-image";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/contexts/toast-context";
import { messageFromError } from "@/features/auth/utils/auth-errors";
import { useInrActions, useInrRefundPreview } from "../hooks/use-inr-requests";
import { paths } from "@/routes/paths";
import { formatDate } from "@/utils/format-date";

export default function SellerRefundReviewPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const preview = useInrRefundPreview(requestId);
  const { refund } = useInrActions();
  const idempotencyKey = useRef<string | null>(null);

  const submit = async () => {
    if (!requestId) return;
    idempotencyKey.current ||= crypto.randomUUID();
    try {
      await refund.mutateAsync({
        requestId,
        idempotencyKey: idempotencyKey.current,
      });
      notify("Refund completed.", "success");
      navigate(paths.account.requestDispute(requestId), { replace: true });
    } catch (err) {
      notify(messageFromError(err, "Refund could not be completed."), "error");
    }
  };

  if (preview.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (preview.isError || !preview.data || !requestId) {
    return (
      <EmptyState
        icon="icon-package"
        title="Refund could not be loaded"
        description={
          preview.error ? messageFromError(preview.error) : undefined
        }
        action={
          <Link to={paths.account.requestsDisputes}>
            <Button variant="secondary">Back to requests</Button>
          </Link>
        }
      />
    );
  }

  const p = preview.data;
  const chargeMessage =
    p.paymentMethod === "PAYPAL"
      ? "The refund will be processed through the original PayPal payment."
      : "SBay will record this COD refund as completed for the original cash-on-delivery order. Arrange any offline cash handoff according to your seller process.";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-xl border border-border bg-surface p-5">
        <Link
          to={paths.account.requestDispute(requestId)}
          className="text-sm text-muted hover:text-primary"
        >
          Back to request
        </Link>
        <h2 className="mt-2 text-2xl font-extrabold text-text">
          Review and refund
        </h2>

        <div className="mt-6 flex items-center justify-between border-b border-border pb-5">
          <span className="font-semibold text-text">Total refund</span>
          <Price cents={p.refundAmount} className="text-xl font-extrabold" />
        </div>

        <div className="mt-5">
          <h3 className="font-semibold text-text">Refund summary</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <SummaryRow
              label="Purchase price"
              value={p.summary.purchasePrice}
            />
            <SummaryRow label="Shipping" value={p.summary.shipping} />
            <SummaryRow label="Fee credits" value={p.summary.feeCredits} />
          </dl>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
            <span className="font-semibold text-text">Amount you owe</span>
            <Price
              cents={p.summary.amountYouOwe}
              className="text-lg font-bold"
            />
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-surface-2 p-4">
          <h3 className="font-semibold text-text">How you'll be charged</h3>
          <p className="mt-2 text-sm text-muted">{chargeMessage}</p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            variant="accent"
            size="lg"
            loading={refund.isPending}
            disabled={!p.refundable}
            onClick={submit}
          >
            Refund now
          </Button>
        </div>
      </section>

      <aside className="rounded-xl border border-border bg-surface p-5 lg:self-start">
        <div className="flex gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
            <ProductImage
              src={p.product.image}
              alt={p.product.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-3 text-sm font-semibold text-text">
              {p.product.title}
            </p>
          </div>
        </div>

        <dl className="mt-5 flex flex-col gap-3 text-sm">
          <Field
            label="Order number"
            value={p.orderId.slice(-8).toUpperCase()}
          />
          <Field
            label="Request ID"
            value={p.requestId.slice(-8).toUpperCase()}
          />
          <Field
            label="Request amount"
            value={<Price cents={p.refundAmount} />}
          />
          <Field label="Buyer" value={p.buyer.displayName} />
          <Field label="Date purchased" value={formatDate(p.datePurchased)} />
        </dl>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-text">
        <Price cents={value} />
      </dd>
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
