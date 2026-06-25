const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'https://backend.fleximagepro.com').replace(
  /\/+$/,
  '',
);
const frontendBaseUrl = (
  process.env.FRONTEND_BASE_URL ||
  process.env.FRONTEND_ORIGIN ||
  'https://fleximagepro.com'
).replace(/\/+$/, '');
const ttlMs = Number(process.env.UPLOAD_TTL_HOURS || 24) * 60 * 60 * 1000;

async function uploadCompressedImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a JPG, PNG, WebP, SVG, or PDF file.' });
    }

    res.status(201).json(await createShareResponse(req.file));
  } catch (error) {
    next(error);
  }
}

async function uploadCompressedImages(req, res, next) {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res
        .status(400)
        .json({ error: 'Please upload at least one JPG, PNG, WebP, SVG, or PDF file.' });
    }
    if (files.length > 10) {
      return res.status(400).json({ error: 'You can share up to 10 images at a time.' });
    }

    res.status(201).json(await createBatchShareResponse(files));
  } catch (error) {
    next(error);
  }
}

async function getImageBatch(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid share ID.' });
    }

    const metadataPath = path.join(uploadsDir, `${id}.json`);
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    } catch {
      return res.status(404).json({ error: 'Share link not found or expired.' });
    }

    if (metadata.type !== 'batch') {
      return res.status(404).json({ error: 'Share link not found or expired.' });
    }

    if (Date.parse(metadata.expiresAt) <= Date.now()) {
      await removeBatchUploadFiles(metadata);
      return res.status(410).json({ error: 'This share link has expired.' });
    }

    res.json({
      id: metadata.id,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      images: metadata.images.map((image) => ({
        id: image.id,
        fileName: image.originalName,
        mimeType: image.mimeType,
        size: image.size,
        previewUrl: image.previewUrl || image.downloadUrl.replace(/\/download$/, '/view'),
        downloadUrl: image.downloadUrl,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function downloadImage(req, res, next) {
  await sendStoredFile(req, res, next, 'attachment');
}

async function viewImage(req, res, next) {
  await sendStoredFile(req, res, next, 'inline');
}

async function sendStoredFile(req, res, next, disposition) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid image ID.' });
    }

    const metadataPath = path.join(uploadsDir, `${id}.json`);
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    } catch {
      return res.status(404).json({ error: 'Image not found or expired.' });
    }

    if (metadata.type === 'batch' || !metadata.storedFileName) {
      return res.status(404).json({ error: 'Image not found or expired.' });
    }

    if (Date.parse(metadata.expiresAt) <= Date.now()) {
      await removeUploadFiles(id, metadata.storedFileName);
      return res.status(410).json({ error: 'Image download has expired.' });
    }

    const filePath = path.join(uploadsDir, metadata.storedFileName);
    if (disposition === 'inline') {
      res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeHeaderValue(metadata.originalName)}"`,
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) {
          next(error);
        }
      });
      return;
    }

    res.download(filePath, metadata.originalName, (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
}

async function removeUploadFiles(id, storedFileName) {
  await Promise.allSettled([
    fs.unlink(path.join(uploadsDir, `${id}.json`)),
    storedFileName ? fs.unlink(path.join(uploadsDir, storedFileName)) : Promise.resolve(),
  ]);
}

async function removeBatchUploadFiles(metadata) {
  const removals = [
    fs.unlink(path.join(uploadsDir, `${metadata.id}.json`)),
    ...(metadata.images || []).flatMap((image) => [
      fs.unlink(path.join(uploadsDir, `${image.id}.json`)),
      image.storedFileName
        ? fs.unlink(path.join(uploadsDir, image.storedFileName))
        : Promise.resolve(),
    ]),
  ];
  await Promise.allSettled(removals);
}

async function createBatchShareResponse(files) {
  const id = crypto.randomUUID();
  const shareUrl = `${frontendBaseUrl}/share/${id}`;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const createdAt = new Date().toISOString();
  const images = await Promise.all(
    files.map((file) => createImageMetadata(file, expiresAt, createdAt)),
  );
  const metadata = {
    type: 'batch',
    id,
    shareUrl,
    images,
    createdAt,
    expiresAt,
  };

  await fs.writeFile(
    path.join(uploadsDir, `${id}.json`),
    JSON.stringify(metadata, null, 2),
    'utf8',
  );

  const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });

  return {
    id,
    shareUrl,
    qrCodeDataUrl,
    expiresAt,
    imageCount: images.length,
  };
}

async function createShareResponse(file) {
  const metadata = await createImageMetadata(
    file,
    new Date(Date.now() + ttlMs).toISOString(),
    new Date().toISOString(),
  );

  const qrCodeDataUrl = await QRCode.toDataURL(metadata.downloadUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });

  return {
    id: metadata.id,
    downloadUrl: metadata.downloadUrl,
    qrCodeDataUrl,
    expiresAt: metadata.expiresAt,
  };
}

async function createImageMetadata(file, expiresAt, createdAt) {
  const id = path.parse(file.filename).name;
  const downloadUrl = `${publicBaseUrl}/api/images/${id}/download`;
  const previewUrl = `${publicBaseUrl}/api/images/${id}/view`;
  const metadata = {
    type: 'image',
    id,
    storedFileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    previewUrl,
    downloadUrl,
    createdAt,
    expiresAt,
  };

  await fs.writeFile(
    path.join(uploadsDir, `${id}.json`),
    JSON.stringify(metadata, null, 2),
    'utf8',
  );

  return metadata;
}

function isUuid(value) {
  return /^[a-f0-9-]{36}$/i.test(value);
}

function encodeHeaderValue(value) {
  return String(value || 'file').replace(/["\r\n]/g, '_');
}

module.exports = {
  downloadImage,
  getImageBatch,
  uploadCompressedImage,
  uploadCompressedImages,
  viewImage,
};
