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

/** Engagement: vier Fragenpaare (S. 128) + Unbekannte Umstände. Schlüssel: "<index>+" / "<index>-". */
export const FACTORS = [
  { plus: "Kühn oder waghalsig?", minus: "Zu komplex, hängt an vielem?" },
  { plus: "Detail trifft eine Schwäche?", minus: "Ziel genau dagegen gewappnet?" },
  { plus: "Freunde oder Kontakte helfen?", minus: "Feinde oder Rivalen mischen mit?" },
  { plus: "Niedrigerer Tier, günstige Lage?", minus: "Höherer Tier, Ärger im Bezirk?" },
  { plus: "Unbekannte Umstände", minus: "Unbekannte Umstände" }
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

/* ------------------------------------------------------------------
 * Debrief (Kap. 5 „Downtime“, S. 145 ff.; Aufstieg S. 48–49)
 * ------------------------------------------------------------------ */

export const DEBRIEF_STEPS = [
  { id: "ergebnis", label: "Ergebnis", page: 145, title: "Das Ergebnis",
    ask: "Wie ist es ausgegangen?",
    hint: "Kurz festhalten, was passiert ist (2–5 Sätze, öffentlich). Bei einem Fehlschlag gibt es meist keinen Payoff – Heat und Verstrickungen gibt es trotzdem." },
  { id: "payoff", label: "Payoff", page: 146, title: "Der Payoff",
    ask: "Was springt dabei heraus?",
    hint: "Rep: 2, +1 je Tier, den das Ziel über der Crew steht, −1 je Tier darunter (min. 0). Niemand weiß, dass es die Crew war → 0 Rep. Coin nach Größe des Jobs; davon geht ggf. der Tribut an den Boss ab." },
  { id: "heat", label: "Heat", page: 147, title: "Die Heat",
    ask: "Wie viel Staub habt ihr aufgewirbelt?",
    hint: "Heat nach Aufsehen (0/2/4/6), dazu +1 hochrangiges Ziel, +1 feindliches Revier, +1 im Krieg, +2 Leichen. Ab 9 Heat: +1 Wanted Level, der Rest läuft über (S. 148)." },
  { id: "verstrickung", label: "Verstrickung", page: 150, title: "Verstrickungen",
    ask: "Was holt euch jetzt ein?",
    hint: "Würfel = Wanted Level (0 → 2 Würfel, der niedrigste zählt). Die Spalte richtet sich nach der Heat der Crew. Ergebnis in der Tabelle im Regelbuch nachschlagen." },
  { id: "fraktionen", label: "Fraktionen", page: 145, title: "Die Fraktionen",
    ask: "Wer ist euch jetzt wohlgesonnen – und wer nicht?",
    hint: "Status-Änderungen nur notieren, die Fraktionsbögen pflegt ihr von Hand. Typisch: −1 bei der Fraktion, der ihr geschadet habt, +1 beim Auftraggeber." },
  { id: "xp", label: "XP", page: 48, title: "Erfahrung",
    ask: "Was habt ihr dabei gelernt?",
    hint: "Verzweifelte Würfe geben XP im Attribut des Wurfs. Die Auslöser (Playbook, Überzeugungen, Laster) vergibt das Buch am Ende der Sitzung – wir notieren sie pro Score. Crew-XP S. 49." },
  { id: "abschluss", label: "Abschluss", page: 145, title: "Abschluss",
    ask: "Alles notiert?",
    hint: "„Score abschließen“ schreibt alles in den Journal-Eintrag. Charakter- und Crew-Bögen werden NICHT verändert – Werte bitte von Hand übertragen." }
];

export const OUTCOMES = [
  { id: "success", label: "Erfolg", desc: "Das Ziel ist erreicht." },
  { id: "partial", label: "Teilerfolg", desc: "Erreicht – aber nicht ganz oder zu einem Preis." },
  { id: "failed", label: "Fehlschlag", desc: "Das Ziel ist verfehlt." }
];

/** Coin-Größen (S. 146) – kurze deutsche Bezeichnungen. */
export const COIN_SIZES = [
  { value: 2, label: "Kleiner Job", desc: "Ein paar Münzen" },
  { value: 4, label: "Standard-Score", desc: "Ordentliche Beute" },
  { value: 6, label: "Großer Score", desc: "Ein dicker Fang" },
  { value: 8, label: "Riesiger Score", desc: "Stoff für Legenden" },
  { value: 10, label: "10+", desc: "Eine Fürstenkasse" }
];

export const EXPOSURE = [
  { value: 0, label: "Leise", desc: "Glatt und unauffällig" },
  { value: 2, label: "Eingedämmt", desc: "Ein paar Zeugen, im Griff" },
  { value: 4, label: "Laut", desc: "Laut und chaotisch" },
  { value: 6, label: "Wild", desc: "Ein öffentliches Spektakel" }
];

export const HEAT_MODS = [
  { id: "highProfile", label: "Hochrangiges Ziel", value: 1 },
  { id: "hostileTurf", label: "Feindliches Revier", value: 1 },
  { id: "war", label: "Im Krieg", value: 1 },
  { id: "killing", label: "Leichen", value: 2 }
];

/** PC-XP: verzweifelte Würfe je Attribut (Zähler) und Auslöser (0/1/2). */
export const XP_ATTRS = [
  { id: "insight", label: "Einsicht" },
  { id: "prowess", label: "Geschick" },
  { id: "resolve", label: "Entschlossenheit" }
];
export const XP_TRIGGERS = [
  { id: "playbook", label: "Playbook-Auslöser" },
  { id: "beliefs", label: "Überzeugungen, Antrieb, Herkunft, Hintergrund" },
  { id: "vice", label: "Laster oder Trauma ausgelebt" }
];
export const CREW_XP = [
  { id: "crewTrigger", label: "Crew-Auslöser" },
  { id: "aboveStation", label: "Herausforderungen über eurem Stand" },
  { id: "reputation", label: "Ruf gestärkt oder ausgebaut" },
  { id: "nature", label: "Ziele, Antrieb oder Wesen der Crew gezeigt" }
];
