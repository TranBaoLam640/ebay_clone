import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: Number.isInteger,
  },
});

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ userId: 1 }, { unique: true });

export const Cart = mongoose.model('Cart', schema);
