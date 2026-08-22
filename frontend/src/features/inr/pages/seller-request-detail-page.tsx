import { Link, useParams } from "react-router-dom";
import { useCallback, useState } from "react";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { Price } from "@/components/price";
import { ProductImage } from "@/components/product-image";
import { Select } from "@/components/select";
import { Skeleton } from "@/components/skeleton";
import { ShipmentTrackingCard } from "@/features/shipping/components/shipment-tracking-card";
import { ReplacementResolutionCard } from "../components/replacement-resolution-card";
import {
  useCarriers,
  useInrActions,
  useInrRequest,
} from "../hooks/use-inr-requests";
import { useInrReplacementRealtime } from "../hooks/use-inr-replacement-realtime";
import type {
  InrReplacementAction,
  InrSellerRequest,
} from "../types/inr.types";
import {
  inrCloseReasonLabel,
  inrResolutionLabel,
  inrStatusLabel,
  inrStatusTone,
} from "../utils/inr-status";
import { messageFromError } from "@/features/auth/utils/auth-errors";
import { useToast } from "@/contexts/toast-context";
import { paths } from "@/routes/paths";
import { formatDateTime } from "@/utils/format-date";

export default function SellerRequestDetailPage() {
  const { requestId } = useParams();
  const { notify } = useToast();
  const request = useInrRequest(requestId);
  const { refetch } = request;
  const carriers = useCarriers();
  const {
    updateTrackingEvidence,
    proposeReplacement,
    acceptReplacement,
    declineReplacement,
    refundInstead,
    prepareReplacementShipment,
  } = useInrActions();
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [carrierId, setCarrierId] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [loadingAction, setLoadingAction] =
    useState<InrReplacementAction | null>(null);
  const refreshRequest = useCallback(() => {
    refetch();
  }, [refetch]);

  useInrReplacementRealtime(request.data?.conversationId, refreshRequest);

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
        description={
          request.error ? messageFromError(request.error) : undefined
        }
        action={
          <Link to={paths.account.requestsDisputes}>
            <Button variant="secondary">Back to requests</Button>
          </Link>
        }
      />
    );
  }

  const r = request.data as InrSellerRequest;
  const shipment = r.shipment
    ? {
        ...r.shipment,
        orderId: r.orderId,
        buyerId: r.buyer?.id ?? "",
        sellerId: r.item?.sellerId ?? "",
        shipperId: null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }
    : null;

  const submitTracking = async () => {
    try {
      await updateTrackingEvidence.mutateAsync({
        requestId: r.id,
        input: { carrierId, trackingId: trackingId.trim() },
      });
      notify("Tracking evidence updated.", "success");
      setTrackingOpen(false);
      setTrackingId("");
      request.refetch();
    } catch (err) {
      notify(messageFromError(err), "error");
    }
  };

  const runReplacementAction = async (
    action: InrReplacementAction,
    task: () => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      setLoadingAction(action);
      await task();
      notify(successMessage, "success");
    } catch (err) {
      notify(messageFromError(err), "error");
    } finally {
      setLoadingAction(null);
      request.refetch();
    }
  };

  const carrierOptions = (carriers.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));
  const canSubmitTracking = Boolean(carrierId && trackingId.trim());
  const replacementId = r.replacementResolution.current?.id;
  const canRefund =
    r.replacementResolution.availableActions.includes("ISSUE_REFUND");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={paths.account.requestsDisputes}
            className="text-sm text-muted hover:text-primary"
          >
            Back to requests
          </Link>
          <h2 className="mt-1 text-xl font-bold text-text">
            Item not received
          </h2>
          <p className="text-xs text-muted">
            Request #{r.id.slice(-8).toUpperCase()}
          </p>
        </div>
        <Badge tone={inrStatusTone(r.status)}>{inrStatusLabel(r.status)}</Badge>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
            <ProductImage
              src={r.item?.image}
              alt={r.item?.title ?? "Order item"}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold text-text">
              {r.item?.title ?? "Order item"}
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Buyer" value={r.buyer?.displayName ?? "Buyer"} />
              <Field label="Opened" value={formatDateTime(r.createdAt)} />
              <Field
                label="Preference"
                value={inrResolutionLabel(r.requestedResolution)}
              />
              <Field
                label="Quantity missing"
                value={String(r.quantityMissing)}
              />
              <Field
                label="Request amount"
                value={<Price cents={r.requestAmount} />}
              />
              {r.closedAt && (
                <Field label="Closed" value={formatDateTime(r.closedAt)} />
              )}
              {r.closeReason && (
                <Field
                  label="Resolution"
                  value={inrCloseReasonLabel(r.closeReason)}
                />
              )}
              {r.closeReason === "SELLER_REFUNDED" && r.refund && (
                <Field
                  label="Refunded"
                  value={<Price cents={r.refund.amount} />}
                />
              )}
            </dl>
            {r.details && (
              <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">
                {r.details}
              </p>
            )}
            {r.closeReason === "SELLER_REFUNDED" && r.refund && (
              <p className="mt-4 rounded-lg bg-success/10 p-3 text-sm text-success">
                Refund completed{" "}
                {r.refund.completedAt
                  ? formatDateTime(r.refund.completedAt)
                  : ""}
                .
              </p>
            )}
          </div>
        </div>
      </section>

      <ShipmentTrackingCard shipment={shipment} title="Canonical shipment" />

      <ReplacementResolutionCard
        role="SELLER"
        resolution={r.replacementResolution}
        messagePath={paths.message(r.conversationId)}
        refundHref={paths.account.requestDisputeRefund(r.id)}
        loadingAction={loadingAction}
        onPropose={() =>
          runReplacementAction(
            "PROPOSE_REPLACEMENT",
            () => proposeReplacement.mutateAsync(r.id),
            "Replacement offered.",
          )
        }
        onAccept={() =>
          replacementId &&
          runReplacementAction(
            "ACCEPT_REPLACEMENT",
            () => acceptReplacement.mutateAsync(replacementId),
            "Replacement accepted.",
          )
        }
        onDecline={() =>
          replacementId &&
          runReplacementAction(
            "DECLINE_REPLACEMENT",
            () => declineReplacement.mutateAsync(replacementId),
            "Replacement declined.",
          )
        }
        onRefundInstead={() =>
          runReplacementAction(
            "REFUND_INSTEAD",
            () => refundInstead.mutateAsync(r.id),
            "Refund requested instead.",
          )
        }
        onPrepareShipment={() =>
          replacementId &&
          runReplacementAction(
            "PREPARE_REPLACEMENT_SHIPMENT",
            () => prepareReplacementShipment.mutateAsync(replacementId),
            "Replacement shipment prepared.",
          )
        }
        onConfirmReceived={() => undefined}
      />

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-text">
              Seller tracking evidence
            </h3>
            <p className="text-sm text-muted">
              Add tracking details for this request without changing the
              canonical shipment record.
            </p>
          </div>
          {r.status === "OPEN" && (
            <Button variant="secondary" onClick={() => setTrackingOpen(true)}>
              <Icon variant="icon-edit" size={16} />
              Update tracking details
            </Button>
          )}
        </div>
        {(r.trackingEvidenceHistory?.length ?? 0) === 0 ? (
          <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">
            No seller tracking evidence has been submitted yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {r.trackingEvidenceHistory.map((e, index) => (
              <li
                key={`${e.trackingId}-${e.submittedAt}-${index}`}
                className="p-3 text-sm"
              >
                <p className="font-semibold text-text">
                  {e.carrierName} | {e.trackingId}
                </p>
                <p className="text-xs text-muted">
                  Submitted {formatDateTime(e.submittedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-text">Next action</p>
          <p className="text-sm text-muted">
            {r.status === "OPEN"
              ? "Message the buyer, update tracking details, or refund the request amount."
              : "This request has been resolved."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to={paths.message(r.conversationId)}>
            <Button variant="secondary" fullWidth className="sm:w-auto">
              <Icon variant="icon-mail" size={16} />
              Send buyer a message
            </Button>
          </Link>
          {canRefund ? (
            <Link to={paths.account.requestDisputeRefund(r.id)}>
              <Button variant="secondary" fullWidth className="sm:w-auto">
                Refund buyer
              </Button>
            </Link>
          ) : (
            <Button variant="secondary" disabled>
              Refund buyer
            </Button>
          )}
        </div>
      </section>

      <Modal
        open={trackingOpen}
        onClose={() => setTrackingOpen(false)}
        title="Update tracking details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTrackingOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={updateTrackingEvidence.isPending}
              disabled={!canSubmitTracking}
              onClick={submitTracking}
            >
              Save tracking
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Carrier"
            disabled={carriers.isLoading || carrierOptions.length === 0}
            value={carrierId}
            onValueChange={setCarrierId}
            options={
              carrierOptions.length
                ? carrierOptions
                : [{ value: "", label: "No carriers available" }]
            }
          />
          <Input
            label="Tracking ID"
            maxLength={120}
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="Enter the tracking ID"
          />
          {carriers.isError && (
            <p className="text-xs text-danger">
              {messageFromError(carriers.error)}
            </p>
          )}
        </div>
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
