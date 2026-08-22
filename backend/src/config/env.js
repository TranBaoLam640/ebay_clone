import 'dotenv/config';
import { z } from 'zod';

const boolean = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const optionalString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);
const positiveInteger = (defaultValue) =>
  z.coerce.number().int().positive().default(defaultValue);
const nonNegativeInteger = (defaultValue) =>
  z.coerce.number().int().nonnegative().default(defaultValue);
const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('/api/v1'),
    SWAGGER_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === 'true',
      ),
    SWAGGER_PATH: z
      .string()
      .regex(
        /^\/(?!.*\/$)/,
        'SWAGGER_PATH must start with / and have no trailing slash',
      )
      .default('/api-docs'),
    MONGODB_URI: optionalString,
    MONGODB_HOST: optionalString,
    MONGODB_PORT: positiveInteger(27017),
    MONGODB_DATABASE: optionalString,
    MONGODB_USERNAME: optionalString,
    MONGODB_PASSWORD: optionalString,
    MONGODB_AUTH_SOURCE: optionalString,
    MONGODB_REPLICA_SET: optionalString,
    MONGODB_TLS: boolean,
    MONGODB_MAX_POOL_SIZE: positiveInteger(10),
    MONGODB_MIN_POOL_SIZE: z.coerce.number().int().nonnegative().default(1),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInteger(5000),
    CLIENT_ORIGIN: z.string().min(1),
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    COOKIE_SECURE: boolean.default('false'),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    COOKIE_DOMAIN: z.string().optional(),
    CSRF_SECRET: z.string().min(32),
    EMAIL_HOST: optionalString,
    EMAIL_PORT: z.coerce.number().int().positive().optional().default(587),
    EMAIL_SECURE: boolean.default('false'),
    EMAIL_USER: optionalString,
    EMAIL_PASSWORD: optionalString,
    EMAIL_FROM: z.string().min(1).default('no-reply@sbay.local'),
    EMAIL_VERIFICATION_URL: z
      .url()
      .default('http://localhost:5173/verify-email'),
    PASSWORD_RESET_URL: z.url().default('http://localhost:5173/reset-password'),
    EMAIL_OTP_TTL_MINUTES: positiveInteger(10),
    EMAIL_OTP_MAX_ATTEMPTS: positiveInteger(5),
    EMAIL_OTP_RESEND_COOLDOWN_SECONDS: nonNegativeInteger(60),
    EMAIL_OTP_HMAC_SECRET: optionalString,
    LOG_LEVEL: z.string().default('info'),
    RETURN_WINDOW_DAYS: positiveInteger(30),
    INR_WINDOW_DAYS: positiveInteger(30),
    SHIPMENT_ETA_MINUTES: positiveInteger(10),
    // How often the in-process sweep closes ended auctions. Multi-replica-safe:
    // only one pod's atomic OPEN→CLOSED claim wins per auction.
    AUCTION_SWEEP_INTERVAL_MS: positiveInteger(15000),
    SELLER_FEEDBACK_AUTO_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === 'true',
      ),
    // Project demo simplification: automated positive seller feedback waits
    // two minutes after delivery, then an in-process sweep scans for work.
    SELLER_FEEDBACK_AUTO_DELAY_MS: positiveInteger(120000),
    SELLER_FEEDBACK_AUTO_SWEEP_INTERVAL_MS: positiveInteger(30000),
    PAYPAL_SIMULATION_ENABLED: boolean.default('true'),
    // Cloudflare R2 object storage for avatar, product image, and attachment uploads.
    R2_ENDPOINT: optionalString,
    R2_REGION: z.string().default('auto'),
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET_NAME: optionalString,
    // Public base URL used to build stored object URLs.
    R2_PUBLIC_URL: optionalString,
    // Max upload size in bytes (default 5 MB).
    UPLOAD_MAX_BYTES: positiveInteger(5 * 1024 * 1024),
  })
  .superRefine((config, context) => {
    if (!config.MONGODB_URI && !config.MONGODB_HOST) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_HOST'],
        message: 'MONGODB_HOST is required when MONGODB_URI is empty',
      });
    }
    if (!config.MONGODB_URI && !config.MONGODB_DATABASE) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_DATABASE'],
        message: 'MONGODB_DATABASE is required when MONGODB_URI is empty',
      });
    }
    if (
      !config.MONGODB_URI &&
      Boolean(config.MONGODB_USERNAME) !== Boolean(config.MONGODB_PASSWORD)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_USERNAME'],
        message: 'MongoDB username and password must be provided together',
      });
    }
    if (config.MONGODB_MIN_POOL_SIZE > config.MONGODB_MAX_POOL_SIZE) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_MIN_POOL_SIZE'],
        message: 'MONGODB_MIN_POOL_SIZE cannot exceed MONGODB_MAX_POOL_SIZE',
      });
    }
    if ((config.EMAIL_OTP_HMAC_SECRET?.length || 0) < 32) {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_OTP_HMAC_SECRET'],
        message: 'EMAIL_OTP_HMAC_SECRET must be at least 32 characters',
      });
    }
    if (Boolean(config.EMAIL_USER) !== Boolean(config.EMAIL_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_USER'],
        message: 'SMTP username and password must be provided together',
      });
    }
    if (config.NODE_ENV === 'production') {
      if (
        config.EMAIL_OTP_HMAC_SECRET ===
        'replace-with-at-least-32-random-characters'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['EMAIL_OTP_HMAC_SECRET'],
          message: 'EMAIL_OTP_HMAC_SECRET must not use the example placeholder',
        });
      }
      if (config.EMAIL_FROM === 'no-reply@sbay.local') {
        context.addIssue({
          code: 'custom',
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM must be configured for production',
        });
      }
      if (config.EMAIL_VERIFICATION_URL.startsWith('http://')) {
        context.addIssue({
          code: 'custom',
          path: ['EMAIL_VERIFICATION_URL'],
          message: 'EMAIL_VERIFICATION_URL must use HTTPS in production',
        });
      }
      for (const field of [
        'EMAIL_HOST',
        'EMAIL_USER',
        'EMAIL_PASSWORD',
        'EMAIL_FROM',
      ]) {
        if (!config[field]) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required in production`,
          });
        }
      }
    }
  })
  .transform((config) => ({
    ...config,
    SWAGGER_ENABLED: config.SWAGGER_ENABLED ?? config.NODE_ENV !== 'production',
    SELLER_FEEDBACK_AUTO_ENABLED:
      config.SELLER_FEEDBACK_AUTO_ENABLED ?? config.NODE_ENV !== 'test',
  }));
export const loadConfig = (source = process.env) => schema.parse(source);
export const env = loadConfig();
