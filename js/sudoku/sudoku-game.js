import { generate, PEERS, DIFFICULTIES } from './generator.js';

const STORAGE_KEY = 'sudoku.game';

/**
 * Playable Sudoku board with an on-screen number pad and keyboard support.
 * The current game is saved in the browser so a reload doesn't lose progress.
 *
 *   const game = new SudokuGame(element, { onMessage: (text, type) => … });
 */
export class SudokuGame {
  constructor(root, { onMessage = () => {} } = {}) {
    this.onMessage = onMessage;
    this.selected = null;
    this.wrong = new Set();

    root.innerHTML = `
      <div class="sudoku-board" role="grid" aria-label="Sudoku board"></div>
      <div class="numpad" aria-label="Number pad"></div>`;
    this.board = root.querySelector('.sudoku-board');
    this.numpad = root.querySelector('.numpad');

    this.cells = Array.from({ length: 81 }, (_, i) => {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sudoku-cell';
      if (col === 2 || col === 5) cell.classList.add('box-right');
      if (row === 2 || row === 5) cell.classList.add('box-bottom');
      cell.dataset.index = i;
      this.board.append(cell);
      return cell;
    });

    this.numButtons = [];
    for (let v = 1; v <= 9; v++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = v;
      btn.dataset.value = v;
      this.numpad.append(btn);
      this.numButtons.push(btn);
    }
    const erase = document.createElement('button');
    erase.type = 'button';
    erase.className = 'btn erase';
    erase.textContent = 'Erase';
    erase.dataset.value = 0;
    this.numpad.append(erase);

    this.board.addEventListener('click', (e) => {
      const cell = e.target.closest('.sudoku-cell');
      if (cell) this.select(Number(cell.dataset.index));
    });
    this.numpad.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) this.input(Number(btn.dataset.value));
    });
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    if (!this.restore()) this.newGame('easy');
  }

  newGame(difficulty = this.difficulty) {
    const { puzzle, solution } = generate(difficulty);
    this.difficulty = difficulty in DIFFICULTIES ? difficulty : 'easy';
    this.givens = puzzle;
    this.solution = solution;
    this.values = puzzle.slice();
    this.reset();
  }

  /** Clear everything the player entered, keeping the same puzzle. */
  restart() {
    this.values = this.givens.slice();
    this.reset();
  }

  reset() {
    this.selected = null;
    this.wrong.clear();
    this.solved = false;
    this.onMessage('');
    this.save();
    this.render();
  }

  select(i) {
    this.selected = i;
    this.render();
  }

  /** Put `value` (1–9) in the selected cell, or clear it with 0. */
  input(value) {
    const i = this.selected;
    if (i === null || this.solved || this.givens[i]) return;
    this.values[i] = value;
    this.wrong.delete(i);
    this.onMessage('');
    if (this.values.every((v, j) => v === this.solution[j])) {
      this.solved = true;
      this.onMessage('🎉 Solved! Well done.', 'success');
    }
    this.save();
    this.render();
  }

  /** Mark wrong entries in red and report how many cells are left. */
  check() {
    if (this.solved) return;
    this.wrong = new Set();
    let empty = 0;
    this.values.forEach((v, i) => {
      if (!v) empty++;
      else if (v !== this.solution[i]) this.wrong.add(i);
    });
    if (this.wrong.size) {
      const n = this.wrong.size;
      this.onMessage(`${n} ${n === 1 ? 'cell is' : 'cells are'} wrong (marked in red).`, 'error');
    } else {
      this.onMessage(`No mistakes so far. ${empty} ${empty === 1 ? 'cell' : 'cells'} to go.`, 'success');
    }
    this.render();
  }

  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
    if (this.selected === null) return;

    if (/^[1-9]$/.test(e.key)) {
      this.input(Number(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      this.input(0);
    } else {
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      const row = (Math.floor(this.selected / 9) + move[0] + 9) % 9;
      const col = ((this.selected % 9) + move[1] + 9) % 9;
      this.select(row * 9 + col);
      this.cells[this.selected].focus();
    }
  }

  render() {
    const sel = this.selected;
    const selValue = sel === null ? 0 : this.values[sel];
    const peers = new Set(sel === null ? [] : PEERS[sel]);
    const counts = new Array(10).fill(0);

    this.values.forEach((v, i) => {
      counts[v]++;
      const cell = this.cells[i];
      const given = Boolean(this.givens[i]);
      const conflict = v !== 0 && PEERS[i].some((p) => this.values[p] === v);
      cell.textContent = v || '';
      cell.classList.toggle('given', given);
      cell.classList.toggle('selected', i === sel);
      cell.classList.toggle('peer', peers.has(i));
      cell.classList.toggle('same', v !== 0 && v === selValue && i !== sel);
      cell.classList.toggle('conflict', conflict);
      cell.classList.toggle('wrong', this.wrong.has(i));
      cell.setAttribute(
        'aria-label',
        `Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}: ${v || 'empty'}${given ? ' (given)' : ''}${conflict ? ', conflict' : ''}`,
      );
    });

    // Grey out a number once all nine of it are on the board.
    this.numButtons.forEach((btn, idx) => { btn.disabled = counts[idx + 1] >= 9; });
    this.board.classList.toggle('solved', this.solved);
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        difficulty: this.difficulty,
        givens: this.givens,
        solution: this.solution,
        values: this.values,
      }));
    } catch {
      // Storage unavailable (private mode, etc.) — the game still works, it just won't be remembered.
    }
  }

  restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const valid = (a) => Array.isArray(a) && a.length === 81 && a.every((v) => Number.isInteger(v) && v >= 0 && v <= 9);
      if (!data || !valid(data.givens) || !valid(data.solution) || !valid(data.values)) return false;
      this.difficulty = data.difficulty in DIFFICULTIES ? data.difficulty : 'easy';
      this.givens = data.givens;
      this.solution = data.solution;
      this.values = data.values;
      this.solved = this.values.every((v, i) => v === this.solution[i]);
      this.render();
      if (this.solved) this.onMessage('🎉 Solved! Start a new game whenever you like.', 'success');
      return true;
    } catch {
      return false;
    }
  }
}
