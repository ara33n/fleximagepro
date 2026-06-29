const { generateSitemapForSite } = require('../services/sitemapCrawlerService');

async function generateSitemap(req, res, next) {
  try {
    const result = await generateSitemapForSite(req.body?.url, {
      limit: req.body?.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateSitemap,
};
