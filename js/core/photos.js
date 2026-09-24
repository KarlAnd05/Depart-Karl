// Helpers for photos that are uploaded to Supabase Storage.
import { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE_PX, PHOTO_MAX_INPUT_BYTES } from '../config.js';
import { validateImageFile, getImageSize, resizeImage, formatBytes } from './image-utils.js';

/**
 * Validate a photo chosen for upload and shrink it if needed, so large phone
 * photos fit the storage limit. Returns { data, type, width, height } where
 * `data` is the File or resized Blob to upload.
 */
export async function preparePhotoUpload(file) {
  const type = await validateImageFile(file, { maxBytes: PHOTO_MAX_INPUT_BYTES });
  const { width, height } = await getImageSize(file);
  if (file.size <= PHOTO_MAX_BYTES && Math.max(width, height) <= PHOTO_MAX_SIDE_PX) {
    return { data: file, type, width, height };
  }
  if (type === 'image/gif') {
    // Resizing would lose the animation, so large GIFs are refused instead.
    throw new Error(`GIFs must be ${formatBytes(PHOTO_MAX_BYTES)} or smaller.`);
  }
  const resized = await resizeImage(file, PHOTO_MAX_SIDE_PX, { quality: 0.88 });
  if (resized.blob.size > PHOTO_MAX_BYTES) throw new Error('This photo is too large, even after resizing it.');
  return { data: resized.blob, type: 'image/jpeg', width: resized.width, height: resized.height };
}

/**
 * Files are kept in private buckets, so each image is shown through a
 * short-lived signed link (only issued to people the database allows).
 * Returns a Map of path → URL; paths you may not see are left out.
 */
export async function getSignedUrls(sb, bucket, paths, expiresInSeconds = 3600) {
  const urls = new Map();
  if (!paths.length) return urls;
  const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, expiresInSeconds);
  if (error) {
    console.warn('Could not create image links:', error.message);
    return urls;
  }
  for (const item of data) {
    if (item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
