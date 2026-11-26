import { MOD, DEBRIEF_STEPS, OUTCOMES, HEAT_MODS, XP_ATTRS, XP_TRIGGERS, CREW_XP } from "./data.mjs";
import { getState, setState, clockStyle } from "./state.mjs";
import { emptyDebrief, emptyPcXp, debriefCalc, entanglementValue } from "./debrief-model.mjs";
import { snapshotFrom, renderOverview, ruleLink } from "./score.mjs";
import { getPrep, npcRoleLabel } from "./prep.mjs";

/* ------------------------------------------------------------------
 * Debrief nach dem Score (Kap. 5, S. 145 ff.). Liest Werte von Actors
 * nur als Vorschlag – schreibt NIE auf Charakter- oder Crew-Bögen.
 * ------------------------------------------------------------------ */

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const nl = (s) => esc(s).replace(/\n/g, "<br>");

/** Systemwerte stehen mal als Zahl, mal als String, mal als [n] (Radio-Multiboxen). */
const sysNum = (v) => {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const clueText = (v) => {
  const t = Array.isArray(v) ? v.filter(Boolean).join(" · ") : String(v ?? "");
  return t.startsWith("BITD.") ? game.i18n.localize(t) : t;
};

/** Crew-Actor: über die Verknüpfung am Charakter (system.crew[0].id), sonst der einzige Crew-Actor der Welt. */
function crewActorFor(actorIds) {
  for (const id of actorIds) {
    const cid = game.actors.get(id)?.system?.crew?.[0]?.id;
    const crew = cid ? game.actors.get(cid) : null;
    if (crew?.type === "crew") return crew;
  }
  const all = game.actors.filter((a) => a.type === "crew");
  return all.length === 1 ? all[0] : null;
}

/* ---------------- Starten / Fortsetzen ---------------- */

export async function startDebrief(entryId) {
  const entry = game.journal.get(entryId);
  const data = entry?.getFlag(MOD, "score");
  if (!data) return ui.notifications.warn("Score-Wizard: Score nicht gefunden.");
  const s = getState();
  const clocks = entry.getFlag(MOD, "clocks") ?? [];

  // Angefangener Debrief für denselben Score → einfach weiter
  if (s.debrief && s.debriefMeta?.entryId === entryId) {
    return setState((st) => { st.mode = "debrief"; st.scoreId = entryId; });
  }

  const crewIds = (data.crew ?? []).map((c) => c.id);
  const crewActor = crewActorFor(crewIds);
  const d = foundry.utils.mergeObject(emptyDebrief(), foundry.utils.deepClone(data.debrief ?? {}), { inplace: false });
  if (!data.debrief) {
    d.targetTier = data.tier ?? null;
    d.crewTier = sysNum(crewActor?.system?.tier) ?? 0;
    d.heatBefore = sysNum(crewActor?.system?.heat);
    d.wantedBefore = sysNum(crewActor?.system?.wanted);
  }
  for (const id of crewIds) d.pcXp[id] = { ...emptyPcXp(), ...(d.pcXp[id] ?? {}) };

  const prep = data.prepId ? getPrep(data.prepId) : null;
  const factionSuggest = [];
  if (data.target) factionSuggest.push({ name: data.target, hint: "Ziel" });
  for (const n of prep?.npcs ?? []) if (n.name && !factionSuggest.some((f) => f.name === n.name)) factionSuggest.push({ name: n.name, hint: npcRoleLabel(n.role) });

  const meta = {
    entryId, no: data.no, name: data.name || "Ohne Namen", rerun: !!data.debrief,
    crewActor: crewActor?.name ?? "",
    crewTrigger: clueText(crewActor?.items?.find((i) => i.type === "crew_type")?.system?.experience_clues),
    crew: (data.crew ?? []).map((c) => {
      const a = game.actors.get(c.id);
      return { id: c.id, name: a?.name ?? c.name, cardImg: c.cardImg ?? "",
        trigger: clueText(a?.items?.find((i) => i.type === "class")?.system?.experience_clues) };
    }),
    clocks: clocks.filter((c) => !c.hidden).map((c) => ({ name: c.name, value: c.value, size: c.size, threat: !!c.threat, full: c.value >= c.size, style: clockStyle(c) })),
    factionSuggest
  };
  const snap = snapshotFrom(data, clocks);
  await setState((st) => {
    st.mode = "debrief"; st.debriefStep = 0; st.debrief = d; st.debriefMeta = meta;
    st.scoreId = entryId; st.score = snap;
  });
}

export const debriefNav = {
  next: () => setState((st) => { st.debriefStep = Math.min(DEBRIEF_STEPS.length - 1, (st.debriefStep ?? 0) + 1); }),
  prev: () => setState((st) => { st.debriefStep = Math.max(0, (st.debriefStep ?? 0) - 1); }),
  goto: (i) => setState((st) => { st.debriefStep = Math.max(0, Math.min(DEBRIEF_STEPS.length - 1, Number(i) || 0)); }),
  /** Zurück zur Score-Ansicht; der Entwurf bleibt für „Score beenden“ erhalten. */
  pause: () => setState((st) => { st.mode = "score"; }),
  discard: () => setState((st) => { st.mode = "score"; st.debrief = null; st.debriefMeta = null; st.debriefStep = 0; })
};

export const factionOps = {
  add: (name = "") => setState((st) => { if (st.debrief) (st.debrief.status ??= []).push({ faction: String(name).slice(0, 80), delta: 0, note: "" }); }),
  remove: (i) => setState((st) => { st.debrief?.status?.splice(Number(i), 1); })
};

/* ---------------- Verstrickung würfeln ---------------- */

export async function rollEntanglement() {
  const s = getState();
  if (!s.debrief) return;
  const c = debriefCalc(s.debrief);
  const secret = s.debrief.entanglement?.secret !== false;
  const roll = await new Roll(`${c.entDice}d6`).evaluate();
  const dice = roll.dice[0].results.map((r) => r.result);
  const value = entanglementValue(dice, c.entZero);
  const msg = await roll.toMessage({
    speaker: { alias: "Verstrickung" },
    flavor: `<div class="bitd-score-chat"><b>Verstrickung</b> · ${esc(c.column)} · ${c.entZero ? "Wanted 0: 2W, niedrigster" : `${c.entDice}W, höchster`} → <b>${value}</b></div>`
  }, { rollMode: secret ? CONST.DICE_ROLL_MODES.PRIVATE : CONST.DICE_ROLL_MODES.PUBLIC });
  if (game.dice3d && msg) await game.dice3d.waitFor3DAnimationByMessageID(msg.id).catch(() => {});
  await setState((st) => { if (st.debrief) st.debrief.entanglement.rolled = dice; });
}

/* ---------------- Abschließen ---------------- */

export async function finishDebrief() {
  const s = getState();
  const entry = game.journal.get(s.debriefMeta?.entryId ?? s.scoreId);
  const data = foundry.utils.deepClone(entry?.getFlag(MOD, "score"));
  if (!entry || !data || !s.debrief) return ui.notifications.warn("Score-Wizard: Kein Debrief offen.");

  const c = debriefCalc(s.debrief);
  const d = foundry.utils.deepClone(s.debrief);
  // Eingaben bleiben, wie sie sind (null = Vorschlag) – sonst würden Vorschläge beim Bearbeiten zu festen Werten.
  d.result = { rep: c.rep, coin: c.coin, tithe: c.tithe, coinToCrew: c.coinToCrew, heat: c.heat,
    heatAfter: c.heatAfter, wantedAfter: c.wantedAfter, overflow: c.overflow };
  d.status = (d.status ?? []).filter((r) => r.faction?.trim());
  d.finishedAt = Date.now();
  data.debrief = d;
  data.phase = "done";

  const base = entry.name.replace(/\s*[⏳✓]\s*$/u, "");
  await entry.update({ name: `${base} ✓`, [`flags.${MOD}.score`]: data });

  const clocks = entry.getFlag(MOD, "clocks") ?? [];
  const snap = snapshotFrom(data, clocks);
  await renderOverview(entry, snap);

  const gmPage = entry.pages.find((p) => p.getFlag(MOD, "role") === "gm");
  if (gmPage) {
    let html = gmPage.text?.content ?? "";
    const at = html.indexOf("🔒 Debrief");
    if (at >= 0) html = html.slice(0, Math.max(0, html.lastIndexOf("<h2", at)));
    await gmPage.update({ "text.content": html + gmDebriefHTML(d, c, s.debriefMeta) });
  }

  await setState((st) => {
    st.mode = "score"; st.scoreId = entry.id; st.score = snap;
    st.debrief = null; st.debriefMeta = null; st.debriefStep = 0;
  });
  ui.notifications.info(`Score abgeschlossen: ${base} ✓ – Werte bitte von Hand auf die Bögen übertragen.`);
  return entry;
}

export function finishedScores(limit = 8) {
  return game.journal
    .filter((j) => j.getFlag(MOD, "score")?.phase === "done")
    .sort((a, b) => (b.getFlag(MOD, "score").no ?? 0) - (a.getFlag(MOD, "score").no ?? 0))
    .slice(0, limit)
    .map((j) => ({ id: j.id, name: j.name }));
}

/* ---------------- Öffentliche Sicht (Überblick-Seite, Beamer) ---------------- */

/** Nur das, was alle sehen dürfen – geheime Verstrickung und SL-Notizen bleiben draußen. */
export function publicDebrief(d, crew = []) {
  if (!d) return null;
  const c = debriefCalc(d);
  const outcome = OUTCOMES.find((o) => o.id === d.outcome);
  const names = Object.fromEntries((crew ?? []).map((x) => [x.id, x.name]));
  const pcs = Object.entries(d.pcXp ?? {}).map(([id, x]) => ({
    name: names[id] ?? game.actors?.get(id)?.name ?? "?",
    cells: [...XP_ATTRS, ...XP_TRIGGERS].map((k) => x[k.id] ?? 0),
    total: [...XP_ATTRS, ...XP_TRIGGERS].reduce((n, k) => n + (x[k.id] ?? 0), 0)
  }));
  const ent = d.entanglement?.secret === false && (d.entanglement.name || d.entanglement.text)
    ? { name: d.entanglement.name, text: d.entanglement.text } : null;
  return {
    outcome: outcome?.label ?? "–", outcomeId: d.outcome ?? "", failed: d.outcome === "failed", summary: d.summary ?? "",
    coin: c.coin, tithe: c.titheOn ? c.tithe : 0, titheBoss: d.tithe?.boss ?? "", tithePaid: d.tithe?.paid !== false,
    coinToCrew: c.coinToCrew, rep: c.rep, quiet: !!d.quiet,
    heat: c.heat, heatMods: HEAT_MODS.filter((m) => d.heatMods?.[m.id]).map((m) => `${m.label} +${m.value}`).join(", "),
    exposure: d.exposure ?? 0,
    status: (d.status ?? []).filter((r) => r.faction?.trim()).map((r) => ({ ...r, deltaLabel: r.delta > 0 ? `+${r.delta}` : String(r.delta ?? 0) })),
    entanglement: ent,
    pcs, crewXp: CREW_XP.map((x) => d.crewXp?.[x.id] ?? 0), crewXpTotal: CREW_XP.reduce((n, x) => n + (d.crewXp?.[x.id] ?? 0), 0)
  };
}

export function debriefOverviewHTML(p) {
  if (!p) return "";
  const head = [...XP_ATTRS.map((a) => a.label), "Playbook", "Überzeug.", "Laster", "Σ"].map((h) => `<th>${esc(h)}</th>`).join("");
  const rows = p.pcs.map((r) => `<tr><td>${esc(r.name)}</td>${r.cells.map((v) => `<td>${v || "·"}</td>`).join("")}<td><b>${r.total}</b></td></tr>`).join("");
  const crewXp = CREW_XP.map((x, i) => `${esc(x.label)}: ${p.crewXp[i]}`).join(" · ");
  const tithe = p.titheBoss ? (p.tithePaid ? ` – Tribut an ${esc(p.titheBoss)}: ${p.tithe}` : ` – Tribut an ${esc(p.titheBoss)} <b>nicht gezahlt</b>`) : "";
  return `<h2>Payoff &amp; Konsequenzen</h2>
<div class="bss-facts">
<div><small>Ergebnis</small><b class="${p.outcomeId === "failed" ? "bss-red" : ""}">${esc(p.outcome)}</b></div>
<div><small>Coin</small><b>${p.coin}</b><i>an die Crew: ${p.coinToCrew}</i></div>
<div><small>Rep</small><b>${p.rep}</b>${p.quiet ? "<i>niemand weiß, dass ihr es wart</i>" : ""}</div>
<div><small>Heat</small><b class="bss-red">${p.heat}</b>${p.heatMods ? `<i>${esc(p.heatMods)}</i>` : ""}</div>
</div>
${p.summary ? `<p>${nl(p.summary)}</p>` : ""}
<p>Coin ${p.coin}${tithe} → <b>${p.coinToCrew}</b> für die Crew.</p>
${p.status.length ? `<p><b>Fraktionen:</b> ${p.status.map((r) => `${esc(r.faction)} ${r.deltaLabel}${r.note ? ` (${esc(r.note)})` : ""}`).join(" · ")}</p>` : ""}
${p.entanglement ? `<p><b>Verstrickung:</b> ${esc(p.entanglement.name)}${p.entanglement.text ? ` – ${nl(p.entanglement.text)}` : ""}</p>` : ""}
${rows ? `<table class="bss-xp"><thead><tr><th>XP</th>${head}</tr></thead><tbody>${rows}</tbody></table>` : ""}
<p><b>Crew-XP ${p.crewXpTotal}:</b> ${crewXp}</p>
<p class="bss-rules">${ruleLink(146)} Payoff · ${ruleLink(147)} Heat · ${ruleLink(150)} Verstrickungen · ${ruleLink(48)} XP · ${ruleLink(49)} Crew-XP</p>`;
}

function gmDebriefHTML(d, c, meta) {
  const e = d.entanglement ?? {};
  const val = entanglementValue(e.rolled, c.entZero);
  return `<h2>🔒 Debrief</h2>
<p><i>Vom Score-Wizard erzeugt – wird beim nächsten „Debrief bearbeiten“ ersetzt. Eigene Notizen bitte oberhalb.</i></p>
<p><b>Heat:</b> ${c.heat}${c.heatBefore !== null ? ` · vorher ${c.heatBefore} → nachher ${c.heatAfter}${c.overflow ? " (+1 Wanted Level, Überlauf)" : ""}` : ""}${c.wantedAfter !== null ? ` · Wanted ${c.wantedAfter}` : ""}</p>
<p><b>Verstrickung${e.secret === false ? "" : " (geheim)"}:</b> ${esc(c.column)} · ${e.rolled?.length ? `Würfel ${e.rolled.join(" ")} → ${val}` : "nicht gewürfelt"}${e.name ? ` · <b>${esc(e.name)}</b>` : ""}</p>
${e.text ? `<p>${nl(e.text)}</p>` : ""}
${d.tithe?.boss && d.tithe.paid === false ? `<p><b>Tribut nicht gezahlt:</b> Geduld-Uhr für ${esc(d.tithe.boss)} anlegen/weiterdrehen.</p>` : ""}
${meta?.crewActor ? `<p><b>Crew-Bogen:</b> ${esc(meta.crewActor)} (Tier ${c.crewTier}) – von Hand aktualisieren.</p>` : ""}
${d.gmNotes ? `<h3>SL-Notizen</h3><p>${nl(d.gmNotes)}</p>` : ""}`;
}
