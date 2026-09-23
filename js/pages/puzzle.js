// Page 0 — puzzle using the photos stored in /puzzle-photos.
import '../core/site.js';
import { PuzzleGame } from '../puzzle/puzzle-game.js';

// Photos live in this folder. The list of files (manifest.json) is rebuilt
// automatically by the deploy workflow, so just add or remove images there.
const PHOTO_DIR = 'puzzle-photos/';
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|svg)$/i;

const $ = (id) => document.getElementById(id);
const difficulty = $('difficulty');
const status = $('status');

let photos = [];
let current = null;

const game = new PuzzleGame($('puzzle'), {
  solvedActions: [
    { label: 'Next photo', primary: true, onClick: () => nextPhoto() },
    { label: 'Play again', onClick: () => game.shuffle() },
  ],
});

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `notice ${type ? `notice-${type}` : ''}`;
}

function setLoading(text) {
  status.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${text}</span>`;
  status.className = 'notice';
}

async function loadPhotoList() {
  const res = await fetch(`${PHOTO_DIR}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the photo list (${res.status}).`);
  const data = await res.json();
  return (data.photos ?? []).filter((name) => IMAGE_FILE.test(name));
}

function pickRandomPhoto() {
  if (photos.length === 1) return photos[0];
  let next;
  do {
    next = photos[Math.floor(Math.random() * photos.length)];
  } while (next === current);
  return next;
}

async function nextPhoto() {
  current = pickRandomPhoto();
  setLoading('Loading photo…');
  try {
    await game.start(PHOTO_DIR + encodeURIComponent(current), Number(difficulty.value));
    setStatus('');
  } catch {
    setStatus(`The photo "${current}" could not be loaded.`, 'error');
  }
}

difficulty.addEventListener('change', () => game.setSize(Number(difficulty.value)));
$('new-photo').addEventListener('click', () => nextPhoto());
$('reshuffle').addEventListener('click', () => game.shuffle());
$('peek').addEventListener('click', () => game.peek());

try {
  photos = await loadPhotoList();
  if (photos.length === 0) {
    setStatus('No puzzle photos yet. Add images to the puzzle-photos folder.', 'error');
  } else {
    await nextPhoto();
  }
} catch (err) {
  setStatus(err.message, 'error');
}
