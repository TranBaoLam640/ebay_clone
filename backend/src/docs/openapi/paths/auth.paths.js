import {
  body,
  object,
  operation,
  response,
  security,
} from '../components/index.js';

const email = { type: 'string', format: 'email' };

export const authPaths = {
  '/auth/csrf-token': {
    get: operation({
      tag: 'Authentication',
      operationId: 'getCsrfToken',
      summary: 'Issue a CSRF token',
      success: response(
        'CSRF token issued',
        object({ csrfToken: { type: 'string' } }, ['csrfToken']),
      ),
      errors: [429, 500],
      security: [],
    }),
  },
  '/auth/register': {
    post: operation({
      tag: 'Authentication',
      operationId: 'registerUser',
      summary: 'Register a user',
      description:
        'Creates an unverified buyer account. A six-digit verification OTP is delivered only by email.',
      requestBody: body({ $ref: '#/components/schemas/RegisterRequest' }),
      success: response(
        'User registered',
        object(
          {
            email,
            otpExpiresInSeconds: { type: 'integer', example: 600 },
            resendAvailableInSeconds: { type: 'integer', example: 60 },
          },
          ['email', 'otpExpiresInSeconds', 'resendAvailableInSeconds'],
        ),
      ),
      successStatus: 201,
      errors: [400, 409, 413, 429, 500, 502],
      security: security.csrf,
    }),
  },
  '/auth/verify-email': {
    post: operation({
      tag: 'Authentication',
      operationId: 'verifyEmail',
      summary: 'Verify an email address with an OTP',
      description:
        'Accepts the six-digit code sent by email. Leading zeroes are significant.',
      requestBody: body({ $ref: '#/components/schemas/VerifyEmailRequest' }),
      success: response(
        'Email verified',
        object({ verified: { type: 'boolean' } }),
      ),
      security: security.csrf,
    }),
  },
  '/auth/resend-verification': {
    post: operation({
      tag: 'Authentication',
      operationId: 'resendEmailVerification',
      summary: 'Resend email verification',
      requestBody: body({
        $ref: '#/components/schemas/ResendVerificationRequest',
      }),
      success: response(
        'Verification sent',
        object({ sent: { type: 'boolean' } }),
      ),
      errors: [400, 429, 500],
      security: security.csrf,
    }),
  },
  '/auth/login': {
    post: operation({
      tag: 'Authentication',
      operationId: 'loginUser',
      summary: 'Log in',
      requestBody: body({ $ref: '#/components/schemas/LoginRequest' }),
      success: response(
        'Logged in and authentication cookies set',
        object({
          user: object({ id: { type: 'string' }, email }, ['id', 'email']),
        }),
      ),
      errors: [400, 401, 413, 429, 500],
      security: security.csrf,
    }),
  },
  '/auth/refresh': {
    post: operation({
      tag: 'Authentication',
      operationId: 'refreshSession',
      summary: 'Rotate authentication cookies',
      success: response(
        'Session refreshed',
        object({ refreshed: { type: 'boolean' } }),
      ),
      errors: [401, 429, 500],
      security: security.refresh,
    }),
  },
  '/auth/logout': {
    post: operation({
      tag: 'Authentication',
      operationId: 'logoutUser',
      summary: 'Log out and revoke the refresh session',
      success: response(
        'Logged out',
        object({ loggedOut: { type: 'boolean' } }),
      ),
      errors: [429, 500],
      description:
        'The refresh cookie is optional; when present its persisted session is revoked before cookies are cleared.',
      security: security.csrf,
    }),
  },
};
