const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

const blogUploadsDir = path.join(__dirname, '..', 'uploads', 'blog');
fs.mkdirSync(blogUploadsDir, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'application/pdf',
]);

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.pdf']);
const maxFileSizeMb = Number(process.env.BLOG_UPLOAD_MAX_MB || 20);

const blogStorage = multer.diskStorage({
  destination: blogUploadsDir,
  filename(_req, file, callback) {
    const extension = extensionForMime(file.mimetype) || path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const blogUpload = multer({
  storage: blogStorage,
  limits: {
    files: 12,
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      callback(createHttpError(415, 'Only JPG, PNG, WebP, SVG, GIF, and PDF files are allowed for blog uploads.'));
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
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'application/pdf') return '.pdf';
  return '';
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  blogUpload,
  blogUploadsDir,
};
