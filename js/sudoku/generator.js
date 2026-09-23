// Sudoku generator and solver.
// A board is an array of 81 numbers (row by row); 0 means an empty cell.

export const DIFFICULTIES = {
  easy: { label: 'Easy', clues: 40 },
  medium: { label: 'Medium', clues: 32 },
  hard: { label: 'Hard', clues: 26 },
};

const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

// PEERS[i] = the 20 other cells that share a row, column or box with cell i.
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const peers = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) peers.push(j);
  }
  return peers;
});

function shuffled(values) {
  const a = values.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Backtracking search. Counts solutions up to `limit` and returns the first one found.
 * With `randomize`, digits are tried in random order (used to create new grids).
 */
export function solve(board, { limit = 1, randomize = false } = {}) {
  const b = board.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);

  for (let i = 0; i < 81; i++) {
    const v = b[i];
    if (!v) continue;
    const bit = 1 << v;
    if (rows[rowOf(i)] & bit || cols[colOf(i)] & bit || boxes[boxOf(i)] & bit) return { count: 0, solution: null };
    rows[rowOf(i)] |= bit;
    cols[colOf(i)] |= bit;
    boxes[boxOf(i)] |= bit;
  }

  let count = 0;
  let solution = null;

  const search = () => {
    // Fill the empty cell with the fewest options first — much faster.
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (b[i]) continue;
      const mask = ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]) & 0x3fe;
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = b.slice();
      return count >= limit;
    }
    if (bestCount === 0) return false;

    const r = rowOf(best);
    const c = colOf(best);
    const x = boxOf(best);
    for (const v of randomize ? shuffled(DIGITS) : DIGITS) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      b[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[x] |= bit;
      if (search()) return true;
      b[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[x] &= ~bit;
    }
    return false;
  };

  search();
  return { count, solution };
}

/**
 * Create a new puzzle with exactly one solution.
 * Returns { puzzle, solution } as 81-number arrays.
 */
export function generate(difficulty = 'easy') {
  const target = (DIFFICULTIES[difficulty] ?? DIFFICULTIES.easy).clues;
  const { solution } = solve(new Array(81).fill(0), { randomize: true });
  const puzzle = solution.slice();

  let clues = 81;
  for (const i of shuffled([...Array(81).keys()])) {
    if (clues <= target) break;
    const value = puzzle[i];
    puzzle[i] = 0;
    if (solve(puzzle, { limit: 2 }).count === 1) clues--;
    else puzzle[i] = value; // removing it would allow more than one answer
  }
  return { puzzle, solution };
}
