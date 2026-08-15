# Authentication Email OTP API

All unsafe requests require `X-CSRF-Token` from `GET /api/v1/auth/csrf-token` and the associated double-submit cookie.

## Register

`POST /api/v1/auth/register`

```json
{
  "email": "buyer@example.com",
  "password": "Strong1!Password",
  "fullName": "Buyer Name"
}
```

A successful registration creates an unverified User, persists an HMAC-protected six-digit OTP record, commits the transaction, then sends the raw OTP through the shared email service. The response contains safe timing metadata but never the OTP or hash.

```json
{
  "success": true,
  "data": {
    "email": "buyer@example.com",
    "otpExpiresInSeconds": 600,
    "resendAvailableInSeconds": 60
  }
}
```

## Verify email

`POST /api/v1/auth/verify-email`

```json
{
  "email": "buyer@example.com",
  "otp": "042731"
}
```

The OTP is exactly six decimal digits and remains a string so leading zeroes are valid. Successful verification transactionally consumes the OTP, marks the User verified, sets the verification timestamp, and creates the existing account notification.

```json
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

## Resend verification

`POST /api/v1/auth/resend-verification`

```json
{
  "email": "buyer@example.com"
}
```

Unknown and already-verified accounts receive the same generic successful response. An existing unverified account must pass the persisted resend cooldown. Resend invalidates every previous active OTP before creating and sending a replacement, so only the newest code can verify the account.

```json
{
  "success": true,
  "data": {
    "sent": true
  }
}
```

## Security policy

`EMAIL_OTP_TTL_MINUTES` controls expiration, `EMAIL_OTP_MAX_ATTEMPTS` controls persisted failed attempts, and `EMAIL_OTP_RESEND_COOLDOWN_SECONDS` controls persisted resend timing. OTPs are generated with `crypto.randomInt`, protected with HMAC-SHA256 using `EMAIL_OTP_HMAC_SECRET`, checked explicitly for expiration, compared safely, and consumed once. Raw OTPs are never stored, logged, returned, or embedded in URLs. Existing link-token records in `emailverificationtokens` are not accepted by the OTP endpoint; a successful resend invalidates a legacy active record and replaces it with an OTP record in the same collection. Tests mock `emailService.sendVerificationEmail` and capture its outbound OTP argument; automated tests never contact SMTP.
