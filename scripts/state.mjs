import { MOD, STEPS, KINDS, SOURCES, PLANS, FACTORS, LOADS, POSITIONS, byId } from "./data.mjs";

/* ------------------------------------------------------------------
 * Live-Zustand: liegt in einer Welt-Einstellung. Nur die aktive SL
 * schreibt; andere Clients (Beamer) schicken Wünsche per Socket.
 * ------------------------------------------------------------------ */

export const emptyState = () => ({
  mode: "off",          // off | wizard | score
  step: 0,
  draft: {
    kind: null, source: null, name: "",
    target: "", tier: null,
    plan: null, detail: "",
    crew: [],           // [{id, name}] – Schnappschuss beim Start
    loads: {},          // actorId -> light|normal|heavy
    factors: {}         // "0+" -> true
  },
  roll: null,           // {dice, pool, value, key}
  scoreId: null,
  score: null,
  prepId: null,         // verknüpfte Vorbereitung (Inhalt nur bei der SL)          // Anzeige-Schnappschuss der laufenden Score-Seite
  rev: 0
});

export function getState() {
  const raw = game.settings.get(MOD, "live") ?? {};
  return foundry.utils.mergeObject(emptyState(), foundry.utils.deepClone(raw), { inplace: false });
}

let queue = Promise.resolve();
/** Nur SL: Zustand ändern. Aufrufe werden nacheinander abgearbeitet. */
export function setState(mutator) {
  queue = queue.then(async () => {
    const s = getState();
    await mutator(s);
    s.rev = (s.rev ?? 0) + 1;
    await game.settings.set(MOD, "live", s);
  }).catch((err) => console.error(`${MOD} | setState`, err));
  return queue;
}

const PLAYER_FIELDS = new Set(["draft.kind", "draft.source", "draft.name", "draft.target", "draft.tier", "draft.plan", "draft.detail"]);

/** Wird auf dem SL-Client ausgeführt. fromGM=false: Wunsch vom Beamer/Spieler. */
export function applyOp(op, args = {}, fromGM = true) {
  return setState((s) => {
    switch (op) {
      case "set": {
        if (!PLAYER_FIELDS.has(args.path)) return;
        let v = args.value;
        if (args.path === "draft.tier") v = v === "" || v == null ? null : Math.max(0, Math.min(6, Number(v) || 0));
        else if (typeof v === "string") v = v.slice(0, 200);
        // Auswahl erneut anklicken = abwählen
        if (args.toggle && foundry.utils.getProperty(s, args.path) === v) v = null;
        foundry.utils.setProperty(s, args.path, v);
        return;
      }
      case "load": {
        if (!byId(LOADS, args.value) || !s.draft.crew.some((c) => c.id === args.actor)) return;
        s.draft.loads[args.actor] = s.draft.loads[args.actor] === args.value ? null : args.value;
        return;
      }
      case "factor": {
        if (!/^\d+[+-]$/.test(args.key ?? "") || !FACTORS[parseInt(args.key)]) return;
        s.draft.factors[args.key] = !s.draft.factors[args.key];
        s.roll = null;
        return;
      }
    }
    if (!fromGM) return;
    switch (op) {
      case "step": s.step = Math.max(0, Math.min(STEPS.length - 1, Number(args.value))); return;
      case "mode": s.mode = args.value; return;
    }
  });
}

/** Von jedem Client aus: Änderung anstoßen. */
export function request(op, args = {}) {
  if (game.user.isGM) return applyOp(op, args, true);
  game.socket.emit(`module.${MOD}`, { type: "op", op, args, userId: game.user.id });
}

export function registerSocket() {
  game.socket.on(`module.${MOD}`, (data) => {
    if (data?.type !== "op" || game.user !== game.users.activeGM) return;
    const sender = game.users.get(data.userId);
    applyOp(data.op, data.args, !!sender?.isGM);
  });
}

/* ------------------------------------------------------------------
 * Engagement-Pool und Ergebnis
 * ------------------------------------------------------------------ */

export function poolOf(draft) {
  let pool = 1;
  for (const [k, on] of Object.entries(draft.factors ?? {})) if (on) pool += k.endsWith("+") ? 1 : -1;
  return pool;
}

export function evaluateDice(pool, dice) {
  const zero = pool <= 0;
  const value = zero ? Math.min(...dice) : Math.max(...dice);
  const crit = !zero && dice.filter((d) => d === 6).length >= 2;
  const key = crit ? 3 : value === 6 ? 2 : value >= 4 ? 1 : 0;
  return { value, key };
}

/* ------------------------------------------------------------------
 * Anzeige-Kontext – gemeinsam für SL-Fenster und Tisch-Ansicht
 * ------------------------------------------------------------------ */

export function buildContext(s = getState()) {
  const d = s.draft;
  const step = STEPS[s.step] ?? STEPS[0];
  const plan = byId(PLANS, d.plan);
  const pool = poolOf(d);

  const ctx = {
    mode: s.mode,
    isWizard: s.mode === "wizard",
    isScore: s.mode === "score",
    step, stepIndex: s.step,
    isFirst: s.step === 0, isLast: s.step === STEPS.length - 1,
    nextLabel: STEPS[s.step + 1]?.label ?? "",
    steps: STEPS.map((x, i) => ({ ...x, n: i + 1, active: i === s.step, done: i < s.step, index: i })),
    [`is_${step.id}`]: true,
    draft: d,
    kinds: KINDS.map((k) => ({ ...k, selected: d.kind === k.id })),
    sources: SOURCES.map((k) => ({ ...k, selected: d.source === k.id })),
    kindLabel: byId(KINDS, d.kind)?.label ?? "",
    sourceLabel: byId(SOURCES, d.source)?.label ?? "",
    tiers: [0, 1, 2, 3, 4, 5, 6].map((t) => ({ value: t, label: ["0", "I", "II", "III", "IV", "V", "VI"][t], selected: d.tier === t })),
    tierLabel: d.tier == null ? "" : ["0", "I", "II", "III", "IV", "V", "VI"][d.tier],
    plans: PLANS.map((p, i) => ({ ...p, selected: d.plan === p.id, tilt: [-1.5, 1, -0.6, 0.8, -1.2, 1.4][i] })),
    plan,
    crew: d.crew.map((c) => ({
      ...c,
      loads: LOADS.map((l) => ({ ...l, selected: d.loads[c.id] === l.id })),
      loadLabel: byId(LOADS, d.loads[c.id])?.label ?? "–"
    })),
    factors: FACTORS.map((f, i) => ({ ...f, i, plusKey: `${i}+`, minusKey: `${i}-`, plusOn: !!d.factors[`${i}+`], minusOn: !!d.factors[`${i}-`] })),
    pool, poolLabel: pool <= 0 ? "0W" : `${pool}W`,
    poolRule: pool <= 0 ? "Pool 0: zwei Würfel, der niedrigere zählt" : "Der höchste Würfel zählt",
    roll: null,
    positions: POSITIONS.map((p) => ({ ...p, selected: false })),
    score: s.score,
    hasDraft: !!(d.kind || d.name || d.target || d.plan)
  };

  if (s.roll) {
    const { value, key } = evaluateDice(s.roll.pool, s.roll.dice);
    let used = false;
    ctx.roll = {
      ...s.roll,
      dice: s.roll.dice.map((v) => { const hit = !used && v === value; if (hit) used = true; return { v, hit }; }),
      position: POSITIONS[key], cut: POSITIONS[key].cut
    };
    ctx.positions = POSITIONS.map((p, i) => ({ ...p, selected: i === key }));
  }

  if (s.score) ctx.scoreView = scoreViewModel(s.score);
  return ctx;
}

export function clockStyle(c) {
  const seg = 360 / c.size;
  return `--seg:${seg}deg;--fill:${c.value * seg}deg`;
}

export function scoreViewModel(sc) {
  const clocks = sc.clocks ?? [];
  const n = clocks.length;
  // Ab 10 Uhren: die 8 zuletzt geänderten groß, der Rest als Textzeile
  const recent = n > 9 ? new Set([...clocks].sort((a, b) => (b.touched ?? 0) - (a.touched ?? 0)).slice(0, 8).map((c) => c.id)) : null;
  const shown = recent ? clocks.filter((c) => recent.has(c.id)) : clocks;
  const rest = recent ? clocks.filter((c) => !recent.has(c.id)) : [];
  return {
    ...sc,
    clocks: shown.map((c) => ({ ...c, style: clockStyle(c), full: c.value >= c.size })),
    clockClass: n <= 2 ? "few" : n <= 6 ? "some" : "many",
    moreClocks: rest.map((c) => `${c.name} ${c.value}/${c.size}`).join(" · "),
    hasClocks: n > 0
  };
}
