const crypto = require('crypto');
const Blog = require('../models/Blog');
const BlogView = require('../models/BlogView');
const { ensureDatabaseReady } = require('../config/db');

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function fileToAsset(req, file) {
  const kind = file.mimetype.startsWith('image/')
    ? 'image'
    : file.mimetype === 'application/pdf'
      ? 'pdf'
      : 'file';
  return {
    kind,
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    url: `${req.protocol}://${req.get('host')}/uploads/blog/${file.filename}`,
  };
}

function buildBlogPayload(req, existingBlog) {
  const body = req.body || {};
  const files = req.files || [];
  const uploadedAssets = files.map((file) => fileToAsset(req, file));
  const existingAssets = parseJsonField(body.existingAssets, existingBlog?.assets || []);
  const existingCoverImage = parseJsonField(body.existingCoverImage, existingBlog?.coverImage || null);
  const title = String(body.title || existingBlog?.title || '').trim();
  const slug = normalizeSlug(body.slug || title || existingBlog?.slug);

  return {
    title,
    slug,
    excerpt: String(body.excerpt || existingBlog?.excerpt || '').trim(),
    metaDescription: String(body.metaDescription || existingBlog?.metaDescription || '').trim(),
    category: String(body.category || existingBlog?.category || 'General').trim(),
    date: body.date ? new Date(body.date) : existingBlog?.date || new Date(),
    readTime: String(body.readTime || existingBlog?.readTime || '6 min read').trim(),
    tags: parseJsonField(body.tags, existingBlog?.tags || []),
    heroTool: parseJsonField(body.heroTool, existingBlog?.heroTool || {}),
    coverImage: uploadedAssets[0] || existingCoverImage || undefined,
    assets: [...(Array.isArray(existingAssets) ? existingAssets : []), ...uploadedAssets],
    sections: parseJsonField(body.sections, existingBlog?.sections || []),
    faqs: parseJsonField(body.faqs, existingBlog?.faqs || []),
    status: ['draft', 'published'].includes(body.status) ? body.status : existingBlog?.status || 'draft',
    updatedBy: req.admin?.username || 'admin',
  };
}

function cleanBlog(blog) {
  const doc = blog.toObject ? blog.toObject() : blog;
  return {
    ...doc,
    id: String(doc._id),
    _id: undefined,
    __v: undefined,
  };
}

async function getBlogCollectionMeta(filter = {}) {
  const summary = await Blog.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        latestUpdatedAt: { $max: '$updatedAt' },
      },
    },
  ]);
  const result = summary[0] || { total: 0, latestUpdatedAt: null };
  const latest = result.latestUpdatedAt ? new Date(result.latestUpdatedAt).toISOString() : '';
  return {
    total: result.total,
    latestUpdatedAt: latest,
    version: `${result.total}:${latest}`,
  };
}

async function getPublicBlogMeta(_req, res, next) {
  try {
    await ensureDatabaseReady();
    res.json({ meta: await getBlogCollectionMeta({ status: 'published' }) });
  } catch (error) {
    next(error);
  }
}

async function listPublicBlogs(req, res, next) {
  try {
    await ensureDatabaseReady();
    const blogs = await Blog.find({ status: 'published' })
      .sort({ date: -1, createdAt: -1 })
      .select('-__v')
      .lean();
    res.json({ blogs: blogs.map(cleanBlog) });
  } catch (error) {
    next(error);
  }
}

async function getPublicBlog(req, res, next) {
  try {
    await ensureDatabaseReady();
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' });
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }
    res.json({ blog: cleanBlog(blog) });
  } catch (error) {
    next(error);
  }
}

async function trackBlogView(req, res, next) {
  try {
    await ensureDatabaseReady();
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' });
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }

    const rawVisitor = [
      req.ip,
      req.get('user-agent') || '',
      req.get('accept-language') || '',
    ].join('|');
    const visitorHash = crypto
      .createHash('sha256')
      .update(`${process.env.VIEW_HASH_SECRET || 'fleximagepro-view'}:${rawVisitor}`)
      .digest('hex');

    const now = new Date();
    const view = await BlogView.findOneAndUpdate(
      { blogId: blog._id, visitorHash },
      {
        $inc: { views: 1 },
        $set: { lastViewedAt: now },
        $setOnInsert: { firstViewedAt: now },
      },
      { new: true, upsert: true, includeResultMetadata: true },
    );
    const isNewViewer = !view.lastErrorObject?.updatedExisting;

    await Blog.updateOne(
      { _id: blog._id },
      {
        $inc: {
          'analytics.views': 1,
          ...(isNewViewer ? { 'analytics.uniqueViewers': 1 } : {}),
        },
        $set: { 'analytics.lastViewedAt': now },
      },
      { timestamps: false },
    );

    const updated = await Blog.findById(blog._id).select('analytics slug title');
    res.json({
      status: 'Blog view recorded',
      blog: cleanBlog(updated),
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminBlogMeta(_req, res, next) {
  try {
    await ensureDatabaseReady();
    res.json({ meta: await getBlogCollectionMeta() });
  } catch (error) {
    next(error);
  }
}

async function listAdminBlogs(req, res, next) {
  try {
    await ensureDatabaseReady();
    const { status, search } = req.query;
    const filter = {};
    if (status && ['draft', 'published'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.$text = { $search: String(search) };
    }
    const blogs = await Blog.find(filter)
      .sort({ updatedAt: -1 })
      .select('-__v')
      .lean();
    res.json({ blogs: blogs.map(cleanBlog) });
  } catch (error) {
    next(error);
  }
}

async function getAdminBlog(req, res, next) {
  try {
    await ensureDatabaseReady();
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }
    res.json({ blog: cleanBlog(blog) });
  } catch (error) {
    next(error);
  }
}

async function createBlog(req, res, next) {
  try {
    await ensureDatabaseReady();
    const payload = buildBlogPayload(req);
    payload.createdBy = req.admin?.username || 'admin';
    const blog = await Blog.create(payload);
    res.status(201).json({
      status: 'Blog created successfully',
      blog: cleanBlog(blog),
    });
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = 'A blog with this slug already exists.';
    }
    next(error);
  }
}

async function updateBlog(req, res, next) {
  try {
    await ensureDatabaseReady();
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }
    Object.assign(blog, buildBlogPayload(req, blog));
    await blog.save();
    res.json({
      status: 'Blog updated successfully',
      blog: cleanBlog(blog),
    });
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = 'A blog with this slug already exists.';
    }
    next(error);
  }
}

async function deleteBlog(req, res, next) {
  try {
    await ensureDatabaseReady();
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }
    await BlogView.deleteMany({ blogId: blog._id });
    res.json({ status: 'Blog deleted successfully' });
  } catch (error) {
    next(error);
  }
}

async function getBlogStats(req, res, next) {
  try {
    await ensureDatabaseReady();
    const stats = await Blog.aggregate([
      {
        $group: {
          _id: null,
          totalBlogs: { $sum: 1 },
          publishedBlogs: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          draftBlogs: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          totalViews: { $sum: '$analytics.views' },
          uniqueViewers: { $sum: '$analytics.uniqueViewers' },
        },
      },
    ]);
    const topBlogs = await Blog.find()
      .sort({ 'analytics.views': -1, updatedAt: -1 })
      .limit(10)
      .select('title slug status analytics updatedAt')
      .lean();

    const summary = stats[0] || {
        totalBlogs: 0,
        publishedBlogs: 0,
        draftBlogs: 0,
        totalViews: 0,
        uniqueViewers: 0,
      };
    delete summary._id;

    res.json({
      stats: summary,
      topBlogs: topBlogs.map(cleanBlog),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBlog,
  deleteBlog,
  getAdminBlogMeta,
  getAdminBlog,
  getBlogStats,
  getPublicBlogMeta,
  getPublicBlog,
  listAdminBlogs,
  listPublicBlogs,
  trackBlogView,
  updateBlog,
};
