const fs = require('node:fs/promises');
const path = require('node:path');
const {
  FRIENDLY_REPAIR_ERROR,
  processPdfWithFallback,
} = require('../services/pdfFallbackService');

async function repairPdf(req, res, next) {
  const uploadedPath = req.file?.path;
  let outputPath = '';
  try {
    if (!req.file || !uploadedPath) {
      return res.status(400).json({ error: 'Please upload a PDF file.', status: 'Preparing your PDF...' });
    }

    const result = await processPdfWithFallback(uploadedPath, undefined, {
      forceGhostscript: req.body?.repairMode === 'ghostscript',
    });
    outputPath = result.outputPath || uploadedPath;
    const fileName = safeDownloadName(req.file.originalname);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-PDF-Status', result.status || 'PDF processed successfully');
    res.setHeader('X-PDF-Repaired', result.repaired ? 'true' : 'false');
    if (result.repairTool) res.setHeader('X-PDF-Repair-Tool', result.repairTool);

    const buffer = await fs.readFile(outputPath);
    res.send(buffer);
  } catch (error) {
    const status = error.status || 422;
    console.warn('PDF repair failed.', {
      status,
      message: String(error?.message || '').slice(0, 300),
    });
    res.status(status).json({
      error: status >= 500 ? 'This PDF could not be repaired' : FRIENDLY_REPAIR_ERROR,
      status: 'This PDF could not be repaired',
    });
  } finally {
    await Promise.all([
      uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve(),
      outputPath && outputPath !== uploadedPath ? fs.unlink(outputPath).catch(() => {}) : Promise.resolve(),
    ]);
  }
}

function safeDownloadName(originalName = 'repaired.pdf') {
  const base = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9._-]/g, '-') || 'repaired';
  return `${base}-repaired.pdf`;
}

module.exports = {
  repairPdf,
};
