export const MOD = "bitd-score";

/** Schritte des Wizards – Reihenfolge wie im Regelbuch, Kap. 4 (S. 125–129). */
export const STEPS = [
  { id: "art", label: "Art", page: 125, title: "Der Job",
    ask: "Was für ein Score ist das – und wie kam er zu euch?",
    hint: "Ein Score ist eine Operation mit einem klaren Ziel. Meist: Crew-Aktivität (Crew-Typ, Kap. 3), ein Claim von der Karte oder ein Sonderauftrag der Spieler." },
  { id: "ziel", label: "Ziel", page: 125, title: "Das Ziel",
    ask: "Wen oder was nehmt ihr euch vor?",
    hint: "Ziel aus Claims oder Fraktionsliste, über einen Auftraggeber oder weil ein NPC die Crew anheuert. Tier merken – er zählt beim Engagement." },
  { id: "plan", label: "Plan", page: 127, title: "Der Plan",
    ask: "Welchen Plan habt ihr in eurem Versteck geschmiedet?",
    hint: "Die Spieler planen nicht im Detail – die Figuren tun das abseits der Bühne. Nur den Plan-Typ wählen; Vorbereitungen kommen später als Flashbacks." },
  { id: "detail", label: "Detail", page: 127, title: "Das Detail",
    ask: "Ein Detail fehlt noch – welches?",
    hint: "Kennt die Crew das Detail nicht, muss sie es erst herausfinden: Gather Information (S. 36), dann zurück zum Wizard." },
  { id: "loadout", label: "Loadout", page: 127, title: "Das Loadout",
    ask: "Wie viel schleppt ihr mit?",
    hint: "Jede Figur wählt nur die Last-Stufe, keine einzelnen Gegenstände (Details S. 57). Gegenstände werden erst im Spiel angekreuzt." },
  { id: "engagement", label: "Engagement", page: 128, title: "Engagement",
    ask: "Wie gut stehen die Karten?",
    hint: "1W für das pure Glück, ±1W je größerem Vor-/Nachteil. Danach nicht den Anmarsch beschreiben – direkt zum ersten ernsten Hindernis schneiden." }
];

export const KINDS = [
  { id: "crew", label: "Crew-Aktivität", desc: "Das, wofür eure Crew bekannt ist." },
  { id: "claim", label: "Claim", desc: "Ein Feld von eurer Claim-Karte erobern." },
  { id: "special", label: "Sonderauftrag", desc: "Ein eigenes Ziel der Spieler." }
];

export const SOURCES = [
  { id: "own", label: "Eigenes Ziel" },
  { id: "client", label: "Auftraggeber" },
  { id: "npc", label: "Jemand tritt an euch heran" }
];

export const PLANS = [
  { id: "assault", label: "Überfall", desc: "Gewalt gegen das Ziel.", detail: "Angriffspunkt",
    placeholder: "z. B. das Hintertor um Mitternacht" },
  { id: "deception", label: "Täuschung", desc: "Locken, austricksen, manipulieren.", detail: "Methode der Täuschung",
    placeholder: "z. B. als Inspektoren der Stadtwache" },
  { id: "stealth", label: "Schleichen", desc: "Unbemerkt eindringen.", detail: "Eintrittspunkt",
    placeholder: "z. B. über das Dach" },
  { id: "occult", label: "Okkult", desc: "Eine übernatürliche Macht einbinden.", detail: "Arkane Methode",
    placeholder: "z. B. ein Ritual im Geisterfeld" },
  { id: "social", label: "Sozial", desc: "Verhandeln, feilschen, überzeugen.", detail: "Soziale Verbindung",
    placeholder: "z. B. über Bazso Baz" },
  { id: "transport", label: "Transport", desc: "Fracht oder Leute durch Gefahr bringen.", detail: "Route & Mittel",
    placeholder: "z. B. per Gondel durch die Kanäle" }
];

/** Engagement: vier Fragenpaare (S. 128). Schlüssel: "<index>+" / "<index>-". */
export const FACTORS = [
  { plus: "Kühn oder waghalsig?", minus: "Zu komplex, hängt an vielem?" },
  { plus: "Detail trifft eine Schwäche?", minus: "Ziel genau dagegen gewappnet?" },
  { plus: "Freunde oder Kontakte helfen?", minus: "Feinde oder Rivalen mischen mit?" },
  { plus: "Niedrigerer Tier, günstige Lage?", minus: "Höherer Tier, Ärger im Bezirk?" }
];

export const LOADS = [
  { id: "light", label: "Leicht", value: 3 },
  { id: "normal", label: "Normal", value: 5 },
  { id: "heavy", label: "Schwer", value: 6 }
];

export const POSITIONS = [
  { id: "desperate", label: "Verzweifelt", range: "1–3",
    cut: "Verzweifelt: Das erste Hindernis ist gleich ein echtes Problem." },
  { id: "risky", label: "Riskant", range: "4/5",
    cut: "Riskant: Ihr steckt mitten im ersten Hindernis – es kann so oder so ausgehen." },
  { id: "controlled", label: "Kontrolliert", range: "6",
    cut: "Kontrolliert: Ihr habt die Lage im Griff, wenn die Action beginnt." },
  { id: "crit", label: "Kritisch", range: "6 6",
    cut: "Kritisch: Das erste Hindernis liegt schon hinter euch – kontrolliert geht es weiter." }
];

export const CLOCK_SIZES = [4, 6, 8];

export const byId = (list, id) => list.find((x) => x.id === id) ?? null;
