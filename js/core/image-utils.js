// Image helpers shared by every page that accepts a photo.

// Allowed image types and the file extension used when storing them.
export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(',');

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Detect the real image type from the file's first bytes ("magic numbers"),
// so a renamed non-image file can't slip through.
function sniffImageType(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'image/webp';
  return null;
}

/**
 * Check that `file` is a JPEG/PNG/WebP/GIF image no larger than `maxBytes`.
 * Returns the detected MIME type, or throws an Error with a user-friendly message.
 */
export async function validateImageFile(file, { maxBytes }) {
  if (!file) throw new Error('Please choose a photo first.');
  if (file.size === 0) throw new Error('That file is empty.');
  if (file.size > maxBytes) {
    throw new Error(`That photo is ${formatBytes(file.size)}. The maximum size is ${formatBytes(maxBytes)}.`);
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = sniffImageType(header);
  if (!type) throw new Error('Only JPEG, PNG, WebP or GIF images are allowed.');
  return type;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.src = src;
  });
}

export async function getImageSize(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Redraw an image file so its longest side is at most `maxSide` pixels.
 * Drawing through a canvas also applies the photo's EXIF rotation.
 * Returns { blob, width, height }.
 */
export async function resizeImage(file, maxSide, { type = 'image/jpeg', quality = 0.9 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (type === 'image/jpeg') {
      // JPEG has no transparency; use white instead of black behind transparent PNGs.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('That image could not be processed.'))), type, quality);
    });
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
