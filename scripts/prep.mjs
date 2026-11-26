import { MOD, PLANS, CLOCK_SIZES } from "./data.mjs";

/* ------------------------------------------------------------------
 * Vorbereitete Scores: je ein Journal im SL-Ordner "Score-Vorbereitung"
 * (Besitzrechte: niemand außer SL). Daten in flags[MOD].prep, dazu eine
 * lesbare Textseite.
 * ------------------------------------------------------------------ */

export const NPC_ROLES = [
  { id: "client", label: "Auftraggeber" },
  { id: "target", label: "Ziel" },
  { id: "victim", label: "Opfer" },
  { id: "ally", label: "Verbündeter" },
  { id: "rival", label: "Gegenspieler" },
  { id: "influence", label: "Negativer Einfluss" },
  { id: "witness", label: "Zeuge / Kontakt" }
];

export const emptyPrep = () => ({
  name: "", target: "", tier: null, district: "",
  hook: "", loot: "",
  planNotes: Object.fromEntries(PLANS.map((p) => [p.id, ""])),
  strengths: "", weaknesses: "",
  obstacles: [],   // {kind:"card", cardId, name, img} | {kind:"text", text}
  clocks: [],      // {name, size, threat, hidden}
  npcs: [],        // {uuid, name, img, role, public}
  gmNotes: "",
  used: false, usedIn: null
});

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const nl = (s) => esc(s).replace(/\n/g, "<br>");
/** NPC als Link, falls ein Actor verknüpft ist – sonst nur der Name. */
export const npcLink = (n) => n.uuid ? `@UUID[${n.uuid}]{${esc(n.name)}}` : esc(n.name);
const roleLabel = (id) => NPC_ROLES.find((r) => r.id === id)?.label ?? "NPC";

async function prepFolder() {
  const name = game.settings.get(MOD, "prepFolder") || "Score-Vorbereitung";
  return game.folders.find((f) => f.type === "JournalEntry" && f.name === name)
    ?? Folder.create({ name, type: "JournalEntry", color: "#5c1a14" });
}

export function getPrep(id) {
  const e = game.journal.get(id);
  const p = e?.getFlag(MOD, "prep");
  return p ? foundry.utils.mergeObject(emptyPrep(), foundry.utils.deepClone(p), { inplace: false }) : null;
}

export function listPreps({ includeUsed = false } = {}) {
  return game.journal
    .filter((j) => j.getFlag(MOD, "prep") && (includeUsed || !j.getFlag(MOD, "prep").used))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((j) => ({ id: j.id, name: j.getFlag(MOD, "prep").name || j.name, used: !!j.getFlag(MOD, "prep").used }));
}

export async function savePrep(id, prep) {
  prep.clocks = (prep.clocks ?? []).filter((c) => c.name?.trim()).map((c) => ({
    name: c.name.trim().slice(0, 60), size: CLOCK_SIZES.includes(Number(c.size)) ? Number(c.size) : 4,
    threat: !!c.threat, hidden: !!c.hidden
  }));
  prep.obstacles = (prep.obstacles ?? []).filter((o) => (o.kind === "card" && o.cardId) || (o.kind === "text" && o.text?.trim()));
  prep.npcs = (prep.npcs ?? []).filter((n) => n.uuid || n.name?.trim());
  const title = `${prep.used ? "✓ " : ""}${prep.name || "Unbenannte Vorbereitung"}`;
  const content = prepHTML(prep);

  let entry = id ? game.journal.get(id) : null;
  if (!entry) {
    const folder = await prepFolder();
    entry = await JournalEntry.create({
      name: title, folder: folder.id,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
      flags: { [MOD]: { prep } },
      pages: [{ name: "Vorbereitung", type: "text", text: { content, format: 1 } }]
    });
    return entry;
  }
  await entry.update({ name: title, [`flags.${MOD}.prep`]: prep });
  const page = entry.pages.contents[0];
  if (page) await page.update({ "text.content": content });
  return entry;
}

export async function markUsed(id, scoreId) {
  const e = game.journal.get(id);
  const prep = getPrep(id);
  if (!e || !prep) return;
  prep.used = true; prep.usedIn = scoreId;
  await savePrep(id, prep);
}

/** Lesbare Fassung im Vorbereitungs-Journal. */
export function prepHTML(p) {
  const planRows = PLANS.filter((x) => p.planNotes?.[x.id]?.trim())
    .map((x) => `<li><b>${esc(x.label)}</b> (${esc(x.detail)}): ${nl(p.planNotes[x.id])}</li>`).join("");
  const obs = p.obstacles.map((o) => `<li>${o.kind === "card" ? `🂠 ${esc(o.name)}` : nl(o.text)}</li>`).join("");
  const clocks = p.clocks.map((c) => `<li>${esc(c.name)} (${c.size})${c.threat ? " · Bedrohung" : ""}${c.hidden ? " · verdeckt" : ""}</li>`).join("");
  const npcs = p.npcs.map((n) => `<li><b>${esc(roleLabel(n.role))}:</b> ${npcLink(n)}${n.uuid ? "" : " <i>(kein Actor)</i>"}${n.public ? " · öffentlich" : ""}</li>`).join("");
  return `<h2>${esc(p.name || "Unbenannt")}</h2>
<p><b>Ziel:</b> ${esc(p.target || "–")}${p.tier != null && p.tier !== "" ? ` (Tier ${esc(p.tier)})` : ""}${p.district ? ` · ${esc(p.district)}` : ""}</p>
${p.hook ? `<p><b>Aufhänger:</b> ${nl(p.hook)}</p>` : ""}${p.loot ? `<p><b>Beute:</b> ${nl(p.loot)}</p>` : ""}
${npcs ? `<h3>NPCs</h3><ul>${npcs}</ul>` : ""}
${planRows ? `<h3>Je nach Plan</h3><ul>${planRows}</ul>` : ""}
${p.strengths || p.weaknesses ? `<h3>Engagement</h3>${p.strengths ? `<p><b>Stark gegen:</b> ${nl(p.strengths)}</p>` : ""}${p.weaknesses ? `<p><b>Schwach gegen:</b> ${nl(p.weaknesses)}</p>` : ""}` : ""}
${obs ? `<h3>Hindernisse</h3><ul>${obs}</ul>` : ""}
${clocks ? `<h3>Uhren</h3><ul>${clocks}</ul>` : ""}
${p.gmNotes ? `<h3>Geheime Notizen</h3><p>${nl(p.gmNotes)}</p>` : ""}
${p.used ? `<p><i>Verwendet${p.usedIn ? ` in @UUID[JournalEntry.${p.usedIn}]{diesem Score}` : ""}.</i></p>` : ""}`;
}

/** Abschnitt für die 🔒 SL-Seite beim Start des Scores. */
export function prepForGMPage(p, planId) {
  const plan = PLANS.find((x) => x.id === planId);
  const note = planId ? p.planNotes?.[planId] : "";
  const npcs = p.npcs.map((n) => `<li><b>${esc(roleLabel(n.role))}:</b> ${npcLink(n)}</li>`).join("");
  const obs = p.obstacles.map((o) => `<li>${o.kind === "card" ? esc(o.name) : nl(o.text)}</li>`).join("");
  return `<h3>Aus der Vorbereitung</h3>
${note ? `<p><b>${esc(plan?.label)}:</b> ${nl(note)}</p>` : ""}
${p.hook ? `<p><b>Aufhänger:</b> ${nl(p.hook)}</p>` : ""}${p.loot ? `<p><b>Beute:</b> ${nl(p.loot)}</p>` : ""}
${npcs ? `<p><b>NPCs</b></p><ul>${npcs}</ul>` : ""}
${obs ? `<p><b>Hindernisse</b></p><ul>${obs}</ul>` : ""}
${p.gmNotes ? `<p><b>Notizen</b><br>${nl(p.gmNotes)}</p>` : ""}`;
}

export const npcRoleLabel = roleLabel;

/* ------------------------------------------------------------------
 * Import: JSON (ein Objekt oder eine Liste). NPCs und Hindernis-Karten
 * dürfen per Name angegeben werden und werden hier aufgelöst.
 * ------------------------------------------------------------------ */
export async function importPreps(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (err) { ui.notifications.error(`Import: kein gültiges JSON (${err.message})`); return []; }
  const list = Array.isArray(data) ? data : [data];
  const deck = game.cards.getName(game.settings.get(MOD, "obstacleDeck"));
  const created = [];
  const missing = [];
  for (const raw of list) {
    const p = foundry.utils.mergeObject(emptyPrep(), raw ?? {}, { inplace: false, insertKeys: true });
    p.used = false; p.usedIn = null;
    p.tier = p.tier === "" || p.tier == null ? null : Number(p.tier);
    p.npcs = (p.npcs ?? []).map((n) => {
      if (n.uuid) return n;
      const a = game.actors.find((x) => x.name.toLowerCase() === String(n.name ?? "").trim().toLowerCase());
      if (!a) missing.push(`NPC „${n.name}“`);
      return a ? { ...n, uuid: a.uuid, name: a.name, img: a.img } : { ...n, uuid: null, img: null };
    });
    p.obstacles = (p.obstacles ?? []).map((o) => {
      if (o.kind !== "card" || o.cardId) return o;
      const c = deck?.cards.find((x) => x.name.toLowerCase() === String(o.name ?? "").trim().toLowerCase());
      if (!c) { missing.push(`Karte „${o.name}“`); return { kind: "text", text: o.name ?? "" }; }
      return { kind: "card", cardId: c.id, name: c.name, img: c.faces?.[c.face ?? 0]?.img ?? c.faces?.[0]?.img ?? c.img };
    });
    const entry = await savePrep(null, p);
    if (entry) created.push(entry);
  }
  ui.notifications.info(`Import: ${created.length} Vorbereitung(en) angelegt.`);
  if (missing.length) ui.notifications.warn(`Import: nicht gefunden – ${missing.join(", ")}. Als Name bzw. Freitext übernommen.`, { permanent: true });
  Hooks.callAll(`${MOD}.prepsChanged`);
  return created;
}
