const fs = require('fs/promises');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const cleanupIntervalMs = Number(process.env.CLEANUP_INTERVAL_MINUTES || 60) * 60 * 1000;

async function cleanupExpiredUploads() {
  await fs.mkdir(uploadsDir, { recursive: true });
  const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
  const metadataFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

  await Promise.all(metadataFiles.map(async (entry) => {
    const metadataPath = path.join(uploadsDir, entry.name);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      if (Date.parse(metadata.expiresAt) > Date.now()) {
        return;
      }
      if (metadata.type === 'batch') {
        await Promise.allSettled([
          fs.unlink(metadataPath),
          ...(metadata.images || []).flatMap((image) => [
            fs.unlink(path.join(uploadsDir, `${image.id}.json`)),
            image.storedFileName ? fs.unlink(path.join(uploadsDir, image.storedFileName)) : Promise.resolve(),
          ]),
        ]);
        return;
      }
      await Promise.allSettled([
        fs.unlink(metadataPath),
        metadata.storedFileName ? fs.unlink(path.join(uploadsDir, metadata.storedFileName)) : Promise.resolve(),
      ]);
    } catch {
      await fs.unlink(metadataPath).catch(() => undefined);
    }
  }));
}

function startUploadCleanup() {
  setInterval(() => {
    cleanupExpiredUploads().catch((error) => console.error('Scheduled cleanup failed:', error));
  }, cleanupIntervalMs).unref();
}

module.exports = {
  cleanupExpiredUploads,
  startUploadCleanup,
};
