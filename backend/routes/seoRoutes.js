const express = require('express');
const { generateSitemap } = require('../controllers/seoController');

const router = express.Router();

router.post('/sitemap', generateSitemap);

module.exports = router;
