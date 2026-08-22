import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/modal";
import type { OrderItem } from "@/features/checkout/services/checkout-api";

interface ContactSellerTopicsModalProps {
  open: boolean;
  item: OrderItem | null;
  messageLoading?: boolean;
  onClose: () => void;
  onMessage: () => void;
  onItemNotReceived: () => void;
  onReturn: () => void;
  canReturn: boolean;
}

export function ContactSellerTopicsModal({
  open,
  item,
  messageLoading,
  onClose,
  onMessage,
  onItemNotReceived,
  onReturn,
  canReturn,
}: ContactSellerTopicsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Contact seller" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="line-clamp-2 text-sm font-semibold text-text">
            {item?.title ?? "Order item"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Choose the topic that best matches what you need.
          </p>
        </div>

        <div className="grid gap-2">
          <TopicButton
            icon="icon-mail"
            title="I have a question about this item"
            description="Open the existing buyer and seller conversation."
            loading={messageLoading}
            onClick={onMessage}
          />
          <TopicButton
            icon="icon-package"
            title="I did not receive my item"
            description="Start an item-not-received request 1 minute after the estimated delivery time."
            onClick={onItemNotReceived}
          />
          <TopicButton
            icon="icon-refresh"
            title="I need to return my item"
            description={
              canReturn
                ? "Open the return request form."
                : "Returns are available after delivery."
            }
            disabled={!canReturn}
            onClick={onReturn}
          />
        </div>
      </div>
    </Modal>
  );
}

function TopicButton({
  icon,
  title,
  description,
  loading,
  disabled,
  onClick,
}: {
  icon: "icon-mail" | "icon-package" | "icon-refresh";
  title: string;
  description: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {loading ? (
          <Icon variant="icon-loading" size={16} spin />
        ) : (
          <Icon variant={icon} size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      <Icon
        variant="icon-chevron-right"
        size={16}
        className="mt-2 shrink-0 text-muted"
      />
    </button>
  );
}

export function MoreActionsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      <Icon variant="icon-menu" size={14} />
      More actions
    </Button>
  );
}
