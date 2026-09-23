// Page 3 — photo album: upload photos (public or private) and browse the gallery.
import '../core/site.js';
import { ALBUM_MAX_BYTES, PHOTO_BUCKET } from '../config.js';
import { getSupabase, ensureVisitorSession } from '../core/supabase.js';
import { validateImageFile, getImageSize, IMAGE_TYPES } from '../core/image-utils.js';
import { escapeHtml, formatDate, getSignedUrls, groupByAlbum, deletePhoto, openLightbox } from '../album/photos.js';

const $ = (id) => document.getElementById(id);
const pageStatus = $('page-status');
const form = $('upload-form');
const fileInput = $('photo-file');
const preview = $('upload-preview');
const uploadBtn = $('upload-btn');
const uploadStatus = $('upload-status');
const gallery = $('gallery');

let sb = null;
let user = null;
let activeTab = 'public';
let shownPhotos = new Map(); // id → photo, for the gallery currently on screen
let previewUrl = null;

function setNotice(el, message, type = '') {
  el.textContent = message;
  el.className = `notice ${type ? `notice-${type}` : ''}`;
}

// ----- gallery -----

function photoCard(photo, url) {
  const title = photo.title || 'Untitled';
  const media = url
    ? `<button class="photo-thumb" type="button" data-open="${photo.id}" aria-label="View ${escapeHtml(title)}">
         <img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" loading="lazy">
       </button>`
    : `<div class="photo-locked"><span class="icon" aria-hidden="true">🔒</span><span>Private: only the administrator can view this photo.</span></div>`;
  const canDelete = activeTab === 'mine' && photo.is_public;
  return `
    <article class="photo-card">
      ${media}
      <div class="photo-meta">
        <span class="photo-title">${escapeHtml(title)}</span>
        <span class="badge ${photo.is_public ? 'badge-public' : 'badge-private'}">${photo.is_public ? 'Public' : 'Private'}</span>
        <span class="muted">${formatDate(photo.created_at)}</span>
        ${canDelete ? `<div class="photo-actions"><button class="btn btn-small btn-danger" type="button" data-delete="${photo.id}">Delete</button></div>` : ''}
      </div>
    </article>`;
}

let loadCount = 0;

async function loadGallery() {
  const loadId = ++loadCount;
  gallery.innerHTML = '<p class="muted">Loading photos…</p>';

  let query = sb.from('photos').select('*').order('created_at', { ascending: false });
  query = activeTab === 'public' ? query.eq('is_public', true) : query.eq('owner_id', user.id);
  const { data: photos, error } = await query;
  if (loadId !== loadCount) return; // the user switched tabs meanwhile
  if (error) {
    gallery.innerHTML = `<p class="notice notice-error">Could not load photos: ${escapeHtml(error.message)}</p>`;
    return;
  }

  shownPhotos = new Map(photos.map((p) => [p.id, p]));
  if (activeTab === 'public') updateAlbumSuggestions(photos);

  if (!photos.length) {
    gallery.innerHTML = `<p class="empty-state">${activeTab === 'public'
      ? 'No public photos yet. Be the first to upload one!'
      : 'You haven’t uploaded any photos from this browser yet.'}</p>`;
    return;
  }

  // Only request links for public photos; private ones are admin-only.
  const urls = await getSignedUrls(sb, photos.filter((p) => p.is_public));
  if (loadId !== loadCount) return;
  gallery.innerHTML = [...groupByAlbum(photos)]
    .map(([album, items]) => `
      <h3>${escapeHtml(album)} <span class="muted">(${items.length})</span></h3>
      <div class="photo-grid">${items.map((p) => photoCard(p, urls.get(p.storage_path))).join('')}</div>`)
    .join('');
}

function updateAlbumSuggestions(photos) {
  const names = [...new Set(photos.map((p) => p.album).filter(Boolean))].sort();
  $('album-names').innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">`).join('');
}

gallery.addEventListener('click', async (e) => {
  const openBtn = e.target.closest('[data-open]');
  if (openBtn) {
    const photo = shownPhotos.get(openBtn.dataset.open);
    openLightbox(openBtn.querySelector('img').src, photo?.title || 'Untitled');
    return;
  }
  const deleteBtn = e.target.closest('[data-delete]');
  if (deleteBtn) {
    const photo = shownPhotos.get(deleteBtn.dataset.delete);
    if (!photo || !confirm(`Delete "${photo.title || 'Untitled'}"? This cannot be undone.`)) return;
    deleteBtn.disabled = true;
    try {
      await deletePhoto(sb, photo);
      await loadGallery();
    } catch (err) {
      alert(err.message);
      deleteBtn.disabled = false;
    }
  }
});

document.querySelector('.tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (!tab || tab.dataset.tab === activeTab) return;
  selectTab(tab.dataset.tab);
});

function selectTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  loadGallery();
}

// ----- upload -----

fileInput.addEventListener('change', async () => {
  setNotice(uploadStatus, '');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  preview.innerHTML = '';
  const file = fileInput.files[0];
  if (!file) return;
  try {
    await validateImageFile(file, { maxBytes: ALBUM_MAX_BYTES });
    previewUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${previewUrl}" alt="Preview of the selected photo">`;
  } catch (err) {
    setNotice(uploadStatus, err.message, 'error');
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  uploadBtn.disabled = true;
  setNotice(uploadStatus, '');

  try {
    const type = await validateImageFile(file, { maxBytes: ALBUM_MAX_BYTES });
    setNotice(uploadStatus, 'Uploading…');
    const { width, height } = await getImageSize(file);
    const path = `${user.id}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
    const isPublic = form.elements.visibility.value === 'public';

    const { error: uploadError } = await sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: type, cacheControl: '3600', upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { error: dbError } = await sb.from('photos').insert({
      storage_path: path,
      title: $('photo-title').value.trim() || null,
      album: $('photo-album').value.trim() || null,
      is_public: isPublic,
      mime_type: type,
      size_bytes: file.size,
      width,
      height,
    });
    if (dbError) {
      await sb.storage.from(PHOTO_BUCKET).remove([path]);
      throw new Error(`Saving the photo failed: ${dbError.message}`);
    }

    form.reset();
    preview.innerHTML = '';
    setNotice(
      uploadStatus,
      isPublic ? 'Uploaded! Your photo is now in the public gallery.' : 'Uploaded privately. Only the administrator can view it.',
      'success',
    );
    selectTab(isPublic ? 'public' : 'mine');
  } catch (err) {
    setNotice(uploadStatus, err.message, 'error');
  } finally {
    uploadBtn.disabled = false;
  }
});

// ----- start -----

sb = await getSupabase();
if (!sb) {
  setNotice(pageStatus, 'The photo album is not set up yet. (Admin: add your Supabase details to js/config.js; see README.)');
} else {
  try {
    user = await ensureVisitorSession(sb);
    $('album-app').hidden = false;
    await loadGallery();
  } catch (err) {
    setNotice(pageStatus, err.message, 'error');
  }
}
