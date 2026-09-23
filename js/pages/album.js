// Page 3 — photo album: upload photos (public or private) and browse the gallery.
import '../core/site.js';
import { PHOTO_BUCKET, GALLERY_PAGE_SIZE, ALBUM_MAX_INPUT_BYTES } from '../config.js';
import { getSupabase, ensureVisitorSession } from '../core/supabase.js';
import { IMAGE_TYPES, validateImageFile } from '../core/image-utils.js';
import { toast, confirmDialog, loadingHtml } from '../core/ui.js';
import {
  escapeHtml, formatDate, getSignedUrls, groupByAlbum, deletePhoto,
  openLightbox, photoCardHtml, prepareAlbumPhoto,
} from '../album/photos.js';

const $ = (id) => document.getElementById(id);
const pageStatus = $('page-status');
const form = $('upload-form');
const fileInput = $('photo-file');
const dropzone = $('dropzone');
const preview = $('upload-preview');
const uploadBtn = $('upload-btn');
const uploadStatus = $('upload-status');
const gallery = $('gallery');

let sb = null;
let user = null;
let activeTab = 'public';
let loaded = []; // photos loaded so far for the active tab (newest first)
let hasMore = false;
let viewable = []; // photos with an image, in on-screen order (for the viewer)
const urls = new Map(); // storage_path → signed URL
let loadCount = 0;
let previewUrl = null;

function setNotice(el, message, type = '') {
  el.textContent = message;
  el.className = `notice ${type ? `notice-${type}` : ''}`;
}

// ----- gallery -----

async function loadGallery({ append = false } = {}) {
  const loadId = ++loadCount;
  if (!append) {
    loaded = [];
    gallery.innerHTML = loadingHtml('Loading photos…');
  }

  // Ask for one extra row to know whether there is another page.
  let query = sb.from('photos').select('*')
    .order('created_at', { ascending: false })
    .range(loaded.length, loaded.length + GALLERY_PAGE_SIZE);
  query = activeTab === 'public' ? query.eq('is_public', true) : query.eq('owner_id', user.id);

  const { data, error } = await query;
  if (loadId !== loadCount) return; // the user switched tabs meanwhile
  if (error) {
    gallery.innerHTML = `<p class="notice notice-error">Could not load photos: ${escapeHtml(error.message)}</p>`;
    return;
  }

  hasMore = data.length > GALLERY_PAGE_SIZE;
  const page = data.slice(0, GALLERY_PAGE_SIZE).filter((p) => !loaded.some((l) => l.id === p.id));
  // Only request links for public photos; private ones are admin-only.
  const newUrls = await getSignedUrls(sb, page.filter((p) => p.is_public));
  if (loadId !== loadCount) return;
  newUrls.forEach((url, path) => urls.set(path, url));
  loaded = loaded.concat(page);

  if (activeTab === 'public') updateAlbumSuggestions();
  render();
}

function render() {
  if (!loaded.length) {
    gallery.innerHTML = `<p class="empty-state">${activeTab === 'public'
      ? 'No public photos yet. Be the first to upload one!'
      : 'You haven’t uploaded any photos from this browser yet.'}</p>`;
    return;
  }

  viewable = [];
  const sections = [...groupByAlbum(loaded)].map(([album, items]) => {
    const cards = items.map((photo) => {
      const url = urls.get(photo.storage_path);
      if (url) viewable.push({ src: url, caption: photo.title || 'Untitled' });
      const canDelete = activeTab === 'mine' && photo.is_public;
      return photoCardHtml(photo, url, {
        index: viewable.length - 1,
        details: [formatDate(photo.created_at)],
        actions: canDelete ? `<button class="btn btn-small btn-danger" type="button" data-delete="${photo.id}">Delete</button>` : '',
      });
    });
    return `
      <h3>${escapeHtml(album)} <span class="muted">(${items.length})</span></h3>
      <div class="photo-grid">${cards.join('')}</div>`;
  });

  gallery.innerHTML = sections.join('') + (hasMore
    ? '<div class="load-more"><button class="btn" type="button" data-load-more>Load more photos</button></div>'
    : '');
}

function updateAlbumSuggestions() {
  const names = [...new Set(loaded.map((p) => p.album).filter(Boolean))].sort();
  $('album-names').innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">`).join('');
}

gallery.addEventListener('click', async (e) => {
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) {
    openLightbox(viewable, Number(viewBtn.dataset.view));
    return;
  }

  const moreBtn = e.target.closest('[data-load-more]');
  if (moreBtn) {
    moreBtn.disabled = true;
    moreBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Loading…';
    await loadGallery({ append: true });
    return;
  }

  const deleteBtn = e.target.closest('[data-delete]');
  if (deleteBtn) {
    const photo = loaded.find((p) => p.id === deleteBtn.dataset.delete);
    if (!photo) return;
    const ok = await confirmDialog({
      title: 'Delete this photo?',
      message: `"${photo.title || 'Untitled'}" will be removed from the gallery. This can’t be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    deleteBtn.disabled = true;
    try {
      await deletePhoto(sb, photo);
      loaded = loaded.filter((p) => p.id !== photo.id);
      render();
      toast('Photo deleted.', 'success');
    } catch (err) {
      toast(err.message, 'error');
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

// ----- choosing a photo -----

async function showPreview() {
  setNotice(uploadStatus, '');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  preview.innerHTML = '';
  const file = fileInput.files[0];
  if (!file) return;
  try {
    await validateImageFile(file, { maxBytes: ALBUM_MAX_INPUT_BYTES });
    previewUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${previewUrl}" alt="Preview of the selected photo">`;
  } catch (err) {
    setNotice(uploadStatus, err.message, 'error');
  }
}

fileInput.addEventListener('change', showPreview);

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (!e.dataTransfer.files.length) return;
  const dt = new DataTransfer();
  dt.items.add(e.dataTransfer.files[0]);
  fileInput.files = dt.files;
  showPreview();
});

// ----- upload -----

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  setNotice(uploadStatus, '');
  if (!file) {
    setNotice(uploadStatus, 'Please choose a photo first.', 'error');
    return;
  }

  const label = uploadBtn.textContent;
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Uploading…';

  try {
    const { data, type, width, height } = await prepareAlbumPhoto(file);
    const path = `${user.id}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
    const isPublic = form.elements.visibility.value === 'public';

    const { error: uploadError } = await sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, data, { contentType: type, cacheControl: '3600', upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { error: dbError } = await sb.from('photos').insert({
      storage_path: path,
      title: $('photo-title').value.trim() || null,
      album: $('photo-album').value.trim() || null,
      is_public: isPublic,
      mime_type: type,
      size_bytes: data.size,
      width,
      height,
    });
    if (dbError) {
      await sb.storage.from(PHOTO_BUCKET).remove([path]);
      throw new Error(`Saving the photo failed: ${dbError.message}`);
    }

    form.reset();
    preview.innerHTML = '';
    toast(isPublic ? 'Uploaded! Your photo is now in the public gallery.' : 'Uploaded privately. Only the administrator can view it.', 'success');
    selectTab(isPublic ? 'public' : 'mine');
  } catch (err) {
    setNotice(uploadStatus, err.message, 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = label;
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
