// Page 2 — Sudoku.
import '../core/site.js';
import { SudokuGame } from '../sudoku/sudoku-game.js';
import { confirmDialog } from '../core/ui.js';

const $ = (id) => document.getElementById(id);
const message = $('sudoku-message');
const difficulty = $('difficulty');

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

// Clean up the background photo saved by an earlier version of this page.
try { localStorage.removeItem('sudoku.background'); } catch { /* storage unavailable */ }
