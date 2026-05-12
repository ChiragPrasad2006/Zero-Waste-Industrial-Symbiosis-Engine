import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { createError } from '../utils/errors.js';

export const requireAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError(401, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
    const user = await User.findById(payload.userId);

    if (!user) {
      throw createError(401, 'User not found');
    }

    if (user.role === 'superior' && user.superiorUntil && user.superiorUntil <= new Date()) {
      user.role = 'user';
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : createError(401, 'Invalid token'));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(createError(403, 'Access denied'));
  }
  next();
};

export const requireSuperiorAccess = (req, _res, next) => {
  const activeSuperior = req.user.role === 'admin' || (req.user.superiorUntil && req.user.superiorUntil > new Date());
  if (!activeSuperior) {
    return next(createError(403, 'Upgrade required to upload posts'));
  }
  next();
};

