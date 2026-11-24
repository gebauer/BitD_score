import { MOD, KINDS, SOURCES, PLANS, FACTORS, LOADS, POSITIONS, CLOCK_SIZES, byId } from "./data.mjs";
import { getState, setState, poolOf, evaluateDice, clockStyle } from "./state.mjs";
import { getPrep, markUsed, prepForGMPage, npcRoleLabel } from "./prep.mjs";

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const OWN = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

/** "@UUID[…#page=N]{📖 S. x}" – Link ins Regelbuch-PDF (PDF Pager). */
export function ruleLink(page) {
  const uuid = game.settings.get(MOD, "rulebookUuid");
  if (!uuid || !page) return "";
  const offset = Number(game.settings.get(MOD, "rulebookOffset")) || 0;
  return `@UUID[${uuid}#page=${page + offset}]{📖 S. ${page}}`;
}

/* ---------------- Wizard starten ---------------- */

export async function startWizard({ fresh = true } = {}) {
  const crew = game.actors
    .filter((a) => a.type === "character" && a.hasPlayerOwner)
    .map((a) => ({ id: a.id, name: a.name }));
  await setState((s) => {
    const keep = fresh ? null : s.draft;
    s.mode = "wizard";
    s.roll = null;
    s.scoreId = null;
    s.score = null;
    if (!keep) { s.step = 0; s.prepId = null; s.draft = { kind: null, source: null, name: "", target: "", tier: null, plan: null, detail: "", crew, loads: {}, factors: {} }; }
    else s.draft.crew = crew;
  });
}

export async function resetWizard() {
  await setState((s) => { s.mode = "off"; s.step = 0; s.roll = null; s.prepId = null; s.draft = { kind: null, source: null, name: "", target: "", tier: null, plan: null, detail: "", crew: [], loads: {}, factors: {} }; });
}

/* ---------------- Engagement Roll ---------------- */

export async function rollEngagement() {
  const s = getState();
  const pool = poolOf(s.draft);
  const n = pool <= 0 ? 2 : Math.min(pool, 10);
  const roll = await new Roll(`${n}d6`).evaluate();
  const dice = roll.dice[0].results.map((r) => r.result);
  const { key } = evaluateDice(pool, dice);
  const pos = POSITIONS[key];
  const plan = byId(PLANS, s.draft.plan);
  const msg = await roll.toMessage({
    speaker: { alias: "Engagement" },
    flavor: `<div class="bitd-score-chat"><b>Engagement Roll</b> · ${esc(plan?.label ?? "")}${s.draft.detail ? ` (${esc(s.draft.detail)})` : ""}<br>
      Pool ${pool <= 0 ? "0 (2W, niedrigster)" : pool + "W"} → <b class="pos-${pos.id}">${pos.label}</b></div>`
  });
  if (game.dice3d && msg) await game.dice3d.waitFor3DAnimationByMessageID(msg.id).catch(() => {});
  await setState((st) => { st.roll = { dice, pool }; });
}

/* ---------------- Hindernisse (nur an die SL) ---------------- */

export async function drawObstacles() {
  const name = game.settings.get(MOD, "obstacleDeck");
  const count = Number(game.settings.get(MOD, "obstacleCount")) || 3;
  const prep = getState().prepId ? getPrep(getState().prepId) : null;
  const prepared = prep?.obstacles ?? [];
  const fig = (img, label) => `<figure style="display:inline-block;margin:2px;text-align:center;width:120px;vertical-align:top">${img ? `<img src="${img}" width="120">` : ""}<figcaption>${label}</figcaption></figure>`;
  let html = prepared.map((o) => o.kind === "card" ? fig(o.img, esc(o.name)) : `<p>• ${esc(o.text)}</p>`).join("");
  const missing = Math.max(0, count - prepared.length);
  if (missing) {
    const deck = game.cards.getName(name);
    if (!deck && !prepared.length) return ui.notifications.warn(`Score-Wizard: Kartenstapel „${name}“ nicht gefunden (Einstellungen).`);
    const used = new Set(prepared.filter((o) => o.kind === "card").map((o) => o.cardId));
    const cards = deck ? [...deck.cards.contents].filter((c) => !used.has(c.id)).sort(() => Math.random() - 0.5).slice(0, missing) : [];
    const rnd = cards.map((c) => fig(c.faces?.[c.face ?? 0]?.img ?? c.faces?.[0]?.img ?? c.img, esc(c.name))).join("");
    if (rnd) html += `${prepared.length ? "<hr><i>Zufällig ergänzt:</i><br>" : ""}${rnd}`;
  }
  await ChatMessage.create({
    content: `<b>Hindernisse${prepared.length ? " – vorbereitet" : " – Vorschläge"}</b><br>${html}`,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id)
  });
}

/* ---------------- Score anlegen ---------------- */

async function scoreFolder() {
  const name = game.settings.get(MOD, "scoreFolder") || "Scores";
  return game.folders.find((f) => f.type === "JournalEntry" && f.name === name)
    ?? Folder.create({ name, type: "JournalEntry" });
}

export function snapshotFrom(data, clocks = []) {
  const plan = byId(PLANS, data.plan);
  const pos = data.roll ? POSITIONS[evaluateDice(data.roll.pool, data.roll.dice).key] : null;
  return {
    no: data.no, name: data.name || "Ohne Namen",
    kind: byId(KINDS, data.kind)?.label ?? "", source: byId(SOURCES, data.source)?.label ?? "",
    target: data.target || "–", tier: data.tier == null ? "" : ["0", "I", "II", "III", "IV", "V", "VI"][data.tier],
    plan: plan?.label ?? "–", detailLabel: plan?.detail ?? "Detail", detail: data.detail || "–",
    position: pos?.label ?? "–", positionId: pos?.id ?? "",
    rollText: data.roll ? `${data.roll.pool <= 0 ? 0 : data.roll.pool}W · ${data.roll.dice.join(" ")}` : "",
    crew: (data.crew ?? []).map((c) => ({ name: c.name, load: byId(LOADS, data.loads?.[c.id])?.label ?? "–" })),
    phase: data.phase ?? "running",
    created: data.created,
    npcs: data.npcs ?? [],
    clocks: clocks.filter((c) => !c.hidden)
  };
}

export async function beginScore() {
  const s = getState();
  const folder = await scoreFolder();
  const nos = game.journal.filter((j) => j.getFlag(MOD, "score")).map((j) => j.getFlag(MOD, "score").no ?? 0);
  const no = (nos.length ? Math.max(...nos) : 0) + 1;
  const prep = s.prepId ? getPrep(s.prepId) : null;
  const data = { ...foundry.utils.deepClone(s.draft), roll: s.roll, no, created: Date.now(), phase: "running", prepId: s.prepId ?? null,
    npcs: (prep?.npcs ?? []).filter((n) => n.public).map((n) => ({ uuid: n.uuid, name: n.name, role: npcRoleLabel(n.role) })) };
  const clocks = (prep?.clocks ?? []).map((c) => ({ id: foundry.utils.randomID(), name: c.name, size: c.size, value: 0, threat: !!c.threat, hidden: !!c.hidden, touched: Date.now() }));
  const snap = snapshotFrom(data, clocks);
  const factorsTxt = Object.entries(data.factors).filter(([, v]) => v).map(([k]) => {
    const f = FACTORS[Number(k[0])];
    return f ? `${k[1] === "+" ? "+1W" : "−1W"} ${k[1] === "+" ? f.plus : f.minus}` : k;
  }).join(", ") || "keine";

  const entry = await JournalEntry.create({
    name: `${String(no).padStart(2, "0")} · ${snap.name} ⏳`,
    folder: folder.id,
    ownership: { default: OWN().OBSERVER },
    flags: { [MOD]: { score: data, clocks } },
    pages: [
      { name: "Überblick", type: "text", sort: 100, text: { content: overviewHTML(snap), format: 1 }, flags: { [MOD]: { role: "overview" } } },
      { name: "Notizen", type: "text", sort: 200, ownership: { default: OWN().OWNER }, text: { content: "", format: 1 }, flags: { [MOD]: { role: "notes" } } },
      { name: "🔒 SL", type: "text", sort: 300, ownership: { default: OWN().NONE },
        text: { content: `<p><b>Engagement-Faktoren:</b> ${esc(factorsTxt)}</p>${prep ? prepForGMPage(prep, data.plan) : ""}`, format: 1 }, flags: { [MOD]: { role: "gm" } } }
    ]
  });

  await setState((st) => {
    st.mode = "score"; st.scoreId = entry.id; st.score = snap; st.step = 0; st.roll = null; st.prepId = null;
    st.draft = { kind: null, source: null, name: "", target: "", tier: null, plan: null, detail: "", crew: [], loads: {}, factors: {} };
  });
  if (prep) await markUsed(s.prepId, entry.id);
  return entry;
}

/** Laufenden Score (wieder) am Beamer zeigen. */
export async function showScore(entryId) {
  const entry = game.journal.get(entryId);
  if (!entry?.getFlag(MOD, "score")) return;
  const snap = snapshotFrom(entry.getFlag(MOD, "score"), entry.getFlag(MOD, "clocks") ?? []);
  await setState((s) => { s.mode = "score"; s.scoreId = entry.id; s.score = snap; });
}

export function runningScores() {
  return game.journal
    .filter((j) => j.getFlag(MOD, "score")?.phase === "running")
    .sort((a, b) => (b.getFlag(MOD, "score").no ?? 0) - (a.getFlag(MOD, "score").no ?? 0))
    .map((j) => ({ id: j.id, name: j.name }));
}

/* ---------------- Uhren ---------------- */

export async function updateClocks(fn) {
  const s = getState();
  const entry = game.journal.get(s.scoreId);
  if (!entry) return ui.notifications.warn("Score-Wizard: Kein laufender Score.");
  const clocks = foundry.utils.deepClone(entry.getFlag(MOD, "clocks") ?? []);
  fn(clocks);
  await entry.setFlag(MOD, "clocks", clocks);
  const snap = snapshotFrom(entry.getFlag(MOD, "score"), clocks);
  await setState((st) => { if (st.scoreId === entry.id) st.score = snap; });
  await renderOverview(entry, snap);
}

export const clockOps = {
  add: (name, size, threat, hidden = false) => updateClocks((cs) => cs.push({
    id: foundry.utils.randomID(), name: (name || "Neue Uhr").slice(0, 60),
    size: CLOCK_SIZES.includes(size) ? size : 4, value: 0, threat: !!threat, hidden: !!hidden, touched: Date.now()
  })),
  toggleHidden: (id) => updateClocks((cs) => { const c = cs.find((x) => x.id === id); if (c) { c.hidden = !c.hidden; c.touched = Date.now(); } }),
  tick: (id, d) => updateClocks((cs) => {
    const c = cs.find((x) => x.id === id); if (!c) return;
    c.value = Math.max(0, Math.min(c.size, c.value + d)); c.touched = Date.now();
  }),
  remove: (id) => updateClocks((cs) => { const i = cs.findIndex((x) => x.id === id); if (i >= 0) cs.splice(i, 1); }),
  toggleThreat: (id) => updateClocks((cs) => { const c = cs.find((x) => x.id === id); if (c) c.threat = !c.threat; })
};

/* ---------------- Überblick-Seite (Zeitungsbogen) ---------------- */

async function renderOverview(entry, snap) {
  const page = entry.pages.find((p) => p.getFlag(MOD, "role") === "overview");
  if (page) await page.update({ "text.content": overviewHTML(snap) });
}

export function overviewHTML(sc) {
  const crew = sc.crew.map((c) => `<li>${esc(c.name)} <span>· ${esc(c.load)}</span></li>`).join("");
  const clocks = (sc.clocks ?? []).map((c) =>
    `<div class="bss-clockbox"><div class="bss-clock${c.threat ? " threat" : ""}" style="${clockStyle(c)}"></div><span>${esc(c.name)} ${c.value}/${c.size}</span></div>`).join("");
  return `<div class="bitd-score-paper">
<div class="bss-meta"><span>Score № ${String(sc.no).padStart(2, "0")}</span><span>${esc(sc.kind)}${sc.source ? " · " + esc(sc.source) : ""}</span><span>${new Date(sc.created ?? Date.now()).toLocaleDateString("de-DE")}</span></div>
<h1 class="bss-headline">${esc(sc.name)}</h1>
<div class="bss-facts">
<div><small>Ziel</small><b>${esc(sc.target)}${sc.tier ? ` (Tier ${sc.tier})` : ""}</b></div>
<div><small>Plan</small><b>${esc(sc.plan)}</b></div>
<div><small>${esc(sc.detailLabel)}</small><b>${esc(sc.detail)}</b></div>
<div><small>Start</small><b class="bss-red">${esc(sc.position)}</b>${sc.rollText ? `<i>${esc(sc.rollText)}</i>` : ""}</div>
</div>
${clocks ? `<h2>Uhren</h2><div class="bss-clocks">${clocks}</div>` : ""}
${crew ? `<h2>Die Crew · Load</h2><ul class="bss-crew">${crew}</ul>` : ""}
${sc.npcs?.length ? `<h2>Beteiligte</h2><ul class="bss-crew">${sc.npcs.map((n) => `<li>@UUID[${n.uuid}]{${esc(n.name)}} <span>· ${esc(n.role)}</span></li>`).join("")}</ul>` : ""}
<p class="bss-rules">${ruleLink(127)} Plan &amp; Loadout · ${ruleLink(128)} Engagement · ${ruleLink(15)} Uhren</p>
<p class="bss-auto">Diese Seite wird vom Score-Wizard erzeugt – Notizen gehören auf „Notizen“.</p>
</div>`;
}
