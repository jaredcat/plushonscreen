import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// Longest edge cap — plenty for 1080p stills; Astro serves smaller variants anyway.
const MAX_DIMENSION = 1920;
// Skip lossy re-encode for already-small JPEG/WebP unless a resize is needed.
const SMALL_FILE_BYTES = 25 * 1024;
const MIN_SAVINGS_RATIO = 0.02;

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const SIGHTING_IMAGE_PATH = /^src\/content\/sightings\/[^/]+\/images\/[^/]+$/i;

function getStagedSightingImages(): string[] {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR -z', {
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .filter(
      (file) => file && IMAGE_EXT.test(file) && SIGHTING_IMAGE_PATH.test(file),
    );
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)}KB`;
}

function logSkipped(filePath: string, reason: string): void {
  console.log(`skipped ${filePath}: ${reason}`);
}

async function optimizeImage(filePath: string): Promise<boolean> {
  const absolutePath = resolve(filePath);
  const input = readFileSync(absolutePath);
  const beforeSize = input.length;
  const ext = filePath.split('.').pop()?.toLowerCase();

  const metadata = await sharp(input, { failOn: 'none' }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

  const isLossy = ext === 'jpg' || ext === 'jpeg' || ext === 'webp';
  if (!needsResize && isLossy && beforeSize <= SMALL_FILE_BYTES) {
    logSkipped(
      filePath,
      `already within limits (${formatKb(beforeSize)}, ${width}×${height})`,
    );
    return false;
  }

  let pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .withMetadata({ orientation: metadata.orientation });

  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  let output: Buffer;
  if (ext === 'jpg' || ext === 'jpeg') {
    output = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  } else if (ext === 'webp') {
    output = await pipeline.webp({ quality: 92 }).toBuffer();
  } else if (ext === 'png') {
    output = await pipeline
      .png({ compressionLevel: 8, adaptiveFiltering: true })
      .toBuffer();
  } else {
    logSkipped(filePath, `unsupported format (.${ext})`);
    return false;
  }

  const savings = 1 - output.length / beforeSize;
  if (!needsResize && savings < MIN_SAVINGS_RATIO) {
    logSkipped(
      filePath,
      `already within limits (${formatKb(beforeSize)}, savings < ${MIN_SAVINGS_RATIO * 100}%)`,
    );
    return false;
  }

  writeFileSync(absolutePath, output);

  const parts = [
    `${filePath}: ${formatKb(beforeSize)} → ${formatKb(output.length)}`,
    `(-${Math.round(savings * 100)}%)`,
  ];
  if (needsResize) {
    parts.push(`resized from ${width}×${height}`);
  }
  console.log(`optimized ${parts.join(', ')}`);
  return true;
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : getStagedSightingImages();

if (files.length === 0) {
  process.exit(0);
}

let optimized = 0;
for (const file of files) {
  if (await optimizeImage(file)) {
    optimized += 1;
  }
}

if (optimized > 0) {
  console.log(`Optimized ${optimized} image${optimized === 1 ? '' : 's'}.`);
}
