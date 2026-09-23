// Helpers shared by the Photo Album and Admin pages.
import { PHOTO_BUCKET } from '../config.js';

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Photos are kept in a private bucket, so each image is shown through a
 * short-lived signed link. The database policies decide who may get one:
 * public photos → anyone, private photos → admin only.
 * Returns a Map of storage_path → URL (photos you may not see are left out).
 */
export async function getSignedUrls(sb, photos, expiresInSeconds = 3600) {
  const urls = new Map();
  if (!photos.length) return urls;
  const { data, error } = await sb.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(photos.map((p) => p.storage_path), expiresInSeconds);
  if (error) {
    console.warn('Could not create image links:', error.message);
    return urls;
  }
  for (const item of data) {
    if (item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

/** Group photos by album name, keeping the newest albums first. */
export function groupByAlbum(photos) {
  const groups = new Map();
  for (const photo of photos) {
    const name = photo.album?.trim() || 'Unsorted';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(photo);
  }
  return groups;
}

/** Delete a photo's file and its database row. */
export async function deletePhoto(sb, photo) {
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (error) throw new Error(`Could not delete the file: ${error.message}`);
  if (!data?.length) throw new Error('You are not allowed to delete this photo.');
  const { error: dbError } = await sb.from('photos').delete().eq('id', photo.id);
  if (dbError) throw new Error(`Could not delete the photo record: ${dbError.message}`);
}

// ----- lightbox -----

let lightbox = null;

export function openLightbox(src, caption) {
  if (!lightbox) {
    lightbox = document.createElement('dialog');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Close">×</button>
      <img alt="">
      <p class="lightbox-caption"></p>`;
    lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
    // Clicking the dark backdrop (outside the image) closes it too.
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
    document.body.append(lightbox);
  }
  const img = lightbox.querySelector('img');
  img.src = src;
  img.alt = caption;
  lightbox.querySelector('.lightbox-caption').textContent = caption;
  lightbox.showModal();
}
