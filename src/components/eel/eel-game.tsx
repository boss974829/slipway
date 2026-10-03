import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const COLS = 16;
const ROWS = 16;
type Point = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type Eel = {
  body: Point[];
  dir: Dir;
  queued: Dir;
  food: Point;
  score: number;
  over: boolean;
  step: number;
};

function placeFood(body: Point[]): Point {
  const open: Point[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!body.some((part) => part.x === x && part.y === y)) open.push({ x, y });
    }
  }
  return open[Math.floor(Math.random() * open.length)] ?? { x: 1, y: 1 };
}

function fresh(): Eel {
  const body = [
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
  ];
  return { body, dir: "right", queued: "right", food: placeFood(body), score: 0, over: false, step: 0.14 };
}

const BEST_KEY = "slipway-eel";

export function EelGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Eel>(fresh());
  const [hud, setHud] = useState({ score: 0, over: false, best: 0 });

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

    const publish = () => {
      const state = stateRef.current;
      setHud((current) => {
        const best = Math.max(current.best, state.score);
        if (best !== current.best) localStorage.setItem(BEST_KEY, String(best));
        return { score: state.score, over: state.over, best };
      });
    };

    const advance = () => {
      const state = stateRef.current;
      if (state.over) return;
      const dir = state.queued;
      const delta = STEP[dir];
      const head = state.body[0];
      const next = { x: head.x + delta.x, y: head.y + delta.y };
      const hitWall = next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS;
      const ate = next.x === state.food.x && next.y === state.food.y;
      const body = ate ? state.body : state.body.slice(0, -1);
      const hitSelf = body.some((part) => part.x === next.x && part.y === next.y);
      if (hitWall || hitSelf) {
        stateRef.current = { ...state, dir, over: true };
        publish();
        return;
      }
      const grown = [next, ...body];
      stateRef.current = {
        ...state,
        body: grown,
        dir,
        score: state.score + (ate ? 1 : 0),
        food: ate ? placeFood(grown) : state.food,
        step: Math.max(0.07, 0.14 - Math.floor((state.score + (ate ? 1 : 0)) / 4) * 0.01),
      };
      if (ate) publish();
    };

    const paint = () => {
      const state = stateRef.current;
      const css = canvas.clientWidth || 320;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.floor(css * dpr);
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cell = size / COLS;
      const tone = (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      ctx.fillStyle = tone("--color-bg");
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = tone("--color-surface-2");
      for (let i = 0; i <= COLS; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
      }
      ctx.fillStyle = tone("--color-fg");
      ctx.beginPath();
      ctx.arc((state.food.x + 0.5) * cell, (state.food.y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
      ctx.fill();
      state.body.forEach((part, index) => {
        ctx.fillStyle = index === 0 ? tone("--color-accent") : tone("--color-muted");
        ctx.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc >= stateRef.current.step) {
        acc = 0;
        advance();
      }
      paint();
      frame = requestAnimationFrame(tick);
    };

    const turn = (dir: Dir) => {
      const state = stateRef.current;
      if (dir !== OPP[state.dir]) state.queued = dir;
    };

    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, Dir | undefined> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        KeyW: "up",
        KeyS: "down",
        KeyA: "left",
        KeyD: "right",
      };
      const dir = map[event.code];
      if (!dir) return;
      event.preventDefault();
      turn(dir);
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const press = (dir: Dir) => {
    const state = stateRef.current;
    if (dir !== OPP[state.dir]) state.queued = dir;
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            <Link to="/">Slipway</Link>
            {" · grid"}
          </p>
          <h1 className="font-sans text-4xl text-fg">Eel</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {hud.score} glow · best {hud.best}
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,20rem)_1fr]">
        <canvas ref={canvasRef} className="playfield" width={320} height={320} />
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">
            W, A, S, D or the arrows. The head is the bright square. The pale dot is a lantern. Walls and your
            own tail end the swim.
          </p>
          {hud.over ? (
            <button
              type="button"
              className="rounded-card bg-accent px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent-ink"
              onClick={() => {
                stateRef.current = fresh();
                setHud((current) => ({ ...current, score: 0, over: false }));
              }}
            >
              Swim again
            </button>
          ) : (
            <p className="font-mono text-xs uppercase tracking-widest text-accent">Night water</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <span />
            <Pad label="Up" onPress={() => press("up")} />
            <span />
            <Pad label="Left" onPress={() => press("left")} />
            <span />
            <Pad label="Right" onPress={() => press("right")} />
            <span />
            <Pad label="Down" onPress={() => press("down")} />
            <span />
          </div>
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
