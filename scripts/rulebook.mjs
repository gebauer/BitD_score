import { MOD } from "./data.mjs";

/* ------------------------------------------------------------------
 * 📖-Links ins Regelbuch-PDF. Der Klick wird hier selbst behandelt,
 * statt sich auf den #page-Anker von PDF Pager zu verlassen: Journal
 * öffnen, auf den PDF-Viewer warten und die Seite direkt setzen.
 * Alternativ (Einstellung) im Browser-Tab mit #page=N.
 * ------------------------------------------------------------------ */

/** HTML-Link auf eine gedruckte Seite des Regelbuchs (leer, wenn kein Regelbuch eingestellt ist). */
export function ruleLink(page) {
  const uuid = game.settings.get(MOD, "rulebookUuid");
  if (!uuid || !page) return "";
  return `<a class="bitd-rule-link" data-rule-page="${Number(page)}" data-tooltip="Regelbuch S. ${Number(page)}">📖 S. ${Number(page)}</a>`;
}

/** PDF-Seite = gedruckte Seite + Versatz (Einstellung). */
const pdfPage = (printed) => printed + (Number(game.settings.get(MOD, "rulebookOffset")) || 0);

export async function openRulebook(printed) {
  const uuid = game.settings.get(MOD, "rulebookUuid");
  const page = uuid ? await fromUuid(uuid).catch(() => null) : null;
  if (!page) return ui.notifications.warn("Score-Wizard: Regelbuch nicht gefunden – „Regelbuch: UUID der PDF-Seite“ in den Einstellungen prüfen.");
  const n = pdfPage(printed);
  const src = page.src ?? page.system?.src ?? "";

  if (game.settings.get(MOD, "rulebookOpen") === "tab" || page.type !== "pdf") {
    if (!src) return ui.notifications.warn("Score-Wizard: Die Regelbuch-Seite hat keine PDF-Datei.");
    window.open(`${foundry.utils.getRoute(src)}#page=${n}`, "_blank");
    return;
  }

  const sheet = page.parent.sheet;
  // Anker trotzdem mitgeben: PDF Pager lädt das PDF dann sofort (statt „PDF laden“-Knopf).
  await sheet.render(true, { pageId: page.id, anchor: `page=${n}` });
  sheet.bringToFront?.();
  gotoWhenLoaded(sheet, page, n);
}

/** Wartet, bis der PDF-Viewer im Journal geladen ist, und springt auf Seite n. */
function gotoWhenLoaded(sheet, page, n) {
  const deadline = Date.now() + 20000;
  const tick = () => {
    const root = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
    const frame = root?.querySelector(`[data-page-id="${page.id}"] iframe`) ?? root?.querySelector("iframe");
    let app = null;
    try { app = frame?.contentWindow?.PDFViewerApplication ?? null; } catch { app = null; }
    if (app?.pdfDocument && app.pagesCount) {
      if (n > app.pagesCount) {
        ui.notifications.warn(`Score-Wizard: PDF-Seite ${n} gibt es nicht – das PDF hat nur ${app.pagesCount} Seiten. „Regelbuch: Seitenversatz“ prüfen.`);
        return;
      }
      app.page = n;
      // Ein evtl. später ausgewerteter Anker (PDF Pager) darf die Seite nicht wieder verstellen.
      setTimeout(() => { if (app.page !== n) app.page = n; }, 700);
      return;
    }
    if (Date.now() < deadline) setTimeout(tick, 250);
    else ui.notifications.warn("Score-Wizard: Der PDF-Viewer hat nicht geladen. Einstellung „Regelbuch öffnen in“ → „Neuer Browser-Tab“ probieren.");
  };
  tick();
}

/** Klicks auf 📖-Links überall abfangen (SL-Fenster, Journal, Chat). */
export function registerRulebookLinks() {
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest?.("a.bitd-rule-link");
    if (!a) return;
    ev.preventDefault();
    ev.stopPropagation();
    openRulebook(Number(a.dataset.rulePage));
  }, true);
}
