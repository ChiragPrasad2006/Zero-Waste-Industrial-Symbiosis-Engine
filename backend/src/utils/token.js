import jwt from 'jsonwebtoken';

export const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'change-me', {
    expiresIn: '7d'
  });

