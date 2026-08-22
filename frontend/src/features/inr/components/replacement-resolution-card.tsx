import { Link } from "react-router-dom";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { ProductImage } from "@/components/product-image";
import { formatDateTime } from "@/utils/format-date";
import type {
  InrReplacementAction,
  InrReplacementDisplayState,
  InrReplacementResolution,
  InrReplacementShipment,
} from "../types/inr.types";

const STATUS_LABEL: Record<InrReplacementDisplayState, string> = {
  PROPOSED: "Proposed",
  ACCEPTED: "Accepted",
  FULFILLING: "In transit",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  REFUND_REQUESTED: "Refund requested",
};

const STATUS_TONE: Record<
  InrReplacementDisplayState,
  "neutral" | "success" | "danger" | "accent" | "primary"
> = {
  PROPOSED: "accent",
  ACCEPTED: "primary",
  FULFILLING: "primary",
  COMPLETED: "success",
  DECLINED: "neutral",
  CANCELLED: "neutral",
  FAILED: "danger",
  REFUND_REQUESTED: "accent",
};

interface ReplacementResolutionCardProps {
  role: "BUYER" | "SELLER";
  resolution: InrReplacementResolution;
  messagePath: string;
  loadingAction: InrReplacementAction | null;
  onPropose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRefundInstead: () => void;
  onPrepareShipment: () => void;
  onConfirmReceived: () => void;
  refundHref?: string;
}

export function ReplacementResolutionCard({
  role,
  resolution,
  messagePath,
  loadingAction,
  onPropose,
  onAccept,
  onDecline,
  onRefundInstead,
  onPrepareShipment,
  onConfirmReceived,
  refundHref,
}: ReplacementResolutionCardProps) {
  const current = resolution.current;
  const actions = new Set(resolution.availableActions);
  const isSeller = role === "SELLER";
  const title = current ? "Replacement resolution" : "Replacement option";
  const description = replacementDescription(role, resolution);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-text">{title}</h3>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {current && (
          <Badge tone={STATUS_TONE[current.displayState]}>
            {STATUS_LABEL[current.displayState]}
          </Badge>
        )}
      </div>

      {current && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
            <ProductImage
              src={current.product.image}
              alt={current.product.title ?? "Replacement item"}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold text-text">
              {current.product.title ?? "Replacement item"}
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Offered by"
                value={current.initiatorRole === "SELLER" ? "Seller" : "Buyer"}
              />
              <Field label="Quantity" value={String(current.quantity)} />
              <Field
                label="Updated"
                value={formatDateTime(current.updatedAt)}
              />
              {current.shipment && (
                <>
                  <Field
                    label="Replacement shipment"
                    value={shipmentStatusLabel(current.shipment)}
                  />
                  {current.shipment.estimatedDeliveryAt && (
                    <Field
                      label="Estimated delivery"
                      value={formatDateTime(
                        current.shipment.estimatedDeliveryAt,
                      )}
                    />
                  )}
                  {isSeller && current.shipment.trackingNumber && (
                    <Field
                      label="Tracking"
                      value={`${current.shipment.carrier ?? "Carrier"} | ${current.shipment.trackingNumber}`}
                    />
                  )}
                </>
              )}
            </dl>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {actions.has("PROPOSE_REPLACEMENT") && (
          <Button
            onClick={onPropose}
            loading={loadingAction === "PROPOSE_REPLACEMENT"}
            disabled={Boolean(loadingAction)}
            fullWidth
            className="sm:w-auto"
          >
            <Icon variant="icon-refresh" size={16} />
            {isSeller ? "Offer replacement" : "Request replacement"}
          </Button>
        )}
        {actions.has("ACCEPT_REPLACEMENT") && (
          <Button
            onClick={onAccept}
            loading={loadingAction === "ACCEPT_REPLACEMENT"}
            disabled={Boolean(loadingAction)}
            fullWidth
            className="sm:w-auto"
          >
            <Icon variant="icon-check" size={16} />
            Accept replacement
          </Button>
        )}
        {actions.has("DECLINE_REPLACEMENT") && (
          <Button
            variant="secondary"
            onClick={onDecline}
            loading={loadingAction === "DECLINE_REPLACEMENT"}
            disabled={Boolean(loadingAction)}
            fullWidth
            className="sm:w-auto"
          >
            Decline
          </Button>
        )}
        {actions.has("REFUND_INSTEAD") && (
          <Button
            variant="secondary"
            onClick={onRefundInstead}
            loading={loadingAction === "REFUND_INSTEAD"}
            disabled={Boolean(loadingAction)}
            fullWidth
            className="sm:w-auto"
          >
            I want a refund instead
          </Button>
        )}
        {actions.has("PREPARE_REPLACEMENT_SHIPMENT") && (
          <Button
            onClick={onPrepareShipment}
            loading={loadingAction === "PREPARE_REPLACEMENT_SHIPMENT"}
            disabled={Boolean(loadingAction)}
            fullWidth
            className="sm:w-auto"
          >
            <Icon variant="icon-truck" size={16} />
            Prepare replacement shipment
          </Button>
        )}
        {actions.has("CONFIRM_REPLACEMENT_RECEIVED") && (
          <Button
            onClick={onConfirmReceived}
            loading={loadingAction === "CONFIRM_REPLACEMENT_RECEIVED"}
            disabled={Boolean(loadingAction)}
            fullWidth
            className="sm:w-auto"
          >
            <Icon variant="icon-check" size={16} />I received the replacement
          </Button>
        )}
        {actions.has("ISSUE_REFUND") && refundHref && (
          <Link to={refundHref} className="sm:w-auto">
            <Button
              variant="secondary"
              fullWidth
              disabled={Boolean(loadingAction)}
            >
              Refund buyer
            </Button>
          </Link>
        )}
        <Link to={messagePath} className="sm:w-auto">
          <Button variant="ghost" fullWidth>
            <Icon variant="icon-mail" size={16} />
            Open chat
          </Button>
        </Link>
      </div>
    </section>
  );
}

function replacementDescription(
  role: "BUYER" | "SELLER",
  resolution: InrReplacementResolution,
) {
  const current = resolution.current;
  if (!current)
    return "Use replacement only when the missing item can still be sent.";
  if (current.displayState === "REFUND_REQUESTED")
    return role === "SELLER"
      ? "The buyer switched from replacement to refund. Use the normal refund review to continue."
      : "The replacement path switched to refund. The seller still needs to issue the refund.";
  if (current.status === "PROPOSED")
    return current.initiatorRole === role
      ? "Waiting for the other side to respond."
      : "Review the replacement proposal and choose the next step.";
  if (current.status === "ACCEPTED")
    return current.shipment
      ? "The replacement shipment is ready for pickup."
      : role === "SELLER"
        ? "Prepare the replacement shipment when the item is ready to send."
        : "The replacement was accepted and is waiting for shipment preparation.";
  if (current.status === "FULFILLING")
    return current.shipment?.status === "DELIVERED"
      ? role === "SELLER"
        ? "The replacement was delivered. Buyer confirmation is not available yet."
        : "The replacement was delivered."
      : "The replacement is in transit.";
  if (current.status === "COMPLETED")
    return role === "SELLER"
      ? "The buyer confirmed receiving the replacement."
      : "You confirmed that the replacement arrived. This request has been resolved.";
  return "This replacement proposal is no longer active.";
}

function shipmentStatusLabel(shipment: InrReplacementShipment) {
  if (shipment.status === "READY_FOR_PICKUP") return "Ready for pickup";
  if (shipment.status === "IN_TRANSIT") return "In transit";
  if (shipment.status === "DELIVERED") return "Delivered";
  return "Cancelled";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-text">{value}</dd>
    </div>
  );
}
