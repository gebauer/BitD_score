import { MOD, PLANS, CLOCK_SIZES } from "./data.mjs";
import { emptyPrep, getPrep, savePrep, NPC_ROLES } from "./prep.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const FDE = () => foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
const TE = () => foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;

/** Formular zum Vorbereiten eines Scores (nur SL). */
export class PrepEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(prepId = null, options = {}) {
    super({ ...options, id: `bitd-score-prep-${prepId ?? foundry.utils.randomID()}` });
    this.prepId = prepId;
    this.prep = (prepId && getPrep(prepId)) || emptyPrep();
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["bitd-score", "bitd-score-gm", "bitd-score-prep"],
    window: { title: "Score vorbereiten", icon: "fa-solid fa-feather", resizable: true },
    position: { width: 760, height: 820 },
    form: { handler: PrepEditor.#onSubmit, submitOnChange: false, closeOnSubmit: true },
    actions: {
      addCard: PrepEditor.#addCard,
      addText: PrepEditor.#addText,
      removeObstacle: PrepEditor.#removeAt("obstacles"),
      addClock: PrepEditor.#addClock,
      removeClock: PrepEditor.#removeAt("clocks"),
      addNpc: PrepEditor.#addNpcFromSelect,
      removeNpc: PrepEditor.#removeAt("npcs")
    }
  };

  static PARTS = { form: { template: `modules/${MOD}/templates/prep.hbs`, scrollable: [".bsp-scroll"] } };

  get title() { return this.prep.name ? `Vorbereitung: ${this.prep.name}` : "Score vorbereiten"; }

  async _prepareContext() {
    const p = this.prep;
    const deck = game.cards.getName(game.settings.get(MOD, "obstacleDeck"));
    return {
      p,
      plans: PLANS.map((x) => ({ ...x, note: p.planNotes?.[x.id] ?? "" })),
      tiers: [0, 1, 2, 3, 4, 5, 6].map((t) => ({ value: t, label: ["0", "I", "II", "III", "IV", "V", "VI"][t], selected: Number(p.tier) === t && p.tier !== null && p.tier !== "" })),
      cards: deck ? deck.cards.contents.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, "de")) : [],
      deckName: game.settings.get(MOD, "obstacleDeck"),
      hasDeck: !!deck,
      obstacles: p.obstacles.map((o, i) => ({ ...o, i, isCard: o.kind === "card" })),
      clocks: p.clocks.map((c, i) => ({ ...c, i, sizes: CLOCK_SIZES.map((s) => ({ s, selected: Number(c.size) === s })) })),
      npcs: p.npcs.map((n, i) => ({ ...n, i, roles: NPC_ROLES.map((r) => ({ ...r, selected: r.id === n.role })) })),
      roles: NPC_ROLES,
      actors: game.actors.filter((a) => a.type === "npc").map((a) => ({ uuid: a.uuid, name: a.name })).sort((a, b) => a.name.localeCompare(b.name, "de"))
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const zone = this.element.querySelector(".bsp-npcs");
    if (!zone) return;
    zone.addEventListener("dragover", (ev) => { ev.preventDefault(); zone.classList.add("drag"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
    zone.addEventListener("drop", async (ev) => {
      ev.preventDefault(); zone.classList.remove("drag");
      const data = TE().getDragEventData(ev);
      if (data?.type !== "Actor" || !data.uuid) return ui.notifications.warn("Bitte einen Actor (NPC) hierher ziehen.");
      await this.#addNpc(data.uuid);
    });
  }

  /** Formularinhalt in this.prep übernehmen (vor jedem Neu-Rendern). */
  #read() {
    const raw = foundry.utils.expandObject(new (FDE())(this.element).object);
    const p = this.prep;
    for (const k of ["name", "target", "district", "hook", "loot", "strengths", "weaknesses", "gmNotes"]) p[k] = raw[k] ?? "";
    p.tier = raw.tier === "" || raw.tier == null ? null : Number(raw.tier);
    p.planNotes = { ...p.planNotes, ...(raw.planNotes ?? {}) };
    const arr = (o) => Object.entries(o ?? {}).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    arr(raw.obstacles).forEach((o, i) => { if (p.obstacles[i]?.kind === "text") p.obstacles[i].text = o.text ?? ""; });
    p.clocks = arr(raw.clocks).map((c) => ({ name: c.name ?? "", size: Number(c.size) || 4, threat: !!c.threat, hidden: !!c.hidden }));
    arr(raw.npcs).forEach((n, i) => { if (p.npcs[i]) { p.npcs[i].role = n.role; p.npcs[i].public = !!n.public; } });
  }

  async #addNpc(uuid) {
    this.#read();
    const a = await fromUuid(uuid);
    if (!a) return;
    if (this.prep.npcs.some((n) => n.uuid === uuid)) return ui.notifications.info(`${a.name} ist schon verknüpft.`);
    this.prep.npcs.push({ uuid, name: a.name, img: a.img, role: "target", public: false });
    this.render();
  }

  static async #addNpcFromSelect() {
    const uuid = this.element.querySelector("[name=_npcPick]")?.value;
    if (uuid) await this.#addNpc(uuid);
  }

  static #addCard() {
    const sel = this.element.querySelector("[name=_cardPick]");
    const deck = game.cards.getName(game.settings.get(MOD, "obstacleDeck"));
    const card = deck?.cards.get(sel?.value);
    if (!card) return;
    this.#read();
    this.prep.obstacles.push({ kind: "card", cardId: card.id, name: card.name, img: card.faces?.[card.face ?? 0]?.img ?? card.faces?.[0]?.img ?? card.img });
    this.render();
  }

  static #addText() {
    this.#read();
    this.prep.obstacles.push({ kind: "text", text: "" });
    this.render();
  }

  static #addClock() {
    this.#read();
    this.prep.clocks.push({ name: "", size: 4, threat: true, hidden: false });
    this.render();
  }

  static #removeAt(key) {
    return function (ev, target) {
      this.#read();
      this.prep[key].splice(Number(target.dataset.index), 1);
      this.render();
    };
  }

  static async #onSubmit() {
    this.#read();
    const entry = await savePrep(this.prepId, this.prep);
    this.prepId = entry?.id ?? this.prepId;
    ui.notifications.info(`Vorbereitung gespeichert: ${this.prep.name || "Unbenannt"}`);
    Hooks.callAll(`${MOD}.prepsChanged`);
  }
}

export function openPrepEditor(id = null) {
  if (!game.user.isGM) return;
  new PrepEditor(id).render({ force: true });
}
