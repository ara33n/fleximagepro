const mongoose = require('mongoose');

const blogViewSchema = new mongoose.Schema({
  blogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true,
    index: true,
  },
  visitorHash: {
    type: String,
    required: true,
    index: true,
  },
  firstViewedAt: {
    type: Date,
    default: Date.now,
  },
  lastViewedAt: {
    type: Date,
    default: Date.now,
  },
  views: {
    type: Number,
    default: 1,
    min: 1,
  },
}, { timestamps: true });

blogViewSchema.index({ blogId: 1, visitorHash: 1 }, { unique: true });

module.exports = mongoose.model('BlogView', blogViewSchema);
