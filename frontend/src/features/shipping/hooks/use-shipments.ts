import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentApi } from '../services/shipment-api';

export const shippingKeys = {
  seller: ['shipments', 'seller'] as const,
  shipper: (scope: 'available' | 'mine') => ['shipments', 'shipper', scope] as const,
};

export function useSellerShipments() {
  return useQuery({
    queryKey: shippingKeys.seller,
    queryFn: shipmentApi.listSeller,
  });
}

export function useShipperShipments(scope: 'available' | 'mine') {
  return useQuery({
    queryKey: shippingKeys.shipper(scope),
    queryFn: () => shipmentApi.listShipper(scope),
  });
}

export function useShipmentActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['shipments'] });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['order'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  return {
    pickup: useMutation({
      mutationFn: shipmentApi.pickup,
      onSuccess: invalidate,
    }),
    deliver: useMutation({
      mutationFn: shipmentApi.deliver,
      onSuccess: invalidate,
    }),
  };
}
