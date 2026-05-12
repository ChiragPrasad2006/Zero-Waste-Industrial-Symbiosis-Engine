import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { decryptEmail } from '../utils/crypto.js';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3
    },
    emailHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    emailEncrypted: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'superior', 'admin'],
      default: 'user'
    },
    superiorUntil: {
      type: Date,
      default: null
    },
    profileImage: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    location: {
      type: String,
      default: 'Peenya Industrial Area'
    },
    sustainabilityScore: {
      type: Number,
      default: 10
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function savePassword(next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    username: this.username,
    email: decryptEmail(this.emailEncrypted),
    role: this.role,
    superiorUntil: this.superiorUntil,
    profileImage: this.profileImage,
    bio: this.bio,
    location: this.location,
    sustainabilityScore: this.sustainabilityScore,
    isSuperiorActive: this.role === 'admin' || (this.superiorUntil && this.superiorUntil > new Date())
  };
};

const User = mongoose.model('User', userSchema);

export default User;

