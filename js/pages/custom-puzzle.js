// Page 1 — puzzle made from a photo the visitor picks. Everything happens in
// the browser; the photo is never uploaded.
import '../core/site.js';
import { PuzzleGame } from '../puzzle/puzzle-game.js';
import { validateImageFile, resizeImage } from '../core/image-utils.js';
import { LOCAL_IMAGE_MAX_BYTES } from '../config.js';

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

async function usePhoto(file) {
  setStatus('');
  try {
    await validateImageFile(file, { maxBytes: LOCAL_IMAGE_MAX_BYTES });
    status.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Preparing your puzzle…</span>';
    status.className = 'notice';
    const { blob } = await resizeImage(file, MAX_SIDE_PX, { quality: 0.92 });
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
