import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const schema = new mongoose.Schema(
  {
    // Public, stable identifier exposed to the API/frontend. Internal refs
    // (parentId, product.categoryId) still use `_id` (ObjectId).
    uuid: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => randomUUID(),
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: '' },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      validate: {
        validator(value) {
          const categoryId = this._id || this.getQuery?.()._id;
          return !value || !categoryId || String(value) !== String(categoryId);
        },
        message: 'Category cannot be its own parent',
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true },
);

schema.index({ slug: 1 }, { unique: true });
schema.index({ status: 1, name: 1 });
schema.index({ parentId: 1, status: 1 });

export const Category = mongoose.model('Category', schema);
