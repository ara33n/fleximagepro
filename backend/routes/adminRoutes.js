const express = require('express');
const {
  createAdminUser,
  getAdminProfile,
  loginAdmin,
  logoutAdmin,
} = require('../controllers/adminAuthController');
const {
  createBlog,
  deleteBlog,
  getAdminBlogMeta,
  getAdminBlog,
  getBlogStats,
  listAdminBlogs,
  updateBlog,
} = require('../controllers/blogController');
const { requireAdmin } = require('../middleware/adminAuth');
const { blogUpload } = require('../middleware/blogUploadMiddleware');

const router = express.Router();

router.post('/login', loginAdmin);
router.post('/logout', requireAdmin, logoutAdmin);
router.post('/users', requireAdmin, createAdminUser);
router.get('/me', requireAdmin, getAdminProfile);
router.get('/blogs/stats', requireAdmin, getBlogStats);
router.get('/blogs/meta', requireAdmin, getAdminBlogMeta);
router.get('/blogs', requireAdmin, listAdminBlogs);
router.get('/blogs/:id', requireAdmin, getAdminBlog);
router.post('/blogs', requireAdmin, blogUpload.array('files', 12), createBlog);
router.put('/blogs/:id', requireAdmin, blogUpload.array('files', 12), updateBlog);
router.delete('/blogs/:id', requireAdmin, deleteBlog);

module.exports = router;
