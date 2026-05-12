import mongoose from 'mongoose';

const upgradeRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    paymentReference: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      default: 100
    },
    months: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    adminNote: {
      type: String,
      default: ''
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

const UpgradeRequest = mongoose.model('UpgradeRequest', upgradeRequestSchema);

export default UpgradeRequest;

