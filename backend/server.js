const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const imageRoutes = require('./routes/imageRoutes');
const qrRoutes = require('./routes/qrRoutes');
const seoRoutes = require('./routes/seoRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const { cleanupOldPdfTempFiles } = require('./middleware/pdfUploadMiddleware');
const { cleanupExpiredUploads, startUploadCleanup } = require('./utils/cleanup');

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'https://fleximagepro.com';
const uploadsDir = path.join(__dirname, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === frontendOrigin) {
      callback(null, true);
      return;
    }
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    callback(error);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['X-PDF-Status', 'X-PDF-Repaired', 'X-PDF-Repair-Tool', 'Content-Disposition'],
  optionsSuccessStatus: 204,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res
    .type('html')
    .send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FlexImagePro API</title></head><body><h1>FlexImagePro API</h1><p>Status: ok</p></body></html>');
});

app.use('/api/images', imageRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/pdf', pdfRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((error, _req, res, _next) => {
  if (error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file is too large.'
      : 'File upload failed.';
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message, status: 'This PDF could not be repaired' });
  }

  const status = error.status || 500;
  const message = status === 500 ? 'Internal server error.' : error.message;
  if (status === 500) {
    console.error(error);
  }
  res.status(status).json({ error: message });
});

cleanupExpiredUploads().catch((error) => console.error('Initial cleanup failed:', error));
cleanupOldPdfTempFiles().catch((error) => console.error('Initial PDF temp cleanup failed:', error));
startUploadCleanup();
setInterval(() => {
  cleanupOldPdfTempFiles().catch((error) => console.error('PDF temp cleanup failed:', error));
}, Number(process.env.CLEANUP_INTERVAL_MINUTES || 60) * 60 * 1000).unref();

app.listen(port, () => {
  console.log(`FlexImagePro backend listening on port ${port}`);
});
