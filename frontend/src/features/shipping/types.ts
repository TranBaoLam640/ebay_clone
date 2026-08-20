export type ShipmentStatus = 'READY_FOR_PICKUP' | 'IN_TRANSIT' | 'DELIVERED';

export interface Shipment {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  shipperId: string | null;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  estimatedDeliveryAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}
