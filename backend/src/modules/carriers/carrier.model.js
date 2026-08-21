import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

schema.index({ active: 1, name: 1 });

export const Carrier = mongoose.model('Carrier', schema);
