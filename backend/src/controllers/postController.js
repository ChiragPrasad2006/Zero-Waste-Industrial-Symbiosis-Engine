import Post from '../models/Post.js';
import User from '../models/User.js';
import CategoryRequest from '../models/CategoryRequest.js';
import { createError } from '../utils/errors.js';
import { getAvailableCategoryNames, normalizeCategoryName } from '../utils/categories.js';

export const listPosts = async (req, res, next) => {
  try {
    const { search, category, status = 'approved', seller = '', mine = '', minPrice = '', maxPrice = '', dateAdded = '', sort = 'newest' } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }
    if (category) {
      query.category = category;
    }
    if (seller) {
      query.seller = seller;
    }
    if (mine === 'true' && req.user) {
      query.seller = req.user._id;
    }
    if (search) {
      query.$text = { $search: search };
    }
    if (minPrice || maxPrice) {
      query.priceMin = {};
      if (minPrice !== '') {
        query.priceMin.$gte = Number(minPrice);
      }
      if (maxPrice !== '') {
        query.priceMin.$lte = Number(maxPrice);
      }
    }
    if (dateAdded) {
      const now = new Date();
      const threshold = new Date(now);
      if (dateAdded === 'today') {
        threshold.setHours(0, 0, 0, 0);
      } else if (dateAdded === '7d') {
        threshold.setDate(now.getDate() - 7);
      } else if (dateAdded === '30d') {
        threshold.setDate(now.getDate() - 30);
      }

      if (['today', '7d', '30d'].includes(dateAdded)) {
        query.createdAt = { $gte: threshold };
      }
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      'price-low': { priceMin: 1, createdAt: -1 },
      'price-high': { priceMin: -1, createdAt: -1 }
    };

    const posts = await Post.find(query)
      .populate('seller', 'username profileImage sustainabilityScore location')
      .sort(search && sort === 'newest' ? { score: { $meta: 'textScore' } } : sortOptions[sort] || sortOptions.newest)
      .limit(100);

    res.json({ posts });
  } catch (error) {
    next(error);
  }
};

export const myPosts = async (req, res, next) => {
  try {
    const posts = await Post.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json({ posts });
  } catch (error) {
    next(error);
  }
};

export const createPost = async (req, res, next) => {
  try {
    const { category, title, description, purpose, priceMin, quantityValue, quantityUnit, imageUrl, wasteAttributes } = req.body;
    const normalizedCategory = normalizeCategoryName(category);
    const availableCategories = await getAvailableCategoryNames();

    if (!availableCategories.includes(normalizedCategory)) {
      throw createError(400, 'Choose an approved category or request a new one first');
    }

    const post = await Post.create({
      seller: req.user._id,
      category: normalizedCategory,
      title,
      description,
      purpose,
      priceMin,
      quantityValue,
      quantityUnit,
      imageUrl,
      wasteAttributes: wasteAttributes || {}
    });

    req.user.sustainabilityScore += 8;
    await req.user.save();

    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      throw createError(404, 'Post not found');
    }

    const isOwner = post.seller.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw createError(403, 'Not allowed to remove this post');
    }

    await post.deleteOne();
    res.json({ message: 'Post removed' });
  } catch (error) {
    next(error);
  }
};

export const categories = async (_req, res, next) => {
  try {
    const items = await getAvailableCategoryNames();
    res.json({ categories: items });
  } catch (error) {
    next(error);
  }
};

export const requestCategory = async (req, res, next) => {
  try {
    const normalizedName = normalizeCategoryName(req.body.name);
    const description = (req.body.description || '').trim();

    if (!normalizedName) {
      throw createError(400, 'Category name is required');
    }

    const availableCategories = await getAvailableCategoryNames();
    if (availableCategories.includes(normalizedName)) {
      throw createError(409, 'That category already exists');
    }

    const existingPending = await CategoryRequest.findOne({
      name: normalizedName,
      status: 'pending'
    });

    if (existingPending) {
      throw createError(409, 'That category is already waiting for admin review');
    }

    const request = await CategoryRequest.create({
      name: normalizedName,
      description,
      requestedBy: req.user._id
    });

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

export const matchingSuggestions = async (req, res, next) => {
  try {
    const approvedPosts = await Post.find({ status: 'approved' }).populate('seller', 'username sustainabilityScore role');
    const users = await User.find({ role: { $ne: 'admin' } }, 'username sustainabilityScore');

    const nodes = users.map((user) => ({
      id: user._id.toString(),
      label: user.username,
      score: user.sustainabilityScore
    }));

    const links = [];
    for (let i = 0; i < approvedPosts.length; i += 1) {
      for (let j = i + 1; j < approvedPosts.length; j += 1) {
        const a = approvedPosts[i];
        const b = approvedPosts[j];
        if (
          a.seller.role !== 'admin' &&
          b.seller.role !== 'admin' &&
          a.seller._id.toString() !== b.seller._id.toString() &&
          (a.category === b.category || a.purpose.toLowerCase().includes(b.category.toLowerCase()) || b.purpose.toLowerCase().includes(a.category.toLowerCase()))
        ) {
          links.push({
            source: a.seller._id.toString(),
            target: b.seller._id.toString(),
            value: Math.round((a.priceMin + b.priceMin) / 2)
          });
        }
      }
    }

    res.json({ nodes, links: links.slice(0, 40) });
  } catch (error) {
    next(error);
  }
};
