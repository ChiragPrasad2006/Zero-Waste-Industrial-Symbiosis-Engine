import CategoryRequest from '../models/CategoryRequest.js';
import Post from '../models/Post.js';

export const defaultCategories = ['Excess Heat', 'Steam Waste', 'Scrap Aluminum', 'Chemical Sludge', 'Packaging Waste', 'Fly Ash'];

export const normalizeCategoryName = (value = '') =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getAvailableCategoryNames = async () => {
  const existingPostCategories = await Post.distinct('category');
  const approved = await CategoryRequest.find({ status: 'approved' }).distinct('name');
  return [...new Set([...defaultCategories, ...existingPostCategories.map(normalizeCategoryName), ...approved.map(normalizeCategoryName)])].sort((a, b) => a.localeCompare(b));
};
