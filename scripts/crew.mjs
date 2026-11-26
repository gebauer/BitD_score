import { MOD } from "./data.mjs";

/* ------------------------------------------------------------------
 * Crew ermitteln: aus den Crew-Karten in den Docks der Crew-Szene
 * (Complete Card Management) oder – Fallback – aus allen
 * Spielercharakteren. Nur lesen, an Karten/Szene wird nichts geändert.
 * ------------------------------------------------------------------ */

export const CCM = "complete-card-management";

/** Bisherige Logik: alle Charaktere mit Spieler-Besitzer. */
export function crewFromActors() {
  return game.actors
    .filter((a) => a.type === "character" && a.hasPlayerOwner)
    .map((a) => ({ id: a.id, name: a.name }));
}

/** Erste Szene mit einer Region, deren Name mit dem Präfix beginnt (Default für die Einstellung). */
export function guessCrewScene(prefix = "Dock") {
  if (!prefix) return "";
  return game.scenes.find((s) => s.regions?.some((r) => r.name?.startsWith(prefix)))?.id ?? "";
}

/** Liegt der Punkt in der Region? v13/v14: RegionDocument#testPoint; ältere Wege als Rückfall. */
function regionContains(region, x, y) {
  const p = { x, y, elevation: 0 };
  try { if (typeof region.testPoint === "function") return !!region.testPoint(p); } catch (err) { console.debug(`${MOD} | testPoint`, err); }
  try { if (typeof region.object?.testPoint === "function") return !!region.object.testPoint(p, 0); } catch (err) { console.debug(`${MOD} | object.testPoint`, err); }
  const polys = region.polygons ?? region.object?.polygons ?? [];
  return polys.some((poly) => poly.contains?.(x, y));
}

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Offene Crew-Karten auf der Crew-Szene (in einem Dock, falls Präfix gesetzt).
 * @returns {Promise<Array<{id:string,name:string,cardImg:string,dock:string}>>}
 */
export async function readCrewFromCards() {
  const scene = game.scenes.get(game.settings.get(MOD, "crewScene"));
  if (!scene) return [];
  const prefix = String(game.settings.get(MOD, "dockPrefix") ?? "").trim();
  const docks = prefix ? scene.regions.filter((r) => r.name?.startsWith(prefix)) : [];
  if (prefix && !docks.length) return [];

  const gx = scene.grid?.sizeX ?? scene.grid?.size ?? 100;
  const gy = scene.grid?.sizeY ?? scene.grid?.size ?? 100;
  const uuids = scene.getFlag(CCM, "cardCollection") ?? [];

  const found = [];
  for (const uuid of uuids) {
    let card = null;
    try { card = fromUuidSync(uuid) ?? await fromUuid(uuid); } catch { card = await fromUuid(uuid).catch(() => null); }
    if (!card || card.documentName !== "Card") continue;

    const actor = game.actors.get(card.getFlag("world", "actorId"));
    if (!actor) continue;
    if (card.face === null || card.face === undefined) continue;   // verdeckt = spielt nicht mit
    const f = card.getFlag(CCM, scene.id);
    if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y)) continue;

    const w = (card.width ?? 2) * gx;
    const h = (card.height ?? 3) * gy;
    const cx = f.x + w / 2, cy = f.y + h / 2;
    let dock = "";
    if (prefix) {
      dock = docks.find((r) => regionContains(r, cx, cy))?.name ?? null;
      if (dock === null) continue;
    }
    found.push({ id: actor.id, name: actor.name, cardImg: card.faces?.[card.face]?.img ?? card.img ?? "", dock, x: f.x });
  }

  found.sort((a, b) => natural(a.dock, b.dock) || a.x - b.x);
  const seen = new Set();
  return found
    .filter((c) => !seen.has(c.id) && seen.add(c.id))
    .map(({ x, ...c }) => c);
}

/** Crew je nach Einstellung lesen – mit Rückfall auf die Actor-Logik. */
export async function readCrew() {
  if (game.settings.get(MOD, "crewSource") !== "cards") return crewFromActors();
  if (!game.modules.get(CCM)?.active) return crewFromActors();
  let crew = [];
  try { crew = await readCrewFromCards(); } catch (err) { console.error(`${MOD} | Crew-Karten lesen`, err); }
  if (crew.length) return crew;
  ui.notifications.warn("Keine offenen Crew-Karten in den Docks – nehme alle Spielercharaktere.");
  return crewFromActors();
}
