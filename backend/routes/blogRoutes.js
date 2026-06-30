const express = require('express');
const {
  getPublicBlogMeta,
  getPublicBlog,
  listPublicBlogs,
  trackBlogView,
} = require('../controllers/blogController');

const router = express.Router();

router.get('/meta', getPublicBlogMeta);
router.get('/', listPublicBlogs);
router.get('/:slug', getPublicBlog);
router.post('/:slug/view', trackBlogView);

module.exports = router;
