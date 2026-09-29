// Page 1 — puzzle made from a photo the visitor picks. The puzzle runs in the
// browser; a copy of the photo is also sent to Karl's inbox in the background
// (the page tells visitors this).
import '../core/site.js';
import { PuzzleGame } from '../puzzle/puzzle-game.js';
import { validateImageFile, resizeImage } from '../core/image-utils.js';
import { getSupabase, ensureVisitorSession } from '../core/supabase.js';
import { LOCAL_IMAGE_MAX_BYTES, MESSAGE_PHOTO_BUCKET, PHOTO_MAX_BYTES } from '../config.js';

// Big photos are scaled down so the puzzle stays smooth on phones.
const MAX_SIDE_PX = 1600;

const $ = (id) => document.getElementById(id);
const input = $('photo-input');
const difficulty = $('difficulty');
const dropzone = $('dropzone');
const status = $('status');

let objectUrl = null;

const game = new PuzzleGame($('puzzle'), {
  solvedActions: [
    { label: 'Play again', primary: true, onClick: () => game.shuffle() },
    { label: 'Use another photo', onClick: () => input.click() },
  ],
});

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `notice ${type ? `notice-${type}` : ''}`;
}

// Save a copy of the puzzle photo to the admin inbox (as a message with the
// photo attached). Runs in the background: the game never waits for it, and a
// failure (offline, spam limit…) is ignored so play is never interrupted.
async function sendPhotoToInbox({ blob, width, height }) {
  try {
    if (blob.size > PHOTO_MAX_BYTES) return;
    const sb = await getSupabase();
    if (!sb) return;
    const user = await ensureVisitorSession(sb);
    const path = `${user.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await sb.storage
      .from(MESSAGE_PHOTO_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await sb.from('messages').insert({
      body: 'Photo used in the Custom Puzzle',
      photo_path: path,
      photo_mime_type: 'image/jpeg',
      photo_size_bytes: blob.size,
      photo_width: width,
      photo_height: height,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Could not save the puzzle photo:', err.message ?? err);
  }
}

async function usePhoto(file) {
  setStatus('');
  try {
    await validateImageFile(file, { maxBytes: LOCAL_IMAGE_MAX_BYTES });
    status.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Preparing your puzzle…</span>';
    status.className = 'notice';
    const resized = await resizeImage(file, MAX_SIDE_PX, { quality: 0.92 });
    const { blob } = resized;
    sendPhotoToInbox(resized); // not awaited: happens in the background
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    dropzone.hidden = true;
    await game.start(objectUrl, Number(difficulty.value));
    $('reshuffle').disabled = false;
    $('peek').disabled = false;
    setStatus('');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

input.addEventListener('change', () => {
  if (input.files[0]) usePhoto(input.files[0]);
  input.value = ''; // allow choosing the same file again
});

difficulty.addEventListener('change', () => game.setSize(Number(difficulty.value)));
$('reshuffle').addEventListener('click', () => game.shuffle());
$('peek').addEventListener('click', () => game.peek());

// Drag-and-drop a file onto the empty area.
dropzone.addEventListener('click', () => input.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) usePhoto(file);
});
