import mongoose from 'mongoose';
import { USER_STATUS } from '../../common/constants/user-status.js';
import { USER_ROLES } from '../../common/constants/user-roles.js';
const schema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    phone: String,
    avatarUrl: String,
    role: { type: String, enum: USER_ROLES, default: 'USER' },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING_VERIFICATION,
    },
    verificationSentAt: Date,
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    lastLoginAt: Date,
  },
  { timestamps: true },
);
export const User = mongoose.model('User', schema);
