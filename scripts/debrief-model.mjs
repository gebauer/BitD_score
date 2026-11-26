import { DEBRIEF_STEPS, OUTCOMES, COIN_SIZES, EXPOSURE, HEAT_MODS, XP_ATTRS, XP_TRIGGERS, CREW_XP } from "./data.mjs";

/* ------------------------------------------------------------------
 * Debrief: Datenmodell, Rechenregeln, erlaubte Änderungen und
 * Anzeige-Kontext. Rein (kein Zugriff auf Foundry-Dokumente), damit
 * state.mjs es ohne Zirkelbezug nutzen kann.
 * ------------------------------------------------------------------ */

export const emptyPcXp = () => ({ insight: 0, prowess: 0, resolve: 0, playbook: 0, beliefs: 0, vice: 0 });

export const emptyDebrief = () => ({
  outcome: null,
  summary: "",
  crewTier: 0,
  targetTier: null,
  quiet: false,
  rep: null,
  coin: null,
  tithe: { boss: "", paid: true, amount: null },
  exposure: 0,
  heatMods: { highProfile: false, hostileTurf: false, war: false, killing: false },
  heat: null,
  heatBefore: null,
  wantedBefore: null,
  entanglement: { rolled: [], name: "", text: "", secret: true },
  status: [],
  pcXp: {},
  crewXp: { crewTrigger: 0, aboveStation: 0, reputation: 0, nature: 0 },
  gmNotes: ""
});

const int = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);
const clamp = (v, lo, hi) => (v === null ? null : Math.max(lo, Math.min(hi, v)));

/** Vorschläge und abgeleitete Werte. Gesetzte Werte (≠ null) gehen vor Vorschlägen. */
export function debriefCalc(d) {
  const crewTier = int(d.crewTier) ?? 0;
  const targetTier = int(d.targetTier) ?? crewTier;
  const repSuggest = d.quiet ? 0 : Math.max(0, 2 + targetTier - crewTier);
  const rep = int(d.rep) ?? repSuggest;
  const coin = int(d.coin) ?? 0;
  const titheSuggest = crewTier + 1;
  const titheOn = !!d.tithe?.boss?.trim() && d.tithe.paid !== false;
  const tithe = titheOn ? (int(d.tithe.amount) ?? titheSuggest) : 0;
  const coinToCrew = Math.max(0, coin - tithe);
  const heatSuggest = (int(d.exposure) ?? 0) + HEAT_MODS.reduce((n, m) => n + (d.heatMods?.[m.id] ? m.value : 0), 0);
  const heat = int(d.heat) ?? heatSuggest;
  const heatBefore = int(d.heatBefore);
  const wantedBefore = int(d.wantedBefore);
  let heatAfter = null, wantedAfter = wantedBefore, overflow = false;
  if (heatBefore !== null) {
    heatAfter = heatBefore + heat;
    if (heatAfter >= 9) { overflow = true; heatAfter -= 9; wantedAfter = (wantedBefore ?? 0) + 1; }
  }
  const columnHeat = heatAfter ?? heat;
  const column = columnHeat <= 3 ? "Heat 0–3" : columnHeat <= 5 ? "Heat 4/5" : "Heat 6+";
  const wanted = wantedAfter ?? 0;
  const entDice = wanted <= 0 ? 2 : Math.min(wanted, 4);
  return { crewTier, targetTier, repSuggest, rep, coin, titheSuggest, titheOn, tithe, coinToCrew,
    heatSuggest, heat, heatBefore, heatAfter, wantedBefore, wantedAfter, overflow, column, columnHeat,
    entDice, entZero: wanted <= 0, entKnown: wantedAfter !== null, hasHeatAfter: heatAfter !== null };
}

/** Wert des Verstrickungswurfs (0 Wanted → niedrigster, sonst höchster). */
export function entanglementValue(dice, zero) {
  if (!dice?.length) return null;
  return zero ? Math.min(...dice) : Math.max(...dice);
}

/* ---------------- Änderungen (vom SL-Fenster oder per Socket vom Beamer) ---------------- */

const STR = (max) => ({ kind: "str", max });
const INT = (lo, hi, nullable = true) => ({ kind: "int", lo, hi, nullable });
const ENUM = (values) => ({ kind: "enum", values });

const FIELDS = {
  "outcome": { ...ENUM(OUTCOMES.map((o) => o.id)), toggle: true },
  "summary": { ...STR(1500), player: true },
  "crewTier": INT(0, 6, false),
  "targetTier": INT(0, 6),
  "rep": INT(0, 20),
  "coin": INT(0, 99),
  "tithe.boss": STR(80),
  "tithe.amount": INT(0, 99),
  "exposure": ENUM(EXPOSURE.map((e) => String(e.value))),
  "heat": INT(0, 20),
  "heatBefore": INT(0, 20),
  "wantedBefore": INT(0, 4),
  "entanglement.name": STR(120),
  "entanglement.text": STR(1500),
  "gmNotes": STR(4000),
  ...Object.fromEntries(CREW_XP.map((x) => [`crewXp.${x.id}`, INT(0, 2, false)]))
};
const TOGGLES = new Set(["quiet", "tithe.paid", "entanglement.secret", ...HEAT_MODS.map((m) => `heatMods.${m.id}`)]);
const STATUS_RE = /^status\.(\d+)\.(faction|delta|note)$/;

function coerce(spec, v) {
  if (spec.kind === "str") return String(v ?? "").slice(0, spec.max);
  if (spec.kind === "enum") return spec.values.includes(String(v)) ? v : undefined;
  const n = int(v);
  if (n === null) return spec.nullable ? null : undefined;
  return clamp(n, spec.lo, spec.hi);
}

/**
 * Änderung am Debrief-Entwurf. `path` ohne „debrief.“-Präfix.
 * @returns {boolean} ob etwas geändert wurde
 */
export function applyDebriefOp(s, op, args, fromGM) {
  const d = s.debrief;
  if (!d || s.mode !== "debrief") return false;
  const path = String(args.path ?? "").replace(/^debrief\./, "");
  const get = (p) => p.split(".").reduce((o, k) => o?.[k], d);
  const set = (p, v) => { const ks = p.split("."); const last = ks.pop(); const o = ks.reduce((o, k) => (o[k] ??= {}), d); o[last] = v; };

  if (op === "dset") {
    const st = path.match(STATUS_RE);
    if (st) {
      if (!fromGM) return false;
      const row = d.status?.[Number(st[1])];
      if (!row) return false;
      row[st[2]] = st[2] === "delta" ? clamp(int(args.value) ?? 0, -3, 3) : String(args.value ?? "").slice(0, st[2] === "note" ? 300 : 80);
      return true;
    }
    const spec = Object.hasOwn(FIELDS, path) ? FIELDS[path] : null;
    if (!spec || (!fromGM && !spec.player)) return false;
    let v = coerce(spec, args.value);
    if (v === undefined) return false;
    if (spec.kind === "enum" && path === "exposure") v = Number(v);
    if (args.toggle && get(path) === v) v = spec.kind === "enum" && path !== "exposure" ? null : v;
    set(path, v);
    return true;
  }
  if (op === "dtoggle") {
    if (!fromGM || !TOGGLES.has(path)) return false;
    set(path, !get(path));
    return true;
  }
  if (op === "xp") {
    const actor = String(args.actor ?? "");
    if (!s.debriefMeta?.crew?.some((c) => c.id === actor)) return false;
    const key = String(args.key ?? "");
    const xp = (d.pcXp[actor] ??= emptyPcXp());
    if (XP_ATTRS.some((a) => a.id === key)) {
      const delta = Number(args.value) === -1 ? -1 : 1;
      xp[key] = clamp((int(xp[key]) ?? 0) + delta, 0, 9);
      return true;
    }
    if (XP_TRIGGERS.some((t) => t.id === key)) {
      const v = clamp(int(args.value) ?? 0, 0, 2);
      xp[key] = xp[key] === v && v > 0 ? v - 1 : v;   // erneut anklicken = eins weniger
      return true;
    }
    return false;
  }
  if (op === "crewxp") {
    if (!fromGM || !CREW_XP.some((x) => x.id === args.key)) return false;
    const v = clamp(int(args.value) ?? 0, 0, 2);
    d.crewXp[args.key] = d.crewXp[args.key] === v && v > 0 ? v - 1 : v;
    return true;
  }
  return false;
}

/* ---------------- Anzeige-Kontext (SL-Fenster und Beamer) ---------------- */

const sumXp = (x) => XP_ATTRS.reduce((n, a) => n + (x[a.id] ?? 0), 0) + XP_TRIGGERS.reduce((n, t) => n + (x[t.id] ?? 0), 0);

export function buildDebriefContext(s) {
  const d = s.debrief ?? emptyDebrief();
  const meta = s.debriefMeta ?? { crew: [], clocks: [] };
  const idx = Math.max(0, Math.min(DEBRIEF_STEPS.length - 1, s.debriefStep ?? 0));
  const step = DEBRIEF_STEPS[idx];
  const c = debriefCalc(d);
  const outcome = OUTCOMES.find((o) => o.id === d.outcome) ?? null;
  const zero = c.entZero;
  const entValue = entanglementValue(d.entanglement?.rolled, zero);
  let usedDie = false;
  const tri = (cur) => [0, 1, 2].map((v) => ({ v, on: (cur ?? 0) >= v && v > 0, selected: (cur ?? 0) === v }));

  return {
    dstep: step, dstepIndex: idx,
    [`dstep_${step.id}`]: true,
    dIsFirst: idx === 0, dIsLast: idx === DEBRIEF_STEPS.length - 1,
    dNextLabel: DEBRIEF_STEPS[idx + 1]?.label ?? "",
    dsteps: DEBRIEF_STEPS.map((x, i) => ({ ...x, n: i + 1, active: i === idx, done: i < idx, index: i })),
    debrief: d, dmeta: meta, calc: c,
    outcome,
    outcomes: OUTCOMES.map((o) => ({ ...o, selected: d.outcome === o.id })),
    failed: d.outcome === "failed",
    coinSizes: COIN_SIZES.map((k) => ({ ...k, coinLabel: k.value === 10 ? "10+" : `${k.value} · ${k.label}`, selected: k.value === 10 ? (c.coin >= 10) : d.coin === k.value })),
    exposures: EXPOSURE.map((e, i) => ({ ...e, selected: Number(d.exposure) === e.value, tilt: [-1.2, 0.8, -0.6, 1.1][i] })),
    heatMods: HEAT_MODS.map((m) => ({ ...m, on: !!d.heatMods?.[m.id] })),
    heatModsText: HEAT_MODS.filter((m) => d.heatMods?.[m.id]).map((m) => `${m.label} +${m.value}`).join(", "),
    repOverridden: d.rep !== null && d.rep !== undefined && d.rep !== "",
    heatOverridden: d.heat !== null && d.heat !== undefined && d.heat !== "",
    entDice: (d.entanglement?.rolled ?? []).map((v) => { const hit = !usedDie && v === entValue; if (hit) usedDie = true; return { v, hit }; }),
    entValue,
    entSecret: d.entanglement?.secret !== false,
    deltas: [-3, -2, -1, 0, 1, 2, 3],
    statusRows: (d.status ?? []).map((r, i) => ({ ...r, i, deltaLabel: r.delta > 0 ? `+${r.delta}` : String(r.delta ?? 0),
      deltaOpts: [-3, -2, -1, 0, 1, 2, 3].map((v) => ({ v, label: v > 0 ? `+${v}` : String(v), selected: (r.delta ?? 0) === v })) })),
    statusPublic: (d.status ?? []).filter((r) => r.faction?.trim()).map((r) => ({ ...r, neg: (r.delta ?? 0) < 0, deltaLabel: r.delta > 0 ? `+${r.delta}` : String(r.delta ?? 0) })),
    factionSuggest: (meta.factionSuggest ?? []).filter((f) => !(d.status ?? []).some((r) => r.faction === f.name)),
    pcs: meta.crew.map((pc, i) => {
      const x = { ...emptyPcXp(), ...(d.pcXp?.[pc.id] ?? {}) };
      return {
        ...pc, tilt: [-2, 1.5, -1, 2, -1.5, 1][i % 6],
        attrs: XP_ATTRS.map((a) => ({ ...a, value: x[a.id] ?? 0 })),
        triggers: XP_TRIGGERS.map((t) => ({ ...t, label: t.id === "playbook" && pc.trigger ? pc.trigger : t.label, short: t.label, opts: tri(x[t.id]) })),
        total: sumXp(x)
      };
    }),
    pcCardStyle: (() => {
      const n = Math.max(1, meta.crew.length);
      const gap = n > 4 ? 16 : 24;
      const col = Math.min(330, Math.floor((1760 - (n - 1) * gap) / n));
      return `--col:${col}px;--gap:${gap}px`;
    })(),
    crewXp: CREW_XP.map((x) => ({ ...x, label: x.id === "crewTrigger" && meta.crewTrigger ? meta.crewTrigger : x.label, opts: tri(d.crewXp?.[x.id]) })),
    crewXpTotal: CREW_XP.reduce((n, x) => n + (d.crewXp?.[x.id] ?? 0), 0)
  };
}
