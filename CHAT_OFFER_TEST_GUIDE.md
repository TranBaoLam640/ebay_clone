# Chat + Offer Test Guide

Huong dan nay mo ta toan bo luong buyer/seller chat va Best Offer hien co trong project, gom UI, API, dieu kien hop le, va checklist test tren Swagger.

## 1. Tai khoan seed de test

Tat ca tai khoan seed dung chung password:

```text
Strong1!Password
```

Tai khoan buyer:

```text
buyer1@example.test
```

Tai khoan seller:

```text
seller1@example.test
seller2@example.test 
seller3@example.test
```

Tai khoan admin:

```text
admin@example.test
```

Password trong MongoDB bi hash la dung. Khong doc nguoc lai duoc. Neu can reset lai password seed, chay lai script seed catalog.

## 2. Man hinh UI lien quan

Frontend mac dinh:

```text
http://localhost:5173
```

Trang chat:

```text
http://localhost:5173/messages
```

Trang My Offers cua buyer:

```text
http://localhost:5173/account/offers
```

Trang product detail:

```text
http://localhost:5173/products/:productId
```

Trang order detail:

```text
http://localhost:5173/account/orders/:orderId
```

Swagger backend:

```text
http://localhost:4000/docs
```

Neu backend cua ban dang dung port khac, xem `PORT` trong `backend/.env`.

## 3. Dieu kien san pham duoc Make Offer

Backend chi chap nhan offer khi san pham thoa tat ca dieu kien:

```text
status = ACTIVE
stock > 0
listingType = FIXED
offersEnabled = true
```

Gia offer hien tai chi can:

```text
so nguyen duong > 0
```

Hien tai chua co rule:

```text
khong bat buoc offer < gia goc
khong co muc toi thieu 50%
khong auto accept
khong auto reject theo gia
```

Vi vay san pham gia 10.000.000d thi cac gia nhu 1d, 5.000.000d, 9.999.999d, 20.000.000d deu qua validation neu san pham co bat offer.

## 4. San pham nen dung de test Offer

Mot so san pham trong database hien tai dang offer duoc:

```text
Samsung Galaxy S23 Ultra
Jordan Street Sneakers
Louis Vuitton City Bag
Canon Travel Camera
Battle Royale Game Kit
6 Tube Pedal Resistance Band
```

San pham khong offer duoc se bi backend tra:

```text
This listing does not accept offers
```

Ly do thuong gap:

```text
offersEnabled = false
listingType = AUCTION
status khong phai ACTIVE
stock = 0
conversation da thanh POST_PURCHASE
```

## 5. Luong UI chinh: buyer chat voi seller roi make offer

1. Dang nhap buyer:

```text
buyer1@example.test
Strong1!Password
```

2. Vao mot product offer duoc.

3. Bam `Contact Seller`.

4. UI tao conversation va chuyen sang:

```text
/messages?conversation=<conversationId>
```

5. Gui tin nhan text de kiem tra chat.

6. Neu san pham du dieu kien offer, o composer se co nut:

```text
Make Offer
```

7. Nhap gia offer, vi du:

```text
5000000
```

8. Submit. Chat se hien message type `OFFER`.

9. Dang xuat buyer.

10. Dang nhap seller tuong ung voi san pham.

11. Mo:

```text
/messages
```

12. Chon conversation vua tao.

13. Seller co the:

```text
Accept
Decline
Counter
```

14. Neu seller `Accept`, dang nhap lai buyer.

15. Buyer vao conversation do, offer card se co:

```text
Buy at offer price
```

16. Bam nut do. UI them san pham vao cart voi quantity cua offer va chuyen sang:

```text
/checkout?offerId=<offerId>
```

17. Hoan tat checkout.

Sau khi checkout thanh cong, offer chuyen sang:

```text
PURCHASED
```

Conversation chuyen tu:

```text
PRE_PURCHASE
```

sang:

```text
POST_PURCHASE
```

Luc nay khong duoc tao offer moi trong conversation do nua.

## 6. Luong UI phu: Make Offer truc tiep tu product detail

Trang product detail co nut `Make Offer` rieng voi san pham `offersEnabled = true`.

Flow nay goi API:

```text
POST /api/v1/products/{productId}/offers
```

Sau khi submit thanh cong, offer hien trong:

```text
/account/offers
```

Buyer co the withdraw neu offer con:

```text
PENDING
```

Flow nay la luong buyer-side cu hon. De demo day du seller accept/decline/counter, nen uu tien luong offer trong chat.

## 7. API Chat

Tat ca API ben duoi can dang nhap bang cookie/session cua user.

### List conversations

```http
GET /api/v1/conversations?limit=50
```

Tra ve cac conversation ma user la buyer hoac la owner cua seller profile.

### Create or reuse conversation

```http
POST /api/v1/conversations
Content-Type: application/json

{
  "productId": "<product_uuid>"
}
```

Tao hoac lay lai conversation `PRE_PURCHASE`.

Neu co order:

```http
POST /api/v1/conversations
Content-Type: application/json

{
  "productId": "<product_uuid>",
  "orderId": "<order_object_id>"
}
```

Se tao/reuse conversation `POST_PURCHASE`.

### List messages

```http
GET /api/v1/conversations/{conversationId}/messages?limit=30
```

Phan trang tin nhan cu:

```http
GET /api/v1/conversations/{conversationId}/messages?limit=30&before=<messageId>
```

### Send text message

```http
POST /api/v1/conversations/{conversationId}/messages
Content-Type: application/json

{
  "type": "TEXT",
  "content": "Hello seller",
  "attachments": [],
  "sendCopyToEmail": false
}
```

### Upload attachments

```http
POST /api/v1/conversations/{conversationId}/attachments
Content-Type: multipart/form-data
```

Field name:

```text
files
```

Gioi han:

```text
toi da 5 files
toi da 5 MB moi file
```

Loai file frontend cho chon:

```text
jpg, jpeg, png, webp, pdf, txt, doc, docx
```

Sau khi upload, dung attachment payload tra ve de gui message:

```http
POST /api/v1/conversations/{conversationId}/messages
Content-Type: application/json

{
  "type": "IMAGE",
  "content": "",
  "attachments": [
    {
      "url": "https://...",
      "fileName": "photo.webp",
      "mimeType": "image/webp",
      "size": 12345,
      "type": "IMAGE"
    }
  ],
  "sendCopyToEmail": false
}
```

### Mark read

```http
PATCH /api/v1/conversations/{conversationId}/read
```

### Archive conversation

```http
PATCH /api/v1/conversations/{conversationId}/archive
```

## 8. API Offer trong chat

### Create offer in conversation

```http
POST /api/v1/conversations/{conversationId}/offers
Content-Type: application/json

{
  "price": 5000000,
  "message": "Can you do this price?"
}
```

Dieu kien:

```text
conversation phai la PRE_PURCHASE
product ACTIVE
stock > 0
listingType FIXED
offersEnabled true
price la so nguyen duong
```

Ket qua:

```text
tao Offer status PENDING
tao Message type OFFER trong chat
emit Socket.IO: offer:new
emit Socket.IO: message:new
```

### Accept offer

```http
POST /api/v1/offers/{offerId}/accept
```

Chi nguoi khong tao offer moi accept duoc.

Ket qua:

```text
PENDING -> ACCEPTED
emit Socket.IO: offer:updated
```

### Decline offer

```http
POST /api/v1/offers/{offerId}/decline
```

Chi nguoi khong tao offer moi decline duoc.

Ket qua:

```text
PENDING -> DECLINED
emit Socket.IO: offer:updated
```

### Counter offer

```http
POST /api/v1/offers/{offerId}/counter
Content-Type: application/json

{
  "price": 6000000,
  "message": "I can do this price."
}
```

Chi nguoi khong tao offer moi counter duoc.

Ket qua:

```text
offer cu: PENDING -> COUNTERED
offer moi: PENDING
offer moi co parentOfferId = offer cu
tao Message type OFFER moi trong chat
emit Socket.IO: offer:updated
emit Socket.IO: offer:new
emit Socket.IO: message:new
```

### Retract offer / counteroffer

```http
POST /api/v1/offers/{offerId}/retract
```

Chi nguoi da gui proposal hien tai moi retract duoc.

Dieu kien:

```text
offer status = PENDING
current user = offer.createdBy
conversation participant hop le
```

Ket qua:

```text
PENDING -> WITHDRAWN
amount giu nguyen
message/offer cu van nam trong lich su chat
emit Socket.IO: offer:updated
```

Neu proposal da ACCEPTED, DECLINED, COUNTERED, WITHDRAWN, EXPIRED hoac PURCHASED thi API tra conflict va khong doi du lieu.

## 9. API Offer ngoai chat

### Create product offer

```http
POST /api/v1/products/{productId}/offers
Content-Type: application/json

{
  "amount": 5000000,
  "quantity": 1,
  "message": "My best offer"
}
```

Dung cho nut `Make Offer` tren product detail.

### List my offers

```http
GET /api/v1/me/offers
```

Dung cho UI:

```text
/account/offers
```

### Withdraw my offer

```http
DELETE /api/v1/me/offers/{offerId}
```

Chi buyer tao offer moi withdraw duoc va offer phai con:

```text
PENDING
```

Ket qua:

```text
PENDING -> WITHDRAWN
```

## 10. Checkout voi accepted offer

Sau khi offer trong chat duoc seller accept, buyer bam:

```text
Buy at offer price
```

Frontend se them san pham vao cart va dieu huong den:

```text
/checkout?offerId=<offerId>
```

Checkout API co field:

```json
{
  "selectedCartItemIds": ["<cart_item_id>"],
  "addressId": "<address_id>",
  "paymentMethod": "COD",
  "offerId": "<accepted_offer_id>"
}
```

Dieu kien checkout voi offer:

```text
offer phai ACCEPTED
offer phai thuoc buyer hien tai
cart chi nen co dung item/product/quantity match offer
product va seller phai match offer
offer chua bi PURCHASED
```

Sau checkout thanh cong:

```text
offer status = PURCHASED
offer gan orderId
offer gan usedAt
conversation gan orderId
conversation type = POST_PURCHASE
```

## 11. Socket.IO events

Client chat ket noi Socket.IO bang cookie auth.

Client join room:

```text
conversation:join
```

Payload:

```text
conversationId
```

Server co cac event lien quan:

```text
message:new
message:read
offer:new
offer:updated
conversation:updated
typing:start
typing:stop
```

## 12. Checklist test UI

### Buyer

1. Login `buyer1@example.test`.
2. Vao product offer duoc.
3. Thay badge/nut offer neu product support offer.
4. Bam `Contact Seller`.
5. Vao duoc `/messages?conversation=...`.
6. Gui tin nhan text.
7. Upload attachment anh `.webp` neu can.
8. Bam `Make Offer`.
9. Nhap gia duong, vi du `5000000`.
10. Thay offer card trong chat.
11. Dang xuat.

### Seller

1. Login seller tuong ung.
2. Vao `/messages`.
3. Chon conversation buyer vua tao.
4. Doc duoc message.
5. Thay offer card.
6. Test `Accept`.
7. Tao conversation khac de test `Decline`.
8. Tao conversation khac de test `Counter`.

### Buyer sau khi accepted

1. Login lai buyer.
2. Vao `/messages`.
3. Mo conversation co offer accepted.
4. Bam `Buy at offer price`.
5. Vao checkout voi `offerId`.
6. Hoan tat checkout COD.
7. Quay lai chat, offer thanh `PURCHASED`.
8. Conversation thanh `POST_PURCHASE`.

## 13. Checklist test Swagger/API

1. Login tren Swagger hoac dung cookie da login.
2. `GET /api/v1/products?format=offerable` de tim product offerable.
3. `POST /api/v1/conversations` voi productId.
4. `GET /api/v1/conversations`.
5. `POST /api/v1/conversations/{id}/messages`.
6. `POST /api/v1/conversations/{id}/attachments` voi field `files`.
7. `POST /api/v1/conversations/{id}/offers`.
8. Dang nhap seller.
9. `GET /api/v1/conversations`.
10. `POST /api/v1/offers/{offerId}/accept`.
11. Dang nhap buyer.
12. Checkout voi accepted offer.
13. Tao offer khac va test `decline`.
14. Tao offer khac va test `counter`.
15. Test loi khi buyer tu accept offer cua minh: phai 403.
16. Test loi khi offer san pham auction/out of stock/non-offerable: phai 409.
17. Test loi khi conversation da POST_PURCHASE tao offer moi: phai 409.

## 14. Trang thai UI hien co va chua co

Da co UI:

```text
Product detail: Contact Seller
Product detail: Make Offer buyer-side
Messages page
Chat text message
Attachment upload trong chat
Offer card trong chat
Accept / Decline / Counter trong chat
Buy at offer price sau accepted
My Offers page cho offer buyer-side
Withdraw offer buyer-side
Order detail: Contact Seller
```

Chua hoan thien / nen can nhac:

```text
Chua co link Messages ro rang trong header/account menu
Chua co seller dashboard rieng
Chua co rule gia offer thuc te nhu 50%-99% gia goc
Chua co auto expire job doi PENDING -> EXPIRED
Co 2 luong Make Offer song song: product detail va chat
```

## 15. De xuat luong demo tot nhat

De demo mon hoc, nen demo theo thu tu:

```text
Buyer login
Product detail
Contact Seller
Chat message
Make Offer trong chat
Seller login
Accept / Counter / Decline
Buyer checkout accepted offer
Conversation thanh post-purchase
Order detail Contact Seller
```

Luong nay the hien duoc gan het tinh nang:

```text
auth
catalog
chat realtime
R2 attachment upload
offer negotiation
checkout
order
post-purchase conversation
```
