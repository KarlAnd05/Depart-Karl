// Admin dashboard — view every uploaded photo (including private ones),
// change its visibility or delete it.
import '../core/site.js';
import { getSupabase, isAdmin } from '../core/supabase.js';
import { formatBytes } from '../core/image-utils.js';
import { toast, confirmDialog, loadingHtml } from '../core/ui.js';
import { escapeHtml, formatDate, getSignedUrls, deletePhoto, openLightbox, photoCardHtml } from '../album/photos.js';

const $ = (id) => document.getElementById(id);
const pageStatus = $('page-status');
const grid = $('admin-grid');
const filter = $('filter');

let sb = null;
let photos = [];
let urls = new Map();
let viewable = [];

function show(section) {
  for (const id of ['login', 'not-admin', 'dashboard']) $(id).hidden = id !== section;
}

async function refreshAuthState() {
  const { data: { session } } = await sb.auth.getSession();
  const user = session?.user;
  if (!user || user.is_anonymous) {
    show('login');
    return;
  }
  if (!(await isAdmin(sb))) {
    $('not-admin-email').textContent = user.email ?? 'an unknown account';
    show('not-admin');
    return;
  }
  $('admin-email').textContent = user.email;
  show('dashboard');
  await loadPhotos();
}

async function loadPhotos() {
  grid.innerHTML = loadingHtml('Loading photos…');
  const { data, error } = await sb.from('photos').select('*').order('created_at', { ascending: false });
  if (error) {
    grid.innerHTML = `<p class="notice notice-error">Could not load photos: ${escapeHtml(error.message)}</p>`;
    return;
  }
  photos = data;
  urls = await getSignedUrls(sb, photos);
  render();
}

function render() {
  const publicCount = photos.filter((p) => p.is_public).length;
  $('summary').textContent = `${photos.length} photos · ${publicCount} public · ${photos.length - publicCount} private`;

  const visible = photos.filter((p) => filter.value === 'all' || (filter.value === 'public') === p.is_public);
  if (!visible.length) {
    grid.innerHTML = '<p class="empty-state">No photos to show.</p>';
    return;
  }

  viewable = [];
  const cards = visible.map((p) => {
    const url = urls.get(p.storage_path);
    if (url) viewable.push({ src: url, caption: p.title || 'Untitled' });
    return photoCardHtml(p, url, {
      index: viewable.length - 1,
      placeholder: { icon: 'alert', text: 'Image file missing' },
      details: [
        `Album: ${escapeHtml(p.album || 'Unsorted')}`,
        `${formatDate(p.created_at)} · ${formatBytes(p.size_bytes)}${p.width ? ` · ${p.width}×${p.height}` : ''}`,
        `<span title="${escapeHtml(p.owner_id)}">Uploader: ${escapeHtml(String(p.owner_id ?? 'unknown').slice(0, 8))}</span>`,
      ],
      actions: `
        <button class="btn btn-small" type="button" data-toggle="${p.id}">Make ${p.is_public ? 'private' : 'public'}</button>
        <button class="btn btn-small btn-danger" type="button" data-delete="${p.id}">Delete</button>`,
    });
  });
  grid.innerHTML = `<div class="photo-grid">${cards.join('')}</div>`;
}

grid.addEventListener('click', async (e) => {
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) {
    openLightbox(viewable, Number(viewBtn.dataset.view));
    return;
  }

  const btn = e.target.closest('[data-toggle], [data-delete]');
  if (!btn) return;
  const photo = photos.find((p) => p.id === (btn.dataset.toggle || btn.dataset.delete));
  if (!photo) return;
  const title = photo.title || 'Untitled';

  if (btn.dataset.delete) {
    const ok = await confirmDialog({
      title: 'Delete this photo?',
      message: `"${title}" will be permanently deleted. This can’t be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
  }

  btn.disabled = true;
  try {
    if (btn.dataset.toggle) {
      const { data, error } = await sb.from('photos').update({ is_public: !photo.is_public }).eq('id', photo.id).select();
      if (error || !data?.length) throw new Error(error?.message ?? 'Update was not allowed.');
      photo.is_public = !photo.is_public;
      render();
      toast(`"${title}" is now ${photo.is_public ? 'public' : 'private'}.`, 'success');
    } else {
      await deletePhoto(sb, photo);
      photos = photos.filter((p) => p.id !== photo.id);
      render();
      toast(`"${title}" was deleted.`, 'success');
    }
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
});

filter.addEventListener('change', render);
$('refresh').addEventListener('click', loadPhotos);

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginBtn = $('login-btn');
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Logging in…';
  $('login-status').textContent = '';
  const { error } = await sb.auth.signInWithPassword({
    email: $('login-email').value.trim(),
    password: $('login-password').value,
  });
  loginBtn.disabled = false;
  loginBtn.textContent = 'Log in';
  if (error) {
    $('login-status').textContent = 'Wrong email or password.';
    return;
  }
  $('login-password').value = '';
  await refreshAuthState();
});

document.querySelectorAll('[data-logout]').forEach((btn) => btn.addEventListener('click', async () => {
  await sb.auth.signOut();
  show('login');
}));

sb = await getSupabase();
if (!sb) {
  pageStatus.textContent = 'Supabase is not set up yet. Add your project details to js/config.js (see README).';
} else {
  await refreshAuthState();
}
