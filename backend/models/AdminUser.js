const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin'],
    default: 'admin',
  },
  active: {
    type: Boolean,
    default: true,
    index: true,
  },
  lastLoginAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', adminUserSchema);
