import { MOD } from "./data.mjs";
import { emptyState, registerSocket, getState } from "./state.mjs";
import { openGMApp } from "./gm-app.mjs";
import { TableView } from "./table.mjs";
import { startWizard, showScore, runningScores } from "./score.mjs";
import { openPrepEditor } from "./prep-app.mjs";
import { listPreps, importPreps } from "./prep.mjs";
import { guessCrewScene } from "./crew.mjs";
import { startDebrief } from "./debrief.mjs";
import { registerRulebookLinks } from "./rulebook.mjs";

let table = null;

Hooks.once("init", () => {
  game.settings.register(MOD, "live", {
    scope: "world", config: false, type: Object, default: emptyState(),
    onChange: () => Hooks.callAll(`${MOD}.stateChanged`)
  });
  game.settings.register(MOD, "tableForPlayers", {
    name: "Tisch-Ansicht auch für Spieler",
    hint: "Zeigt die Tisch-Ansicht zusätzlich allen Spieler-Clients, nicht nur dem Beamer.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => syncTable()
  });
  game.settings.register(MOD, "scoreFolder", {
    name: "Ordner für Scores", hint: "Journal-Ordner, in dem neue Scores angelegt werden.",
    scope: "world", config: true, type: String, default: "Scores"
  });
  game.settings.register(MOD, "prepFolder", {
    name: "Ordner für Vorbereitungen", hint: "Journal-Ordner für vorbereitete Scores (nur SL sichtbar).",
    scope: "world", config: true, type: String, default: "Score-Vorbereitung"
  });
  game.settings.register(MOD, "rulebookUuid", {
    name: "Regelbuch: UUID der PDF-Seite",
    hint: "UUID der PDF-Journalseite (PDF Pager). Leer lassen, um keine 📖-Links zu erzeugen.",
    scope: "world", config: true, type: String,
    default: "JournalEntry.LaCpbCF0tRbOWxFG.JournalEntryPage.s3ygzsMAtS4CrEbi"
  });
  game.settings.register(MOD, "rulebookOffset", {
    name: "Regelbuch: Seitenversatz", hint: "PDF-Seite = gedruckte Seite + Versatz. Den Versatz nur hier eintragen, nicht zusätzlich in PDF Pager.",
    scope: "world", config: true, type: Number, default: 8
  });
  game.settings.register(MOD, "rulebookOpen", {
    name: "Regelbuch öffnen in",
    hint: "Foundry: das Journal mit dem PDF, der Wizard springt auf die Seite. Browser-Tab: eingebauter PDF-Viewer des Browsers – funktioniert immer, liegt aber außerhalb von Foundry.",
    scope: "client", config: true, type: String, default: "foundry",
    choices: { foundry: "Foundry (Journal / PDF Pager)", tab: "Neuer Browser-Tab" }
  });
  game.settings.register(MOD, "skylineImage", {
    name: "Skyline-Bild",
    hint: "Bild am unteren Rand der Tisch-Ansicht. Am besten außerhalb des Modulordners ablegen (z. B. assets/bitd-score/), damit es Updates übersteht. Leer = keine Skyline.",
    scope: "world", config: true, type: String, filePicker: "image",
    default: "assets/bitd-score/skyline-a.webp",
    onChange: applySkyline
  });
  applySkyline();
  game.settings.register(MOD, "obstacleDeck", {
    name: "Kartenstapel für Hindernisse", scope: "world", config: true, type: String, default: "Obstacles"
  });
  game.settings.register(MOD, "obstacleCount", {
    name: "Anzahl gezogener Hindernisse", scope: "world", config: true, type: Number, default: 3,
    range: { min: 1, max: 6, step: 1 }
  });
});

Hooks.once("setup", () => {
  // Benutzerliste ist erst hier verfügbar
  const choices = { "": "– keiner –" };
  for (const u of game.users) if (!u.isGM) choices[u.id] = u.name;
  game.settings.register(MOD, "beamerUser", {
    name: "Beamer-Benutzer",
    hint: "Dieser Benutzer bekommt die Tisch-Ansicht als Vollbild-Overlay, sobald die SL einen Score zeigt.",
    scope: "world", config: true, type: String, choices, default: "",
    onChange: () => syncTable()
  });

  // Crew aus den Crew-Karten (Complete Card Management) – Szenenliste gibt es erst hier
  game.settings.register(MOD, "crewSource", {
    name: "Crew: Quelle",
    hint: "Karten = offene Crew-Karten in den Docks der Crew-Szene (braucht Complete Card Management). Charaktere = alle Spielercharaktere.",
    scope: "world", config: true, type: String, default: "cards",
    choices: { cards: "Crew-Karten in den Docks", actors: "Alle Spielercharaktere" }
  });
  game.settings.register(MOD, "dockPrefix", {
    name: "Crew: Namensanfang der Docks",
    hint: "Regionen auf der Crew-Szene, deren Name so beginnt, gelten als Dock. Leer = alle offenen Crew-Karten der Szene zählen.",
    scope: "world", config: true, type: String, default: "Dock"
  });
  const scenes = { "": "– keine –" };
  for (const sc of game.scenes) scenes[sc.id] = sc.name;
  game.settings.register(MOD, "crewScene", {
    name: "Crew: Szene",
    hint: "Szene, auf der die Crew-Karten in den Docks liegen.",
    scope: "world", config: true, type: String, choices: scenes,
    default: guessCrewScene(game.settings.get(MOD, "dockPrefix") || "Dock")
  });
});

/** Skyline als CSS-Variable setzen – absolute URL, damit sie nicht relativ zum Stylesheet aufgelöst wird. */
function applySkyline() {
  const path = String(game.settings.get(MOD, "skylineImage") ?? "").trim();
  let value = "none";
  if (path) {
    const href = /^(https?:|data:)/.test(path) ? path : new URL(foundry.utils.getRoute(path), window.location.origin).href;
    value = `url("${href.replace(/["\\]/g, "\\$&")}")`;
  }
  document.documentElement.style.setProperty("--bs-skyline", value);
}

function wantsTable() {
  if (game.user.isGM) return false;
  return game.user.id === game.settings.get(MOD, "beamerUser") || game.settings.get(MOD, "tableForPlayers");
}

function syncTable() {
  if (wantsTable()) { table ??= new TableView(); table.render(); }
  else { table?.destroy(); table = null; }
}

Hooks.once("ready", () => {
  registerSocket();
  registerRulebookLinks();
  Hooks.on(`${MOD}.stateChanged`, () => { if (table) table.render(); });
  syncTable();

  game.modules.get(MOD).api = {
    open: openGMApp,
    start: async () => { await startWizard(); return openGMApp(); },
    show: showScore,
    running: runningScores,
    prepare: openPrepEditor,
    preps: listPreps,
    importPreps,
    debrief: async (entryId) => { await startDebrief(entryId ?? getState().scoreId); return openGMApp(); },
    state: getState
  };
});

// Knopf im Journal-Verzeichnis für die SL
Hooks.on("renderJournalDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  const header = root?.querySelector(".header-actions, .directory-header .action-buttons");
  if (!header || header.querySelector(".bitd-score-open")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bitd-score-open";
  btn.innerHTML = `<i class="fa-solid fa-mask"></i> Score-Wizard`;
  btn.addEventListener("click", () => openGMApp());
  header.append(btn);
});
