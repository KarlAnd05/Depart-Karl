// Helpers shared by the Photo Album and Admin pages.
import { PHOTO_BUCKET, ALBUM_MAX_BYTES, ALBUM_MAX_SIDE_PX, ALBUM_MAX_INPUT_BYTES } from '../config.js';
import { validateImageFile, getImageSize, resizeImage, formatBytes } from '../core/image-utils.js';
import { icon } from '../core/icons.js';

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Validate a photo chosen for the album and shrink it if needed, so large
 * phone photos fit the storage limit. Returns { data, type, width, height }
 * where `data` is the File or resized Blob to upload.
 */
export async function prepareAlbumPhoto(file) {
  const type = await validateImageFile(file, { maxBytes: ALBUM_MAX_INPUT_BYTES });
  const { width, height } = await getImageSize(file);
  if (file.size <= ALBUM_MAX_BYTES && Math.max(width, height) <= ALBUM_MAX_SIDE_PX) {
    return { data: file, type, width, height };
  }
  if (type === 'image/gif') {
    // Resizing would lose the animation, so large GIFs are refused instead.
    throw new Error(`GIFs must be ${formatBytes(ALBUM_MAX_BYTES)} or smaller.`);
  }
  const resized = await resizeImage(file, ALBUM_MAX_SIDE_PX, { quality: 0.88 });
  if (resized.blob.size > ALBUM_MAX_BYTES) throw new Error('This photo is too large, even after resizing it.');
  return { data: resized.blob, type: 'image/jpeg', width: resized.width, height: resized.height };
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

/** Card markup for a photo: thumbnail (or a locked placeholder) plus details and actions. */
export function photoCardHtml(photo, url, {
  index,
  details = [],
  actions = '',
  placeholder = { icon: 'lock', text: 'Private: only the administrator can view this photo.' },
} = {}) {
  const title = photo.title || 'Untitled';
  const media = url
    ? `<button class="photo-thumb" type="button" data-view="${index}" aria-label="View ${escapeHtml(title)}">
         <img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" loading="lazy">
       </button>`
    : `<div class="photo-locked">${icon(placeholder.icon)}<span>${placeholder.text}</span></div>`;
  return `
    <article class="photo-card">
      ${media}
      <div class="photo-meta">
        <span class="photo-title">${escapeHtml(title)}</span>
        <span class="badge ${photo.is_public ? 'badge-public' : 'badge-private'}">${photo.is_public ? 'Public' : 'Private'}</span>
        ${details.map((d) => `<span class="muted">${d}</span>`).join('')}
        ${actions ? `<div class="photo-actions">${actions}</div>` : ''}
      </div>
    </article>`;
}

// ----- lightbox (full-size viewer with previous / next) -----

let lightbox = null;
let items = [];
let current = 0;

function showItem(index) {
  current = (index + items.length) % items.length;
  const item = items[current];
  const img = lightbox.querySelector('img');
  img.src = item.src;
  img.alt = item.caption;
  lightbox.querySelector('.lightbox-caption').textContent =
    items.length > 1 ? `${item.caption} · ${current + 1} of ${items.length}` : item.caption;
}

function buildLightbox() {
  lightbox = document.createElement('dialog');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('aria-label', 'Photo viewer');
  lightbox.innerHTML = `
    <div class="lightbox-stage">
      <img alt="">
      <p class="lightbox-caption"></p>
    </div>
    <button class="lightbox-btn lightbox-close" type="button" aria-label="Close">${icon('close')}</button>
    <button class="lightbox-btn lightbox-prev" type="button" aria-label="Previous photo">${icon('chevronLeft')}</button>
    <button class="lightbox-btn lightbox-next" type="button" aria-label="Next photo">${icon('chevronRight')}</button>`;

  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => showItem(current - 1));
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => showItem(current + 1));
  // Clicking the dark area around the photo closes the viewer.
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-stage')) lightbox.close();
  });
  lightbox.addEventListener('keydown', (e) => {
    if (items.length < 2) return;
    if (e.key === 'ArrowLeft') showItem(current - 1);
    if (e.key === 'ArrowRight') showItem(current + 1);
  });
  // Swipe left/right on touch screens.
  let startX = null;
  lightbox.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  lightbox.addEventListener('pointerup', (e) => {
    if (startX === null || items.length < 2) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) showItem(current + (dx < 0 ? 1 : -1));
  });
  document.body.append(lightbox);
}

/** Open the viewer. items: [{ src, caption }] */
export function openLightbox(list, startIndex = 0) {
  if (!lightbox) buildLightbox();
  items = list;
  const single = items.length < 2;
  lightbox.querySelector('.lightbox-prev').hidden = single;
  lightbox.querySelector('.lightbox-next').hidden = single;
  showItem(startIndex);
  lightbox.showModal();
}
