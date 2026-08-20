import type { ShipmentStatus } from '../types';

export function shipmentStatusLabel(status: ShipmentStatus | string): string {
  switch (status) {
    case 'READY_FOR_PICKUP':
      return 'Ready for pickup';
    case 'IN_TRANSIT':
      return 'In transit';
    case 'DELIVERED':
      return 'Delivered';
    default:
      return status;
  }
}

export function shipmentStatusTone(status: ShipmentStatus | string): string {
  switch (status) {
    case 'READY_FOR_PICKUP':
      return 'bg-warning/15 text-warning';
    case 'IN_TRANSIT':
      return 'bg-primary/10 text-primary';
    case 'DELIVERED':
      return 'bg-success/10 text-success';
    default:
      return 'bg-surface-2 text-muted';
  }
}
