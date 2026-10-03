import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type Bell = { x: number; y: number; rung: boolean };
type Post = { x: number; y: number };

type World = {
  x: number;
  y: number;
  camX: number;
  camY: number;
  zoom: number;
  shake: number;
  bells: Bell[];
  posts: Post[];
  facing: number;
};

const WORLD = 1800;
const SPEED = 220;

function build(): World {
  const bells: Bell[] = [];
  const posts: Post[] = [];
  let seed = 42;
  const roll = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 6; i += 1) {
    bells.push({ x: 180 + roll() * (WORLD - 360), y: 180 + roll() * (WORLD - 360), rung: false });
  }
  for (let i = 0; i < 22; i += 1) {
    posts.push({ x: 120 + roll() * (WORLD - 240), y: 120 + roll() * (WORLD - 240) });
  }
  let x = WORLD / 2;
  let y = WORLD / 2;
  if (posts.some((post) => Math.hypot(x - post.x, y - post.y) < 40)) {
    x = 80;
    y = 80;
  }
  return {
    x,
    y,
    camX: x,
    camY: y,
    zoom: 1,
    shake: 0,
    bells,
    posts,
    facing: -Math.PI / 2,
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}

export function SlipGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(build());
  const keysRef = useRef<Set<string>>(new Set());
  const [rung, setRung] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const world = worldRef.current;
    let frame = 0;
    let last = performance.now();
    let vx = 0;
    let vy = 0;

    const probe = {
      getYaw: () => world.facing,
      getSpeed: () => Math.hypot(vx, vy),
      getX: () => world.x,
      getY: () => world.y,
      setKeys: (codes: string[]) => {
        keysRef.current = new Set(codes);
      },
    };
    window.__controlsTest = probe;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const keys = keysRef.current;
      let mx = 0;
      let my = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft") || keys.has("Numpad4")) mx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight") || keys.has("Numpad6")) mx += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp") || keys.has("Numpad8")) my -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown") || keys.has("Numpad2")) my += 1;
      if (keys.has("Equal") || keys.has("NumpadAdd")) world.zoom = Math.min(1.8, world.zoom + dt * 0.8);
      if (keys.has("Minus") || keys.has("NumpadSubtract")) world.zoom = Math.max(0.65, world.zoom - dt * 0.8);
      const length = Math.hypot(mx, my) || 1;
      vx = (mx / length) * (mx || my ? SPEED : 0);
      vy = (my / length) * (mx || my ? SPEED : 0);
      if (mx || my) world.facing = Math.atan2(vy, vx);
      const tryMove = (nx: number, ny: number) => {
        const blocked = world.posts.some((post) => Math.hypot(nx - post.x, ny - post.y) < 28);
        if (blocked || nx < 24 || ny < 24 || nx > WORLD - 24 || ny > WORLD - 24) {
          world.shake = Math.max(world.shake, 8);
          return false;
        }
        return true;
      };
      if (tryMove(world.x + vx * dt, world.y)) world.x += vx * dt;
      if (tryMove(world.x, world.y + vy * dt)) world.y += vy * dt;
      let newly = 0;
      for (const bell of world.bells) {
        if (!bell.rung && Math.hypot(world.x - bell.x, world.y - bell.y) < 26) {
          bell.rung = true;
          world.shake = 16;
          newly += 1;
        }
      }
      if (newly) setRung(world.bells.filter((bell) => bell.rung).length);
      const viewW = (canvas.clientWidth || 640) / world.zoom;
      const viewH = (canvas.clientHeight || 420) / world.zoom;
      const deadX = viewW * 0.18;
      const deadY = viewH * 0.18;
      let targetX = world.camX;
      let targetY = world.camY;
      if (world.x - targetX > deadX) targetX = world.x - deadX;
      if (world.x - targetX < -deadX) targetX = world.x + deadX;
      if (world.y - targetY > deadY) targetY = world.y - deadY;
      if (world.y - targetY < -deadY) targetY = world.y + deadY;
      const follow = 1 - Math.exp(-5 * dt);
      world.camX += (targetX - world.camX) * follow;
      world.camY += (targetY - world.camY) * follow;
      world.shake *= Math.exp(-4 * dt);
      paint();
      frame = requestAnimationFrame(tick);
    };

    const paint = () => {
      const cssW = canvas.clientWidth || 640;
      const cssH = canvas.clientHeight || 420;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.floor(cssW * dpr);
      const height = Math.floor(cssH * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const shakeX = Math.sin(performance.now() / 30) * world.shake;
      const shakeY = Math.cos(performance.now() / 27) * world.shake;
      const tone = (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const wash = tone("--color-bg");
      const board = tone("--color-surface-2");
      ctx.setTransform(dpr * world.zoom, 0, 0, dpr * world.zoom, width / 2 + shakeX, height / 2 + shakeY);
      ctx.translate(-world.camX, -world.camY);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, WORLD, WORLD);
      const tile = 80;
      for (let y = 0; y < WORLD; y += tile) {
        for (let x = 0; x < WORLD; x += tile) {
          ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? board : wash;
          ctx.fillRect(x, y, tile - 2, tile - 2);
        }
      }
      for (const post of world.posts) {
        ctx.fillStyle = tone("--color-muted");
        ctx.beginPath();
        ctx.arc(post.x, post.y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const bell of world.bells) {
        ctx.strokeStyle = bell.rung ? tone("--color-accent") : tone("--color-fg");
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bell.x, bell.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bell.x, bell.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(world.x, world.y);
      ctx.rotate(world.facing);
      ctx.fillStyle = tone("--color-accent");
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, 10);
      ctx.lineTo(-12, -10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Equal", "Minus"].includes(
          event.code,
        )
      ) {
        event.preventDefault();
      }
      keysRef.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const clear = () => {
      keysRef.current.clear();
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      if (window.__controlsTest === probe) delete window.__controlsTest;
    };
  }, []);

  const hold = (code: string, down: boolean) => {
    if (down) keysRef.current.add(code);
    else keysRef.current.delete(code);
  };

  const done = rung >= 6;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-4 sm:px-6">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            <Link to="/">Slipway</Link>
            {" · walk"}
          </p>
          <h1 className="font-sans text-4xl text-fg">Slip</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          {done ? "The pier is awake" : `${rung} / 6 bells`}
        </p>
      </header>
      <canvas ref={canvasRef} className="playfield" width={960} height={540} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          Walk with W A S D, the arrows, or the pads. The wedge points where you are headed. A is left on the
          boards, D is right. Plus and minus change how close the camera sits. Posts stop you. Walk into a ring
          to sound it.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <span />
          <Hold label="Up" code="KeyW" onHold={hold} />
          <Hold label="Near" code="Equal" onHold={hold} />
          <Hold label="Left" code="KeyA" onHold={hold} />
          <Hold label="Down" code="KeyS" onHold={hold} />
          <Hold label="Right" code="KeyD" onHold={hold} />
          <span />
          <Hold label="Far" code="Minus" onHold={hold} />
          <span />
        </div>
      </div>
    </main>
  );
}

function Hold({
  label,
  code,
  onHold,
}: {
  label: string;
  code: string;
  onHold: (code: string, down: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="min-h-11 rounded-card border border-line bg-surface px-3 py-3 font-mono text-xs uppercase tracking-widest text-fg"
      onPointerDown={(event) => {
        event.preventDefault();
        onHold(code, true);
      }}
      onPointerUp={() => onHold(code, false)}
      onPointerLeave={() => onHold(code, false)}
      onPointerCancel={() => onHold(code, false)}
    >
      {label}
    </button>
  );
}
