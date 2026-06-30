const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['image', 'pdf', 'file'],
    default: 'file',
  },
  originalName: {
    type: String,
    trim: true,
    maxlength: 240,
  },
  fileName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
    min: 0,
  },
  url: {
    type: String,
    required: true,
  },
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180,
  },
  paragraphs: [{
    type: String,
    trim: true,
    maxlength: 3000,
  }],
}, { _id: false });

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 240,
  },
  answer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
}, { _id: false });

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    index: true,
  },
  excerpt: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  metaDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180,
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
    index: true,
  },
  date: {
    type: Date,
    default: Date.now,
    index: true,
  },
  readTime: {
    type: String,
    default: '6 min read',
    trim: true,
    maxlength: 40,
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 60,
  }],
  heroTool: {
    label: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    route: {
      type: String,
      trim: true,
      maxlength: 160,
    },
  },
  coverImage: assetSchema,
  assets: [assetSchema],
  sections: [sectionSchema],
  faqs: [faqSchema],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
    index: true,
  },
  analytics: {
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    uniqueViewers: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastViewedAt: Date,
  },
  createdBy: {
    type: String,
    default: 'admin',
  },
  updatedBy: {
    type: String,
    default: 'admin',
  },
}, { timestamps: true });

blogSchema.index({ title: 'text', excerpt: 'text', category: 'text', tags: 'text' });

module.exports = mongoose.model('Blog', blogSchema);
