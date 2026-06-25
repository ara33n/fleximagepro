const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf']);
const maxFileSizeMb = Number(process.env.MAX_UPLOAD_MB || 25);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename(req, file, callback) {
    const id = crypto.randomUUID();
    const extension = extensionForMime(file.mimetype) || path.extname(file.originalname).toLowerCase();
    callback(null, `${id}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      callback(createHttpError(415, 'Only JPG, PNG, WebP, SVG images, and PDF files are allowed.'));
      return;
    }
    callback(null, true);
  },
});

function extensionForMime(mimeType) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/svg+xml') return '.svg';
  if (mimeType === 'application/pdf') return '.pdf';
  return '';
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  upload,
};
