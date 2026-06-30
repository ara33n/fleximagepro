const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');

const tempDir = path.join(os.tmpdir(), 'fleximagepro-pdf');
const maxFileSizeMb = Number(process.env.MAX_PDF_UPLOAD_MB || process.env.MAX_UPLOAD_MB || 25);
const tempTtlMs = Number(process.env.PDF_TEMP_TTL_MINUTES || 60) * 60 * 1000;

fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: tempDir,
  filename(_req, file, callback) {
    const id = crypto.randomUUID();
    const extension = path.extname(file.originalname).toLowerCase() === '.pdf' ? '.pdf' : '.pdf';
    callback(null, `${id}${extension}`);
  },
});

const pdfUpload = multer({
  storage,
  limits: {
    files: 1,
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (file.mimetype !== 'application/pdf' || extension !== '.pdf') {
      callback(createHttpError(415, 'Please upload a PDF file.'));
      return;
    }
    callback(null, true);
  },
});

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  cleanupOldPdfTempFiles,
  pdfUpload,
  tempDir,
};

async function cleanupOldPdfTempFiles() {
  const entries = await fs.promises.readdir(tempDir, { withFileTypes: true }).catch(() => []);
  const now = Date.now();
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.pdf') return;
    const filePath = path.join(tempDir, entry.name);
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (stat && now - stat.mtimeMs > tempTtlMs) {
      await fs.promises.unlink(filePath).catch(() => {});
    }
  }));
}
