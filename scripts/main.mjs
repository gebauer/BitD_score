import { MOD } from "./data.mjs";
import { emptyState, registerSocket, getState } from "./state.mjs";
import { openGMApp } from "./gm-app.mjs";
import { TableView } from "./table.mjs";
import { startWizard, showScore, runningScores } from "./score.mjs";
import { openPrepEditor } from "./prep-app.mjs";
import { listPreps } from "./prep.mjs";

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
    default: ""
  });
  game.settings.register(MOD, "rulebookOffset", {
    name: "Regelbuch: Seitenversatz", hint: "PDF-Seite = gedruckte Seite + Versatz.",
    scope: "world", config: true, type: Number, default: 8
  });
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
});

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
  Hooks.on(`${MOD}.stateChanged`, () => { if (table) table.render(); });
  syncTable();

  game.modules.get(MOD).api = {
    open: openGMApp,
    start: async () => { await startWizard(); return openGMApp(); },
    show: showScore,
    running: runningScores,
    prepare: openPrepEditor,
    preps: listPreps,
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
