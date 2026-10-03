import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
];

type Board = number[][];
type Piece = { id: number; m: number[][]; x: number; y: number };
type Kiln = {
  board: Board;
  piece: Piece;
  next: number;
  bag: number[];
  score: number;
  lines: number;
  over: boolean;
};

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function shuffle(source: number[]) {
  const ids = source.slice();
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = ids[i];
    ids[i] = ids[j] ?? ids[i];
    ids[j] = swap;
  }
  return ids;
}

function take(bag: number[]) {
  if (bag.length === 0) bag.push(...shuffle([0, 1, 2, 3, 4, 5, 6]));
  return bag.pop() ?? 0;
}

function rotate(matrix: number[][]) {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  const next = Array.from({ length: width }, () => Array(height).fill(0));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) next[x][height - 1 - y] = matrix[y][x];
  }
  return next;
}

function fits(board: Board, matrix: number[][], ox: number, oy: number) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < (matrix[0]?.length ?? 0); x += 1) {
      if (!matrix[y][x]) continue;
      const bx = ox + x;
      const by = oy + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) return false;
      if (by >= 0 && board[by][bx]) return false;
    }
  }
  return true;
}

function spawn(board: Board, id: number, bag: number[]): Piece | null {
  const matrix = SHAPES[id].map((row) => row.slice());
  const piece = { id, m: matrix, x: 3, y: 0 };
  return fits(board, piece.m, piece.x, piece.y) ? piece : null;
}

function fresh(): Kiln {
  const bag = shuffle([0, 1, 2, 3, 4, 5, 6]);
  const id = take(bag);
  const next = take(bag);
  const piece = spawn(emptyBoard(), id, bag);
  return {
    board: emptyBoard(),
    piece: piece ?? { id, m: SHAPES[id].map((row) => row.slice()), x: 3, y: 0 },
    next,
    bag,
    score: 0,
    lines: 0,
    over: !piece,
  };
}

function ghostY(state: Kiln) {
  let y = state.piece.y;
  while (fits(state.board, state.piece.m, state.piece.x, y + 1)) y += 1;
  return y;
}

function merge(state: Kiln) {
  const board = state.board.map((row) => row.slice());
  for (let y = 0; y < state.piece.m.length; y += 1) {
    for (let x = 0; x < (state.piece.m[0]?.length ?? 0); x += 1) {
      if (!state.piece.m[y][x]) continue;
      const by = state.piece.y + y;
      const bx = state.piece.x + x;
      if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) board[by][bx] = 1;
    }
  }
  let cleared = 0;
  const kept = board.filter((row) => {
    const full = row.every(Boolean);
    if (full) cleared += 1;
    return !full;
  });
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(0));
  const table = [0, 100, 300, 500, 800];
  const level = 1 + Math.floor(state.lines / 8);
  const lines = state.lines + cleared;
  const score = state.score + (table[cleared] ?? 0) * level;
  const id = state.next;
  const bag = state.bag;
  const next = take(bag);
  const piece = spawn(kept, id, bag);
  return {
    board: kept,
    piece: piece ?? { id, m: SHAPES[id].map((row) => row.slice()), x: 3, y: 0 },
    next,
    bag,
    score,
    lines,
    over: !piece,
  };
}

function nudge(state: Kiln, dx: number, dy: number): Kiln | null {
  if (state.over) return null;
  if (!fits(state.board, state.piece.m, state.piece.x + dx, state.piece.y + dy)) return null;
  return { ...state, piece: { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy } };
}

function spin(state: Kiln): Kiln | null {
  if (state.over) return null;
  const matrix = rotate(state.piece.m);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (fits(state.board, matrix, state.piece.x + kick, state.piece.y)) {
      return { ...state, piece: { ...state.piece, m: matrix, x: state.piece.x + kick } };
    }
  }
  return null;
}

function hard(state: Kiln) {
  if (state.over) return state;
  const y = ghostY(state);
  return merge({ ...state, piece: { ...state.piece, y } });
}

const BEST_KEY = "slipway-kiln";

export function KilnGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Kiln>(fresh());
  const [hud, setHud] = useState({ score: 0, lines: 0, over: false, best: 0 });

  useEffect(() => {
    const saved = Number(localStorage.getItem(BEST_KEY) || 0);
    setHud((current) => ({ ...current, best: Number.isFinite(saved) ? saved : 0 }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let last = performance.now();
    let acc = 0;

    const paint = () => {
      const state = stateRef.current;
      const css = canvas.clientWidth || 280;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.floor(css * dpr);
      const height = Math.floor(width * 2);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cell = width / COLS;
      const tone = (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const bg = tone("--color-bg");
      const line = tone("--color-line");
      const paper = tone("--color-fg");
      const muted = tone("--color-muted");
      const accent = tone("--color-accent");
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
          if (state.board[y][x]) {
            ctx.fillStyle = paper;
            ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
          }
        }
      }
      const drawPiece = (matrix: number[][], ox: number, oy: number, ghost: boolean) => {
        ctx.fillStyle = ghost ? muted : accent;
        for (let y = 0; y < matrix.length; y += 1) {
          for (let x = 0; x < (matrix[0]?.length ?? 0); x += 1) {
            if (!matrix[y][x]) continue;
            const px = (ox + x) * cell;
            const py = (oy + y) * cell;
            if (py < 0) continue;
            if (ghost) ctx.strokeRect(px + 3, py + 3, cell - 6, cell - 6);
            else ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
          }
        }
      };
      if (!state.over) {
        drawPiece(state.piece.m, state.piece.x, ghostY(state), true);
        drawPiece(state.piece.m, state.piece.x, state.piece.y, false);
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = stateRef.current;
      if (!state.over) {
        acc += dt;
        const level = 1 + Math.floor(state.lines / 8);
        const interval = Math.max(0.12, 0.85 - (level - 1) * 0.07);
        if (acc >= interval) {
          acc = 0;
          const dropped = nudge(state, 0, 1);
          stateRef.current = dropped ?? merge(state);
          publish();
        }
      }
      paint();
      frame = requestAnimationFrame(tick);
    };

    const publish = () => {
      const state = stateRef.current;
      setHud((current) => {
        const best = Math.max(current.best, state.score);
        if (best !== current.best) localStorage.setItem(BEST_KEY, String(best));
        return { score: state.score, lines: state.lines, over: state.over, best };
      });
    };

    const onKey = (event: KeyboardEvent) => {
      const key = event.code;
      if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "KeyA", "KeyD", "KeyS", "KeyW", "Space"].includes(key)) {
        return;
      }
      event.preventDefault();
      const state = stateRef.current;
      if (state.over && (key === "Space" || key === "Enter")) return;
      let next: Kiln | null = null;
      if (key === "ArrowLeft" || key === "KeyA") next = nudge(state, -1, 0);
      if (key === "ArrowRight" || key === "KeyD") next = nudge(state, 1, 0);
      if (key === "ArrowDown" || key === "KeyS") {
        next = nudge(state, 0, 1);
        if (!next) next = merge(state);
        acc = 0;
      }
      if (key === "ArrowUp" || key === "KeyW") next = spin(state);
      if (key === "Space") {
        next = hard(state);
        acc = 0;
      }
      if (next) {
        stateRef.current = next;
        publish();
      }
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const act = (kind: "left" | "right" | "down" | "spin" | "drop") => {
    const state = stateRef.current;
    let next: Kiln | null = null;
    if (kind === "left") next = nudge(state, -1, 0);
    if (kind === "right") next = nudge(state, 1, 0);
    if (kind === "down") next = nudge(state, 0, 1) ?? merge(state);
    if (kind === "spin") next = spin(state);
    if (kind === "drop") next = hard(state);
    if (!next) return;
    stateRef.current = next;
    setHud((current) => {
      const best = Math.max(current.best, next.score);
      if (best !== current.best) localStorage.setItem(BEST_KEY, String(best));
      return { score: next.score, lines: next.lines, over: next.over, best };
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            <Link to="/">Slipway</Link>
            {" · stack"}
          </p>
          <h1 className="font-sans text-4xl text-fg">Kiln</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {hud.score} · rows {hud.lines} · best {hud.best}
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <canvas ref={canvasRef} className="playfield" width={280} height={560} />
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">
            Move with A and D, or the arrows. W turns a crate. S sinks it. Space drops it to the floor.
          </p>
          {hud.over ? (
            <button
              type="button"
              className="rounded-card bg-accent px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent-ink"
              onClick={() => {
                stateRef.current = fresh();
                setHud((current) => ({ ...current, score: 0, lines: 0, over: false }));
              }}
            >
              Fire another load
            </button>
          ) : (
            <p className="font-mono text-xs uppercase tracking-widest text-accent">The shed is hot</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <span />
            <Pad label="Turn" onPress={() => act("spin")} />
            <span />
            <Pad label="Left" onPress={() => act("left")} />
            <Pad label="Sink" onPress={() => act("down")} />
            <Pad label="Right" onPress={() => act("right")} />
          </div>
          <Pad label="Drop" onPress={() => act("drop")} />
        </div>
      </div>
    </main>
  );
}

function Pad({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="min-h-11 rounded-card border border-line bg-surface px-3 py-3 font-mono text-xs uppercase tracking-widest text-fg"
    >
      {label}
    </button>
  );
}
