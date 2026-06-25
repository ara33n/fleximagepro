const QRCode = require('qrcode');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_SIZE = 720;
const BRAND_TEAL = '#0f766e';
const BRAND_TEAL_LIGHT = '#14b8a6';
const DARK = '#18181b';
const WHITE = '#ffffff';
const logoPath = path.join(__dirname, '..', '..', 'public', 'assets', 'logo-96.png');

async function createBrandedQrDataUrl(value, options = {}) {
  if (!value || typeof value !== 'string') {
    throw new Error('A valid share URL is required to generate a QR code.');
  }

  const pngBuffer = await createBrandedQrPng(value, options);
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

async function createBrandedQrPng(value, options = {}) {
  const size = clampNumber(options.size, 320, 1400, DEFAULT_SIZE);
  const qr = QRCode.create(value, {
    errorCorrectionLevel: 'H',
    margin: 0,
  });

  const moduleCount = qr.modules.size;
  const quietModules = 4;
  const moduleSize = Math.floor(size / (moduleCount + quietModules * 2));
  const qrSize = moduleSize * (moduleCount + quietModules * 2);
  const offset = Math.floor((size - qrSize) / 2);
  const quietOffset = offset + quietModules * moduleSize;
  const logoSize = Math.round(size * clampNumber(options.logoRatio, 0.18, 0.22, 0.2));

  const qrSvg = renderRoundedQrSvg({
    qr,
    size,
    moduleCount,
    moduleSize,
    quietOffset,
    logoSize,
  });

  const logoPng = await createCenterLogoPng(logoSize);
  const logoTop = Math.round((size - logoSize) / 2);
  const logoLeft = logoTop;

  return sharp(Buffer.from(qrSvg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .composite([
      {
        input: logoPng,
        top: logoTop,
        left: logoLeft,
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function renderRoundedQrSvg({ qr, size, moduleCount, moduleSize, quietOffset, logoSize }) {
  const cells = [];
  const logoClearance = logoSize * 0.64;
  const center = size / 2;
  const moduleRadius = Math.max(1, moduleSize * 0.38);

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!qr.modules.get(row, col) || isFinderModule(row, col, moduleCount)) {
        continue;
      }

      const x = quietOffset + col * moduleSize;
      const y = quietOffset + row * moduleSize;
      const cellCenterX = x + moduleSize / 2;
      const cellCenterY = y + moduleSize / 2;
      if (Math.abs(cellCenterX - center) < logoClearance && Math.abs(cellCenterY - center) < logoClearance) {
        continue;
      }

      cells.push(
        `<rect x="${num(x + moduleSize * 0.12)}" y="${num(y + moduleSize * 0.12)}" width="${num(moduleSize * 0.76)}" height="${num(moduleSize * 0.76)}" rx="${num(moduleRadius)}" fill="${DARK}"/>`,
      );
    }
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="qrShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${num(size * 0.08)}" fill="${WHITE}"/>
  <rect x="${num(size * 0.04)}" y="${num(size * 0.04)}" width="${num(size * 0.92)}" height="${num(size * 0.92)}" rx="${num(size * 0.065)}" fill="${WHITE}" filter="url(#qrShadow)"/>
  <g>
    ${renderFinderMarkers(moduleCount, moduleSize, quietOffset)}
    ${cells.join('\n    ')}
  </g>
</svg>`.trim();
}

function renderFinderMarkers(moduleCount, moduleSize, quietOffset) {
  const positions = [
    [0, 0],
    [moduleCount - 7, 0],
    [0, moduleCount - 7],
  ];

  return positions
    .map(([col, row]) => {
      const x = quietOffset + col * moduleSize;
      const y = quietOffset + row * moduleSize;
      const outer = moduleSize * 7;
      const middle = moduleSize * 5;
      const inner = moduleSize * 3;
      return `
    <rect x="${num(x)}" y="${num(y)}" width="${num(outer)}" height="${num(outer)}" rx="${num(moduleSize * 1.65)}" fill="${BRAND_TEAL}"/>
    <rect x="${num(x + moduleSize)}" y="${num(y + moduleSize)}" width="${num(middle)}" height="${num(middle)}" rx="${num(moduleSize * 1.05)}" fill="${WHITE}"/>
    <rect x="${num(x + moduleSize * 2)}" y="${num(y + moduleSize * 2)}" width="${num(inner)}" height="${num(inner)}" rx="${num(moduleSize * 0.72)}" fill="${DARK}"/>`;
    })
    .join('\n');
}

async function createCenterLogoPng(size) {
  const badgeSize = Math.round(size * 0.9);
  const innerSize = Math.round(size * 0.64);
  const innerOffset = Math.round((size - innerSize) / 2);
  const badgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="logoShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <circle cx="${num(size / 2)}" cy="${num(size / 2)}" r="${num(badgeSize / 2)}" fill="${WHITE}" filter="url(#logoShadow)"/>
  <circle cx="${num(size / 2)}" cy="${num(size / 2)}" r="${num(badgeSize / 2 - size * 0.035)}" fill="${WHITE}" stroke="${BRAND_TEAL_LIGHT}" stroke-width="${num(size * 0.03)}"/>
</svg>`.trim();

  const logo = await sharp(logoPath)
    .resize(innerSize, innerSize, { fit: 'contain', withoutEnlargement: false })
    .png()
    .toBuffer();

  return sharp(Buffer.from(badgeSvg))
    .png()
    .composite([
      {
        input: logo,
        top: innerOffset,
        left: innerOffset,
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function isFinderModule(row, col, moduleCount) {
  const inTop = row < 7;
  const inLeft = col < 7;
  const inRight = col >= moduleCount - 7;
  const inBottom = row >= moduleCount - 7;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function num(value) {
  return Number(value.toFixed(2)).toString();
}

module.exports = {
  createBrandedQrDataUrl,
  createBrandedQrPng,
};
