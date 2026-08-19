import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

const importService = async (smtp = true, secure = true) => {
  vi.resetModules();
  process.env.EMAIL_HOST = smtp ? 'smtp.example.test' : '';
  process.env.EMAIL_PORT = secure ? '465' : '587';
  process.env.EMAIL_SECURE = String(secure);
  process.env.EMAIL_USER = 'mailer';
  process.env.EMAIL_PASSWORD = 'mailer-password';
  process.env.EMAIL_FROM = 'SBay <no-reply@example.com>';
  process.env.EMAIL_VERIFICATION_URL = 'https://example.com/verify-email';
  return import('../../src/common/services/email.service.js');
};

beforeEach(() => {
  createTransport.mockClear();
  sendMail.mockReset();
  sendMail.mockResolvedValue({ accepted: ['buyer@example.com'] });
});

describe('email service', () => {
  it('memoizes a secure transporter and sends text and HTML OTP content', async () => {
    const { emailService } = await importService();
    expect(createTransport).toHaveBeenCalledOnce();
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: { user: 'mailer', pass: 'mailer-password' },
    });
    await expect(
      emailService.sendVerificationEmail({
        to: 'buyer@example.com',
        otp: '042731',
        expiresInMinutes: 10,
        verificationUrl: 'https://example.com/verify-email',
      }),
    ).resolves.toBe(true);
    const message = sendMail.mock.calls[0][0];
    expect(message.subject).toBe('Verify your email for SBay');
    expect(message.text).toContain('042731');
    expect(message.html).toContain('042731');
    expect(message.text).toContain('10 minutes');
    expect(message.text).not.toContain('?otp=');
    expect(createTransport).toHaveBeenCalledOnce();
  });

  it('requires STARTTLS for non-implicit TLS transports', async () => {
    await importService(true, false);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false,
        requireTLS: true,
      }),
    );
  });

  it('suppresses delivery without SMTP and does not create a transporter', async () => {
    const { emailService } = await importService(false);
    await expect(
      emailService.sendVerificationEmail({
        to: 'buyer@example.com',
        otp: '042731',
        expiresInMinutes: 10,
        verificationUrl: 'https://example.com/verify-email',
      }),
    ).resolves.toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('treats SMTP rejection as failed delivery', async () => {
    sendMail.mockResolvedValueOnce({ accepted: [] });
    const { emailService } = await importService();
    await expect(
      emailService.sendVerificationEmail({
        to: 'buyer@example.com',
        otp: '042731',
        expiresInMinutes: 10,
        verificationUrl: 'https://example.com/verify-email',
      }),
    ).resolves.toBe(false);
  });

  it('does not expose SMTP errors to callers', async () => {
    sendMail.mockRejectedValueOnce(
      new Error('authentication failed for mailer-password'),
    );
    const { emailService } = await importService();
    await expect(
      emailService.sendVerificationEmail({
        to: 'buyer@example.com',
        otp: '042731',
        expiresInMinutes: 10,
        verificationUrl: 'https://example.com/verify-email',
      }),
    ).resolves.toBe(false);
  });

  it('builds purchase feedback reminder content with purchased items', async () => {
    const { buildPurchaseFeedbackEmail } = await importService();
    const message = buildPurchaseFeedbackEmail({
      buyerName: 'Buyer One',
      checkoutGroupId: 'checkout-123',
      items: [
        { title: 'Camera Kit', quantity: 2 },
        { title: 'Desk Lamp', quantity: 1 },
      ],
    });

    expect(message.subject).toBe('Thank you for buying on SBay');
    expect(message.text).toContain('Hi Buyer One');
    expect(message.text).toContain('Please leave feedback for the item');
    expect(message.text).toContain('Camera Kit x 2');
    expect(message.text).toContain('Desk Lamp x 1');
    expect(message.text).toContain('checkout-123');
    expect(message.html).toContain('Thank you for buying on SBay');
  });
});
