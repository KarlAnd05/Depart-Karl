// Page 3 — send the site owner an anonymous message, optionally with a photo.
import '../core/site.js';
import { MESSAGE_PHOTO_BUCKET, MESSAGE_MAX_LENGTH, PHOTO_MAX_INPUT_BYTES } from '../config.js';
import { getSupabase, ensureVisitorSession } from '../core/supabase.js';
import { IMAGE_TYPES, validateImageFile } from '../core/image-utils.js';
import { preparePhotoUpload } from '../core/photos.js';

const $ = (id) => document.getElementById(id);
const form = $('message-form');
const body = $('message-body');
const charCount = $('char-count');
const photoInput = $('photo-input');
const photoBtn = $('photo-btn');
const photoPreview = $('photo-preview');
const sendBtn = $('send-btn');
const formStatus = $('form-status');

let photoFile = null;
let previewUrl = null;

function setNotice(el, message, type = '') {
  el.textContent = message;
  el.className = `notice ${type ? `notice-${type}` : ''}`;
}

// ----- message text -----

function updateCount() {
  charCount.textContent = `${body.value.length} / ${MESSAGE_MAX_LENGTH}`;
}
body.maxLength = MESSAGE_MAX_LENGTH;
body.addEventListener('input', updateCount);
updateCount();

// ----- optional photo -----

function clearPhoto() {
  photoFile = null;
  photoInput.value = '';
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  photoPreview.hidden = true;
  photoBtn.hidden = false;
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  setNotice(formStatus, '');
  if (!file) return;
  try {
    await validateImageFile(file, { maxBytes: PHOTO_MAX_INPUT_BYTES });
    clearPhoto();
    photoFile = file;
    previewUrl = URL.createObjectURL(file);
    photoPreview.querySelector('img').src = previewUrl;
    photoPreview.hidden = false;
    photoBtn.hidden = true;
  } catch (err) {
    photoInput.value = '';
    setNotice(formStatus, err.message, 'error');
  }
});

$('photo-remove').addEventListener('click', clearPhoto);

// ----- sending -----

let sb = null;

async function uploadPhoto(user) {
  const { data, type, width, height } = await preparePhotoUpload(photoFile);
  const path = `${user.id}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
  const { error } = await sb.storage
    .from(MESSAGE_PHOTO_BUCKET)
    .upload(path, data, { contentType: type, upsert: false });
  if (error) throw new Error(`The photo could not be uploaded: ${error.message}`);
  return {
    photo_path: path,
    photo_mime_type: type,
    photo_size_bytes: data.size,
    photo_width: width,
    photo_height: height,
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice(formStatus, '');
  const text = body.value.trim();
  if (!text) {
    setNotice(formStatus, 'Please write a message first.', 'error');
    body.focus();
    return;
  }

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
  try {
    // The anonymous session is only created when someone actually sends a message.
    const user = await ensureVisitorSession(sb);
    const photo = photoFile ? await uploadPhoto(user) : {};
    const { error } = await sb.from('messages').insert({ body: text, ...photo });
    if (error) {
      throw new Error(error.message.includes('Too many messages')
        ? 'You have sent a lot of messages recently. Please try again later.'
        : `Your message could not be sent: ${error.message}`);
    }
    form.reset();
    clearPhoto();
    updateCount();
    $('compose').hidden = true;
    $('sent').hidden = false;
  } catch (err) {
    setNotice(formStatus, err.message, 'error');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send message';
  }
});

$('send-another').addEventListener('click', () => {
  $('sent').hidden = true;
  $('compose').hidden = false;
  body.focus();
});

// ----- start -----

sb = await getSupabase();
if (!sb) {
  setNotice($('page-status'), 'Messages are not set up yet. (Admin: add your Supabase details to js/config.js; see README.)');
  sendBtn.disabled = true;
}
