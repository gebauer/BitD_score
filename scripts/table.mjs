import { MOD } from "./data.mjs";
import { getState, buildContext } from "./state.mjs";
import { captureFocus, restoreFocus, bindInteractions } from "./ui-common.mjs";

const renderTpl = (path, ctx) => (foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate)(path, ctx);

/**
 * Tisch-Ansicht: Vollbild-Overlay auf dem Beamer-Client.
 * Erscheint, wenn die SL einen Wizard oder Score zeigt; sonst ist Foundry
 * ganz normal bedienbar (Karte erkunden).
 */
export class TableView {
  constructor() {
    this.root = null;
    this.stage = null;
    this.hidden = false;
    this.lastMode = "off";
    this._onResize = () => this.fit();
  }

  async render() {
    const s = getState();
    if (s.mode !== this.lastMode) this.hidden = false;   // neuer Modus → wieder zeigen
    this.lastMode = s.mode;

    if (s.mode === "off") return this.destroy();
    this.ensure();

    const ctx = buildContext(s);
    ctx.table = true;
    const f = captureFocus(this.stage);
    const html = await renderTpl(`modules/${MOD}/templates/table.hbs`, ctx);
    if (!this.stage) return;   // während des Renderns zerstört (z. B. SL hat pausiert)
    this.stage.innerHTML = html;
    restoreFocus(this.stage, f);
    this.applyHidden();
    this.fit();
  }

  ensure() {
    if (this.root) return;
    this.root = document.createElement("div");
    this.root.id = "bitd-score-table";
    this.root.innerHTML = `<div class="bst-stage"></div>
      <button type="button" class="bst-hide" aria-label="Tisch-Ansicht ausblenden"><i class="fa-solid fa-map"></i> Zur Karte</button>
      <button type="button" class="bst-show" aria-label="Tisch-Ansicht zeigen"><i class="fa-solid fa-mask"></i> Score</button>`;
    document.body.append(this.root);
    this.stage = this.root.querySelector(".bst-stage");
    bindInteractions(this.stage);
    this.root.querySelector(".bst-hide").addEventListener("click", () => { this.hidden = true; this.applyHidden(); });
    this.root.querySelector(".bst-show").addEventListener("click", () => { this.hidden = false; this.applyHidden(); });
    window.addEventListener("resize", this._onResize);
  }

  applyHidden() {
    if (!this.root) return;
    this.root.classList.toggle("is-hidden", this.hidden);
    document.body.classList.toggle("bitd-score-table-active", !this.hidden);
  }

  /** Bühne ist 1920×1080 gestaltet und wird auf das Fenster skaliert. */
  fit() {
    if (!this.stage) return;
    const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.stage.style.transform = `translate(-50%, -50%) scale(${k})`;
  }

  destroy() {
    if (!this.root) return;
    window.removeEventListener("resize", this._onResize);
    this.root.remove();
    this.root = this.stage = null;
    document.body.classList.remove("bitd-score-table-active");
  }
}
