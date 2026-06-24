import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join(process.cwd(), 'dist', 'image-tools', 'browser');
const shareDir = join(browserDir, 'share');
const csrIndex = join(browserDir, 'index.csr.html');
const defaultIndex = join(browserDir, 'index.html');
const target = join(shareDir, 'index.html');
const source = existsSync(csrIndex) ? csrIndex : defaultIndex;

await mkdir(shareDir, { recursive: true });
await copyFile(source, target);

console.log(`Created share fallback: ${target}`);
