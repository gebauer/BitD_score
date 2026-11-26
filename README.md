# BitD Score-Wizard (`bitd-score`)

Geführter Score-Ablauf für *Blades in the Dark* in Foundry VTT (v13/v14), parallel zum Regelbuch (Kap. 4, S. 125–129):

**Art → Ziel → Plan → Detail → Loadout → Engagement**, danach legt der Wizard eine Score-Seite im Journal an.

- **SL-Fenster** (Steuerung): Hinweise und 📖-Links ins Regelbuch je Schritt, Würfeln, Hindernisse ziehen (nur an die SL geflüstert), Score anlegen, Score-Uhren verwalten.
- **Tisch-Ansicht** (Beamer): Vollbild-Overlay im Look des Foundry-Templates. Spieler können am Beamer selbst wählen (Art, Ziel, Plan, Detail, Loadout, Engagement-Faktoren); die SL schaltet die Schritte weiter und würfelt. Geheimes erscheint dort nie.
- **Score-Uhren** gehören zum Score (nicht zu den System-Uhren): Klick +1, Rechtsklick −1, rot = Bedrohung, schwarz = Fortschritt.

## Installation

Manifest-URL (nachdem das Repo `gebauer/BitD_score` mit Release existiert):

```
https://github.com/gebauer/BitD_score/releases/latest/download/module.json
```

Release anlegen: `module.json` und `bitd-score.zip` als Assets an das Release hängen.

## Einrichtung

1. Modul in der Welt aktivieren.
2. Einstellungen → **Beamer-Benutzer**: den Benutzer wählen, der am Beamer-PC eingeloggt ist.
3. Optional: Skyline-Bild (siehe unten), Ordner für Scores, Regelbuch-UUID/Versatz (PDF Pager), Kartenstapel für Hindernisse.
   - 📖-Links: Der Wizard öffnet das Regelbuch-Journal selbst und springt im PDF auf *gedruckte Seite + Versatz*. Den Versatz nur in den Wizard-Einstellungen eintragen, nicht zusätzlich in PDF Pager. Klappt das nicht, „Regelbuch öffnen in“ → **Neuer Browser-Tab** wählen (eingebauter PDF-Viewer des Browsers).
4. **Kirsty** auf dem SL-PC und dem Beamer-PC installieren (Desktop-Lizenz – die Schrift wird deshalb nicht mitgeliefert). Ohne Kirsty fällt die Anzeige auf Oswald zurück.

## Crew aus Karten

Standardmäßig liest der Wizard die Crew aus den **Crew-Karten auf der Crew-Szene** (braucht *Complete Card Management*):
wer mitspielt, liegt als Karte **offen in einem Dock**; umgedrehte Karten oder Karten außerhalb der Docks zählen nicht.

- Einstellungen: **Crew: Quelle** (Karten / alle Spielercharaktere), **Crew: Szene**, **Crew: Namensanfang der Docks** (Standard `Dock`; leer = alle offenen Crew-Karten der Szene).
- Eine Karte gehört zu dem Charakter aus ihrem Flag `world.actorId` (gesetzt vom Crew-Karten-Makro). Reihenfolge = Dock-Name („Dock 2“ vor „Dock 10“).
- Beim Start und bei „Planung fortsetzen“ wird die Crew neu gelesen; im Schritt Loadout gibt es **Crew neu einlesen** – gewählte Loads der Anwesenden bleiben.
- Am Beamer zeigt der Schritt Loadout die Kartenbilder mit den Load-Knöpfen darunter, die Score-Seite kleine Kartenbilder vor den Namen.
- Findet der Wizard keine offene Karte in einem Dock (oder ist Complete Card Management nicht aktiv), nimmt er wie früher alle Spielercharaktere.

## Bedienung

- Knopf **Score-Wizard** im Journal-Verzeichnis, oder Makro:
  ```js
  game.modules.get("bitd-score").api.open();
  ```
- **Pause** gibt den Beamer frei (Karte), die Planung bleibt erhalten → „Planung fortsetzen“.
- Am Beamer: Knopf **Zur Karte** blendet das Overlay lokal aus, **Score** holt es zurück.

## Debrief („Score beenden“)

Nach dem Score führt der Debrief-Wizard in der Reihenfolge des Regelbuchs (Kap. 5, S. 145 ff.; XP S. 48–49) durch:
**Ergebnis → Payoff → Heat → Verstrickung → Fraktionen → XP → Abschluss**. Der Beamer folgt Schritt für Schritt.

- Starten: SL-Fenster → **Score beenden** (Score-Ansicht oder Liste „Laufende Scores“). Abgeschlossene Scores: **Debrief bearbeiten** – öffnet mit den gespeicherten Werten und überschreibt sie beim Abschließen.
- **Vorschläge:** Rep (`2 + Tier Ziel − Tier Crew`, leise = 0), Tribut (`Tier + 1`), Heat (Aufsehen + Zuschläge, auch eigene wie „Granate! +1“) werden vorgeschlagen und können überschrieben werden. Tier, Heat und Wanted werden aus dem Crew-Bogen gelesen.
- **Heat auf den Crew-Bogen:** Knopf „Heat auf Crew-Bogen übertragen“ (Schritt Heat oder Abschluss) schreibt Heat nach Überlauf und Wanted – mit Rückfrage. Berechnet wird aus „Heat vorher“, erneutes Klicken ersetzt also, statt doppelt zu addieren. Alles andere (Coin, Rep, Status, XP) bitte von Hand auf die Bögen übertragen.
- **Verstrickung:** Spalte nach Heat der Crew (vorher + neu), Würfel = Wanted Level (0 → 2 Würfel, niedrigster). Würfeln oder echte Würfel von Hand eintragen (1–6). Die Tabelle der Spalte wird angezeigt, die gewürfelte Zeile markiert; ein Klick auf einen Eintrag übernimmt ihn. „geheim“ = Wurf nur an die SL, nichts am Beamer und nicht auf der Überblick-Seite.
- **XP:** pro Figur drei Fragen – **Playbook? Hintergrund? Trauma?** – je 0/1/2, darunter der Playbook-Auslöser vom Bogen. Spieler können am Beamer selbst klicken; Crew-XP setzt die SL. Verzweifelte Würfe notiert ihr wie gewohnt während des Scores auf dem Bogen. Das Buch vergibt diese XP am Ende der *Sitzung* – hier wird pro Score notiert.
- **Score abschließen:** Ergebnis in die Flags (`flags.bitd-score.score.debrief`), Eintrag wird zu `NN · Name ✓`, die Überblick-Seite bekommt „Payoff & Konsequenzen“, die 🔒 SL-Seite die Verstrickung und SL-Notizen (der Abschnitt „🔒 Debrief“ wird bei erneutem Abschließen ersetzt – eigene Notizen bitte darüber schreiben).
- Makro: `game.modules.get("bitd-score").api.debrief(journalEntryId)`.

## Scores vorbereiten

SL-Fenster → **Neuen Score vorbereiten** (oder `game.modules.get("bitd-score").api.prepare()`).
Gespeichert wird im Journal-Ordner „Score-Vorbereitung“ (Besitzrechte: nur SL).

- Name, Ziel, Tier, Bezirk, Aufhänger, Beute
- NPCs mit Rolle (Auftraggeber, Ziel, Opfer, Verbündeter, Gegenspieler, Negativer Einfluss, Zeuge/Kontakt) – per Drag & Drop oder Auswahl; „öffentlich“ = erscheint auf der Score-Seite
- Notizen je Plan-Typ, Engagement-Hinweise (stark/schwach gegen …)
- Hindernisse: Karten aus dem Obstacle-Stapel oder Freitext
- Uhren (optional **verdeckt**), geheime Notizen

Im Wizard verknüpfst du die Vorbereitung im Hinweiskasten, sobald die Spieler ihr Ziel genannt haben. Übernommen werden nur Ziel und Tier (falls noch leer) – nie der Name. Alles andere siehst nur du, passend zum Schritt. „Hindernisse ziehen“ zeigt zuerst die vorbereiteten. „Score beginnen“ legt die Uhren an, schreibt die Vorbereitung auf die 🔒 SL-Seite und markiert sie als verwendet (✓).

### Import (JSON)

SL-Fenster → **Importieren (JSON)** oder `game.modules.get("bitd-score").api.importPreps(text)`.
Ein Objekt oder eine Liste im Vorbereitungs-Format. NPCs dürfen nur mit `name` angegeben werden (werden über den Actor-Namen verknüpft), Hindernis-Karten mit `{"kind":"card","name":"…"}` über den Kartennamen. Nicht Gefundenes wird als Name bzw. Freitext übernommen und gemeldet.

## Noch nicht drin

- Outro-Wizard (Payoff, Heat, Entanglements, Fraktionen) – ersetzt `MAKRO-score-beenden.js`.
- Ereignisse/Notizen-Erfassung nach dem Score in den Zeitungsbogen.
- Kurzes Aufleuchten einer Uhr am Beamer, wenn sie weiterläuft.

## Lizenzen / Assets

- Alegreya, Alegreya SC, Oswald: SIL Open Font License (siehe `fonts/`).
- Verstrickungstabelle (`scripts/data.mjs`): nach dem *Blades in the Dark* SRD von One Seven Design, lizenziert unter [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); Namen und Kurzbeschreibungen frei ins Deutsche übertragen und gekürzt.
- Holztextur (`assets/holz.webp`) und Tintenklecks (`assets/tinte.webp`, freie Grafik) sind im Modul enthalten.
- **Skylines – nicht im Repo/Release enthalten** (Lizenz unklar). Das Bild wird nur **einmal auf dem Foundry-Server** abgelegt, z. B. unter `Data/assets/bitd-score/` (übersteht Modul-Updates), und in den Einstellungen unter **Skyline-Bild** ausgewählt (Standard: `assets/bitd-score/skyline-a.webp`). Alle Clients (SL-PC, Beamer-PC) laden es von dort – auf den einzelnen Rechnern muss nichts installiert werden:
  - `skyline-a.webp` – Skyline A: <https://www.worldanvil.com/w/doskvol-zlifer/a/rowan-house-landmark>
  - `skyline-b.webp` – Skyline B: <https://www.worldanvil.com/w/doskvol-zlifer/a/coalridge-settlement>

  Ohne Bild bleibt der untere Rand der Tisch-Ansicht einfach leer.
