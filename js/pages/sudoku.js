// Page 2 — Sudoku with an optional custom background photo.
import '../core/site.js';
import { SudokuGame } from '../sudoku/sudoku-game.js';
import { validateImageFile, resizeImage, blobToDataUrl } from '../core/image-utils.js';
import { LOCAL_IMAGE_MAX_BYTES } from '../config.js';
import { confirmDialog } from '../core/ui.js';

const BG_STORAGE_KEY = 'sudoku.background';
const BG_MAX_SIDE_PX = 1920;

const $ = (id) => document.getElementById(id);
const message = $('sudoku-message');
const difficulty = $('difficulty');
const bg = $('sudoku-bg');
const bgInput = $('bg-input');
const bgRemove = $('bg-remove');
const bgStatus = $('bg-status');

function showMessage(text, type = '') {
  message.textContent = text;
  message.className = `notice sudoku-message ${type ? `notice-${type}` : ''}`;
}

const game = new SudokuGame($('sudoku'), { onMessage: showMessage });
difficulty.value = game.difficulty;

const undoBtn = $('undo');
game.onChange = () => { undoBtn.disabled = !game.canUndo; };
game.onChange();

async function confirmLosingProgress(title) {
  const hasProgress = game.values.some((v, i) => v && !game.givens[i]) && !game.solved;
  return !hasProgress || confirmDialog({ title, message: 'Your current progress will be lost.', confirmLabel: 'Continue' });
}

$('new-game').addEventListener('click', async () => {
  if (await confirmLosingProgress('Start a new game?')) game.newGame(difficulty.value);
});
$('restart').addEventListener('click', async () => {
  if (await confirmLosingProgress('Restart this puzzle?')) game.restart();
});
$('check').addEventListener('click', () => game.check());
undoBtn.addEventListener('click', () => game.undo());

// ----- background photo -----

function applyBackground(dataUrl) {
  bg.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
  bg.hidden = !dataUrl;
  bgRemove.hidden = !dataUrl;
}

bgInput.addEventListener('change', async () => {
  const file = bgInput.files[0];
  bgInput.value = '';
  if (!file) return;
  bgStatus.textContent = '';
  try {
    await validateImageFile(file, { maxBytes: LOCAL_IMAGE_MAX_BYTES });
    const { blob } = await resizeImage(file, BG_MAX_SIDE_PX, { quality: 0.82 });
    const dataUrl = await blobToDataUrl(blob);
    applyBackground(dataUrl);
    try {
      localStorage.setItem(BG_STORAGE_KEY, dataUrl);
    } catch {
      bgStatus.textContent = 'Background set, but it could not be saved for your next visit.';
    }
  } catch (err) {
    bgStatus.textContent = err.message;
  }
});

bgRemove.addEventListener('click', () => {
  applyBackground(null);
  bgStatus.textContent = '';
  try { localStorage.removeItem(BG_STORAGE_KEY); } catch { /* ignore */ }
});

try {
  applyBackground(localStorage.getItem(BG_STORAGE_KEY));
} catch {
  applyBackground(null);
}
