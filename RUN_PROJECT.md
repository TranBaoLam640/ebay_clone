# Huong dan chay du an SBay

File nay huong dan cach chay backend, frontend, MongoDB local, upload qua Cloudflare R2, va mo Swagger.

## 1. Yeu cau can co

- Node.js 20 tro len
- npm
- MongoDB dang chay local tai `127.0.0.1:27017`
- File `backend/.env` da duoc cau hinh
- File `frontend/.env` da duoc cau hinh

Kiem tra nhanh:

```bash
node -v
npm -v
```

## 2. Kiem tra backend env

Tu thu muc goc repo:

```bash
cd backend
node -e "import('./src/config/env.js').then(()=>console.log('ENV_OK')).catch((e)=>{console.error(e.issues || e.message); process.exit(1);})"
```

Neu hien:

```text
ENV_OK
```

la file `backend/.env` hop le.

## 3. Kiem tra MongoDB

Tu thu muc `backend`:

```bash
npm run db:check
```

Ket qua mong doi:

```text
Database connection: successful
Database name: sbay
Connection readyState: 1
```

Hien tai backend dang dung cau hinh:

```env
MONGODB_HOST=127.0.0.1
MONGODB_PORT=27017
MONGODB_DATABASE=sbay
```

Neu muon dung database khac, sua cac bien MongoDB trong `backend/.env`.

## 4. Cai dependencies

Neu chua tung cai package:

```bash
cd backend
npm install
```

Mo terminal khac:

```bash
cd frontend
npm install
```

## 5. Chay backend

Terminal 1:

```bash
cd backend
npm run dev
```

Backend mac dinh chay tai:

```text
http://localhost:4000
```

Kiem tra health:

```text
http://localhost:4000/health
```

## 6. Chay frontend

Terminal 2:

```bash
cd frontend
npm run dev
```

Frontend Vite thuong chay tai:

```text
http://localhost:5173
```

Dam bao `frontend/.env` co:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Neu frontend va backend chay cung may local, cau hinh backend nen co:

```env
CLIENT_ORIGIN=http://localhost:5173
```

## 7. Mo Swagger

Sau khi backend da chay, mo:

```text
http://localhost:4000/api-docs/
```

OpenAPI JSON:

```text
http://localhost:4000/api-docs/openapi.json
```

Neu Swagger khong hien, kiem tra trong `backend/.env`:

```env
SWAGGER_ENABLED=true
SWAGGER_PATH=/api-docs
```

## 8. Cach test API tren Swagger

Backend dung cookie HttpOnly va CSRF, nen flow tren Swagger la:

1. Mo Swagger tai `http://localhost:4000/api-docs/`
2. Goi `GET /api/v1/auth/csrf-token`
3. Copy gia tri `data.csrfToken`
4. Khi goi cac API `POST`, `PATCH`, `DELETE`, them header:

```text
X-CSRF-Token: <csrfToken vua copy>
```

5. Register user:

```text
POST /api/v1/auth/register
```

6. Verify email OTP neu can.
7. Login:

```text
POST /api/v1/auth/login
```

8. Sau login, browser tu giu cookie HttpOnly. Cac request tiep theo tren Swagger se tu gui cookie neu cung origin.

## 9. Test upload R2

Dieu kien trong `backend/.env`:

```env
R2_ENDPOINT=<da cau hinh>
R2_REGION=auto
R2_ACCESS_KEY_ID=<secret>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=sbay-storage
R2_PUBLIC_URL=<public r2.dev hoac custom domain>
UPLOAD_MAX_BYTES=5242880
```

Sau khi login tren Swagger hoac frontend, co the test:

```text
POST /api/v1/uploads/avatar
POST /api/v1/uploads/product-image
POST /api/v1/conversations/{id}/attachments
```

Upload field name cho avatar/product image:

```text
file
```

Upload field name cho message attachments:

```text
files
```

Ket qua thanh cong se tra ve URL bat dau bang `R2_PUBLIC_URL`.

## 10. Chay tests

Backend:

```bash
cd backend
npm test
```

Test rieng messaging/upload attachments:

```bash
cd backend
npm test -- tests/integration/messaging.test.js
```

Kiem tra OpenAPI:

```bash
cd backend
npm run docs:check
```

## 11. Seed data development

Neu muon tao lai du lieu mau:

```bash
cd backend
npm run seed
```

Can than: seed script co the xoa/ghi lai cac fixture development co ID co dinh.

## 12. Loi thuong gap

### Backend bao ENV error

Chay lai:

```bash
cd backend
node -e "import('./src/config/env.js').then(()=>console.log('ENV_OK')).catch((e)=>{console.error(e.issues || e.message); process.exit(1);})"
```

Doc field bi loi va sua trong `backend/.env`.

### Backend khong ket noi MongoDB

Kiem tra MongoDB dang chay:

```bash
cd backend
npm run db:check
```

Neu dung local MongoDB, dam bao MongoDB dang listen tai:

```text
127.0.0.1:27017
```

### Upload tra ve 503

Thuong la thieu bien R2:

```env
R2_ENDPOINT
R2_REGION
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

### Upload tra ve 502

Backend da goi R2 nhung R2 tu choi hoac loi. Kiem tra:

- Access Key ID
- Secret Access Key
- Bucket permission
- Bucket name `sbay-storage`
- Endpoint account ID
- R2 public access/domain

### Frontend bi CORS

Kiem tra:

```env
CLIENT_ORIGIN=http://localhost:5173
```

Sau khi sua `.env`, restart backend.

## 13. Thu tu chay nhanh moi ngay

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Mo:

```text
Frontend: http://localhost:5173
Swagger:  http://localhost:4000/api-docs/
Health:   http://localhost:4000/health
```
