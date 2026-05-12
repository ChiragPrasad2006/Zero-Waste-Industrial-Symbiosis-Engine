import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    purpose: {
      type: String,
      required: true
    },
    priceMin: {
      type: Number,
      required: true,
      min: 0
    },
    quantityValue: {
      type: Number,
      required: true,
      min: 0
    },
    quantityUnit: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String,
      default: ''
    },
    wasteAttributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    flaggedReason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

postSchema.index({ title: 'text', description: 'text', category: 'text', purpose: 'text' });

const Post = mongoose.model('Post', postSchema);

export default Post;

