/** Central route path definitions. Keeps links type-safe and refactorable. */
import type { UserRole } from '@/features/auth/types/auth.types';

export const paths = {
  home: '/',
  products: '/products',
  product: (id: string) => `/products/${id}`,
  seller: (id: string) => `/sellers/${id}`,
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  checkout: '/checkout',
  messages: '/messages',
  message: (id: string) => `/messages?conversation=${id}`,
  orders: '/account/orders',
  order: (id: string) => `/account/orders/${id}`,
  orderCheckout: (id: string) => `/account/orders/${id}/checkout`,
  inrRequests: '/account/inr-requests',
  inrRequest: (id: string) => `/account/inr-requests/${id}`,
  account: {
    root: '/account',
    profile: '/account/profile',
    password: '/account/password',
    addresses: '/account/addresses',
    notifications: '/account/notifications',
    bids: '/account/bids',
    offers: '/account/offers',
    sellerFeedbacks: '/account/seller-feedbacks',
    sellerShipments: '/account/seller-shipments',
    requestsDisputes: '/account/requests-disputes',
    requestDispute: (id: string) => `/account/requests-disputes/${id}`,
    requestDisputeRefund: (id: string) =>
      `/account/requests-disputes/${id}/refund`,
  },
  shipper: {
    shipments: '/shipper/shipments',
  },
} as const;

export const defaultPathForRole = (role?: UserRole | null) =>
  role === 'SHIPPER' ? paths.shipper.shipments : paths.home;
