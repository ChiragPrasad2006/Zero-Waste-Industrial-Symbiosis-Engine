import User from '../models/User.js';
import UpgradeRequest from '../models/UpgradeRequest.js';
import { encryptEmail, hashEmail } from '../utils/crypto.js';
import { signToken } from '../utils/token.js';
import { createError } from '../utils/errors.js';

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      throw createError(400, 'Username, email, and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailLookup = hashEmail(normalizedEmail);

    const existing = await User.findOne({
      $or: [{ username: username.trim() }, { emailHash: emailLookup }]
    });

    if (existing) {
      throw createError(409, 'Username or email already exists');
    }

    const user = await User.create({
      username: username.trim(),
      emailHash: emailLookup,
      emailEncrypted: encryptEmail(normalizedEmail),
      password
    });

    const token = signToken(user._id.toString());
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailLookup = hashEmail(email || '');
    const user = await User.findOne({ emailHash: emailLookup });

    if (!user || !(await user.comparePassword(password || ''))) {
      throw createError(401, 'Invalid email or password');
    }

    const token = signToken(user._id.toString());
    res.json({ token, user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res) => {
  const pendingUpgrade = await UpgradeRequest.findOne({
    user: req.user._id,
    status: 'pending'
  }).sort({ createdAt: -1 });

  res.json({
    user: req.user.toSafeObject(),
    pendingUpgrade
  });
};

export const updateProfile = async (req, res, next) => {
  try {
    const { username, email, currentPassword, newPassword, profileImage, bio, location } = req.body;

    if (!currentPassword || !(await req.user.comparePassword(currentPassword))) {
      throw createError(401, 'Current password is required to update your profile');
    }

    if (username && username !== req.user.username) {
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: req.user._id } });
      if (taken) {
        throw createError(409, 'Username is already taken');
      }
      req.user.username = username.trim();
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailLookup = hashEmail(normalizedEmail);
      const takenEmail = await User.findOne({ emailHash: emailLookup, _id: { $ne: req.user._id } });
      if (takenEmail) {
        throw createError(409, 'Email is already taken');
      }
      req.user.emailHash = emailLookup;
      req.user.emailEncrypted = encryptEmail(normalizedEmail);
    }

    if (newPassword) {
      req.user.password = newPassword;
    }

    if (typeof profileImage === 'string') {
      req.user.profileImage = profileImage;
    }
    if (typeof bio === 'string') {
      req.user.bio = bio;
    }
    if (typeof location === 'string') {
      req.user.location = location;
    }

    await req.user.save();
    res.json({ user: req.user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

export const requestUpgrade = async (req, res, next) => {
  try {
    const { paymentReference, months = 1 } = req.body;

    if (!paymentReference) {
      throw createError(400, 'Payment reference is required');
    }

    const existingPending = await UpgradeRequest.findOne({
      user: req.user._id,
      status: 'pending'
    });

    if (existingPending) {
      throw createError(409, 'You already have a pending upgrade request');
    }

    const request = await UpgradeRequest.create({
      user: req.user._id,
      paymentReference: paymentReference.trim(),
      months: Number(months) || 1,
      amount: 100 * (Number(months) || 1)
    });

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

