import Post from '../models/Post.js';
import User from '../models/User.js';
import { createError } from '../utils/errors.js';

export const listPosts = async (req, res, next) => {
  try {
    const { search, category, status = 'approved', seller = '', mine = '' } = req.query;
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

    const posts = await Post.find(query)
      .populate('seller', 'username profileImage sustainabilityScore location')
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
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

    const post = await Post.create({
      seller: req.user._id,
      category,
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
    const items = await Post.distinct('category');
    res.json({ categories: items.filter(Boolean).sort() });
  } catch (error) {
    next(error);
  }
};

export const matchingSuggestions = async (req, res, next) => {
  try {
    const approvedPosts = await Post.find({ status: 'approved' }).populate('seller', 'username sustainabilityScore');
    const users = await User.find({}, 'username sustainabilityScore');

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

