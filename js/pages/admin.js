// Admin dashboard — read the anonymous messages visitors sent (with their
// photos), mark them as read, or delete them.
import '../core/site.js';
import { MESSAGE_PHOTO_BUCKET } from '../config.js';
import { getSupabase, isAdmin } from '../core/supabase.js';
import { toast, confirmDialog, loadingHtml } from '../core/ui.js';
import { escapeHtml, formatDateTime } from '../core/format.js';
import { getSignedUrls } from '../core/photos.js';
import { openLightbox } from '../core/lightbox.js';

const $ = (id) => document.getElementById(id);
const pageStatus = $('page-status');
const list = $('message-list');
const filter = $('filter');

let sb = null;
let messages = [];
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
  await loadMessages();
}

async function loadMessages() {
  list.innerHTML = loadingHtml('Loading messages…');
  const { data, error } = await sb.from('messages')
    .select('id, body, photo_path, photo_width, photo_height, is_read, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    list.innerHTML = `<p class="notice notice-error">Could not load messages: ${escapeHtml(error.message)}</p>`;
    return;
  }
  messages = data;
  urls = await getSignedUrls(sb, MESSAGE_PHOTO_BUCKET, messages.map((m) => m.photo_path).filter(Boolean));
  render();
}

function render() {
  const unread = messages.filter((m) => !m.is_read).length;
  $('summary').textContent = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'} · ${unread} unread`;

  const visible = messages.filter((m) =>
    filter.value === 'all' || (filter.value === 'unread' ? !m.is_read : Boolean(m.photo_path)));
  if (!visible.length) {
    list.innerHTML = `<p class="empty-state">${messages.length ? 'No messages match this filter.' : 'No messages yet.'}</p>`;
    return;
  }

  viewable = [];
  list.innerHTML = visible.map((m) => {
    const url = m.photo_path ? urls.get(m.photo_path) : null;
    if (url) viewable.push({ src: url, caption: `Photo sent ${formatDateTime(m.created_at)}` });
    const photo = !m.photo_path ? ''
      : url
        ? `<button class="message-photo" type="button" data-view="${viewable.length - 1}" aria-label="View attached photo">
             <img src="${escapeHtml(url)}" alt="Attached photo" loading="lazy">
           </button>`
        : '<p class="hint">The attached photo could not be loaded.</p>';
    return `
      <article class="message-card${m.is_read ? '' : ' unread'}">
        <div class="message-meta">
          ${m.is_read ? '' : '<span class="badge badge-new">New</span>'}
          <time datetime="${m.created_at}">${formatDateTime(m.created_at)}</time>
        </div>
        <p class="message-body">${escapeHtml(m.body)}</p>
        ${photo}
        <div class="message-actions">
          <button class="btn btn-small" type="button" data-toggle-read="${m.id}">Mark as ${m.is_read ? 'unread' : 'read'}</button>
          <button class="btn btn-small btn-danger" type="button" data-delete="${m.id}">Delete</button>
        </div>
      </article>`;
  }).join('');
}

list.addEventListener('click', async (e) => {
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) {
    openLightbox(viewable, Number(viewBtn.dataset.view));
    return;
  }

  const btn = e.target.closest('[data-toggle-read], [data-delete]');
  if (!btn) return;
  const message = messages.find((m) => m.id === (btn.dataset.toggleRead || btn.dataset.delete));
  if (!message) return;

  if (btn.dataset.delete) {
    const ok = await confirmDialog({
      title: 'Delete this message?',
      message: message.photo_path ? 'The message and its photo will be permanently deleted.' : 'This message will be permanently deleted.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
  }

  btn.disabled = true;
  try {
    if (btn.dataset.toggleRead) {
      const { data, error } = await sb.from('messages').update({ is_read: !message.is_read }).eq('id', message.id).select('id');
      if (error || !data?.length) throw new Error(error?.message ?? 'Update was not allowed.');
      message.is_read = !message.is_read;
      render();
    } else {
      if (message.photo_path) {
        const { error } = await sb.storage.from(MESSAGE_PHOTO_BUCKET).remove([message.photo_path]);
        if (error) throw new Error(`Could not delete the photo: ${error.message}`);
      }
      const { error } = await sb.from('messages').delete().eq('id', message.id);
      if (error) throw new Error(`Could not delete the message: ${error.message}`);
      messages = messages.filter((m) => m.id !== message.id);
      render();
      toast('Message deleted.', 'success');
    }
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
});

filter.addEventListener('change', render);
$('refresh').addEventListener('click', loadMessages);

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
