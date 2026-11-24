import { MOD, STEPS, CLOCK_SIZES } from "./data.mjs";
import { getState, setState, buildContext, request, clockStyle } from "./state.mjs";
import { startWizard, resetWizard, rollEngagement, drawObstacles, beginScore, showScore, runningScores, clockOps, ruleLink } from "./score.mjs";
import { captureFocus, restoreFocus, bindInteractions } from "./ui-common.mjs";
import { listPreps, getPrep, npcRoleLabel } from "./prep.mjs";
import { openPrepEditor } from "./prep-app.mjs";
import { PLANS } from "./data.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TE = () => foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;

/** Steuerfenster der SL. */
export class ScoreGMApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bitd-score-gm",
    classes: ["bitd-score", "bitd-score-gm"],
    window: { title: "Score-Wizard", icon: "fa-solid fa-mask", resizable: true },
    position: { width: 760, height: "auto" },
    actions: {
      start: () => startWizard({ fresh: true }),
      resume: () => startWizard({ fresh: false }),
      reset: ScoreGMApp.#reset,
      next: () => setState((st) => { st.step = Math.min(STEPS.length - 1, st.step + 1); }),
      prev: () => setState((st) => { st.step = Math.max(0, st.step - 1); }),
      goto: (ev, t) => setState((st) => { st.step = Number(t.dataset.step); }),
      roll: () => rollEngagement(),
      reroll: () => setState((st) => { st.roll = null; }),
      obstacles: () => drawObstacles(),
      begin: async () => { const e = await beginScore(); if (e) ui.notifications.info(`Score angelegt: ${e.name}`); },
      release: () => setState((st) => { st.mode = "off"; }),
      backToWizard: () => setState((st) => { st.mode = "wizard"; }),
      show: (ev, t) => showScore(t.dataset.entry),
      openJournal: () => { const e = game.journal.get(getState().scoreId); e?.sheet.render(true); },
      clockAdd: ScoreGMApp.#clockAdd,
      clockTick: (ev, t) => clockOps.tick(t.dataset.clock, 1),
      clockRemove: (ev, t) => clockOps.remove(t.dataset.clock),
      clockThreat: (ev, t) => clockOps.toggleThreat(t.dataset.clock),
      clockHidden: (ev, t) => clockOps.toggleHidden(t.dataset.clock),
      newPrep: () => openPrepEditor(null),
      editPrep: (ev, t) => openPrepEditor(t.dataset.prep),
      unlinkPrep: () => setState((st) => { st.prepId = null; })
    }
  };

  static PARTS = { main: { template: `modules/${MOD}/templates/gm.hbs` } };

  async _prepareContext() {
    const s = getState();
    const ctx = buildContext(s);
    ctx.gm = true;
    ctx.running = runningScores();
    ctx.clockSizes = CLOCK_SIZES;
    ctx.ruleHTML = await TE().enrichHTML(ruleLink(ctx.step.page));
    ctx.gatherHTML = await TE().enrichHTML(ruleLink(36));
    ctx.loadRuleHTML = await TE().enrichHTML(ruleLink(57));
    const entry = s.scoreId ? game.journal.get(s.scoreId) : null;
    ctx.rawClocks = (entry?.getFlag(MOD, "clocks") ?? []).map((c) => ({ ...c, label: `${c.value}/${c.size}`, style: clockStyle(c) }));
    ctx.preps = listPreps();
    ctx.allPreps = listPreps({ includeUsed: true });
    const prep = s.prepId ? getPrep(s.prepId) : null;
    if (prep) {
      const planId = s.draft.plan;
      ctx.prep = {
        id: s.prepId, name: prep.name || "Unbenannt",
        planLabel: PLANS.find((p) => p.id === planId)?.label ?? "",
        planNote: planId ? prep.planNotes?.[planId] ?? "" : "",
        otherPlans: PLANS.filter((p) => p.id !== planId && prep.planNotes?.[p.id]?.trim()).map((p) => p.label).join(", "),
        hook: prep.hook, loot: prep.loot, strengths: prep.strengths, weaknesses: prep.weaknesses,
        npcs: prep.npcs.map((n) => ({ ...n, roleLabel: npcRoleLabel(n.role) })),
        obstacleCount: prep.obstacles.length, clockCount: prep.clocks.length,
        hiddenClocks: prep.clocks.filter((c) => c.hidden).length
      };
    }
    ctx.beamerUser = game.users.get(game.settings.get(MOD, "beamerUser"))?.name ?? null;
    ctx.beamerOnline = !!game.users.get(game.settings.get(MOD, "beamerUser"))?.active;
    return ctx;
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    bindInteractions(this.element);
    this.element.addEventListener("change", (ev) => {
      const sel = ev.target.closest("[name=prepLink]");
      if (!sel?.value) return;
      const id = sel.value;
      setState((st) => {
        st.prepId = id;
        const p = getPrep(id);
        // Nur Ziel/Tier übernehmen – und nur, wenn die Spieler noch nichts eingetragen haben. Den Namen nie (Spoiler).
        if (p && !st.draft.target) st.draft.target = p.target;
        if (p && st.draft.tier == null && p.tier != null && p.tier !== "") st.draft.tier = Number(p.tier);
      });
    });
    // Rechtsklick auf eine Uhr = ein Segment zurück
    this.element.addEventListener("contextmenu", (ev) => {
      const t = ev.target.closest("[data-action='clockTick']");
      if (!t) return;
      ev.preventDefault();
      clockOps.tick(t.dataset.clock, -1);
    });
    const rerender = async () => {
      if (!this.rendered) return;
      const f = captureFocus(this.element);
      await this.render();
      restoreFocus(this.element, f);
    };
    this._hook = Hooks.on(`${MOD}.stateChanged`, rerender);
    this._hook2 = Hooks.on(`${MOD}.prepsChanged`, rerender);
  }

  _onClose(options) {
    super._onClose?.(options);
    if (this._hook) Hooks.off(`${MOD}.stateChanged`, this._hook);
    if (this._hook2) Hooks.off(`${MOD}.prepsChanged`, this._hook2);
  }

  static async #reset() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Wizard zurücksetzen" },
      content: "<p>Alle Eingaben dieses Wizard-Durchlaufs verwerfen?</p>"
    });
    if (ok) await resetWizard();
  }

  static async #clockAdd(ev, target) {
    const form = target.closest(".bss-clockform");
    const name = form.querySelector("[name=clockName]").value.trim();
    const size = Number(form.querySelector("[name=clockSize]").value);
    const threat = form.querySelector("[name=clockThreat]").checked;
    await clockOps.add(name, size, threat);
  }
}

let app = null;
export function openGMApp() {
  if (!game.user.isGM) return ui.notifications.warn("Score-Wizard: Nur für die SL.");
  app ??= new ScoreGMApp();
  app.render({ force: true });
  return app;
}

// Für den Fall, dass jemand ohne SL-Rechte die API aufruft: Beamer-Wunsch weiterreichen
export { request };
