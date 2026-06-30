const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = Number(process.env.PDF_REPAIR_TIMEOUT_MS || 30000);
const QPDF_BIN = process.env.QPDF_BIN || 'qpdf';
const GHOSTSCRIPT_BIN = process.env.GHOSTSCRIPT_BIN || 'gs';
const FRIENDLY_REPAIR_ERROR = 'This PDF is strongly encrypted or badly damaged. Please upload an unlocked or freshly exported copy.';

async function processPdf(inputPath, processor = defaultPdfProcessor) {
  assertSafePdfPath(inputPath);
  return processor(inputPath);
}

async function processPdfWithFallback(inputPath, processor = defaultPdfProcessor, options = {}) {
  assertSafePdfPath(inputPath);
  const tempFiles = [];
  let successfulOutputPath = '';

  try {
    if (options.forceGhostscript) {
      const gsOutputPath = siblingPath(inputPath, 'repaired-gs');
      tempFiles.push(gsOutputPath);
      try {
        await repairWithGhostscript(inputPath, gsOutputPath);
        const result = await processPdf(gsOutputPath, repairedProcessor(processor));
        successfulOutputPath = result.outputPath || gsOutputPath;
        return { ...result, repaired: true, repairTool: 'ghostscript', status: 'PDF processed successfully' };
      } catch (error) {
        if (isPasswordProtectedError(error)) {
          throw createPdfError(422, FRIENDLY_REPAIR_ERROR, error);
        }
        console.warn('Forced Ghostscript repair failed; trying qpdf fallback.', safeError(error));
      }
    }

    try {
      const result = await processPdf(inputPath, processor);
      successfulOutputPath = result.outputPath || inputPath;
      return { ...result, repaired: false, status: 'PDF processed successfully' };
    } catch (error) {
      if (isPasswordProtectedError(error)) {
        throw createPdfError(422, FRIENDLY_REPAIR_ERROR, error);
      }
      console.warn('PDF normal processing failed; trying repair fallback.', safeError(error));
    }

    const qpdfOutputPath = siblingPath(inputPath, 'repaired-qpdf');
    tempFiles.push(qpdfOutputPath);
    try {
      await repairWithQpdf(inputPath, qpdfOutputPath);
      const result = await processPdf(qpdfOutputPath, repairedProcessor(processor));
      successfulOutputPath = result.outputPath || qpdfOutputPath;
      return { ...result, repaired: true, repairTool: 'qpdf', status: 'PDF processed successfully' };
    } catch (error) {
      if (isPasswordProtectedError(error)) {
        throw createPdfError(422, FRIENDLY_REPAIR_ERROR, error);
      }
      console.warn('qpdf repair failed; trying Ghostscript fallback.', safeError(error));
    }

    const gsOutputPath = siblingPath(inputPath, 'repaired-gs');
    tempFiles.push(gsOutputPath);
    try {
      await repairWithGhostscript(inputPath, gsOutputPath);
      const result = await processPdf(gsOutputPath, repairedProcessor(processor));
      successfulOutputPath = result.outputPath || gsOutputPath;
      return { ...result, repaired: true, repairTool: 'ghostscript', status: 'PDF processed successfully' };
    } catch (error) {
      console.warn('Ghostscript repair failed.', safeError(error));
      throw createPdfError(422, FRIENDLY_REPAIR_ERROR, error);
    }
  } finally {
    await cleanupFiles(tempFiles.filter((file) => file !== successfulOutputPath));
  }
}

async function repairWithQpdf(inputPath, outputPath) {
  assertSafePdfPath(inputPath);
  assertSafePdfPath(outputPath);
  try {
    await runBinary(QPDF_BIN, ['--decrypt', inputPath, outputPath], DEFAULT_TIMEOUT_MS);
  } catch (error) {
    if (isPasswordProtectedError(error)) throw error;
    await assertPdfOutput(outputPath);
    return outputPath;
  }
  await assertPdfOutput(outputPath);
  return outputPath;
}

async function repairWithGhostscript(inputPath, outputPath) {
  assertSafePdfPath(inputPath);
  assertSafePdfPath(outputPath);
  try {
    await runBinary(GHOSTSCRIPT_BIN, [
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.7',
    `-sOutputFile=${outputPath}`,
    inputPath,
    ], DEFAULT_TIMEOUT_MS);
  } catch (error) {
    if (isPasswordProtectedError(error)) throw error;
    await assertPdfOutput(outputPath);
    return outputPath;
  }
  await assertPdfOutput(outputPath);
  return outputPath;
}

async function defaultPdfProcessor(inputPath) {
  await assertPdfOutput(inputPath);
  await runBinary(QPDF_BIN, ['--check', inputPath], DEFAULT_TIMEOUT_MS);
  return {
    outputPath: inputPath,
    status: 'PDF processed successfully',
  };
}

async function validateRepairedPdf(inputPath) {
  await assertPdfOutput(inputPath);
  return {
    outputPath: inputPath,
    status: 'PDF processed successfully',
  };
}

function repairedProcessor(processor) {
  return processor === defaultPdfProcessor ? validateRepairedPdf : processor;
}

async function runBinary(command, args, timeout) {
  try {
    return await execFileAsync(command, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false,
    });
  } catch (error) {
    const message = [error.message, error.stderr, error.stdout].filter(Boolean).join('\n');
    const wrapped = new Error(message || `${command} failed.`);
    wrapped.code = error.code;
    wrapped.signal = error.signal;
    wrapped.timedOut = error.killed || /timed out/i.test(message);
    throw wrapped;
  }
}

async function assertPdfOutput(filePath) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size < 5) {
    throw new Error('PDF output was not created.');
  }
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);
    if (buffer.toString('ascii') !== '%PDF-') {
      throw new Error('Invalid PDF output.');
    }
  } finally {
    await handle.close();
  }
}

function siblingPath(inputPath, suffix) {
  const directory = path.dirname(inputPath);
  const extension = path.extname(inputPath) || '.pdf';
  const base = path.basename(inputPath, extension).replace(/[^a-zA-Z0-9._-]/g, '');
  return path.join(directory, `${base}-${suffix}${extension}`);
}

function assertSafePdfPath(filePath) {
  const resolved = path.resolve(filePath);
  if (path.extname(resolved).toLowerCase() !== '.pdf') {
    throw createPdfError(415, 'Please upload a PDF file.');
  }
  if (resolved.includes('\0')) {
    throw createPdfError(400, 'Invalid PDF path.');
  }
}

function isPasswordProtectedError(error) {
  const message = String(error?.message || '');
  return /password|invalid password|requires a password|encrypted file requires|password required|invalid encryption key/i.test(message);
}

function createPdfError(status, message, cause) {
  const error = new Error(message);
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}

function safeError(error) {
  return {
    message: String(error?.message || 'Unknown PDF error').slice(0, 500),
    code: error?.code,
    timedOut: Boolean(error?.timedOut),
  };
}

async function cleanupFiles(files) {
  await Promise.all(files.map((file) => fs.unlink(file).catch(() => {})));
}

module.exports = {
  FRIENDLY_REPAIR_ERROR,
  processPdf,
  processPdfWithFallback,
  repairWithGhostscript,
  repairWithQpdf,
};
