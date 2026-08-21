import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { RootLayout } from '@/layouts/root-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { AccountLayout } from '@/layouts/account-layout';
import { ProtectedRoute } from './protected-route';
import { RouteErrorPage } from '@/features/misc/route-error-page';
import { Icon } from '@/components/icon';

// Lazily load pages so the initial bundle stays lean.
const HomePage = lazy(() => import('@/features/catalog/pages/home-page'));
const ProductListPage = lazy(() => import('@/features/catalog/pages/product-list-page'));
const ProductDetailPage = lazy(() => import('@/features/product-detail/pages/product-detail-page'));
const SellerPage = lazy(() => import('@/features/sellers/pages/seller-page'));
const LoginPage = lazy(() => import('@/features/auth/pages/login-page'));
const RegisterPage = lazy(() => import('@/features/auth/pages/register-page'));
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/verify-email-page'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/forgot-password-page'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/reset-password-page'));
const ProfilePage = lazy(() => import('@/features/account/pages/profile-page'));
const PasswordPage = lazy(() => import('@/features/account/pages/password-page'));
const AddressesPage = lazy(() => import('@/features/account/pages/addresses-page'));
const NotificationsPage = lazy(() => import('@/features/notifications/pages/notifications-page'));
const MessagesPage = lazy(() => import('@/features/messages/pages/messages-page'));
const MyBidsPage = lazy(() => import('@/features/account/pages/my-bids-page'));
const MyOffersPage = lazy(() => import('@/features/account/pages/my-offers-page'));
const SellerFeedbacksPage = lazy(() => import('@/features/sellers/pages/seller-feedbacks-page'));
const SellerShipmentsPage = lazy(() => import('@/features/shipping/pages/seller-shipments-page'));
const ShipperShipmentsPage = lazy(() => import('@/features/shipping/pages/shipper-shipments-page'));
const BuyerInrDetailPage = lazy(() => import('@/features/inr/pages/buyer-inr-detail-page'));
const SellerRequestsPage = lazy(() => import('@/features/inr/pages/seller-requests-page'));
const SellerRequestDetailPage = lazy(() => import('@/features/inr/pages/seller-request-detail-page'));
const CheckoutPage = lazy(() => import('@/features/checkout/pages/checkout-page'));
const OrdersPage = lazy(() => import('@/features/checkout/pages/orders-page'));
const OrderDetailPage = lazy(() => import('@/features/checkout/pages/order-detail-page'));
const CheckoutOrderPage = lazy(() => import('@/features/checkout/pages/checkout-order-page'));
const NotFoundPage = lazy(() => import('@/features/misc/not-found-page'));

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted">
          <Icon variant="icon-loading" size={28} spin />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <Lazy><HomePage /></Lazy> },
      { path: '/products', element: <Lazy><ProductListPage /></Lazy> },
      { path: '/products/:productId', element: <Lazy><ProductDetailPage /></Lazy> },
      { path: '/sellers/:sellerId', element: <Lazy><SellerPage /></Lazy> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/checkout', element: <Lazy><CheckoutPage /></Lazy> },
          { path: '/messages', element: <Lazy><MessagesPage /></Lazy> },
          {
            path: '/account',
            element: <AccountLayout />,
            children: [
              { index: true, element: <Lazy><ProfilePage /></Lazy> },
              { path: 'profile', element: <Lazy><ProfilePage /></Lazy> },
              { path: 'password', element: <Lazy><PasswordPage /></Lazy> },
              { path: 'addresses', element: <Lazy><AddressesPage /></Lazy> },
              { path: 'orders', element: <Lazy><OrdersPage /></Lazy> },
              { path: 'orders/:orderId', element: <Lazy><OrderDetailPage /></Lazy> },
              { path: 'orders/:orderId/checkout', element: <Lazy><CheckoutOrderPage /></Lazy> },
              { path: 'inr-requests/:requestId', element: <Lazy><BuyerInrDetailPage /></Lazy> },
              { path: 'bids', element: <Lazy><MyBidsPage /></Lazy> },
              { path: 'offers', element: <Lazy><MyOffersPage /></Lazy> },
              { path: 'seller-feedbacks', element: <Lazy><SellerFeedbacksPage /></Lazy> },
              { path: 'seller-shipments', element: <Lazy><SellerShipmentsPage /></Lazy> },
              { path: 'requests-disputes', element: <Lazy><SellerRequestsPage /></Lazy> },
              { path: 'requests-disputes/:requestId', element: <Lazy><SellerRequestDetailPage /></Lazy> },
              { path: 'notifications', element: <Lazy><NotificationsPage /></Lazy> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute roles={['SHIPPER']} />,
        children: [
          { path: '/shipper/shipments', element: <Lazy><ShipperShipmentsPage /></Lazy> },
        ],
      },
      { path: '*', element: <Lazy><NotFoundPage /></Lazy> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <Lazy><LoginPage /></Lazy> },
      { path: '/register', element: <Lazy><RegisterPage /></Lazy> },
      { path: '/verify-email', element: <Lazy><VerifyEmailPage /></Lazy> },
      { path: '/forgot-password', element: <Lazy><ForgotPasswordPage /></Lazy> },
      { path: '/reset-password', element: <Lazy><ResetPasswordPage /></Lazy> },
    ],
  },
]);
