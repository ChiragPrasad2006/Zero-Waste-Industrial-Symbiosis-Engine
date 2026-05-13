import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import { createError } from '../utils/errors.js';

export const listConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'username profileImage')
      .populate('post', 'title category')
      .sort({ lastMessageAt: -1 });

    res.json({ conversations });
  } catch (error) {
    next(error);
  }
};

export const openConversation = async (req, res, next) => {
  try {
    const { postId } = req.body;
    const post = await Post.findById(postId);

    if (!post) {
      throw createError(404, 'Post not found');
    }
    if (post.seller.toString() === req.user._id.toString()) {
      throw createError(400, 'You cannot start a chat with your own post');
    }

    const participantIds = [req.user._id.toString(), post.seller.toString()].sort();
    let conversation = await Conversation.findOne({
      post: post._id,
      participants: { $all: participantIds, $size: 2 }
    })
      .populate('participants', 'username profileImage')
      .populate('post', 'title category');

    if (!conversation) {
      conversation = await Conversation.create({
        post: post._id,
        participants: participantIds
      });
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'username profileImage')
        .populate('post', 'title category');
    }

    res.json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.participants.some((id) => id.toString() === req.user._id.toString())) {
      throw createError(404, 'Conversation not found');
    }

    const messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'username profileImage')
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.participants.some((id) => id.toString() === req.user._id.toString())) {
      throw createError(404, 'Conversation not found');
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: req.body.text
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await Message.findById(message._id).populate('sender', 'username profileImage');
    res.status(201).json({ message: populated });
  } catch (error) {
    next(error);
  }
};
