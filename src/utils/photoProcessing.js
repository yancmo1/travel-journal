const PROCESSABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function boundedSize(width, height, maxWidth) {
  if (!width || !height || Math.max(width, height) <= maxWidth) return { width, height };
  const scale = maxWidth / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function renderVariant(file, maxWidth, quality) {
  if (!PROCESSABLE_TYPES.has(String(file.type || '').toLowerCase())) return null;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = boundedSize(bitmap.width, bitmap.height, maxWidth);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return null;
    return { blob, width: size.width, height: size.height };
  } finally {
    bitmap?.close?.();
  }
}

/**
 * Replaceable processing boundary. A future queued Cloudflare Images,
 * container, or external processor can implement the same method without
 * making the Worker depend on sharp, PostgreSQL, or a writable filesystem.
 */
export class PhotoProcessor {
  async prepareVariants() {
    throw new Error('Photo processor is not configured for this environment');
  }
}

export class BrowserPhotoProcessor extends PhotoProcessor {
  async prepareVariants(files) {
    return Promise.all(Array.from(files, async file => ({
      display: await renderVariant(file, 1600, 0.86),
      thumbnail: await renderVariant(file, 480, 0.78),
    })));
  }
}

export function createPhotoProcessor(mode = 'browser') {
  if (String(mode).toLowerCase() === 'browser') return new BrowserPhotoProcessor();
  throw new Error(`Unsupported photo processor mode: ${mode}`);
}

const browserPhotoProcessor = createPhotoProcessor('browser');

/**
 * Prepare optional browser-generated variants. The original File remains
 * untouched so the caller can preserve it for archival storage. Unsupported
 * formats, including HEIC when the browser cannot decode them, return no
 * variants and are handled by the server's processing state.
 */
export async function preparePhotoVariants(files) {
  return browserPhotoProcessor.prepareVariants(files);
}
