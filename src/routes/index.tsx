import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const GAMES = [
  {
    to: "/meshline",
    title: "Meshline",
    kind: "Desk",
    copy: "Two benches, nine relays. Chart, shear, mend, and hold five.",
  },
  {
    to: "/kiln",
    title: "Kiln",
    kind: "Stack",
    copy: "Crates fall in the drying shed. Fill a row and it burns off.",
  },
  {
    to: "/eel",
    title: "Eel",
    kind: "Grid",
    copy: "A lantern eel on the night grid. Eat the glow. Do not knot.",
  },
  {
    to: "/slip",
    title: "Slip",
    kind: "Walk",
    copy: "Cross the pier. The camera lags behind you. Ring every bell.",
  },
] as const;

export const Route = createFileRoute("/")({
  component: Arcade,
});

function Arcade() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-widest text-muted">
        <span className="text-fg">Slipway</span>
        <span>Four games</span>
      </header>
      <section className="mt-10 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Night pier</p>
        <h1 className="mt-3 font-sans text-5xl leading-none text-fg sm:text-6xl">Pick a bench.</h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          A strategy desk, a crate stack, a lantern eel, and a walk along the boards. Each one is its own
          game. None of them keep a score anywhere but this browser.
        </p>
      </section>
      <Reel />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {GAMES.map((game) => (
          <Link
            key={game.to}
            to={game.to}
            className="rounded-card border border-line bg-surface px-4 py-4 hover:border-accent"
          >
            <span className="font-mono text-xs uppercase tracking-widest text-accent">{game.kind}</span>
            <span className="mt-2 block font-sans text-3xl text-fg">{game.title}</span>
            <span className="mt-2 block text-sm leading-relaxed text-muted">{game.copy}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

function Reel() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) video.pause();
  }, []);

  return (
    <video
      ref={ref}
      className="mt-8 block w-full rounded-card border border-line"
      src="/slipway-reel.mp4"
      muted
      loop
      playsInline
      autoPlay
      aria-label="A night glide along the pier"
    />
  );
}
