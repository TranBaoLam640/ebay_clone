import { User } from './user.model.js';
export const create = (data, session) =>
  session
    ? User.create([data], { session }).then(([user]) => user)
    : User.create(data);
export const findById = (id, session) =>
  User.findById(id).session(session || null);
export const findByEmail = (email) => User.findOne({ email });
// Batch-fetch display names for a set of user ids (bid-history redaction).
export const findNamesByIds = (ids) =>
  User.find({ _id: { $in: ids } })
    .select('fullName')
    .lean();
export const findByEmailWithPassword = (email) =>
  User.findOne({ email }).select('+passwordHash');
export const updateById = (id, data) =>
  User.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true,
  });
export const markVerificationSent = (id, session) =>
  User.updateOne({ _id: id }, { verificationSentAt: new Date() }, { session });
export const markVerified = (id, session) =>
  User.findOneAndUpdate(
    { _id: id, isEmailVerified: false },
    {
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
    { returnDocument: 'after', session },
  );
export const markLogin = (id) =>
  User.findByIdAndUpdate(
    id,
    { lastLoginAt: new Date() },
    { returnDocument: 'after' },
  );
export const updatePassword = (id, passwordHash, session) =>
  User.updateOne({ _id: id }, { passwordHash }, { session });
