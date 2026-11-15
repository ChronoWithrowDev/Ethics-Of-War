import { PLANETS } from './data';
import type { PlanetId } from './data';
import type { Inventory, Settings } from './engine';

export interface SaveData { completed: Record<string, number>; inv: Inventory; settings: Settings; dev: boolean }
const KEY = 'ptolemy-solar-shooter-v1';

export const defaultSave = (): SaveData => ({
  completed: {}, inv: { owned: ['revolver'], ammo: {}, armor: 0 }, dev: false,
  settings: { sens: 1, fov: 80, volume: 0.7, music: 0.5, difficulty: 1 },
});
export function loadSave(): SaveData {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = defaultSave(); const s = JSON.parse(raw) as Partial<SaveData>; return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, inv: { ...d.inv, ...(s.inv || {}) } }; } } catch { /* ignore */ }
  return defaultSave();
}
export function writeSave(s: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export const UNLOCK_REQ: Record<PlanetId, PlanetId | null> = { earth: null, moon: 'earth', mars: 'earth', jupiter: 'mars', saturn: 'jupiter', uranus: 'saturn', neptune: 'uranus', pluto: 'neptune' };
export const completedCount = (s: SaveData, id: PlanetId) => s.completed[id] || 0;
export const isCleared = (s: SaveData, id: PlanetId) => completedCount(s, id) >= PLANETS[id].levels;
export function isUnlocked(s: SaveData, id: PlanetId) { if (s.dev) return true; const r = UNLOCK_REQ[id]; return r ? isCleared(s, r) : true; }
export function levelsAvailable(s: SaveData, id: PlanetId) { return s.dev ? PLANETS[id].levels : Math.min(PLANETS[id].levels, completedCount(s, id) + 1); }

/** Make sure every owned weapon has at least a little ammo when a level starts. */
const TOPUP: Record<string, [string, number]> = { powerline: ['pellets', 8], scatter: ['shells', 8], chaingun: ['bullets', 60], rivet: ['nails', 50], thumper: ['grenades', 5], arc: ['cells', 40], rocket: ['rockets', 5], rail: ['slugs', 4] };
export function topUp(inv: Inventory): Inventory {
  const a = { ...inv.ammo };
  inv.owned.forEach(w => { const t = TOPUP[w]; if (t && (a[t[0]] ?? 0) < t[1]) a[t[0]] = t[1]; });
  return { ...inv, ammo: a };
}
