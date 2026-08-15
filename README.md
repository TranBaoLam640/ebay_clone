# SBay

SBay là hệ thống mô phỏng sàn thương mại điện tử dành cho **người mua (Buyer)**, gồm giao diện React và REST API Express/MongoDB. Dự án hỗ trợ toàn bộ hành trình từ đăng ký, tìm kiếm sản phẩm, giỏ hàng, đặt hàng, thanh toán đến đánh giá, hoàn trả; đồng thời có thêm **Auction** và **Best Offer**.

## Công nghệ sử dụng

### Frontend

- React 19, TypeScript và Vite
- React Router, TanStack Query và Axios
- Tailwind CSS, GSAP và Lenis
- Giao diện responsive, hỗ trợ light/dark mode

### Backend

- Node.js 20+, Express và MongoDB/Mongoose
- JWT trong HttpOnly cookie, CSRF, Helmet và CORS
- Pino logging, Swagger/OpenAPI và Vitest
- Docker, GitHub Actions, Kubernetes, ingress-nginx và Cloudflare Tunnel

## Tính năng dành cho người mua

### 1. Tài khoản và xác thực

- Đăng ký bằng email và mật khẩu.
- Xác nhận email bằng mã OTP sáu chữ số.
- Gửi lại OTP khi mã hết hạn hoặc chưa nhận được email.
- Đăng nhập, làm mới phiên đăng nhập và đăng xuất.
- Quên mật khẩu, nhận OTP và đặt lại mật khẩu.
- JWT được lưu trong HttpOnly cookie; refresh token được xoay vòng và có thể thu hồi.

### 2. Quản lý thông tin cá nhân

- Xem và cập nhật hồ sơ người dùng.
- Thay đổi mật khẩu.
- Cập nhật ảnh đại diện.
- Kiểm tra dữ liệu đầu vào ở cả frontend và backend.

### 3. Quản lý địa chỉ giao hàng

- Thêm và lưu nhiều địa chỉ nhận hàng.
- Xem, sửa và xóa địa chỉ.
- Chọn một địa chỉ làm mặc định.
- Chọn địa chỉ phù hợp trong quá trình thanh toán.
- Lưu bản chụp địa chỉ vào đơn hàng để lịch sử đơn không bị thay đổi khi người dùng sửa địa chỉ.

### 4. Danh mục và tìm kiếm sản phẩm

- Xem danh sách danh mục và danh mục con.
- Xem danh sách sản phẩm có phân trang.
- Tìm kiếm sản phẩm theo tên hoặc từ khóa.
- Lọc theo danh mục, người bán và khoảng giá.
- Sắp xếp kết quả theo các tiêu chí được API hỗ trợ.
- Đồng bộ bộ lọc với URL để có thể tải lại hoặc chia sẻ trang kết quả.

### 5. Chi tiết sản phẩm

- Hiển thị tên, ảnh, mô tả, thuộc tính, giá và tồn kho.
- Hiển thị thông tin và uy tín của người bán.
- Hiển thị điểm đánh giá và danh sách nhận xét.
- Hiển thị các thông tin Auction hoặc Best Offer khi sản phẩm hỗ trợ.
- Giao diện ảnh và nội dung thích ứng theo kích thước màn hình.

### 6. Giỏ hàng

- Thêm sản phẩm vào giỏ hàng.
- Thay đổi số lượng hoặc xóa từng sản phẩm.
- Xóa toàn bộ giỏ hàng.
- Kiểm tra tồn kho và giá hiện tại.
- Hỗ trợ giỏ hàng cục bộ cho khách chưa đăng nhập.
- Đồng bộ giỏ hàng local với giỏ hàng server sau khi đăng nhập.
- Nhóm sản phẩm theo người bán để phục vụ checkout nhiều nhà bán hàng.

### 7. Mã giảm giá

- Nhập và kiểm tra Coupon trước khi đặt hàng.
- Kiểm tra điều kiện sử dụng, thời hạn, số lượt dùng và phạm vi áp dụng.
- Tính lại tạm tính, mức giảm, phí giao hàng và tổng thanh toán.
- Bảo vệ bộ đếm lượt sử dụng trong luồng checkout giao dịch.

### 8. Checkout và đặt hàng

- Xem trước toàn bộ đơn hàng trước khi xác nhận.
- Chọn địa chỉ giao hàng và phương thức thanh toán.
- Tạo nhiều đơn con theo từng người bán trong cùng một lần checkout.
- Lưu snapshot sản phẩm, giá và địa chỉ tại thời điểm mua.
- Sử dụng `Idempotency-Key` để tránh tạo đơn trùng khi gửi lại request.
- Cập nhật tồn kho, Coupon, thanh toán và đơn hàng bằng MongoDB transaction.

### 9. Thanh toán

- Hỗ trợ thanh toán khi nhận hàng (**COD**).
- Hỗ trợ luồng **PayPal giả lập** để phục vụ học tập và trình diễn.
- Theo dõi trạng thái thanh toán và liên kết thanh toán với đơn hàng.
- Xử lý khôi phục dữ liệu liên quan khi giao dịch thất bại theo nghiệp vụ backend.

> PayPal hiện là chế độ mô phỏng, chưa kết nối cổng PayPal thật.

### 10. Lịch sử và chi tiết đơn hàng

- Xem danh sách đơn hàng thuộc tài khoản hiện tại.
- Phân trang và lọc theo trạng thái.
- Xem chi tiết từng đơn, sản phẩm, người bán, địa chỉ và thanh toán.
- Theo dõi trạng thái xử lý và giao hàng.
- Bảo vệ quyền sở hữu: Buyer chỉ xem được đơn hàng của chính mình.

### 11. Hoàn trả

- Gửi yêu cầu hoàn trả cho sản phẩm đủ điều kiện.
- Nhập lý do và nội dung yêu cầu.
- Kiểm tra thời hạn hoàn trả theo cấu hình hệ thống.
- Xem yêu cầu và trạng thái xử lý hoàn trả.

### 12. Đánh giá và uy tín

- Xem đánh giá sản phẩm, lọc theo số sao và sắp xếp kết quả.
- Buyer đã mua và nhận hàng có thể gửi đánh giá gồm số sao và bình luận.
- Chỉnh sửa hoặc xóa đánh giá thuộc sở hữu của mình qua API.
- Xem hồ sơ, điểm uy tín và phản hồi của người bán.
- Gửi, chỉnh sửa hoặc xóa phản hồi người bán cho đơn hàng hợp lệ.

### 13. Thông báo

- Xem danh sách thông báo hệ thống.
- Phân trang và lọc theo loại hoặc trạng thái đã đọc.
- Xem số lượng thông báo chưa đọc.
- Đánh dấu một thông báo hoặc toàn bộ thông báo là đã đọc.
- Phục vụ thông báo liên quan đến tài khoản, đơn hàng và hoạt động hệ thống.

> Thông báo hiện được tải qua API, chưa sử dụng WebSocket để đẩy realtime.

### 14. Auction

- Xem sản phẩm đấu giá và thông tin phiên đấu giá.
- Theo dõi giá hiện tại, thời gian kết thúc và lịch sử đặt giá.
- Buyer đặt giá theo bước giá và điều kiện của phiên đấu giá.
- Kiểm tra trạng thái, thời hạn và giá hợp lệ ở backend.
- Giao diện cập nhật gần realtime bằng cơ chế polling.

### 15. Best Offer

- Buyer gửi đề nghị giá cho sản phẩm hỗ trợ Best Offer.
- Xem các đề nghị đã gửi và trạng thái xử lý.
- Rút đề nghị khi còn đủ điều kiện.
- Backend quản lý vòng đời và kiểm tra quyền sở hữu đề nghị.

## Yêu cầu phi chức năng

### Bảo mật

- Mật khẩu được băm bằng bcrypt, không lưu mật khẩu thuần văn bản.
- Access token và refresh token dùng JWT trong cookie `HttpOnly`.
- Xoay vòng và thu hồi refresh token khi đăng xuất hoặc đổi mật khẩu.
- Chống CSRF bằng double-submit token cho request thay đổi dữ liệu.
- Helmet thiết lập security headers; CORS giới hạn origin được cấu hình.
- Cookie production hỗ trợ `Secure` và `SameSite`.
- Dữ liệu đầu vào được kiểm tra và chuẩn hóa.
- Log tự động che mật khẩu, token, cookie và header nhạy cảm.
- MongoDB sử dụng transaction cho các nghiệp vụ cần tính nhất quán.
- HTTPS được triển khai ở lớp Cloudflare edge/Tunnel trong mô hình Kubernetes.

### Hiệu năng

- API danh sách hỗ trợ phân trang, lọc và giới hạn dữ liệu trả về.
- MongoDB sử dụng index cho các truy vấn nghiệp vụ chính.
- TanStack Query quản lý cache, trạng thái tải và tái sử dụng dữ liệu phía frontend.
- Vite tối ưu bundle production; hình ảnh và giao diện được tải theo nhu cầu của trang.
- Nén response được bật ở backend.
- HPA có thể tăng số backend Pod khi CPU vượt ngưỡng cấu hình.

> Mục tiêu tìm kiếm và tải chi tiết sản phẩm dưới 1 giây phụ thuộc dữ liệu, cấu hình MongoDB, tài nguyên máy chủ và mạng triển khai; cần xác nhận bằng benchmark trên môi trường thực tế.

### Responsive và trải nghiệm

- Thiết kế mobile-first và hoạt động trên điện thoại, máy tính bảng, desktop.
- Điều hướng, danh sách, bộ lọc, giỏ hàng và checkout thích ứng theo màn hình.
- Hỗ trợ light/dark mode và CSS-variable theming.
- Có loading, empty state và error state để phản hồi rõ ràng cho người dùng.
- Nội dung người dùng được React escape mặc định để hạn chế XSS.

### Khả năng mở rộng

- Backend không lưu trạng thái phiên trong bộ nhớ tiến trình; trạng thái bền vững nằm ở MongoDB và cookie/JWT.
- Kubernetes Service và ingress-nginx phân phối request đến nhiều backend Pod.
- Backend Deployment mặc định có nhiều replica.
- Horizontal Pod Autoscaler tự động scale theo CPU.
- MongoDB replica set hỗ trợ transaction và khả năng triển khai mở rộng.
- Docker image giúp môi trường chạy nhất quán giữa máy phát triển và production.

### Logging và xử lý lỗi

- Structured logging bằng Pino và Pino HTTP.
- Mỗi request có request ID để truy vết.
- Phân biệt lỗi phía client (`4xx`) và lỗi phía server (`5xx`).
- Error middleware tập trung trả response có cấu trúc thống nhất.
- Log che dữ liệu nhạy cảm và lưu ngữ cảnh cần thiết để gỡ lỗi.
- Endpoint `/health` và `/ready` hỗ trợ kiểm tra tiến trình và kết nối cơ sở dữ liệu.

## Hạ tầng, DevOps và kiểm thử

### Docker

- Backend có Dockerfile production nhiều giai đoạn.
- Chỉ cài dependency production và chạy bằng user không phải root.
- Có container healthcheck và hỗ trợ nhận tín hiệu dừng an toàn.

### Nginx, load balancing và rate limiting

- Sử dụng ingress-nginx làm cổng vào trong Kubernetes.
- Kubernetes Service phân phối request đến các backend Pod.
- Giới hạn request theo IP, số request mỗi giây, burst và số kết nối tại ingress.
- Hỗ trợ lấy IP thật khi đi qua Cloudflare Tunnel.

> Dự án dùng ingress-nginx; chưa có cấu hình Nginx standalone riêng.

### CI/CD

- GitHub Actions tự động cài dependency, lint và chạy test backend.
- Chỉ build Docker image khi bước kiểm thử thành công.
- Image được gắn tag và đẩy lên GitHub Container Registry.
- Kubernetes có thể theo dõi image mới để thực hiện rolling update.

> Jenkins mới có thư mục định hướng, chưa có `Jenkinsfile` hoặc pipeline hoàn chỉnh.

### Kubernetes và Zero Downtime

- Có Namespace, ConfigMap, Secret mẫu, Deployment, Service, Ingress và HPA.
- Có manifest MongoDB StatefulSet và khởi tạo replica set.
- RollingUpdate dùng nhiều replica, `maxUnavailable: 0` và `maxSurge: 1`.
- Readiness/liveness probe ngăn chuyển traffic đến Pod chưa sẵn sàng.
- `preStop`, thời gian graceful termination và xử lý `SIGTERM` giúp request đang chạy hoàn tất trước khi Pod dừng.
- Cloudflare Tunnel cung cấp đường truy cập tới ingress mà không cần mở trực tiếp cổng public trên máy chủ.

> Zero downtime hiện tập trung vào rolling deployment của backend. Khả năng chịu lỗi toàn hệ thống vẫn phụ thuộc mô hình cluster, số node và kiến trúc MongoDB thực tế.

### Kiểm thử

- Unit và integration test bằng Vitest/Supertest.
- MongoDB Memory Server chạy replica set trong test để kiểm tra transaction.
- Security regression test cho xác thực, CSRF, phân quyền, cookie và che dữ liệu log.
- Có JMeter test plan để kiểm thử tải.
- Có hướng dẫn kiểm tra rollout khi hệ thống vẫn đang nhận lưu lượng.

> Dự án chưa có quy trình pentest/DAST/SAST chuyên dụng hoặc báo cáo pentest chính thức; các bài test hiện tại chủ yếu kiểm tra hồi quy bảo mật ở cấp ứng dụng.

### Quản lý nhóm

- Git và GitHub hỗ trợ quản lý phiên bản, review và CI/CD.
- Có thể sử dụng Jira để quản lý backlog, sprint, bug và phân công thành viên.

> Repository hiện chưa chứa tài liệu, export hoặc liên kết Jira cụ thể.

## Trạng thái đáp ứng yêu cầu

| Hạng mục                                     | Trạng thái                                        |
| -------------------------------------------- | ------------------------------------------------- |
| Đăng ký, xác nhận email, đăng nhập/đăng xuất | Hoàn thành                                        |
| Hồ sơ và đổi mật khẩu                        | Hoàn thành                                        |
| Danh mục, tìm kiếm, lọc và chi tiết sản phẩm | Hoàn thành                                        |
| Cart local và server                         | Hoàn thành                                        |
| Địa chỉ, checkout và tạo đơn                 | Hoàn thành                                        |
| COD                                          | Hoàn thành                                        |
| PayPal                                       | Mô phỏng                                          |
| Lịch sử và chi tiết đơn hàng                 | Hoàn thành                                        |
| Hoàn trả, Coupon, Review và Notification     | Hoàn thành nghiệp vụ chính                        |
| Auction                                      | Hoàn thành nghiệp vụ chính, cập nhật bằng polling |
| Best Offer                                   | Hoàn thành nghiệp vụ Buyer chính                  |
| Responsive                                   | Đã triển khai                                     |
| Bảo mật ứng dụng                             | Đã triển khai                                     |
| Docker, GitHub Actions và Kubernetes         | Đã triển khai                                     |
| Nginx/load balancing/rate limiting           | Đã triển khai qua ingress-nginx/Kubernetes        |
| Zero-downtime backend rollout                | Đã cấu hình                                       |
| JMeter                                       | Có test plan                                      |
| Jenkins                                      | Chưa triển khai pipeline                          |
| Jira                                         | Chưa có tài liệu trong repository                 |
| Pentest chuyên dụng                          | Chưa có                                           |

## Cấu trúc dự án

```text
sbay/
├── .github/workflows/       # GitHub Actions
├── backend/
│   ├── docs/                # Tài liệu API, kiến trúc và kiểm thử
│   ├── infrastructure/      # Docker/Kubernetes/CI-CD/load test
│   ├── src/                 # REST API và nghiệp vụ
│   └── tests/               # Unit và integration tests
└── frontend/
    ├── public/
    └── src/                 # React application
```

## Yêu cầu môi trường

- Node.js 20+
- npm
- MongoDB replica set hoặc sharded cluster

## Chạy dự án

### Backend

```sh
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

Backend mặc định chạy tại `http://localhost:4000`.

- Swagger UI: `http://localhost:4000/api-docs/`
- Health check: `http://localhost:4000/health`
- Readiness check: `http://localhost:4000/ready`

### Frontend

Mở terminal khác tại thư mục gốc:

```sh
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173` và proxy request API sang backend tại cổng `4000`.

## Tài khoản mẫu

- Email: `vduong2709@gmai.com`
- Mật khẩu: `Buyer#2026`

## Kiểm tra dự án

### Backend

```sh
cd backend
npm test
npm run test:coverage
npm run lint
npm run docs:check
```

### Frontend

```sh
cd frontend
npm run lint
npm run build
```

Xem hướng dẫn chi tiết tại [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md) và [`backend/infrastructure/kubernetes/README.md`](backend/infrastructure/kubernetes/README.md).
