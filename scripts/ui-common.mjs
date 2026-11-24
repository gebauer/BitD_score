import { request } from "./state.mjs";

/** Fokus und Cursor in Textfeldern über ein Neu-Rendern retten. */
export function captureFocus(root) {
  const el = document.activeElement;
  if (!root || !el || !root.contains(el) || !el.dataset?.field) return null;
  return { field: el.dataset.field, value: el.value, start: el.selectionStart, end: el.selectionEnd };
}

export function restoreFocus(root, f) {
  if (!root || !f) return;
  const el = root.querySelector(`[data-field="${f.field}"]`);
  if (!el) return;
  el.value = f.value;
  el.focus();
  try { el.setSelectionRange(f.start, f.end); } catch { /* nicht jedes Feld kann das */ }
}

/** Klick auf [data-op] und Tippen in [data-field] → request(). */
export function bindInteractions(root) {
  const pending = new Map();
  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-op]");
    if (!t || !root.contains(t)) return;
    ev.preventDefault();
    const { op, path, value, toggle, actor, key } = t.dataset;
    request(op, { path, value, toggle: toggle === "1", actor, key });
  });
  root.addEventListener("input", (ev) => {
    const t = ev.target.closest("[data-field]");
    if (!t) return;
    clearTimeout(pending.get(t.dataset.field));
    pending.set(t.dataset.field, setTimeout(() => request("set", { path: t.dataset.field, value: t.value }), 350));
  });
}
