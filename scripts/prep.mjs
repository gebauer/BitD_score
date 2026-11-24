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
  prep.npcs = (prep.npcs ?? []).filter((n) => n.uuid);
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
  const npcs = p.npcs.map((n) => `<li><b>${esc(roleLabel(n.role))}:</b> @UUID[${n.uuid}]{${esc(n.name)}}${n.public ? " · öffentlich" : ""}</li>`).join("");
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
  const npcs = p.npcs.map((n) => `<li><b>${esc(roleLabel(n.role))}:</b> @UUID[${n.uuid}]{${esc(n.name)}}</li>`).join("");
  const obs = p.obstacles.map((o) => `<li>${o.kind === "card" ? esc(o.name) : nl(o.text)}</li>`).join("");
  return `<h3>Aus der Vorbereitung</h3>
${note ? `<p><b>${esc(plan?.label)}:</b> ${nl(note)}</p>` : ""}
${p.hook ? `<p><b>Aufhänger:</b> ${nl(p.hook)}</p>` : ""}${p.loot ? `<p><b>Beute:</b> ${nl(p.loot)}</p>` : ""}
${npcs ? `<p><b>NPCs</b></p><ul>${npcs}</ul>` : ""}
${obs ? `<p><b>Hindernisse</b></p><ul>${obs}</ul>` : ""}
${p.gmNotes ? `<p><b>Notizen</b><br>${nl(p.gmNotes)}</p>` : ""}`;
}

export const npcRoleLabel = roleLabel;
