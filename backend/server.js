const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const imageRoutes = require('./routes/imageRoutes');
const { cleanupExpiredUploads, startUploadCleanup } = require('./utils/cleanup');

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'https://fleximagepro.com';
const uploadsDir = path.join(__dirname, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
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
  optionsSuccessStatus: 204,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/images', imageRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((error, _req, res, _next) => {
  if (error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file is too large.'
      : 'File upload failed.';
    return res.status(400).json({ error: message });
  }

  const status = error.status || 500;
  const message = status === 500 ? 'Internal server error.' : error.message;
  if (status === 500) {
    console.error(error);
  }
  res.status(status).json({ error: message });
});

cleanupExpiredUploads().catch((error) => console.error('Initial cleanup failed:', error));
startUploadCleanup();

app.listen(port, () => {
  console.log(`FlexImagePro backend listening on port ${port}`);
});
