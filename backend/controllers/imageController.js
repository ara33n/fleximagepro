const fs = require('fs/promises');
const path = require('path');
const QRCode = require('qrcode');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'https://backend.fleximagepro.com').replace(/\/+$/, '');
const ttlMs = Number(process.env.UPLOAD_TTL_HOURS || 24) * 60 * 60 * 1000;

async function uploadCompressedImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a JPG, PNG, or WebP image.' });
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
      return res.status(400).json({ error: 'Please upload at least one JPG, PNG, or WebP image.' });
    }
    if (files.length > 10) {
      return res.status(400).json({ error: 'You can share up to 10 images at a time.' });
    }

    const images = await Promise.all(files.map((file) => createShareResponse(file)));
    res.status(201).json({ images });
  } catch (error) {
    next(error);
  }
}

async function downloadImage(req, res, next) {
  try {
    const { id } = req.params;
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid image ID.' });
    }

    const metadataPath = path.join(uploadsDir, `${id}.json`);
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    } catch {
      return res.status(404).json({ error: 'Image not found or expired.' });
    }

    if (Date.parse(metadata.expiresAt) <= Date.now()) {
      await removeUploadFiles(id, metadata.storedFileName);
      return res.status(410).json({ error: 'Image download has expired.' });
    }

    const filePath = path.join(uploadsDir, metadata.storedFileName);
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

async function createShareResponse(file) {
  const id = path.parse(file.filename).name;
  const downloadUrl = `${publicBaseUrl}/api/images/${id}/download`;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const metadata = {
    id,
    storedFileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    downloadUrl,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  await fs.writeFile(
    path.join(uploadsDir, `${id}.json`),
    JSON.stringify(metadata, null, 2),
    'utf8',
  );

  const qrCodeDataUrl = await QRCode.toDataURL(downloadUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });

  return {
    id,
    downloadUrl,
    qrCodeDataUrl,
    expiresAt,
  };
}

module.exports = {
  downloadImage,
  uploadCompressedImage,
  uploadCompressedImages,
};
