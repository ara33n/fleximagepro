const { createBrandedQrDataUrl } = require('../services/brandedQrService');

const maxUrlLength = 2048;

async function generateQrCode(req, res, next) {
  try {
    const { shareUrl } = req.body || {};
    if (!isValidShareUrl(shareUrl)) {
      return res.status(400).json({ error: 'A valid FlexImagePro share URL is required.' });
    }

    const qrCodeDataUrl = await createBrandedQrDataUrl(shareUrl);
    res.json({
      shareUrl,
      qrCodeDataUrl,
      mimeType: 'image/png',
    });
  } catch (error) {
    next(error);
  }
}

function isValidShareUrl(value) {
  if (!value || typeof value !== 'string' || value.length > maxUrlLength) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:');
  } catch {
    return false;
  }
}

module.exports = {
  generateQrCode,
};
