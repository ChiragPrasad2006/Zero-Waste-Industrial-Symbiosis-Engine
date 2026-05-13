import Post from '../models/Post.js';
import UpgradeRequest from '../models/UpgradeRequest.js';
import User from '../models/User.js';
import CategoryRequest from '../models/CategoryRequest.js';
import { createError } from '../utils/errors.js';

export const dashboard = async (_req, res, next) => {
  try {
    const [pendingPosts, requests, users, pendingCategories] = await Promise.all([
      Post.find({ status: 'pending' }).populate('seller', 'username'),
      UpgradeRequest.find({ status: 'pending' }).populate('user', 'username role').sort({ createdAt: -1 }),
      User.find({}, 'username role superiorUntil createdAt').sort({ createdAt: -1 }),
      CategoryRequest.find({ status: 'pending' }).populate('requestedBy', 'username').sort({ createdAt: -1 })
    ]);

    res.json({
      pendingPosts,
      requests,
      users,
      pendingCategories
    });
  } catch (error) {
    next(error);
  }
};

export const reviewPost = async (req, res, next) => {
  try {
    const { status, flaggedReason = '' } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw createError(404, 'Post not found');
    }

    post.status = status;
    post.flaggedReason = flaggedReason;
    await post.save();

    res.json({ post });
  } catch (error) {
    next(error);
  }
};

export const reviewUpgrade = async (req, res, next) => {
  try {
    const { status, paymentConfirmed, adminNote = '' } = req.body;
    const request = await UpgradeRequest.findById(req.params.id).populate('user');

    if (!request) {
      throw createError(404, 'Upgrade request not found');
    }

    if (status === 'approved' && !paymentConfirmed) {
      throw createError(400, 'Payment must be confirmed before approval');
    }

    request.status = status;
    request.adminNote = adminNote;
    request.approvedBy = req.user._id;
    await request.save();

    if (status === 'approved') {
      const start = request.user.superiorUntil && request.user.superiorUntil > new Date() ? request.user.superiorUntil : new Date();
      const nextDate = new Date(start);
      nextDate.setMonth(nextDate.getMonth() + request.months);
      request.user.role = 'superior';
      request.user.superiorUntil = nextDate;
      request.user.sustainabilityScore += 20;
      await request.user.save();
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
};

export const reviewCategory = async (req, res, next) => {
  try {
    const { status, adminNote = '' } = req.body;
    const request = await CategoryRequest.findById(req.params.id);

    if (!request) {
      throw createError(404, 'Category request not found');
    }

    request.status = status;
    request.adminNote = adminNote;
    request.reviewedBy = req.user._id;
    await request.save();

    res.json({ request });
  } catch (error) {
    next(error);
  }
};
