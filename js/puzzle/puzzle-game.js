import { loadImage } from '../core/image-utils.js';

const DRAG_THRESHOLD_PX = 6;
const MAX_BOARD_HEIGHT_RATIO = 0.7; // board never taller than 70% of the viewport

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Swap-style picture puzzle.
 *
 * The image is cut into an N×N grid and shuffled. The player swaps pieces —
 * tap one piece then another, or drag a piece onto another — until the
 * picture is whole. The board always keeps the image's own aspect ratio.
 *
 *   const game = new PuzzleGame(element, { solvedActions: [{ label, onClick, primary }] });
 *   await game.start(imageUrl, 4);
 */
export class PuzzleGame {
  constructor(container, { solvedActions = [] } = {}) {
    this.container = container;
    this.size = 3;
    this.order = []; // order[position] = index of the piece shown at that position
    this.tiles = []; // tiles[piece] = element
    this.selected = null; // selected position, or null
    this.drag = null;
    this.moves = 0;
    this.solved = false;
    this.aspect = 0;
    this.imageUrl = null;

    container.classList.add('puzzle');
    container.innerHTML = `
      <div class="puzzle-stats">
        <span>Moves: <b data-moves>0</b></span>
        <span>Time: <b data-time>0:00</b></span>
      </div>
      <div class="puzzle-board" aria-label="Puzzle board">
        <img class="puzzle-peek" alt="" hidden>
        <div class="puzzle-overlay" hidden>
          <div class="card" role="alertdialog" aria-labelledby="puzzle-done-title">
            <h2 id="puzzle-done-title">Puzzle complete</h2>
            <p class="muted" data-summary></p>
            <div class="toolbar" data-actions></div>
          </div>
        </div>
      </div>`;

    this.board = container.querySelector('.puzzle-board');
    this.peekImg = container.querySelector('.puzzle-peek');
    this.overlay = container.querySelector('.puzzle-overlay');
    this.movesEl = container.querySelector('[data-moves]');
    this.timeEl = container.querySelector('[data-time]');
    this.summaryEl = container.querySelector('[data-summary]');

    const actions = container.querySelector('[data-actions]');
    for (const action of solvedActions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.primary ? 'btn btn-primary' : 'btn';
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      actions.append(btn);
    }

    this.board.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.board.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.board.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.board.addEventListener('pointercancel', () => this.cancelDrag());
    this.board.addEventListener('keydown', (e) => this.onKeyDown(e));

    let lastWidth = 0;
    new ResizeObserver(() => {
      if (container.clientWidth !== lastWidth) {
        lastWidth = container.clientWidth;
        this.layout();
      }
    }).observe(container);
    window.addEventListener('resize', () => this.layout());
  }

  /** Load an image and start a new shuffled game with `size`×`size` pieces. */
  async start(imageUrl, size = this.size) {
    const img = await loadImage(imageUrl);
    this.imageUrl = imageUrl;
    this.aspect = img.naturalWidth / img.naturalHeight || 1;
    this.peekImg.src = imageUrl;
    this.container.hidden = false;
    this.setSize(size);
  }

  /** Change the number of pieces per side and reshuffle the current image. */
  setSize(size) {
    this.size = size;
    if (!this.imageUrl) return;
    this.buildTiles();
    this.layout();
    this.shuffle();
  }

  buildTiles() {
    const n = this.size;
    for (const tile of this.tiles) tile.remove();
    this.tiles = [];
    const url = this.imageUrl.replace(/"/g, '%22');

    for (let piece = 0; piece < n * n; piece++) {
      const row = Math.floor(piece / n);
      const col = piece % n;
      const tile = document.createElement('div');
      tile.className = 'puzzle-tile';
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      tile.style.width = `${100 / n}%`;
      tile.style.height = `${100 / n}%`;
      tile.style.backgroundImage = `url("${url}")`;
      tile.style.backgroundSize = `${n * 100}% ${n * 100}%`;
      tile.style.backgroundPosition = `${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`;
      this.board.insertBefore(tile, this.peekImg);
      this.tiles.push(tile);
    }
  }

  /** Shuffle the pieces (never leaving them already solved) and reset the stats. */
  shuffle() {
    const count = this.size * this.size;
    this.order = Array.from({ length: count }, (_, i) => i);
    do {
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    } while (this.isSolved());

    this.clearSelection();
    this.solved = false;
    this.moves = 0;
    this.movesEl.textContent = '0';
    this.board.classList.remove('solved');
    this.overlay.hidden = true;
    this.startTimer();
    this.placeTiles();
  }

  /** Show the complete picture for a moment. */
  peek(ms = 2000) {
    if (!this.imageUrl) return;
    this.peekImg.hidden = false;
    clearTimeout(this.peekTimeout);
    this.peekTimeout = setTimeout(() => { this.peekImg.hidden = true; }, ms);
  }

  isSolved() {
    return this.order.every((piece, pos) => piece === pos);
  }

  // Size the board to fit the available width and height while keeping the
  // image's aspect ratio. Sizes are rounded to whole pixels per piece so the
  // pieces line up without seams.
  layout() {
    if (!this.aspect) return;
    const n = this.size;
    const maxWidth = this.container.clientWidth;
    const maxHeight = Math.max(240, window.innerHeight * MAX_BOARD_HEIGHT_RATIO);
    const width = Math.min(maxWidth, maxHeight * this.aspect);
    const tileW = Math.max(1, Math.floor(width / n));
    const tileH = Math.max(1, Math.floor(width / this.aspect / n));
    this.board.style.width = `${tileW * n}px`;
    this.board.style.height = `${tileH * n}px`;
  }

  translateFor(pos) {
    const row = Math.floor(pos / this.size);
    const col = pos % this.size;
    return `translate(${col * 100}%, ${row * 100}%)`;
  }

  placeTiles() {
    this.order.forEach((piece, pos) => {
      const tile = this.tiles[piece];
      tile.dataset.pos = pos;
      tile.style.transform = this.translateFor(pos);
      tile.setAttribute('aria-label', `Piece at row ${Math.floor(pos / this.size) + 1}, column ${(pos % this.size) + 1}`);
    });
  }

  swap(a, b) {
    [this.order[a], this.order[b]] = [this.order[b], this.order[a]];
    this.moves += 1;
    this.movesEl.textContent = String(this.moves);
    this.placeTiles();
    if (this.isSolved()) this.finish();
  }

  // ----- selection (tap / keyboard) -----

  tap(pos) {
    if (this.solved) return;
    if (this.selected === null) {
      this.selected = pos;
      this.tileAt(pos).classList.add('selected');
    } else if (this.selected === pos) {
      this.clearSelection();
    } else {
      const first = this.selected;
      this.clearSelection();
      this.swap(first, pos);
    }
  }

  clearSelection() {
    if (this.selected !== null) this.tileAt(this.selected)?.classList.remove('selected');
    this.selected = null;
  }

  tileAt(pos) {
    return this.tiles[this.order[pos]];
  }

  onKeyDown(e) {
    const tile = e.target.closest('.puzzle-tile');
    if (!tile || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    this.tap(Number(tile.dataset.pos));
  }

  // ----- drag and drop (mouse + touch via pointer events) -----

  onPointerDown(e) {
    if (this.solved || e.button !== 0) return;
    const tile = e.target.closest('.puzzle-tile');
    if (!tile) return;
    e.preventDefault();
    tile.setPointerCapture(e.pointerId);
    this.drag = {
      tile,
      pos: Number(tile.dataset.pos),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  }

  onPointerMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      this.clearSelection();
      d.tile.classList.add('dragging');
    }
    d.tile.style.transform = `${this.translateFor(d.pos)} translate(${dx}px, ${dy}px)`;
  }

  onPointerUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    d.tile.classList.remove('dragging');
    if (!d.moved) {
      this.tap(d.pos);
      return;
    }
    const target = this.positionAt(e.clientX, e.clientY);
    if (target !== null && target !== d.pos) this.swap(d.pos, target);
    else this.placeTiles();
  }

  cancelDrag() {
    if (!this.drag) return;
    this.drag.tile.classList.remove('dragging');
    this.drag = null;
    this.placeTiles();
  }

  positionAt(x, y) {
    const rect = this.board.getBoundingClientRect();
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return null;
    const n = this.size;
    const col = Math.min(n - 1, Math.floor(((x - rect.left) / rect.width) * n));
    const row = Math.min(n - 1, Math.floor(((y - rect.top) / rect.height) * n));
    return row * n + col;
  }

  // ----- timer & completion -----

  startTimer() {
    clearInterval(this.timer);
    this.startedAt = performance.now();
    this.timeEl.textContent = '0:00';
    this.timer = setInterval(() => {
      this.timeEl.textContent = formatTime(performance.now() - this.startedAt);
    }, 1000);
  }

  finish() {
    this.solved = true;
    clearInterval(this.timer);
    const elapsed = formatTime(performance.now() - this.startedAt);
    this.timeEl.textContent = elapsed;
    this.board.classList.add('solved');
    this.summaryEl.textContent = `Solved in ${this.moves} ${this.moves === 1 ? 'move' : 'moves'} · ${elapsed}`;
    setTimeout(() => {
      this.overlay.hidden = false;
      this.overlay.querySelector('button')?.focus();
    }, 400);
  }
}
