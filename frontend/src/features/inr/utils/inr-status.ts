import type {
  InrCloseReason,
  InrResolution,
  InrStatus,
} from "../types/inr.types";

export function inrStatusLabel(status: InrStatus): string {
  return status === "OPEN" ? "Open" : "Closed";
}

export function inrStatusTone(status: InrStatus): "accent" | "success" {
  return status === "OPEN" ? "accent" : "success";
}

export function inrResolutionLabel(resolution: InrResolution): string {
  return resolution === "REFUND" ? "I want a refund" : "I still want the item";
}

export function inrCloseReasonLabel(reason: InrCloseReason): string {
  if (reason === "SELLER_REFUNDED") return "Resolved - seller refunded";
  if (reason === "REPLACEMENT_RECEIVED")
    return "Resolved - replacement received";
  return "Resolved - item arrived";
}
