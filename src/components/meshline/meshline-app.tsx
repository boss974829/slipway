import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Anchor,
  Fish,
  Flag,
  Flame,
  Radio,
  Scan,
  Shield,
  Wrench,
  Zap,
} from "lucide-react";
import {
  ACTIONS,
  BAND_CAP,
  type ActionId,
  type Match,
  type Relay,
  type RelayId,
  type Role,
  countOwned,
  createMatch,
  illegal,
  playHuman,
  relayInfo,
  scoreFor,
  sideActions,
  stepGallery,
} from "@/lib/meshline/engine";

const STORAGE_KEY = "meshline-best";

const ICONS = {
  chart: Scan,
  shear: Zap,
  take: Flag,
  mend: Wrench,
  seal: Shield,
  lure: Fish,
  anchor: Anchor,
} as const;

const ROLES: { id: Role; title: string; copy: string }[] = [
  {
    id: "razor",
    title: "Razor",
    copy: "Chart a relay, shear it open, then take it. Heat climbs when you cut.",
  },
  {
    id: "keel",
    title: "Keel",
    copy: "Mend what shakes, plate the obvious cut, lure the greedy shear, anchor what is steady.",
  },
  {
    id: "gallery",
    title: "Gallery",
    copy: "Watch both benches run the evening cable. Step it, or let it play.",
  },
];

function loadBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    /* ignore private mode */
  }
}

function ownerLabel(owner: Relay["owner"]) {
  if (owner === "open") return "Open";
  if (owner === "razor") return "Razor";
  return "Keel";
}

function Pips({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: BAND_CAP }, (_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${index < value ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </span>
      <span className="sr-only">
        {value} of {BAND_CAP}
      </span>
    </div>
  );
}

function Heat({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted">
        <span className="inline-flex items-center gap-1">
          <Flame className="size-3.5" aria-hidden />
          Heat
        </span>
        <span>{Math.min(100, value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RelayCard({
  relay,
  selected,
  onSelect,
}: {
  relay: Relay;
  selected: boolean;
  onSelect: (id: RelayId) => void;
}) {
  const info = relayInfo(relay.id);
  return (
    <button
      type="button"
      onClick={() => onSelect(relay.id)}
      aria-pressed={selected}
      className={`flex min-h-28 flex-col items-start rounded-card border px-3 py-3 text-left transition-colors ${
        selected ? "border-accent bg-surface-2" : "border-line bg-surface hover:border-muted"
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        <span>{info.district}</span>
        {info.critical ? <span className="text-accent">Key</span> : null}
      </span>
      <span className="mt-2 font-sans text-lg leading-tight text-fg">{info.name}</span>
      <span className="mt-auto flex w-full items-end justify-between gap-2 pt-3">
        <span className="font-mono text-xs uppercase tracking-widest text-fg">{ownerLabel(relay.owner)}</span>
        <span className="font-mono text-xs text-muted">{relay.integrity}</span>
      </span>
      <span className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <span
          className={`block h-full ${relay.owner === "open" ? "bg-muted" : "bg-accent"}`}
          style={{ width: `${relay.integrity}%` }}
        />
      </span>
      <span className="mt-2 flex gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        {relay.revealed ? <span>Charted</span> : <span>Dark</span>}
        {relay.shielded ? <span>Plate</span> : null}
        {relay.decoy ? <span>Lure</span> : null}
      </span>
    </button>
  );
}

function Briefing({
  callsign,
  role,
  best,
  onCallsign,
  onRole,
  onStart,
}: {
  callsign: string;
  role: Role;
  best: number;
  onCallsign: (value: string) => void;
  onRole: (role: Role) => void;
  onStart: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-widest text-muted">
        <span className="inline-flex items-center gap-2 text-fg">
          <Radio className="size-4 text-accent" aria-hidden />
          Meshline
        </span>
        <Link to="/" className="text-muted">
          Slipway
        </Link>
      </header>

      <section className="mt-10 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Evening cable</p>
        <h1 className="mt-3 font-sans text-5xl leading-none text-fg sm:text-6xl">
          Hold the fiber. Spend the heat.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          Nine relays tie a harbor city together. Razor cuts and takes. Keel mends, plates, and anchors.
          Five relays win the night. Twelve cables, then the count.
        </p>
      </section>

      <label className="mt-8 block max-w-md">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">Callsign</span>
        <input
          value={callsign}
          maxLength={18}
          onChange={(event) => onCallsign(event.target.value)}
          placeholder="Unlisted"
          className="mt-2 w-full rounded-card border border-line bg-surface px-4 py-3 text-fg outline-none placeholder:text-muted"
        />
      </label>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {ROLES.map((item) => {
          const active = role === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onRole(item.id)}
              className={`rounded-card border px-4 py-4 text-left ${
                active ? "border-accent bg-surface-2" : "border-line bg-surface"
              }`}
            >
              <span className="font-sans text-2xl text-fg">{item.title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted">{item.copy}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onStart}
          className="rounded-card bg-accent px-5 py-3 font-mono text-sm uppercase tracking-widest text-accent-ink"
        >
          Open the court
        </button>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Best mark {best}</p>
      </div>
    </main>
  );
}

function Court({
  match,
  running,
  onSelect,
  selected,
  onAct,
  onStep,
  onToggleRun,
  onLeave,
  onRematch,
}: {
  match: Match;
  running: boolean;
  selected: RelayId;
  onSelect: (id: RelayId) => void;
  onAct: (action: ActionId | "cool") => void;
  onStep: () => void;
  onToggleRun: () => void;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const relay = match.relays.find((item) => item.id === selected) ?? match.relays[0];
  const info = relayInfo(relay.id);
  const human = match.human;
  const yourHeat = human ? match.heat[human] : 0;
  const locked = Boolean(human && yourHeat >= 100 && match.phase === "play");
  const actions = human ? sideActions(human) : [];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-4 border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">
              <Link to="/" className="text-muted">
                Slipway
              </Link>
              {" · "}Cable {Math.min(match.round, match.maxRounds)} / {match.maxRounds}
            </p>
            <h1 className="font-sans text-3xl text-fg">
              {match.callsign}
              <span className="text-muted"> · {match.role}</span>
            </h1>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Razor {countOwned(match, "razor")} · Open {countOwned(match, "open")} · Keel{" "}
            {countOwned(match, "keel")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {human ? (
            <>
              <Pips value={match.bandwidth[human]} label="Band" />
              <Heat value={yourHeat} />
            </>
          ) : (
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <Pips value={match.bandwidth.razor} label="Razor" />
              <Pips value={match.bandwidth.keel} label="Keel" />
            </div>
          )}
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {match.relays.map((item) => (
              <RelayCard key={item.id} relay={item} selected={item.id === selected} onSelect={onSelect} />
            ))}
          </div>
          <ol className="mt-4 max-h-52 space-y-2 overflow-auto rounded-card border border-line bg-surface p-3">
            {match.log.map((line) => (
              <li key={line.id} className="font-mono text-xs leading-relaxed text-muted">
                <span className={line.tone === "note" ? "text-muted" : "text-fg"}>{line.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {info.district}
            {info.critical ? " · key site" : ""}
          </p>
          <h2 className="font-sans text-3xl leading-none text-fg">{info.name}</h2>
          <p className="text-sm leading-relaxed text-muted">{info.note}</p>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs uppercase tracking-widest text-muted">
            <div className="rounded-card bg-surface-2 px-3 py-2">
              <dt>Held by</dt>
              <dd className="mt-1 text-fg">{ownerLabel(relay.owner)}</dd>
            </div>
            <div className="rounded-card bg-surface-2 px-3 py-2">
              <dt>Integrity</dt>
              <dd className="mt-1 text-fg">{relay.integrity}</dd>
            </div>
          </dl>

          {match.phase === "end" ? (
            <EndNote match={match} onLeave={onLeave} onRematch={onRematch} />
          ) : human ? (
            <div className="grid gap-2">
              {locked ? (
                <button
                  type="button"
                  onClick={() => onAct("cool")}
                  className="rounded-card bg-accent px-4 py-3 text-left font-mono text-sm uppercase tracking-widest text-accent-ink"
                >
                  Sit this cable
                </button>
              ) : (
                actions.map((action) => {
                  const meta = ACTIONS[action];
                  const why = illegal(match, human, relay.id, action);
                  const Icon = ICONS[action];
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={Boolean(why)}
                      onClick={() => onAct(action)}
                      className="rounded-card border border-line px-3 py-3 text-left enabled:hover:border-accent disabled:opacity-40"
                    >
                      <span className="flex items-center justify-between gap-2 text-fg">
                        <span className="inline-flex items-center gap-2 font-sans text-lg">
                          <Icon className="size-4 text-accent" aria-hidden />
                          {meta.label}
                        </span>
                        <span className="font-mono text-xs uppercase tracking-widest text-muted">
                          {meta.cost} band
                        </span>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{why ?? meta.hint}</span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={onStep}
                className="rounded-card bg-accent px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent-ink"
              >
                Step the cable
              </button>
              <button
                type="button"
                onClick={onToggleRun}
                className="rounded-card border border-line px-4 py-3 font-mono text-sm uppercase tracking-widest text-fg"
              >
                {running ? "Pause" : "Let it run"}
              </button>
              <p className="text-sm leading-relaxed text-muted">
                Next bench: {match.next}. Rival on the wire: {match.rival}.
              </p>
            </div>
          )}

          {match.phase === "play" ? (
            <button
              type="button"
              onClick={onLeave}
              className="mt-1 font-mono text-xs uppercase tracking-widest text-muted"
            >
              Leave the desk
            </button>
          ) : null}

          <details className="text-sm leading-relaxed text-muted">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-fg">
              Field notes
            </summary>
            <p className="mt-2">
              Razor must chart before a shear or a take. A take needs 40 integrity or less and no plate.
              Keel anchors at 62 or higher. Five relays end it. At heat 100 you sit a cable.
            </p>
          </details>
        </aside>
      </div>
    </main>
  );
}

function EndNote({
  match,
  onLeave,
  onRematch,
}: {
  match: Match;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const you = match.human;
  const won = you && match.winner === you;
  const drew = match.winner === "draw";
  const title = !you
    ? match.winner === "draw"
      ? "The mesh stays split."
      : `${match.winner === "razor" ? "Razor" : "Keel"} keeps the night.`
    : won
      ? "The mesh answers."
      : drew
        ? "Neither bench keeps it."
        : `${match.rival} holds the cable.`;
  const score = you ? scoreFor(match, you) : 0;

  return (
    <div className="grid gap-3">
      <h3 className="font-sans text-3xl leading-none text-fg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{match.reason}</p>
      {you ? (
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Mark {score}</p>
      ) : null}
      <button
        type="button"
        onClick={onRematch}
        className="rounded-card bg-accent px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent-ink"
      >
        Run it again
      </button>
      <button
        type="button"
        onClick={onLeave}
        className="rounded-card border border-line px-4 py-3 font-mono text-sm uppercase tracking-widest text-fg"
      >
        Change bench
      </button>
    </div>
  );
}

export function MeshlineApp() {
  const [callsign, setCallsign] = useState("");
  const [role, setRole] = useState<Role>("razor");
  const [best, setBest] = useState(0);
  const [match, setMatch] = useState<Match | null>(null);
  const [selected, setSelected] = useState<RelayId>("archive");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setBest(loadBest());
  }, []);

  useEffect(() => {
    if (!match || match.phase !== "end" || !match.human || !match.winner) return;
    const score = scoreFor(match, match.human);
    if (score > best) {
      setBest(score);
      saveBest(score);
    }
  }, [match, best]);

  useEffect(() => {
    if (!running || !match || match.role !== "gallery" || match.phase === "end") return;
    const timer = window.setTimeout(() => {
      setMatch((current) => (current ? stepGallery(current) : current));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [running, match]);

  if (!match) {
    return (
      <Briefing
        callsign={callsign}
        role={role}
        best={best}
        onCallsign={setCallsign}
        onRole={setRole}
        onStart={() => {
          const next = createMatch(callsign, role);
          setSelected("archive");
          setRunning(false);
          setMatch(next);
        }}
      />
    );
  }

  return (
    <Court
      match={match}
      running={running}
      selected={selected}
      onSelect={setSelected}
      onAct={(action) => setMatch((current) => (current ? playHuman(current, action, selected) : current))}
      onStep={() => {
        setRunning(false);
        setMatch((current) => (current ? stepGallery(current) : current));
      }}
      onToggleRun={() => setRunning((value) => !value)}
      onLeave={() => {
        setRunning(false);
        setMatch(null);
      }}
      onRematch={() => {
        setRunning(false);
        setSelected("archive");
        setMatch(createMatch(match.callsign, match.role));
      }}
    />
  );
}

