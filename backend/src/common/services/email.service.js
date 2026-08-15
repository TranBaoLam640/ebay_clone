import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const smtpConfigured = Boolean(env.EMAIL_HOST && env.EMAIL_PORT);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      ...(env.EMAIL_SECURE === false ? { requireTLS: true } : {}),
      ...(env.EMAIL_USER && env.EMAIL_PASSWORD
        ? { auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } }
        : {}),
    })
  : null;

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
};

export const buildVerificationEmail = ({
  otp,
  expiresInMinutes,
  verificationUrl,
}) => ({
  subject: 'Verify your email for SBay',
  text: `SBay email verification\n\nYour verification code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes. Do not share this code with anyone.\n\nEnter the code at: ${verificationUrl}\n\nIf you did not register for SBay, you can ignore this email.`,
  html: `<h1>Verify your email for SBay</h1><p>Your verification code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</p><p>This code expires in ${expiresInMinutes} minutes. Do not share this code with anyone.</p><p><a href="${verificationUrl}">Verify email</a></p><p>If you did not register for SBay, you can ignore this email.</p>`,
});

const sendVerificationEmail = async ({
  to,
  otp,
  expiresInMinutes,
  verificationUrl,
}) => {
  const maskedRecipient = maskEmail(to);
  if (!transporter) {
    logger.info(
      {
        messageType: 'EMAIL_VERIFICATION_OTP',
        recipient: maskedRecipient,
        deliverySuppressed: true,
      },
      'SMTP is not configured; verification email was not sent',
    );
    return false;
  }

  try {
    const content = buildVerificationEmail({
      otp,
      expiresInMinutes,
      verificationUrl,
    });
    const result = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      ...content,
    });
    if (Array.isArray(result?.accepted) && !result.accepted.includes(to))
      return false;
    logger.info(
      {
        messageType: 'EMAIL_VERIFICATION_OTP',
        recipient: maskedRecipient,
        deliverySuppressed: false,
      },
      'Verification email delivered',
    );
    return true;
  } catch (error) {
    logger.warn(
      {
        messageType: 'EMAIL_VERIFICATION_OTP',
        recipient: maskedRecipient,
        errorCode: error.code,
      },
      'Verification email delivery failed',
    );
    return false;
  }
};

export const buildPasswordResetEmail = ({
  otp,
  expiresInMinutes,
  resetUrl,
}) => ({
  subject: 'Reset your SBay password',
  text: `SBay password reset\n\nYour password reset code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes. Do not share this code with anyone.\n\nEnter the code at: ${resetUrl}\n\nIf you did not request a password reset, you can ignore this email — your password stays unchanged.`,
  html: `<h1>Reset your SBay password</h1><p>Your password reset code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</p><p>This code expires in ${expiresInMinutes} minutes. Do not share this code with anyone.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request a password reset, you can ignore this email — your password stays unchanged.</p>`,
});

const sendPasswordResetEmail = async ({
  to,
  otp,
  expiresInMinutes,
  resetUrl,
}) => {
  const maskedRecipient = maskEmail(to);
  if (!transporter) {
    logger.info(
      {
        messageType: 'PASSWORD_RESET_OTP',
        recipient: maskedRecipient,
        deliverySuppressed: true,
      },
      'SMTP is not configured; password reset email was not sent',
    );
    return false;
  }

  try {
    const content = buildPasswordResetEmail({
      otp,
      expiresInMinutes,
      resetUrl,
    });
    const result = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      ...content,
    });
    if (Array.isArray(result?.accepted) && !result.accepted.includes(to))
      return false;
    logger.info(
      {
        messageType: 'PASSWORD_RESET_OTP',
        recipient: maskedRecipient,
        deliverySuppressed: false,
      },
      'Password reset email delivered',
    );
    return true;
  } catch (error) {
    logger.warn(
      {
        messageType: 'PASSWORD_RESET_OTP',
        recipient: maskedRecipient,
        errorCode: error.code,
      },
      'Password reset email delivery failed',
    );
    return false;
  }
};

export const emailService = { sendVerificationEmail, sendPasswordResetEmail };
