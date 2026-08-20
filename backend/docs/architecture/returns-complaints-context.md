# SBay Returns / Complaint Architecture Context

Tài liệu này mô tả kiến trúc các module liên quan đến phần khiếu nại/trả hàng để một ChatGPT hoặc reviewer chưa biết dự án có thể đánh giá nhanh. Trong code hiện tại, domain này được đặt tên là `returns`; thực thể chính là `ReturnRequest`. Về nghiệp vụ, có thể hiểu đây là luồng buyer gửi yêu cầu khiếu nại/trả hàng sau khi đơn đã giao.

## 1. Tổng quan dự án

SBay là ứng dụng marketplace/auction gồm:

- Backend: Node.js + Express + MongoDB/Mongoose, tổ chức theo module domain trong `backend/src/modules`.
- Frontend: React + Vite + TypeScript, tổ chức theo feature trong `frontend/src/features`.
- API prefix: `/api/v1`, router tổng ở `backend/src/routes/index.js`.
- Response chuẩn: backend trả envelope `{ success, data, meta }`; frontend unwrap qua `frontend/src/services/api-client.ts`.
- Auth: backend dùng `authenticate` middleware cho route cần đăng nhập; unsafe request dùng CSRF global theo cấu hình app.
- Transaction: các luồng ghi quan trọng dùng MongoDB session/transaction qua helper `checkoutRepository.transaction`.

## 2. Domain khiếu nại/trả hàng hiện tại

Module chính:

- `backend/src/modules/returns/return-request.model.js`
- `backend/src/modules/returns/return-request.repository.js`
- `backend/src/modules/returns/return-request.service.js`
- `backend/src/modules/returns/return-request.controller.js`
- `backend/src/modules/returns/return-request.route.js`
- `backend/src/modules/returns/return-request.validation.js`
- `backend/src/modules/returns/return-request.constants.js`

Mount route:

- `routes.use('/returns', returnRoute)` trong `backend/src/routes/index.js`.

API hiện có:

- `POST /api/v1/returns`: buyer tạo yêu cầu khiếu nại/trả hàng.
- `GET /api/v1/returns`: buyer xem danh sách yêu cầu của chính mình.
- `GET /api/v1/returns/:returnId`: buyer xem chi tiết một yêu cầu của chính mình.

Các route không có trong hiện trạng:

- Không có `PATCH /returns/:returnId`.
- Không có `DELETE /returns/:returnId`.
- Không có route admin/seller để duyệt, từ chối, hoàn tất.
- Không có mount cũ kiểu `/return-requests`.

## 3. Data model: ReturnRequest

Collection Mongoose: `returnrequests`.

Các field chính:

- `buyerId`: ref `User`, bắt buộc.
- `orderId`: ref `Order`, bắt buộc.
- `sellerId`: ref `SellerProfile`, bắt buộc.
- `orderItemId`: ObjectId của item trong order, bắt buộc.
- `productId`: ref `Product`, bắt buộc.
- `quantity`: số nguyên dương, tối thiểu 1.
- `reason`: enum `RETURN_REASONS`.
- `details`: text tùy chọn, trim, tối đa 1000 ký tự.
- `status`: enum `RETURN_STATUSES`, mặc định `REQUESTED`.
- `cancelledAt`: Date tùy chọn.
- `createdAt`, `updatedAt`: timestamps tự động.

Enums:

- Reasons: `DAMAGED`, `DEFECTIVE`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, `MISSING_PARTS`, `CHANGED_MIND`, `OTHER`.
- Statuses: `REQUESTED`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`.

Indexes:

- `{ buyerId: 1, status: 1, createdAt: -1 }` để list theo buyer/status.
- `{ orderId: 1 }` unique để đảm bảo một request cho mỗi order.
- `{ sellerId: 1, status: 1, createdAt: -1 }` để hỗ trợ seller/admin queue sau này, dù route seller chưa có.

Lưu ý thiết kế: mặc dù request gắn với `orderItemId`, unique index đang đặt trên `orderId`, nên rule hiện tại là một khiếu nại/trả hàng cho mỗi order, không phải mỗi item.

## 4. Điều kiện tạo khiếu nại/trả hàng

Luồng tạo nằm trong `return-request.service.js`.

Input được validate bằng Zod:

- `orderId`: ObjectId string hợp lệ.
- `orderItemId`: ObjectId string hợp lệ.
- `quantity`: số nguyên dương.
- `reason`: thuộc enum `RETURN_REASONS`.
- `details`: tùy chọn, trim, 1-1000 ký tự.
- Body dùng `.strict()`, không nhận field lạ.

Điều kiện nghiệp vụ:

- Buyer phải đăng nhập.
- Order phải thuộc buyer hiện tại (`orderRepository.findOwned`).
- `order.orderStatus` phải là `DELIVERED`.
- `orderItemId` phải tồn tại trong `order.items`.
- `order.deliveredAt` phải có, không ở tương lai, và còn trong `RETURN_WINDOW_DAYS`.
- `quantity` không được vượt quá `item.quantity`.
- Chưa có `ReturnRequest` nào cho order đó.

Nếu không đủ điều kiện, service trả lỗi `409 RETURN_NOT_ELIGIBLE`. Nếu đã có request cho order, service bắt duplicate key và trả `409 CONFLICT`.

Config liên quan:

- `RETURN_WINDOW_DAYS`, default `30`, đọc từ `backend/src/config/env.js`.

## 5. Transaction và side effects

`POST /returns` được bọc trong MongoDB transaction:

1. Tìm order thuộc buyer.
2. Kiểm tra eligibility.
3. Tạo `ReturnRequest`.
4. Tạo notification cho buyer.
5. Tìm seller profile và tạo notification cho user của seller nếu seller tồn tại.
6. Commit transaction.

Notification dùng:

- `type: 'RETURN'`
- `referenceType: 'ReturnRequest'`
- `referenceId: returnRequestId`
- `eventType: USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED`
- `eventKey` deterministic:
  - `RETURN_REQUESTED:<returnRequestId>:BUYER`
  - `RETURN_REQUESTED:<returnRequestId>:SELLER`

Notification model có unique partial index `{ userId: 1, eventKey: 1 }`, giúp tránh trùng notification cùng user/event key.

## 6. Các module xung quanh

### Orders

Files chính:

- `backend/src/modules/orders/order.model.js`
- `backend/src/modules/orders/order.repository.js`
- `backend/src/modules/orders/order.service.js`
- `backend/src/modules/orders/order.route.js`

Order là nguồn sự thật cho eligibility của khiếu nại/trả hàng. `ReturnRequest` không tự tính trạng thái giao hàng mà dựa vào:

- `buyerId`
- `sellerId`
- `items`
- `orderStatus`
- `deliveredAt`

Các order status hiện tại:

- `PENDING_PAYMENT`
- `CONFIRMED`
- `PAYMENT_FAILED`
- `DELIVERED`

Frontend chỉ hiển thị nút tạo return khi order detail có `orderStatus === 'DELIVERED'`. Backend vẫn là lớp quyết định cuối cùng.

### Checkout groups và payments

Files chính:

- `backend/src/modules/checkout/*`
- `backend/src/modules/checkout-groups/*`
- `backend/src/modules/payments/*`

Return chỉ mở sau khi order đã `DELIVERED`, nên phụ thuộc gián tiếp vào checkout/payment lifecycle. Payment model có trạng thái như `PENDING`, `CREATED`, `CONFIRMED`, `CAPTURED`, `FAILED`; checkout/payment thành công sẽ đưa order đến các trạng thái có thể giao hàng/xác nhận.

Hiện tại return flow chưa xử lý refund, reverse payment hoặc cập nhật payment/order khi request được approve/reject/complete. Nó chỉ tạo request và notification.

### Sellers

Files chính:

- `backend/src/modules/sellers/seller.repository.js`
- `backend/src/modules/sellers/seller-profile.model.js`

ReturnRequest lưu `sellerId` từ order. Service dùng `sellerRepository.findById` để tìm seller profile và gửi notification cho `seller.userId`. Chưa có seller-facing return management API, nhưng index theo `sellerId/status/createdAt` cho thấy thiết kế đã chừa đường cho queue xử lý của seller.

### Notifications

Files chính:

- `backend/src/modules/notifications/*`
- `backend/src/common/constants/user4-notification-events.js`

Return flow tạo notification transactionally cho buyer và seller. Đây là side effect chính duy nhất hiện tại sau khi tạo request.

### Product, review, seller feedback

ReturnRequest lưu `productId` snapshot từ order item. Order service còn enrich order items với:

- `productUuid`
- product review availability
- review state
- seller feedback state

Frontend order detail đặt return cạnh các hành động sau giao hàng như review sản phẩm, feedback seller, contact seller. Các module này không trực tiếp thay đổi ReturnRequest, nhưng cùng dùng order item/delivered order làm eligibility nền.

### Conversations / messaging

Frontend order detail có nút contact seller qua `messagingApi.createConversation({ productId, orderId })`. Đây là luồng hỗ trợ buyer liên hệ seller, có thể liên quan nghiệp vụ khiếu nại nhưng chưa được liên kết chính thức với ReturnRequest.

## 7. Frontend luồng khiếu nại/trả hàng

Files chính:

- `frontend/src/features/checkout/services/return-api.ts`
- `frontend/src/features/checkout/hooks/use-returns.ts`
- `frontend/src/features/checkout/components/return-request-form.tsx`
- `frontend/src/features/checkout/pages/order-detail-page.tsx`
- `frontend/src/features/checkout/utils/return-status.ts`

Flow UI:

1. Buyer vào trang chi tiết order.
2. Nếu order `DELIVERED`, UI hiển thị section return.
3. Hook `useReturns` gọi `GET /returns` để lấy tất cả return requests của buyer.
4. UI tìm request hiện có bằng `r.orderId === order.id`.
5. Nếu chưa có request, buyer mở modal `ReturnRequestForm`.
6. Buyer chọn item, reason, quantity, details.
7. Frontend gọi `POST /returns`.
8. Thành công: toast, đóng modal, invalidate query `['returns']`.
9. Nếu đã có request: UI hiển thị status, reason, quantity, requestedAt, details, cancelledAt nếu có.

Frontend mirror enum reason/status từ backend. Comment trong code nhắc `RETURN_REASONS` phải giữ cùng thứ tự với backend.

## 8. API documentation và test coverage

OpenAPI:

- `backend/src/docs/openapi/paths/returns.paths.js`
- schemas nằm trong `backend/src/docs/openapi/components/schemas.js`.

Coverage liên quan:

- `backend/tests/integration/user4-checkout-orders-payments-returns.test.js`
- `backend/tests/unit/user3-user4-compliance.test.js`

Các test đáng chú ý:

- Reject buyer khác tạo return cho order không thuộc mình.
- Tạo return thành công cho delivered order còn trong window.
- Tạo notification cho buyer và seller.
- Chặn tạo request thứ hai cho cùng order.
- List/get chỉ trả dữ liệu owned.
- Buyer khác `GET /returns/:id` nhận 404.
- `PATCH /returns/:id` và `DELETE /returns/:id` không tồn tại.
- Reject thiếu `deliveredAt`, `deliveredAt` ở tương lai, hoặc quá hạn return window.
- Unit test enum reason/status và unique index one-per-order.

## 9. Ranh giới và điểm cần reviewer chú ý

Các điểm hiện tại có thể cần đánh giá:

- Tên nghiệp vụ trong code là `returns`, nhưng user-facing có thể gọi là khiếu nại. Nếu sản phẩm cần dispute/complaint rộng hơn return, nên cân nhắc tách domain `complaints` hoặc mở rộng model.
- Unique index `{ orderId: 1 }` khiến mỗi order chỉ có một request, dù order có nhiều items. UI cũng ghi chú “returns remain per-order”. Nếu muốn khiếu nại từng item độc lập, index và lookup UI cần đổi sang `{ orderId, orderItemId }`.
- Status enum có `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`, nhưng chưa có API hay service để chuyển trạng thái.
- Không có seller/admin queue API dù model đã index theo seller.
- Không có refund/payment settlement khi return được xử lý.
- Không có upload evidence/image cho return, chỉ có `details` text.
- Notification copy hiện là generic English `"Return requested"`, chưa dùng i18n phía backend.
- `ReturnRequest` lưu snapshot tối thiểu (`productId`, `sellerId`, `orderItemId`, quantity) nhưng không lưu title/image/price tại thời điểm khiếu nại. UI lấy tên sản phẩm từ order hiện tại.
- List API hỗ trợ phân trang ở backend, nhưng frontend `returnApi.list()` hiện gọi `/returns` không truyền page/limit và dùng toàn bộ danh sách để tìm request theo order.

## 10. Sơ đồ luồng tạo return

```text
Buyer UI
  -> OrderDetailPage
  -> ReturnRequestForm
  -> POST /api/v1/returns
      -> authenticate
      -> validate(createSchema)
      -> return-request.controller.create
      -> return-request.service.create
          -> start MongoDB transaction
          -> orderRepository.findOwned(buyerId, orderId)
          -> eligibleItem(order, input, now)
          -> returnRequestRepository.create(...)
          -> notificationService.createNotification(buyer)
          -> sellerRepository.findById(sellerId)
          -> notificationService.createNotification(seller.userId)
          -> commit
      -> response 201 { success, data: ReturnRequest }
```

## 11. File map nhanh

```text
backend/src/routes/index.js
backend/src/modules/returns/
backend/src/modules/orders/
backend/src/modules/checkout/
backend/src/modules/checkout-groups/
backend/src/modules/payments/
backend/src/modules/sellers/
backend/src/modules/notifications/
frontend/src/features/checkout/services/return-api.ts
frontend/src/features/checkout/hooks/use-returns.ts
frontend/src/features/checkout/components/return-request-form.tsx
frontend/src/features/checkout/pages/order-detail-page.tsx
backend/tests/integration/user4-checkout-orders-payments-returns.test.js
backend/tests/unit/user3-user4-compliance.test.js
```
