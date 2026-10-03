export const RELAYS = [
  {
    id: "harbor",
    name: "Harbor Gate",
    district: "Docks",
    critical: true,
    note: "The undersea cable comes ashore here.",
  },
  {
    id: "vault",
    name: "Cold Vault",
    district: "Records",
    critical: true,
    note: "City ledgers sit on a chilled rack.",
  },
  {
    id: "switch",
    name: "Switchyard",
    district: "Rail",
    critical: false,
    note: "Signal boxes along the freight spine.",
  },
  {
    id: "beacon",
    name: "Beacon",
    district: "Headland",
    critical: false,
    note: "Weather radio and the pilot channel.",
  },
  {
    id: "archive",
    name: "Archive Stack",
    district: "Library",
    critical: false,
    note: "Public memory on a tired rack.",
  },
  {
    id: "clinic",
    name: "Night Clinic",
    district: "Ward",
    critical: true,
    note: "After-hours charts and the paging line.",
  },
  {
    id: "exchange",
    name: "Exchange",
    district: "Market",
    critical: false,
    note: "The morning price feed.",
  },
  {
    id: "tower",
    name: "Hill Tower",
    district: "Civic",
    critical: true,
    note: "The mesh's high site over the roofs.",
  },
  {
    id: "pier",
    name: "Pier Shed",
    district: "Wharf",
    critical: false,
    note: "Cameras trained on the loading doors.",
  },
] as const;

export type RelayId = (typeof RELAYS)[number]["id"];
export type Side = "razor" | "keel";
export type Role = Side | "gallery";
export type ActionId = "chart" | "shear" | "take" | "mend" | "seal" | "lure" | "anchor";
export type Owner = "open" | Side;

export type Relay = {
  id: RelayId;
  owner: Owner;
  integrity: number;
  shielded: boolean;
  decoy: boolean;
  revealed: boolean;
};

export type LogLine = { id: number; text: string; tone: "note" | Side };

export type Match = {
  callsign: string;
  rival: string;
  role: Role;
  human: Side | null;
  round: number;
  maxRounds: number;
  next: Side;
  bandwidth: Record<Side, number>;
  heat: Record<Side, number>;
  relays: Relay[];
  log: LogLine[];
  seq: number;
  phase: "play" | "end";
  winner: Side | "draw" | null;
  reason: string;
  rng: number;
};

export const BAND_CAP = 5;
const REGEN = 2;
const HEAT_LOCK = 100;

export const ACTIONS: Record<
  ActionId,
  { label: string; cost: number; hint: string; side: Side }
> = {
  chart: {
    label: "Chart",
    cost: 1,
    hint: "Mark a relay so it can be cut or taken.",
    side: "razor",
  },
  shear: {
    label: "Shear",
    cost: 3,
    hint: "Cut a charted relay. A lure springs. A plate glances.",
    side: "razor",
  },
  take: {
    label: "Take",
    cost: 3,
    hint: "Seize a charted relay at 40 integrity or less.",
    side: "razor",
  },
  mend: {
    label: "Mend",
    cost: 1,
    hint: "Restore 26 integrity on any relay.",
    side: "keel",
  },
  seal: {
    label: "Seal",
    cost: 2,
    hint: "Raise a plate. The next shear mostly glances.",
    side: "keel",
  },
  lure: {
    label: "Lure",
    cost: 2,
    hint: "Trap the next shear. It deals no cut.",
    side: "keel",
  },
  anchor: {
    label: "Anchor",
    cost: 3,
    hint: "Claim a steady relay, 62 integrity or higher.",
    side: "keel",
  },
};

const RAZOR_ACTIONS: ActionId[] = ["chart", "shear", "take"];
const KEEL_ACTIONS: ActionId[] = ["mend", "seal", "lure", "anchor"];

const RIVALS = ["Nia Voss", "Calder Finch", "Jun Park", "Imani Ade"] as const;

export function relayInfo(id: RelayId) {
  return RELAYS.find((relay) => relay.id === id) ?? RELAYS[0];
}

export function sideActions(side: Side): ActionId[] {
  return side === "razor" ? RAZOR_ACTIONS : KEEL_ACTIONS;
}

export function countOwned(match: Match, owner: Owner) {
  return match.relays.filter((relay) => relay.owner === owner).length;
}

export function scoreFor(match: Match, side: Side) {
  const held = countOwned(match, side);
  const bonus = match.winner === side ? 40 : match.winner === "draw" ? 12 : 0;
  return held * 8 + bonus + Math.max(0, match.maxRounds - match.round);
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roll(seed: number) {
  let a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: a >>> 0 };
}

function other(side: Side): Side {
  return side === "razor" ? "keel" : "razor";
}

function who(match: Match, side: Side) {
  if (match.human === side) return match.callsign;
  return match.rival;
}

function pushLog(match: Match, tone: LogLine["tone"], text: string): Match {
  const line: LogLine = { id: match.seq + 1, text, tone };
  return { ...match, seq: line.id, log: [...match.log.slice(-23), line] };
}

function withRelay(match: Match, id: RelayId, patch: (relay: Relay) => Relay): Match {
  return {
    ...match,
    relays: match.relays.map((relay) => (relay.id === id ? patch(relay) : relay)),
  };
}

export function illegal(match: Match, side: Side, id: RelayId, action: ActionId): string | null {
  if (match.phase === "end") return "The cable is closed.";
  if (ACTIONS[action].side !== side) return "Wrong bench.";
  const relay = match.relays.find((item) => item.id === id);
  if (!relay) return "No such relay.";
  if (match.bandwidth[side] < ACTIONS[action].cost) return "Not enough band.";
  if (action === "chart" && relay.revealed) return "Already charted.";
  if (action === "shear" && !relay.revealed) return "Chart it first.";
  if (action === "shear" && relay.owner === "razor") return "Already yours.";
  if (action === "take" && !relay.revealed) return "Chart it first.";
  if (action === "take" && relay.owner === "razor") return "Already yours.";
  if (action === "take" && relay.shielded) return "A plate is up.";
  if (action === "take" && relay.integrity > 40) return "Still too solid.";
  if (action === "mend" && relay.integrity >= 100) return "Nothing to mend.";
  if (action === "seal" && relay.shielded) return "Already plated.";
  if (action === "lure" && relay.decoy) return "A lure is already set.";
  if (action === "anchor" && relay.owner === "keel") return "Already held.";
  if (action === "anchor" && relay.integrity < 62) return "Too shaken to anchor.";
  if (action === "anchor" && relay.shielded && relay.owner === "razor") return "A plate is up.";
  return null;
}

function spend(match: Match, side: Side, action: ActionId, heat: number): Match {
  return {
    ...match,
    bandwidth: { ...match.bandwidth, [side]: match.bandwidth[side] - ACTIONS[action].cost },
    heat: { ...match.heat, [side]: Math.min(140, match.heat[side] + heat) },
  };
}

function apply(match: Match, side: Side, action: ActionId, id: RelayId): Match {
  const relay = match.relays.find((item) => item.id === id);
  if (!relay) return match;
  const name = relayInfo(id).name;
  const actor = who(match, side);

  if (action === "chart") {
    return pushLog(
      withRelay(spend(match, side, action, 3), id, (item) => ({ ...item, revealed: true })),
      side,
      `${actor} charts ${name}.`,
    );
  }

  if (action === "shear") {
    if (relay.decoy) {
      return pushLog(
        withRelay(spend(match, side, action, 22), id, (item) => ({ ...item, decoy: false })),
        side,
        `${actor} shears ${name}. The lure answers. No cut.`,
      );
    }
    if (relay.shielded) {
      const integrity = Math.max(0, relay.integrity - 8);
      return pushLog(
        withRelay(spend(match, side, action, 10), id, (item) => ({
          ...item,
          shielded: false,
          integrity,
        })),
        side,
        `${actor} shears ${name}. The plate glances, then drops.`,
      );
    }
    const integrity = Math.max(0, relay.integrity - 28);
    return pushLog(
      withRelay(spend(match, side, action, 14), id, (item) => ({ ...item, integrity })),
      side,
      `${actor} shears ${name} down to ${integrity}.`,
    );
  }

  if (action === "take") {
    return pushLog(
      withRelay(spend(match, side, action, 10), id, (item) => ({
        ...item,
        owner: "razor",
        integrity: 64,
        decoy: false,
        shielded: false,
      })),
      side,
      `${actor} takes ${name}.`,
    );
  }

  if (action === "mend") {
    const integrity = Math.min(100, relay.integrity + 26);
    return pushLog(
      withRelay(spend(match, side, action, 2), id, (item) => ({ ...item, integrity })),
      side,
      `${actor} mends ${name} to ${integrity}.`,
    );
  }

  if (action === "seal") {
    return pushLog(
      withRelay(spend(match, side, action, 5), id, (item) => ({ ...item, shielded: true })),
      side,
      `${actor} seals ${name}.`,
    );
  }

  if (action === "lure") {
    return pushLog(
      withRelay(spend(match, side, action, 6), id, (item) => ({ ...item, decoy: true })),
      side,
      `${actor} sets a lure on ${name}.`,
    );
  }

  return pushLog(
    withRelay(spend(match, side, action, 8), id, (item) => ({
      ...item,
      owner: "keel",
      shielded: false,
      decoy: false,
    })),
    side,
    `${actor} anchors ${name}.`,
  );
}

function judge(match: Match, timed: boolean): { winner: Side | "draw"; reason: string } | null {
  const razor = countOwned(match, "razor");
  const keel = countOwned(match, "keel");
  if (razor >= 5 && keel >= 5) {
    return { winner: "draw", reason: "Both benches crossed five relays at once." };
  }
  if (razor >= 5) return { winner: "razor", reason: "Razor holds five relays." };
  if (keel >= 5) return { winner: "keel", reason: "Keel holds five relays." };
  if (!timed) return null;
  if (razor === keel) return { winner: "draw", reason: "Twelve cables. The mesh stays split." };
  if (razor > keel) return { winner: "razor", reason: "Time. Razor holds more of the mesh." };
  return { winner: "keel", reason: "Time. Keel holds more of the mesh." };
}

function closeIfNeeded(match: Match, timed: boolean): Match {
  const verdict = judge(match, timed);
  if (!verdict) return match;
  return { ...match, phase: "end", winner: verdict.winner, reason: verdict.reason };
}

function choose(match: Match, side: Side) {
  let best: { id: RelayId; action: ActionId; score: number } | null = null;
  const actions = sideActions(side);
  for (const relay of match.relays) {
    for (const action of actions) {
      if (illegal(match, side, relay.id, action)) continue;
      let score = 0;
      if (action === "take") score = 120 + (relayInfo(relay.id).critical ? 10 : 0);
      if (action === "anchor") score = 100 + (relayInfo(relay.id).critical ? 20 : 0) - relay.integrity / 10;
      if (action === "shear") {
        score = 110 - relay.integrity + (relayInfo(relay.id).critical ? 12 : 0);
        if (relay.decoy) score = 8;
        if (relay.shielded) score = 18;
      }
      if (action === "chart") score = (relayInfo(relay.id).critical ? 46 : 24) + (100 - relay.integrity) / 8;
      if (action === "mend") {
        score = relay.integrity < 48 ? 64 - relay.integrity : 0;
        if (relay.integrity <= 40) score += 36;
        if (relayInfo(relay.id).critical) score += 14;
      }
      if (action === "seal") {
        score = relay.revealed && relay.owner !== "razor" ? 36 : 12;
        if (relayInfo(relay.id).critical) score += 10;
      }
      if (action === "lure") {
        score = relay.revealed && relay.integrity <= 70 && relay.owner !== "razor" ? 44 : 8;
      }
      if (score <= 0) continue;
      if (!best || score > best.score) best = { id: relay.id, action, score };
    }
  }
  return best;
}

function runSide(match: Match, side: Side, action: ActionId | null, id: RelayId | null): Match {
  if (match.phase === "end") return match;
  const actor = who(match, side);
  if (match.heat[side] >= HEAT_LOCK) {
    return pushLog(
      { ...match, heat: { ...match.heat, [side]: 36 } },
      "note",
      `${actor} sits out. The bench cools.`,
    );
  }
  if (action && id) {
    if (illegal(match, side, id, action)) return match;
    return closeIfNeeded(apply(match, side, action, id), false);
  }
  const pick = choose(match, side);
  if (!pick) return pushLog(match, "note", `${actor} holds.`);
  return closeIfNeeded(apply(match, side, pick.action, pick.id), false);
}

function tick(match: Match): Match {
  const bandwidth: Record<Side, number> = {
    razor: Math.min(BAND_CAP, match.bandwidth.razor + REGEN),
    keel: Math.min(BAND_CAP, match.bandwidth.keel + REGEN),
  };
  const round = match.round + 1;
  return closeIfNeeded({ ...match, bandwidth, round }, round > match.maxRounds);
}

export function createMatch(callsign: string, role: Role): Match {
  const name = callsign.trim().slice(0, 18) || "Unlisted";
  let rng = hash(`${name}:${role}:${Date.now()}`) || 1;
  const rivalRoll = roll(rng);
  rng = rivalRoll.seed;
  const rival = RIVALS[Math.floor(rivalRoll.value * RIVALS.length) % RIVALS.length] ?? RIVALS[0];

  const relays: Relay[] = RELAYS.map((info) => {
    const spun = roll(rng);
    rng = spun.seed;
    let integrity = 58 + Math.floor(spun.value * 28);
    let owner: Owner = "open";
    let revealed = false;
    if (info.id === "switch") {
      owner = "razor";
      integrity = 60;
    }
    if (info.id === "pier") {
      owner = "keel";
      integrity = 80;
    }
    if (info.id === "archive") {
      revealed = true;
      integrity = 50;
    }
    return {
      id: info.id,
      owner,
      integrity,
      shielded: false,
      decoy: false,
      revealed,
    };
  });

  const human = role === "gallery" ? null : role;
  let match: Match = {
    callsign: name,
    rival,
    role,
    human,
    round: 1,
    maxRounds: 12,
    next: "razor",
    bandwidth: { razor: BAND_CAP, keel: BAND_CAP },
    heat: { razor: 0, keel: 0 },
    relays,
    log: [],
    seq: 0,
    phase: "play",
    winner: null,
    reason: "",
    rng,
  };
  match = pushLog(
    match,
    "note",
    human
      ? `${name} takes the ${human} bench. ${rival} answers across the cable.`
      : `Gallery open. ${rival} is on the wire with the city benches.`,
  );
  return match;
}

export function playHuman(match: Match, action: ActionId | "cool", id: RelayId): Match {
  if (!match.human || match.phase === "end") return match;
  let next = runSide(match, match.human, action === "cool" ? null : action, action === "cool" ? null : id);
  if (next.phase === "end") return next;
  next = runSide(next, other(match.human), null, null);
  if (next.phase === "end") return next;
  return tick(next);
}

export function stepGallery(match: Match): Match {
  if (match.human || match.phase === "end") return match;
  let next = runSide(match, match.next, null, null);
  if (next.phase === "end") return next;
  const finishedKeel = match.next === "keel";
  next = { ...next, next: other(match.next) };
  if (!finishedKeel) return next;
  return tick(next);
}
