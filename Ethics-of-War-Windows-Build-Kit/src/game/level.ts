import * as THREE from 'three';
import { PLANETS, ENEMIES, WEAPON_LOCATIONS, WEAPON_BY_ID, LEVEL_LENGTH_SCALE } from './data';
import type { PlanetId, Planet, EnemyDef, AmmoType, LevelEnv } from './data';
import { makeTexture, mulberry } from './textures';

export const CELL = 4;
export const CRATE_H = 1.5;
export const T_WALL = 0, T_FLOOR = 1, T_DOOR = 2, T_SECRET = 3, T_PILLAR = 4, T_DOORO = 5, T_CRATE = 6, T_TREE = 7, T_CLIFF = 8, T_VOID = 9;
export const isSolidT = (t: number) => t === T_WALL || t === T_DOOR || t === T_SECRET || t === T_PILLAR || t === T_TREE || t === T_CLIFF;
export const isPassableT = (t: number) => t === T_FLOOR || t === T_DOOR || t === T_DOORO || t === T_CRATE;
export const CORR_H = 5.5;
export const HUT_H = 4.6;

export type RoomKind = 'start' | 'normal' | 'boss' | 'exit' | 'secret' | 'hut' | 'yard' | 'platform';
export interface Room { id: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; ceil: number; fy: number; outdoor: boolean; kind: RoomKind; alt: boolean; lamp: number; col: number }
export interface DoorInfo { id: number; cells: { x: number; y: number }[]; axis: 'x' | 'z'; cx: number; cz: number; open: number; hold: number; panels: THREE.Mesh[]; state: 'closed' | 'open' }
export interface SecretInfo { id: number; x: number; y: number; dx: number; dy: number; room: number; open: number; opening: boolean; found: boolean; isRock: boolean; mesh?: THREE.Mesh; cx: number; cz: number }
export interface EnemySpawn { def: string; x: number; z: number; y: number; room: number; ambush: boolean }
export interface PickupSpawn { kind: 'health' | 'armor' | 'ammo' | 'weapon'; ammo?: AmmoType; weapon?: string; value: number; x: number; z: number; y: number; secret: boolean }
export interface Lamp { x: number; y: number; z: number; room: number; color: number; power: number }
export interface TreeSpot { x: number; z: number; fy: number; s: number }
export interface Mountain { x: number; z: number; r: number; h: number; baseY: number }
export interface Deck { id: number; room: number; x0: number; z0: number; x1: number; z1: number; y: number; thick: number }
export interface Stair { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number; axis: 'x' | 'z'; dir: 1 | -1; steps: number; room: number }
export interface Ladder { x: number; z: number; nx: number; nz: number; y0: number; y1: number; room: number }
export interface AntigravPad { x: number; y: number; z: number; w: number; d: number; color: number }
export interface ArenaSpawn { x: number; y: number; z: number }
export interface ArenaInfo { name: string; description: string; spawns: ArenaSpawn[] }

export interface LevelData {
  planet: PlanetId; level: number; name: string; env: LevelEnv; isBoss: boolean; seed: number;
  arena?: ArenaInfo;
  W: number; H: number; tiles: Uint8Array; ceil: Float32Array; sky: Uint8Array; wallTop: Float32Array; floorH: Float32Array; roomOf: Int16Array; reach: Uint8Array;
  rooms: Room[]; doors: DoorInfo[]; secrets: SecretInfo[]; lamps: Lamp[]; trees: TreeSpot[]; mountains: Mountain[];
  decks: Deck[]; stairs: Stair[]; ladders: Ladder[]; antigravPads: AntigravPad[];
  spawn: { x: number; z: number; y: number; yaw: number }; exit: { x: number; z: number; y: number }; exitKind: 'portal' | 'elevator'; exitYaw: number;
  enemies: EnemySpawn[]; pickups: PickupSpawn[]; bossPos?: { x: number; z: number }; totalSecrets: number;
  minFloorY: number;
}

export const AMMO_PICK: Record<AmmoType, number> = { inf: 0, pellets: 6, shells: 6, bullets: 50, nails: 40, grenades: 5, cells: 30, rockets: 5, slugs: 4, vector: 1 };

type ColKind = 'bld' | 'yard' | 'sky' | 'boss';
interface Col { kind: ColKind; x0: number; w: number; hw: number; hh: number; nodes: number[]; E: number; rise: number }

/** Each world has its own closed monster roster (the Moon gauntlet uses everything). */
export function enemyPool(planet: Planet, level: number): { def: EnemyDef; w: number }[] {
  if (planet.id === 'moon') return ENEMIES.map(e => ({ def: e, w: e.weight }));
  return ENEMIES.filter(e => e.intro[0] === planet.tier && e.intro[1] <= level).map(e => {
    let w = e.weight; if (level - e.intro[1] < 2) w *= 1.8;
    return { def: e, w };
  });
}

export function stairHeightAt(st: Stair, x: number, z: number): number {
  const t = st.axis === 'x'
    ? (st.dir > 0 ? (x - st.x0) / Math.max(0.01, st.x1 - st.x0) : (st.x1 - x) / Math.max(0.01, st.x1 - st.x0))
    : (st.dir > 0 ? (z - st.z0) / Math.max(0.01, st.z1 - st.z0) : (st.z1 - z) / Math.max(0.01, st.z1 - st.z0));
  return st.y0 + (st.y1 - st.y0) * Math.max(0, Math.min(1, t));
}

export function generateLevel(planetId: PlanetId, levelNum: number, seed: number, owned: string[]): LevelData {
  const planet = PLANETS[planetId]; const th = planet.theme; const rnd = mulberry(seed);
  const isBoss = levelNum >= planet.levels;
  const env: LevelEnv = planet.levelEnvs[levelNum - 1] || 'mixed';
  const ascend = (planetId === 'earth' && levelNum >= 14) || (planetId === 'pluto' && levelNum === 5);
  const gorge = /dikes|creek|canyon|trench|pass|sink/i.test(planet.levelNames[levelNum - 1] || '');
  const hasTrees = planetId === 'earth' && env !== 'indoor';
  const N = Math.max(5, Math.min(11, Math.round((6 + Math.floor(levelNum / 2.6)) * LEVEL_LENGTH_SCALE)));

  // ---- column plan matching the coherent level environment
  const kinds: ColKind[] = [];
  for (let i = 0; i < N; i++) {
    if (isBoss && i === N - 1) kinds.push('boss');
    else if (env === 'indoor') kinds.push('bld');
    else if (env === 'outdoor') kinds.push('yard');
    else if (env === 'skybridge') kinds.push(i === 0 || i >= N - 1 || rnd() < 0.32 ? 'bld' : 'sky');
    else kinds.push(i === 0 || i >= N - 2 ? 'bld' : rnd() < 0.45 ? 'yard' : 'bld');
  }
  if (env === 'mixed' && !kinds.includes('yard')) kinds[Math.max(1, Math.floor(N / 2))] = 'yard';
  if (env === 'skybridge' && !kinds.includes('sky')) kinds[Math.max(1, Math.floor(N / 2))] = 'sky';

  const H = 50; const ROWS = [13, 37]; const MID = 25;
  const cols: Col[] = []; let xcur = 4;
  kinds.forEach(k => {
    let w: number, hw = 0, hh = 0;
    if (k === 'bld') w = 22;
    else if (k === 'boss') { hw = 10; hh = 10; w = 2 * hw + 8; }
    else if (k === 'sky') { hw = 12 + Math.floor(rnd() * 4); hh = 12; w = 2 * hw + 8; }
    else { hw = 14 + Math.floor(rnd() * 6); hh = 16 + Math.floor(rnd() * 4); w = 2 * hw + 10; }
    cols.push({ kind: k, x0: xcur, w, hw, hh, nodes: [], E: 0, rise: 0 }); xcur += w;
  });
  const W = xcur + 4;
  let Eacc = 0;
  cols.forEach(c => {
    c.E = Eacc;
    if (ascend && c.kind === 'yard') { c.rise = 2.6 + rnd() * 2.0; Eacc += c.rise; }
    else if (env === 'skybridge' && c.kind === 'sky') { const step = (rnd() < 0.5 ? 1.5 : -1.0); c.rise = step; Eacc = Math.max(-2, Eacc + step); }
  });

  const baseTile = env === 'skybridge' ? T_VOID : env === 'outdoor' ? T_CLIFF : T_WALL;
  const tiles = new Uint8Array(W * H).fill(baseTile);
  const ceil = new Float32Array(W * H); const sky = new Uint8Array(W * H); const wallTop = new Float32Array(W * H); const floorH = new Float32Array(W * H); const roomOf = new Int16Array(W * H).fill(-1);
  const I = (x: number, y: number) => y * W + x;
  const rooms: Room[] = []; const doors: DoorInfo[] = []; const lamps: Lamp[] = []; const secrets: SecretInfo[] = [];
  const decks: Deck[] = []; const stairs: Stair[] = []; const ladders: Ladder[] = []; const antigravPads: AntigravPad[] = [];
  const lampCols = [th.lamp, th.lamp, th.lamp, 0xff6a40, 0x70b0ff];

  const mkRoom = (col: number, cx: number, cy: number, hw: number, hh: number, outdoor: boolean, kind: RoomKind, ceilH: number): Room => {
    const r: Room = { id: rooms.length, x0: cx - hw, x1: cx + hw - 1, y0: cy - hh, y1: cy + hh - 1, cx, cy, ceil: ceilH, fy: 0, outdoor, kind, alt: rnd() < 0.4, lamp: kind === 'boss' ? 0xff5030 : lampCols[Math.floor(rnd() * lampCols.length)], col };
    rooms.push(r); cols[col].nodes.push(r.id); return r;
  };
  cols.forEach((c, ci) => {
    if (c.kind === 'bld') {
      const two = ci > 0 && ci < N - 2 && rnd() < 0.48; const ys = two ? ROWS : [MID];
      ys.forEach(cy => {
        const hw = 5 + Math.floor(rnd() * 3), hh = 5 + Math.floor(rnd() * 3);
        const tall = ci > 0 && rnd() < 0.6;
        mkRoom(ci, c.x0 + Math.floor(c.w / 2), cy, hw, hh, false, ci === 0 ? 'start' : ci === N - 1 ? 'exit' : 'normal', tall ? 8.8 + Math.floor(rnd() * 2) : 6.2 + Math.floor(rnd() * 2));
      });
    } else if (c.kind === 'boss') {
      const outdoor = env === 'outdoor' || env === 'skybridge' || (env === 'mixed' && (planetId === 'earth' || planetId === 'mars' || planetId === 'pluto' || rnd() < 0.6));
      mkRoom(ci, c.x0 + c.hw + 4, MID, c.hw, c.hh, outdoor, 'boss', outdoor ? CORR_H : 14);
    } else if (c.kind === 'sky') {
      // Reserve column marker; actual floating islands will be placed below
      mkRoom(ci, c.x0 + c.hw + 4, MID, c.hw, c.hh, true, 'platform', CORR_H);
    } else {
      mkRoom(ci, c.x0 + c.hw + 5, MID, c.hw, c.hh, true, 'yard', CORR_H);
    }
  });

  // ---- continuous 3D terrain elevation (hills, ridges, valleys/gorges + ascending climbs)
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28;
  const colOfX = (x: number) => { for (let i = cols.length - 1; i >= 0; i--) if (x >= cols[i].x0) return i; return 0; };
  const rawBaseElev = (x: number) => {
    const ci = colOfX(x); const c = cols[ci]; if (c.rise === 0) return c.E;
    const r = rooms[c.nodes[0]]; const t = Math.max(0, Math.min(1, (x - r.x0) / Math.max(1, r.x1 - r.x0))); return c.E + c.rise * t;
  };
  const terrainNoise = (x: number, y: number) => {
    const wx = x * 0.28, wz = y * 0.28;
    let n = Math.sin(wx + ph1) * Math.cos(wz + ph2) * 1.35 + Math.sin(wx * 0.55 - wz * 0.7 + ph3) * 0.9;
    if (gorge) n += Math.pow(Math.abs(y - MID) / 14, 1.8) * 2.8 - 1.2;
    return n;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ci = colOfX(x); const c = cols[ci];
    let h = rawBaseElev(x);
    if (c.kind === 'yard' || (env === 'outdoor' && c.kind === 'boss')) {
      const r = rooms[c.nodes[0]];
      const edgeX = Math.min(x - r.x0, r.x1 - x);
      const edgeY = Math.min(y - r.y0, r.y1 - y);
      const blend = Math.max(0, Math.min(1, Math.min(edgeX, edgeY) / 3.5));
      h += terrainNoise(x, y) * blend;
    }
    floorH[I(x, y)] = h;
  }
  rooms.forEach(r => { r.fy = floorH[I(r.cx, r.cy)]; });

  // ---- carve rooms (except 'sky' columns which carve floating platform chains)
  rooms.forEach(r => {
    if (r.kind === 'platform') return;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const i = I(x, y); tiles[i] = T_FLOOR; ceil[i] = floorH[i] + r.ceil; sky[i] = r.outdoor ? 1 : 0; roomOf[i] = r.id;
    }
    if (!r.outdoor) {
      // surround building footprint with solid T_WALL (important for skybridge/outdoor levels!)
      for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) continue;
        const i = I(x, y); if (tiles[i] === T_VOID || tiles[i] === T_CLIFF) tiles[i] = T_WALL;
      }
      const hw = (r.x1 - r.x0 + 1) / 2, hh = (r.y1 - r.y0 + 1) / 2; const lx = Math.max(2, Math.floor(hw / 2)), ly = Math.max(2, Math.floor(hh / 2));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) lamps.push({ x: (r.cx + sx * lx + 0.5) * CELL, y: r.fy + r.ceil - 0.3, z: (r.cy + sy * ly + 0.5) * CELL, room: r.id, color: r.lamp, power: 1.25 });
      if (env === 'skybridge') {
        antigravPads.push({ x: (r.cx + 0.5) * CELL, y: r.fy - 0.5, z: (r.cy + 0.5) * CELL, w: (r.x1 - r.x0 + 3) * CELL, d: (r.y1 - r.y0 + 3) * CELL, color: th.lamp });
      }
    } else if (env === 'skybridge' && r.kind === 'boss') {
      // suspended boss platform
      antigravPads.push({ x: (r.cx + 0.5) * CELL, y: r.fy - 0.5, z: (r.cy + 0.5) * CELL, w: (r.x1 - r.x0 + 2) * CELL, d: (r.y1 - r.y0 + 2) * CELL, color: 0xff5040 });
    }
  });

  // ---- carve floating platforms inside 'sky' columns
  const skyPlatforms: { col: number; islands: Room[] }[] = [];
  cols.forEach((c, ci) => {
    if (c.kind !== 'sky') return;
    const host = rooms[c.nodes[0]];
    const islands: Room[] = [];
    // Split the column into 2 or 3 floating islands separated by 1-cell jump gaps (4m gap, very clearable with jump!)
    const segs = 3;
    const availX = host.x1 - host.x0 + 1;
    const segW = Math.floor((availX - (segs - 1) * 2) / segs); // 2-cell (8 m) void gaps between islands
    const laneY = MID + Math.floor((rnd() - 0.5) * 6);
    for (let s = 0; s < segs; s++) {
      const ix0 = host.x0 + s * (segW + 2);
      const ix1 = s === segs - 1 ? host.x1 : ix0 + segW - 1;
      const midIsland = s === 1;
      const ih = midIsland ? 4 : 2;
      const cy = laneY + (midIsland ? 0 : Math.floor((rnd() - 0.5) * 2));
      const iy0 = Math.max(8, cy - ih), iy1 = Math.min(H - 9, cy + ih);
      const fy = c.E + (s / Math.max(1, segs - 1)) * c.rise - s * 0.5; // each hop drops slightly so the wider gap stays clearable
      const r: Room = { id: rooms.length, x0: ix0, x1: ix1, y0: iy0, y1: iy1, cx: Math.floor((ix0 + ix1) / 2), cy: Math.floor((iy0 + iy1) / 2), ceil: CORR_H, fy, outdoor: true, kind: 'platform', alt: s % 2 === 1, lamp: th.lamp, col: ci };
      rooms.push(r); islands.push(r);
      for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
        const i = I(x, y); tiles[i] = T_FLOOR; floorH[i] = fy; ceil[i] = fy + CORR_H; sky[i] = 1; roomOf[i] = r.id;
      }
      antigravPads.push({ x: ((ix0 + ix1 + 1) / 2) * CELL, y: fy - 0.45, z: ((iy0 + iy1 + 1) / 2) * CELL, w: (ix1 - ix0 + 1) * CELL * 0.92, d: (iy1 - iy0 + 1) * CELL * 0.92, color: th.lamp });
    }
    // Optional side bonus island with ammo/health reachable via a 1-cell jump
    if (rnd() < 0.7 && islands[1]) {
      const mid = islands[1]; const dir = rnd() < 0.5 ? -1 : 1;
      const bx0 = mid.cx - 2, bx1 = mid.cx + 1;
      const by0 = dir < 0 ? mid.y0 - 6 : mid.y1 + 3, by1 = by0 + 3;
      if (by0 > 4 && by1 < H - 5) {
        const fy = mid.fy + 0.8;
        const br: Room = { id: rooms.length, x0: bx0, x1: bx1, y0: by0, y1: by1, cx: mid.cx, cy: Math.floor((by0 + by1) / 2), ceil: CORR_H, fy, outdoor: true, kind: 'platform', alt: true, lamp: 0x60ffb0, col: ci };
        rooms.push(br);
        for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = I(x, y); tiles[i] = T_FLOOR; floorH[i] = fy; ceil[i] = fy + CORR_H; sky[i] = 1; roomOf[i] = br.id; }
        antigravPads.push({ x: ((bx0 + bx1 + 1) / 2) * CELL, y: fy - 0.45, z: ((by0 + by1 + 1) / 2) * CELL, w: 4 * CELL * 0.92, d: 4 * CELL * 0.92, color: 0x60ffb0 });
      }
    }
    // Mark outer placeholder host inert so no pickups/enemies spawn on empty host bounds
    host.x1 = host.x0 - 1;
    skyPlatforms.push({ col: ci, islands });
  });

  // ---- links between consecutive columns (corridors, passes, skybridges)
  let doorId = 0;
  const addDoor = (cells: { x: number; y: number }[], axis: 'x' | 'z') => {
    cells.forEach(c => { tiles[I(c.x, c.y)] = T_DOOR; });
    const cxw = (cells.reduce((s, c) => s + c.x + 0.5, 0) / cells.length) * CELL, czw = (cells.reduce((s, c) => s + c.y + 0.5, 0) / cells.length) * CELL;
    doors.push({ id: doorId++, cells, axis, cx: cxw, cz: czw, open: 0, hold: 0, panels: [], state: 'closed' });
  };
  const carve = (x: number, y: number, outdoor: boolean) => {
    const i = I(x, y); if (tiles[i] === T_FLOOR && roomOf[i] >= 0) return;
    tiles[i] = T_FLOOR; sky[i] = outdoor ? 1 : 0; ceil[i] = floorH[i] + CORR_H; roomOf[i] = -1;
    if (!outdoor) {
      // ensure corridor walls are T_WALL (not T_VOID/T_CLIFF) so corridors are solid enclosed buildings!
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dz; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = I(nx, ny); if (tiles[ni] === T_VOID || tiles[ni] === T_CLIFF) tiles[ni] = T_WALL;
      }
    }
  };
  const corridor = (A: Room, B: Room, doorA: boolean, doorB: boolean, straightY?: number, openAir = false) => {
    const yA = straightY ?? A.cy + (-1 + Math.floor(rnd() * 3)); const yB = straightY ?? B.cy + (-1 + Math.floor(rnd() * 3));
    const gs = A.x1 + 1, ge = B.x0 - 1; const xm = Math.floor((gs + ge) / 2) - 1;
    for (let x = gs; x <= xm + 1; x++) { carve(x, yA, openAir); carve(x, yA + 1, openAir); }
    if (yA !== yB) for (let y = Math.min(yA, yB); y <= Math.max(yA, yB) + 1; y++) { carve(xm, y, openAir); carve(xm + 1, y, openAir); }
    for (let x = xm; x <= ge; x++) { carve(x, yB, openAir); carve(x, yB + 1, openAir); }
    if (doorA) addDoor([{ x: gs, y: yA }, { x: gs, y: yA + 1 }], 'x');
    if (doorB) addDoor([{ x: ge, y: yB }, { x: ge, y: yB + 1 }], 'x');
    if (!openAir) {
      lamps.push({ x: (xm + 1) * CELL, y: floorH[I(xm, yA)] + CORR_H - 0.3, z: (yA + 1) * CELL, room: -1, color: th.lamp, power: 0.9 });
      if (yA !== yB) lamps.push({ x: (xm + 1) * CELL, y: floorH[I(xm, yB)] + CORR_H - 0.3, z: (yB + 1) * CELL, room: -1, color: th.lamp, power: 0.9 });
    }
  };
  const link = (aId: number, bId: number) => {
    const A = rooms[aId], B = rooms[bId];
    const ay = A.kind === 'yard', by = B.kind === 'yard';
    const ap = A.kind === 'platform', bp = B.kind === 'platform';
    if (ap || bp) {
      // Connect building ↔ floating platform chain with an L-shaped skybridge catwalk (plus optional 1-cell jump gap on straight run)
      const src = ap ? skyPlatforms.find(s => s.col === A.col)!.islands.slice(-1)[0] : A;
      const dst = bp ? skyPlatforms.find(s => s.col === B.col)!.islands[0] : B;
      const gs = src.x1 + 1, ge = dst.x0 - 1;
      const yA = Math.max(src.y0 + 1, Math.min(src.y1 - 2, src.cy));
      const yB = Math.max(dst.y0 + 1, Math.min(dst.y1 - 2, dst.cy));
      const xm = Math.floor((gs + ge) / 2);
      const putSkyTile = (x: number, y: number, fy: number) => {
        const i = I(x, y); if (tiles[i] === T_FLOOR && roomOf[i] >= 0) return;
        tiles[i] = T_FLOOR; floorH[i] = fy; ceil[i] = fy + CORR_H; sky[i] = 1; roomOf[i] = -1;
      };
      for (let x = gs; x <= xm; x++) { putSkyTile(x, yA, src.fy); putSkyTile(x, yA + 1, src.fy); }
      if (yA !== yB) for (let y = Math.min(yA, yB); y <= Math.max(yA, yB) + 1; y++) { putSkyTile(xm, y, (src.fy + dst.fy) * 0.5); putSkyTile(xm + 1, y, (src.fy + dst.fy) * 0.5); }
      const gapStart = Math.floor((xm + 1 + ge) / 2) - 1;
      for (let x = xm + 1; x <= ge; x++) {
        // 2-cell jump gap on the straight run after the bend when space permits
        if (ge - xm >= 6 && (x === gapStart || x === gapStart + 1)) continue;
        putSkyTile(x, yB, dst.fy); putSkyTile(x, yB + 1, dst.fy);
      }
      if (!ap && gs <= ge) addDoor([{ x: gs, y: yA }, { x: gs, y: yA + 1 }], 'x');
      if (!bp && gs <= ge) addDoor([{ x: ge, y: yB }, { x: ge, y: yB + 1 }], 'x');
      return;
    }
    if (!ay && !by) corridor(A, B, true, true);
    else if (!ay && by) { const y = A.cy + (-1 + Math.floor(rnd() * 3)); corridor(A, B, true, false, y); }
    else if (ay && !by) { const y = B.cy + (-1 + Math.floor(rnd() * 3)); corridor(A, B, false, true, y); }
    else { // yard → yard: 1 or 2 wide natural mountain passes
      const n = 1 + (rnd() < 0.65 ? 1 : 0); const ylo = Math.max(A.y0, B.y0) + 2, yhi = Math.min(A.y1, B.y1) - 5;
      for (let k = 0; k < n; k++) {
        const y = ylo + Math.floor(rnd() * Math.max(1, yhi - ylo));
        for (let x = A.x1 + 1; x <= B.x0 - 1; x++) for (let yy = y; yy < y + 4; yy++) carve(x, yy, true);
      }
    }
  };
  for (let ci = 0; ci < N - 1; ci++) {
    const a = cols[ci].nodes, b = cols[ci + 1].nodes;
    if (a.length === 1 && b.length === 1) link(a[0], b[0]);
    else if (a.length === 1) { link(a[0], b[0]); link(a[0], b[1]); }
    else if (b.length === 1) { link(a[0], b[0]); link(a[1], b[0]); }
    else { link(a[0], b[0]); link(a[1], b[1]); if (rnd() < 0.5) link(rnd() < 0.5 ? a[0] : a[1], rnd() < 0.5 ? b[0] : b[1]); }
  }

  // ---- huts inside yards (solid buildings with roofs!)
  const yardRooms = rooms.filter(r => r.kind === 'yard');
  yardRooms.forEach(yr => {
    const n = Math.floor(rnd() * 3); const placed: Room[] = [];
    for (let k = 0; k < n; k++) for (let t = 0; t < 20; t++) {
      const hw = 2 + Math.floor(rnd() * 2), hh = 2 + Math.floor(rnd() * 2);
      const cx = yr.x0 + 5 + hw + Math.floor(rnd() * (yr.x1 - yr.x0 - 10 - 2 * hw)), cy = yr.y0 + 5 + hh + Math.floor(rnd() * (yr.y1 - yr.y0 - 10 - 2 * hh));
      if (placed.some(p => Math.abs(p.cx - cx) < hw + (p.x1 - p.x0) / 2 + 4 && Math.abs(p.cy - cy) < hh + (p.y1 - p.y0) / 2 + 4)) continue;
      if (Math.abs(cx - yr.cx) < hw + 4 && Math.abs(cy - yr.cy) < hh + 4) continue;
      const fy = floorH[I(cx, cy)];
      const hut: Room = { id: rooms.length, x0: cx - hw, x1: cx + hw - 1, y0: cy - hh, y1: cy + hh - 1, cx, cy, ceil: HUT_H, fy, outdoor: false, kind: 'hut', alt: rnd() < 0.5, lamp: lampCols[Math.floor(rnd() * lampCols.length)], col: yr.col };
      rooms.push(hut); placed.push(hut);
      for (let y = hut.y0 - 1; y <= hut.y1 + 1; y++) for (let x = hut.x0 - 1; x <= hut.x1 + 1; x++) {
        const i = I(x, y); const inside = x >= hut.x0 && x <= hut.x1 && y >= hut.y0 && y <= hut.y1;
        floorH[i] = fy; // level ground pad for the hut
        if (inside) { tiles[i] = T_FLOOR; sky[i] = 0; ceil[i] = fy + HUT_H; roomOf[i] = hut.id; } else { tiles[i] = T_WALL; roomOf[i] = -1; }
      }
      addDoor([{ x: hut.x0 - 1, y: cy }], 'x'); addDoor([{ x: hut.x1 + 1, y: cy }], 'x');
      for (const c of [{ x: hut.x0 - 1, y: cy }, { x: hut.x1 + 1, y: cy }]) { const i = I(c.x, c.y); ceil[i] = fy + HUT_H; sky[i] = 0; roomOf[i] = hut.id; }
      lamps.push({ x: (cx + 0.5) * CELL, y: fy + HUT_H - 0.3, z: (cy + 0.5) * CELL, room: hut.id, color: hut.lamp, power: 1.3 });
      break;
    }
  });

  // ---- interior architecture: upper mezzanine decks, staircases & climbable ladders!
  rooms.forEach(r => {
    if (r.outdoor || r.kind === 'hut' || r.kind === 'secret' || r.kind === 'boss') return;
    if (r.ceil < 8.4) return;
    const rw = r.x1 - r.x0 + 1, rh = r.y1 - r.y0 + 1;
    if (rw < 10 || rh < 10) return;
    const deckH = r.fy + 3.2;
    const side = rnd() < 0.5 ? -1 : 1; // north or south mezzanine balcony along the room flank
    const dRows = 3;
    const dz0 = side < 0 ? r.y0 * CELL : (r.y1 - dRows + 1) * CELL;
    const dz1 = side < 0 ? (r.y0 + dRows) * CELL : (r.y1 + 1) * CELL;
    const dx0 = (r.x0 + 1) * CELL, dx1 = r.x1 * CELL;
    decks.push({ id: decks.length, room: r.id, x0: dx0, z0: dz0, x1: dx1, z1: dz1, y: deckH, thick: 0.35 });
    // Staircase from room floor up onto one end of the mezzanine
    const stairW = 2.6;
    const sx0 = dx0 + 1.0, sx1 = sx0 + 6.5;
    const sz0 = side < 0 ? dz1 : dz0 - stairW;
    const sz1 = side < 0 ? dz1 + stairW : dz0;
    stairs.push({ x0: sx0, z0: sz0, x1: sx1, z1: sz1, y0: r.fy, y1: deckH, axis: 'x', dir: 1, steps: 10, room: r.id });
    // Wait: player walks up stairs along +X, then steps sideways onto the mezzanine (dz0..dz1)!
    // Better yet: orient stair perpendicular or flush at the east/west edge of the deck so walking straight off the top lands directly ON the mezzanine!
    stairs[stairs.length - 1] = {
      x0: dx0 + 1.0, z0: side < 0 ? dz1 : dz0 - 6.0,
      x1: dx0 + 4.2, z1: side < 0 ? dz1 + 6.0 : dz0,
      y0: r.fy, y1: deckH, axis: 'z', dir: side < 0 ? -1 : 1, steps: 10, room: r.id,
    };
    // Climbable ladder on the opposite end of the mezzanine!
    const lx = dx1 - 2.2;
    const lz = side < 0 ? dz1 + 0.25 : dz0 - 0.25;
    ladders.push({ x: lx, z: lz, nx: 0, nz: side < 0 ? 1 : -1, y0: r.fy, y1: deckH, room: r.id });
    // Extra lamp illuminating the upper mezzanine
    lamps.push({ x: (dx0 + dx1) / 2, y: r.fy + r.ceil - 0.35, z: (dz0 + dz1) / 2, room: r.id, color: r.lamp, power: 1.3 });
  });

  // ---- decoration
  const trees: TreeSpot[] = [];
  rooms.forEach(r => {
    if (r.kind === 'hut' || r.kind === 'secret' || r.x1 < r.x0) return;
    const hw = (r.x1 - r.x0 + 1) / 2, hh = (r.y1 - r.y0 + 1) / 2;
    const setT = (x: number, y: number, t: number) => {
      const i = I(x, y); if (Math.abs(x - r.cx) <= 2 && Math.abs(y - r.cy) <= 2) return;
      if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1 && tiles[i] === T_FLOOR && roomOf[i] === r.id) tiles[i] = t;
    };
    if (r.kind === 'boss') {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) setT(r.cx + (sx > 0 ? 4 : -6) + a, r.cy + (sy > 0 ? 4 : -6) + b, T_PILLAR);
      return;
    }
    if (r.kind === 'platform') {
      if (r.x1 - r.x0 >= 3 && r.y1 - r.y0 >= 3 && rnd() < 0.7) setT(r.cx, r.cy + (rnd() < 0.5 ? 1 : -1), T_CRATE);
      return;
    }
    if (r.kind === 'yard') {
      const rocks = 5 + Math.floor(rnd() * 6);
      for (let k = 0; k < rocks; k++) { const x = r.x0 + 3 + Math.floor(rnd() * (r.x1 - r.x0 - 6)), y = r.y0 + 3 + Math.floor(rnd() * (r.y1 - r.y0 - 6)); setT(x, y, T_PILLAR); if (rnd() < 0.5) setT(x + 1, y, T_PILLAR); }
      const crates = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < crates; k++) { const x = r.x0 + 3 + Math.floor(rnd() * (r.x1 - r.x0 - 6)), y = r.y0 + 3 + Math.floor(rnd() * (r.y1 - r.y0 - 6)); setT(x, y, T_CRATE); if (rnd() < 0.5) setT(x, y + 1, T_CRATE); }
      if (hasTrees) for (let y = r.y0 + 2; y <= r.y1 - 2; y++) for (let x = r.x0 + 2; x <= r.x1 - 2; x++) if (rnd() < 0.085) setT(x, y, T_TREE);
      return;
    }
    // Building interior props (keep clear of stairs/ladders)
    if (hw >= 5 && hh >= 5 && !decks.some(d => d.room === r.id) && rnd() < 0.4) {
      const sx = rnd() < 0.5 ? -1 : 1, sy = rnd() < 0.5 ? -1 : 1, bw = 1 + Math.floor(rnd() * (hw - 4)), bh = 1 + Math.floor(rnd() * (hh - 4));
      for (let a = 0; a < bw; a++) for (let b = 0; b < bh; b++) { const x = sx < 0 ? r.x0 + a : r.x1 - a, y = sy < 0 ? r.y0 + b : r.y1 - b; const i = I(x, y); if (tiles[i] === T_FLOOR && roomOf[i] === r.id) tiles[i] = T_WALL; }
    }
    if (hw >= 6 && hh >= 5) for (const sx of [-1, 1]) for (const sy of [-1, 1]) if (rnd() < 0.4) {
      const px = r.cx + (sx > 0 ? 3 : -4), py = r.cy + (sy > 0 ? 2 : -3);
      const wx = (px + 0.5) * CELL, wz = (py + 0.5) * CELL;
      if (!stairs.some(st => wx >= st.x0 - 3 && wx <= st.x1 + 3 && wz >= st.z0 - 3 && wz <= st.z1 + 3)) setT(px, py, T_PILLAR);
    }
    const crates = 1 + Math.floor(rnd() * 2);
    for (let c = 0; c < crates; c++) {
      const x = r.x0 + 2 + Math.floor(rnd() * (r.x1 - r.x0 - 3)), y = r.y0 + 2 + Math.floor(rnd() * (r.y1 - r.y0 - 3));
      const wx = (x + 0.5) * CELL, wz = (y + 0.5) * CELL;
      if (Math.abs(x - r.cx) < 2 && Math.abs(y - r.cy) < 2) continue;
      if (stairs.some(st => wx >= st.x0 - 2.5 && wx <= st.x1 + 2.5 && wz >= st.z0 - 2.5 && wz <= st.z1 + 2.5)) continue;
      if (ladders.some(ld => Math.hypot(wx - ld.x, wz - ld.z) < 4)) continue;
      setT(x, y, T_CRATE);
    }
  });
  doors.forEach(d => d.cells.forEach(c => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = I(c.x + dx, c.y + dy); if (tiles[i] === T_PILLAR || tiles[i] === T_CRATE || tiles[i] === T_TREE) tiles[i] = T_FLOOR; } }));

  // ---- reachability (allows 1-cell jump gaps across T_VOID in skybridge levels!)
  const start = rooms[0]; const reach = new Uint8Array(W * H);
  const bfs = () => {
    reach.fill(0); const q: number[] = [I(start.cx, start.cy)]; reach[q[0]] = 1;
    while (q.length) {
      const c = q.pop()!; const x = c % W, y = (c / W) | 0;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ax, ny = y + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = I(nx, ny); const t = tiles[n];
        if (!reach[n] && (t === T_FLOOR || t === T_DOOR)) { reach[n] = 1; q.push(n); }
        else if (t === T_VOID) {
          // jump across up to 2 void cells (8 m) to a landing tile
          for (let step = 2; step <= 3; step++) {
            const jx = x + ax * step, jy = y + ay * step;
            if (jx < 0 || jy < 0 || jx >= W || jy >= H) break;
            const jn = I(jx, jy); const jt = tiles[jn];
            if (jt === T_VOID) continue;
            if (!reach[jn] && (jt === T_FLOOR || jt === T_DOOR)) { reach[jn] = 1; q.push(jn); }
            break;
          }
        }
      }
    }
  };
  bfs();
  const last = rooms[cols[N - 1].nodes[0]];
  if (!reach[I(last.cx, last.cy)]) {
    for (let i = 0; i < W * H; i++) if ((tiles[i] === T_TREE || tiles[i] === T_PILLAR) && roomOf[i] >= 0 && rooms[roomOf[i]].kind === 'yard') tiles[i] = T_FLOOR;
    bfs();
  }

  // ---- spawn + exit (portal, or elevator deeper into indoor facilities)
  const spawn = { x: (start.cx + 0.5) * CELL, z: (start.cy + 0.5) * CELL, y: start.fy, yaw: -Math.PI / 2 };
  let exitKind: 'portal' | 'elevator' = 'portal'; let exit = { x: (last.cx + 0.5) * CELL, z: (last.cy + 0.5) * CELL, y: last.fy }; const exitYaw = Math.PI / 2;
  if (!isBoss && !last.outdoor && (env === 'indoor' || rnd() < 0.6)) {
    exitKind = 'elevator';
    for (let x = last.x1 + 1; x <= last.x1 + 2; x++) for (let y = last.cy - 1; y <= last.cy; y++) { const i = I(x, y); tiles[i] = T_FLOOR; sky[i] = 0; floorH[i] = last.fy; ceil[i] = last.fy + 4.2; roomOf[i] = last.id; reach[i] = 1; }
    for (let y = last.cy - 1; y <= last.cy; y++) { const i = I(last.x1, y); if (tiles[i] !== T_FLOOR) tiles[i] = T_FLOOR; }
    exit = { x: (last.x1 + 2) * CELL, z: last.cy * CELL, y: last.fy };
    lamps.push({ x: exit.x, y: last.fy + 3.9, z: exit.z, room: last.id, color: 0x9ad0ff, power: 1.5 });
  }
  const bossPos = isBoss ? { x: (last.cx + 0.5) * CELL, z: (last.cy - 3.5) * CELL } : undefined;

  // ---- inventory-aware ammo pool
  const ownedAmmo = new Set<AmmoType>(); owned.forEach(w => { const a = WEAPON_BY_ID[w]?.ammo; if (a && a !== 'inf') ownedAmmo.add(a); });
  const locHere = WEAPON_LOCATIONS.filter(l => l.planet === planetId && l.level === levelNum);
  locHere.forEach(l => { const a = WEAPON_BY_ID[l.weapon].ammo; if (a !== 'inf') ownedAmmo.add(a); });
  const ammoList = [...ownedAmmo].filter(a => a !== 'vector');
  const pickups: PickupSpawn[] = []; const used = new Set<number>();
  const pickCell = (r: Room, margin = 1, needReach = true): { x: number; z: number; y: number } => {
    for (let t = 0; t < 60; t++) {
      const x = r.x0 + margin + Math.floor(rnd() * Math.max(1, r.x1 - r.x0 + 1 - margin * 2)), y = r.y0 + margin + Math.floor(rnd() * Math.max(1, r.y1 - r.y0 + 1 - margin * 2));
      const id = I(x, y); if (tiles[id] === T_FLOOR && roomOf[id] === r.id && (!needReach || reach[id]) && !used.has(id)) { used.add(id); return { x: (x + 0.5) * CELL, z: (y + 0.5) * CELL, y: floorH[id] }; }
    }
    return { x: (r.cx + 0.5) * CELL, z: (r.cy + 0.5) * CELL, y: r.fy };
  };
  const nearestFloor = (r: Room, tx: number, ty: number) => {
    let best = { x: tx, y: ty }, bd = 1e9;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (tiles[I(x, y)] === T_FLOOR && reach[I(x, y)]) { const d = (x - tx) ** 2 + (y - ty) ** 2; if (d < bd) { bd = d; best = { x, y }; } }
    return { x: (best.x + 0.5) * CELL, z: (best.y + 0.5) * CELL, y: floorH[I(best.x, best.y)] };
  };
  const addAmmo = (r: Room, secret = false, type?: AmmoType, spot?: { x: number; z: number; y: number }) => {
    const a = type || ammoList[Math.floor(rnd() * ammoList.length)]; if (!a) return;
    const p = spot || pickCell(r); pickups.push({ kind: 'ammo', ammo: a, value: AMMO_PICK[a], x: p.x, z: p.z, y: p.y, secret });
  };

  // ---- secrets (hidden behind building walls, or cliff alcoves on outdoor levels)
  const weaponSecrets = locHere.filter(l => l.secret);
  let sCount = isBoss ? 0 : 1 + (levelNum >= 5 ? 1 : 0) + (levelNum >= 10 ? 1 : 0); sCount = Math.max(sCount, weaponSecrets.length);
  const dirs4 = [[0, -1], [0, 1], [1, 0], [-1, 0]];
  const buildingHosts = rooms.filter(r => !r.outdoor && (r.kind === 'normal' || r.kind === 'exit' || r.kind === 'start'));
  const secretHosts = buildingHosts.length ? buildingHosts : rooms.filter(r => r.kind === 'yard' && r.x1 >= r.x0);
  for (let s = 0; s < sCount && secretHosts.length; s++) {
    for (let attempt = 0; attempt < 180; attempt++) {
      const r = secretHosts[Math.floor(rnd() * secretHosts.length)];
      const [dx, dy] = dirs4[Math.floor(rnd() * 4)]; const px = Math.abs(dy), py = Math.abs(dx);
      const hw = (r.x1 - r.x0 + 1) / 2, hh = (r.y1 - r.y0 + 1) / 2; const span = dx === 0 ? hw : hh;
      const lat = Math.floor((rnd() * 2 - 1) * (span - 2));
      const ex = dx === 0 ? r.cx + lat : (dx > 0 ? r.x1 : r.x0), ey = dy === 0 ? r.cy + lat : (dy > 0 ? r.y1 : r.y0);
      if (ex < r.x0 || ex > r.x1 || ey < r.y0 || ey > r.y1 || tiles[I(ex, ey)] !== T_FLOOR) continue;
      let ok = true;
      for (let k = 1; k <= 5 && ok; k++) for (let j = -2; j <= 2 && ok; j++) {
        const x = ex + dx * k + px * j, y = ey + dy * k + py * j;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { ok = false; break; }
        const t = tiles[I(x, y)];
        if (t !== T_WALL && t !== T_CLIFF && t !== T_VOID) ok = false;
      }
      if (!ok) continue;
      const dxc = ex + dx, dyc = ey + dy; const di = I(dxc, dyc); const isRock = r.outdoor || tiles[di] === T_CLIFF;
      const sfy = floorH[I(ex, ey)];
      tiles[di] = T_SECRET; floorH[di] = sfy; ceil[di] = sfy + CORR_H; sky[di] = 0; roomOf[di] = r.id;
      const xa = Math.min(ex + dx * 2 - px, ex + dx * 4 + px), xb = Math.max(ex + dx * 2 - px, ex + dx * 4 + px), ya = Math.min(ey + dy * 2 - py, ey + dy * 4 + py), yb = Math.max(ey + dy * 2 - py, ey + dy * 4 + py);
      for (let y = ya - 1; y <= yb + 1; y++) for (let x = xa - 1; x <= xb + 1; x++) {
        const i = I(x, y); const inside = x >= xa && x <= xb && y >= ya && y <= yb;
        floorH[i] = sfy;
        if (inside) { tiles[i] = T_FLOOR; ceil[i] = sfy + CORR_H; sky[i] = 0; }
        else if (tiles[i] === T_VOID || (tiles[i] === T_CLIFF && !isRock)) tiles[i] = T_WALL;
      }
      const croom: Room = { id: rooms.length, x0: xa, x1: xb, y0: ya, y1: yb, cx: ex + dx * 3, cy: ey + dy * 3, ceil: CORR_H, fy: sfy, outdoor: false, kind: 'secret', alt: false, lamp: 0xffd060, col: r.col };
      rooms.push(croom);
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) roomOf[I(x, y)] = croom.id;
      lamps.push({ x: (croom.cx + 0.5) * CELL, y: sfy + CORR_H - 0.3, z: (croom.cy + 0.5) * CELL, room: croom.id, color: 0xffd060, power: 1.4 });
      secrets.push({ id: secrets.length, x: dxc, y: dyc, dx, dy, room: r.id, open: 0, opening: false, found: false, isRock, cx: (dxc + 0.5) * CELL, cz: (dyc + 0.5) * CELL });
      const ctr = { x: (croom.cx + 0.5) * CELL, z: (croom.cy + 0.5) * CELL, y: sfy };
      const ws = weaponSecrets[secrets.length - 1];
      if (ws) {
        if (owned.includes(ws.weapon)) { const a = WEAPON_BY_ID[ws.weapon].ammo; pickups.push({ kind: 'ammo', ammo: a, value: AMMO_PICK[a] * 3, ...ctr, secret: true }); }
        else pickups.push({ kind: 'weapon', weapon: ws.weapon, value: 0, ...ctr, secret: true });
      } else if (ammoList.length) addAmmo(croom, true, undefined, ctr);
      const side = (a: number, b: number) => ({ x: (croom.cx + 0.5 + a) * CELL, z: (croom.cy + 0.5 + b) * CELL, y: sfy });
      pickups.push({ kind: 'armor', value: 50, ...side(-px, -py), secret: true });
      pickups.push({ kind: 'health', value: 50, ...side(px, py), secret: true });
      if (ownedAmmo.has('vector') && rnd() < 0.55) pickups.push({ kind: 'ammo', ammo: 'vector', value: 1, ...side(dx, dy), secret: true });
      break;
    }
  }
  for (let s = secrets.length; s < weaponSecrets.length; s++) { const r = rooms[cols[Math.min(1, N - 1)].nodes[0]]; const p = nearestFloor(r, r.cx + 2, r.cy + 2); pickups.push({ kind: 'weapon', weapon: weaponSecrets[s].weapon, value: 0, ...p, secret: false }); }

  // ---- enemies (world-specific roster, lighter counts; also populate upper mezzanine decks!)
  const enemies: EnemySpawn[] = []; const pool = enemyPool(planet, levelNum); const totalW = pool.reduce((s, p) => s + p.w, 0);
  const pickDef = (): EnemyDef => { let t = rnd() * totalW; for (const p of pool) { t -= p.w; if (t <= 0) return p.def; } return pool[0].def; };
  const moon = planetId === 'moon';
  const base = moon ? 4 + levelNum * 0.8 : 1.4 + 0.12 * levelNum + 0.3 * planet.tier;
  rooms.forEach(r => {
    if (r.kind === 'start' || r.kind === 'boss' || r.kind === 'secret' || r.x1 < r.x0) return; if (!pool.length) return;
    const area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    let count = Math.round(base * (area / 120) * (0.7 + rnd() * 0.6));
    count = Math.max(r.kind === 'hut' || r.kind === 'platform' ? 0 : 1, Math.min(r.kind === 'yard' ? (moon ? 14 : 7) : moon ? 10 : 5, count));
    if (r.kind === 'hut') count = rnd() < 0.45 ? 1 : 0;
    if (r.kind === 'platform') count = r.x1 - r.x0 >= 4 ? 1 + Math.floor(rnd() * 2) : rnd() < 0.6 ? 1 : 0;
    if (isBoss && r.col === N - 2) count = Math.max(1, Math.floor(count * 0.6));
    let large = 0; const ambushRoom = r.col >= 2 && rnd() < 0.28;
    for (let k = 0; k < count; k++) {
      let d = pickDef(); if (d.size === 'large' && (large >= 2 || r.kind === 'platform')) d = pickDef(); if (d.size === 'large') large++;
      const c = pickCell(r, r.kind === 'platform' ? 0 : 2); if (Math.hypot(c.x - spawn.x, c.z - spawn.z) < 14) continue;
      enemies.push({ def: d.id, x: c.x, z: c.z, y: c.y, room: r.id, ambush: ambushRoom && k % 5 < 2 });
    }
    const dk = decks.find(d => d.room === r.id);
    if (dk && rnd() < 0.85) {
      let d = pickDef(); if (d.size === 'large') d = pickDef();
      enemies.push({ def: d.id, x: (dk.x0 + dk.x1) / 2 + (rnd() - 0.5) * 6, z: (dk.z0 + dk.z1) / 2, y: dk.y, room: r.id, ambush: false });
    }
  });

  // ---- normal pickups (including upper mezzanine rewards!)
  const weaponHost = rooms.find(r => r.col === Math.max(1, Math.floor(N / 2)) && r.x1 >= r.x0) || rooms[0];
  rooms.forEach(r => {
    if (r.kind === 'start' || r.kind === 'boss' || r.kind === 'secret' || r.x1 < r.x0) return;
    const big = r.kind === 'yard';
    if (rnd() < (big ? 0.9 : 0.45)) { const p = pickCell(r); pickups.push({ kind: 'health', value: 25, ...p, secret: false }); }
    if (rnd() < (big ? 0.5 : 0.22)) { const p = pickCell(r); pickups.push({ kind: 'armor', value: 25, ...p, secret: false }); }
    const n = (rnd() < 0.85 ? 1 : 0) + (rnd() < (big ? 0.9 : 0.4) ? 1 : 0); for (let k = 0; k < n; k++) addAmmo(r);
    if (ownedAmmo.has('vector') && rnd() < 0.05) pickups.push({ kind: 'ammo', ammo: 'vector', value: 1, ...pickCell(r), secret: false });
    if (isBoss && r.col === N - 2) { for (let k = 0; k < 3; k++) pickups.push({ kind: 'health', value: 50, ...pickCell(r), secret: false }); for (let k = 0; k < 2; k++) pickups.push({ kind: 'armor', value: 50, ...pickCell(r), secret: false }); ammoList.forEach(a => addAmmo(r, false, a)); }
    const dk = decks.find(d => d.room === r.id);
    if (dk) {
      pickups.push({ kind: rnd() < 0.5 ? 'armor' : 'health', value: 25, x: (dk.x0 + dk.x1) / 2, z: (dk.z0 + dk.z1) / 2, y: dk.y, secret: false });
      addAmmo(r, false, undefined, { x: (dk.x0 + dk.x1) / 2 + 3, z: (dk.z0 + dk.z1) / 2, y: dk.y });
    }
  });
  locHere.filter(l => !l.secret).forEach(l => {
    const p = nearestFloor(weaponHost, weaponHost.cx, weaponHost.cy);
    if (owned.includes(l.weapon)) { const a = WEAPON_BY_ID[l.weapon].ammo; pickups.push({ kind: 'ammo', ammo: a, value: AMMO_PICK[a] * 2, ...p, secret: false }); }
    else pickups.push({ kind: 'weapon', weapon: l.weapon, value: 0, ...p, secret: false });
  });
  if (moon && ownedAmmo.has('vector')) yardRooms.forEach((r, i) => { if (i % 2 === 0) pickups.push({ kind: 'ammo', ammo: 'vector', value: 1, ...pickCell(r), secret: false }); });

  // ---- wall tops: buildings full height, outdoor perimeters convert to natural rock cliffs, filler = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = I(x, y); let t = tiles[id];
    if (t === T_TREE) { wallTop[id] = floorH[id] + 7; continue; }
    if (t !== T_WALL && t !== T_PILLAR && t !== T_CLIFF) continue;
    let maxC = 0, tIn = false, tOut = false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dz; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = I(nx, ny); if (!isPassableT(tiles[ni])) continue;
      if (sky[ni]) tOut = true; else { tIn = true; maxC = Math.max(maxC, ceil[ni]); }
    }
    if (t === T_WALL && !tIn && tOut) { t = T_CLIFF; tiles[id] = T_CLIFF; }
    if (t === T_CLIFF) {
      if (tOut || tIn) {
        const jagged = Math.abs(Math.sin(x * 1.7 + y * 2.3)) * 5.0;
        wallTop[id] = floorH[id] + 5.5 + jagged;
      } else wallTop[id] = 0;
    } else if (tIn) {
      wallTop[id] = maxC + 0.45;
    } else if (tOut) {
      wallTop[id] = floorH[id] + (t === T_PILLAR ? 3.8 : 2.6);
    } else {
      wallTop[id] = 0;
    }
  }

  // ---- surrounding mountains / cliffs + exterior forest (skipped on pure indoor & skybridge levels)
  const mountains: Mountain[] = []; const inPlay = (cx: number, cy: number, pad: number) => rooms.some(r => r.x1 >= r.x0 && cx >= r.x0 - pad && cx <= r.x1 + pad && cy >= r.y0 - pad && cy <= r.y1 + pad);
  const playDist = new Int16Array(W * H).fill(-1); { const q: number[] = [];
    for (let i = 0; i < W * H; i++) { const t = tiles[i]; if (isPassableT(t) || t === T_TREE || t === T_SECRET) { playDist[i] = 0; q.push(i); } }
    for (let hd = 0; hd < q.length; hd++) { const c = q[hd]; const x = c % W, y = (c / W) | 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dz; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = I(nx, ny); if (playDist[n] < 0) { playDist[n] = playDist[c] + 1; q.push(n); } } } }
  const distToPlay = (cx: number, cy: number) => { const ix = Math.max(0, Math.min(W - 1, cx)), iy = Math.max(0, Math.min(H - 1, cy)); return Math.max(0, playDist[I(ix, iy)]) + Math.hypot(cx - ix, cy - iy); };
  const addMountain = (cx: number, cy: number, r: number, h: number, baseY: number) => {
    const maxR = (distToPlay(cx, cy) - 0.75) * CELL; if (maxR < 6) return;
    const rr = Math.min(r, maxR); mountains.push({ x: (cx + 0.5) * CELL, z: (cy + 0.5) * CELL, r: rr, h: Math.min(h, rr * 2.6), baseY });
  };
  if (env === 'outdoor' || env === 'mixed') {
    const outRooms = rooms.filter(r => r.outdoor);
    outRooms.forEach(r => {
      const ex = (r.x1 - r.x0 + 1) / 2, ez = (r.y1 - r.y0 + 1) / 2;
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2 + rnd() * 0.2; const d = 3 + rnd() * 11;
        const cx = Math.round(r.cx + Math.cos(a) * (ex + d)), cy = Math.round(r.cy + Math.sin(a) * (ez + d));
        if (inPlay(cx, cy, 2)) continue;
        const hgt = 14 + rnd() * 28; const baseY = r.fy - 1.5;
        addMountain(cx, cy, (7 + rnd() * 10) * (hgt / 24), hgt, baseY);
        if (hasTrees) for (let t = 0; t < 6; t++) {
          const tx = cx + Math.floor((rnd() - 0.5) * 8), ty = cy + Math.floor((rnd() - 0.5) * 8);
          if (tx >= 0 && ty >= 0 && tx < W && ty < H && (isPassableT(tiles[I(tx, ty)]) || tiles[I(tx, ty)] === T_TREE)) continue;
          if (!inPlay(tx, ty, 1) && !trees.some(q => Math.abs(q.x / CELL - tx) < 1 && Math.abs(q.z / CELL - ty) < 1)) {
            trees.push({ x: (tx + 0.5) * CELL, z: (ty + 0.5) * CELL, fy: floorH[I(Math.max(0, Math.min(W - 1, tx)), Math.max(0, Math.min(H - 1, ty)))] - 0.3, s: 0.8 + rnd() * 0.8 });
          }
        }
      }
    });
    for (let x = -12; x <= W + 12; x += 7) for (const y of [-9 - Math.floor(rnd() * 6), H + 9 + Math.floor(rnd() * 6)]) addMountain(x, y, 14 + rnd() * 14, 24 + rnd() * 32, rawBaseElev(Math.max(0, Math.min(W - 1, x))) - 2);
    for (let y = -6; y <= H + 6; y += 7) for (const x of [-10 - Math.floor(rnd() * 6), W + 10 + Math.floor(rnd() * 6)]) addMountain(x, y, 14 + rnd() * 14, 24 + rnd() * 32, rawBaseElev(Math.max(0, Math.min(W - 1, x))) - 2);
  }

  let minFloorY = 1e9;
  for (let i = 0; i < W * H; i++) if (tiles[i] !== T_VOID && floorH[i] < minFloorY) minFloorY = floorH[i];
  if (minFloorY > 1e8) minFloorY = 0;

  return { planet: planetId, level: levelNum, name: planet.levelNames[levelNum - 1] || `Level ${levelNum}`, env, isBoss, seed, W, H, tiles, ceil, sky, wallTop, floorH, roomOf, reach, rooms, doors, secrets, lamps, trees, mountains, decks, stairs, ladders, antigravPads, spawn, exit, exitKind, exitYaw, enemies, pickups, bossPos, totalSecrets: secrets.length, minFloorY };
}

// ============================================================================ meshing
export const levelUniforms = { uPlayer: { value: new THREE.Vector3() }, uBoost: { value: 0.45 } };
function patch(mat: THREE.MeshBasicMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPlayer = levelUniforms.uPlayer; sh.uniforms.uBoost = levelUniforms.uBoost;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uPlayer;\nuniform float uBoost;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat dd = distance(vWPos, uPlayer);\ndiffuseColor.rgb *= 1.0 + uBoost * (1.0 - smoothstep(1.5, 30.0, dd));');
  };
  mat.customProgramCacheKey = () => 'lvlpatch';
}

interface MB { pos: number[]; uv: number[]; col: number[]; idx: number[]; n: number }
const mb = (): MB => ({ pos: [], uv: [], col: [], idx: [], n: 0 });
function geoOf(b: MB): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx); return g;
}

export function buildLevelMesh(lv: LevelData, planet: Planet): THREE.Group {
  const th = planet.theme; const group = new THREE.Group();
  const { W, H, tiles, ceil, sky, wallTop, floorH, roomOf } = lv; const I = (x: number, y: number) => y * W + x;
  const lampsBy = new Map<number, Lamp[]>(); lv.lamps.forEach(l => { const a = lampsBy.get(l.room) || []; a.push(l); lampsBy.set(l.room, a); });
  const LR = 18; const BRIGHT = 1.35;
  const lampRGB = new Map<number, THREE.Color>(); const lc = (c: number) => { let v = lampRGB.get(c); if (!v) { v = new THREE.Color(c); lampRGB.set(c, v); } return v; };
  const light = (x: number, y: number, z: number, room: number, isSky: boolean, out: number[]) => {
    const a = th.ambient * (isSky ? 1.55 : 1) * BRIGHT; let r = a, g = a, b = a;
    const lists = room === -1 ? [lampsBy.get(-1)] : [lampsBy.get(room), lampsBy.get(-1)];
    for (const lst of lists) if (lst) for (const l of lst) {
      const dx = l.x - x, dy = l.y - y, dz = l.z - z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > LR) continue;
      const f = (1 - d / LR) ** 2 * l.power * BRIGHT; const c = lc(l.color); r += c.r * f; g += c.g * f; b += c.b * f;
    }
    out[0] = Math.min(r, 2.2); out[1] = Math.min(g, 2.2); out[2] = Math.min(b, 2.2);
  };
  const tmp = [0, 0, 0];
  const quad = (b: MB, pts: number[][], uvs: number[][], room: number, isSky: boolean, tint: THREE.Color, shade: number) => {
    for (let i = 0; i < 4; i++) {
      const p = pts[i]; light(p[0], p[1], p[2], room, isSky, tmp);
      b.pos.push(p[0], p[1], p[2]); b.uv.push(uvs[i][0], uvs[i][1]); b.col.push(tint.r * tmp[0] * shade, tint.g * tmp[1] * shade, tint.b * tmp[2] * shade);
    }
    b.idx.push(b.n, b.n + 1, b.n + 2, b.n, b.n + 2, b.n + 3); b.n += 4;
  };
  const walls = mb(), cliffs = mb(), floors = mb(), yardFloors = mb(), ceils = mb(), roofs = mb(), crates = mb(), pillars = mb();
  const cWall = new THREE.Color(th.wall), cWall2 = new THREE.Color(th.wall2), cFloor = new THREE.Color(th.floor), cCeil = new THREE.Color(th.ceil), cCrate = new THREE.Color(0xb89060), cGround = new THREE.Color(th.floor).lerp(new THREE.Color(th.wall), 0.25), cPillar = new THREE.Color(th.wall2).multiplyScalar(1.25), cRock = new THREE.Color(th.wall2).multiplyScalar(0.88), cRoof = new THREE.Color(th.ceil).multiplyScalar(1.25);
  const roomTint = (rid: number) => (rid >= 0 && lv.rooms[rid].alt ? cWall2 : rid < 0 ? cWall2 : cWall);
  const passable = (t: number) => t !== T_WALL && t !== T_PILLAR && t !== T_TREE && t !== T_CLIFF;
  const fH = (x: number, y: number) => floorH[I(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)))];
  const cornerH = (gx: number, gz: number) => {
    // Only average non-void floor heights so floating platforms stay crisp and level!
    let s = 0, c = 0;
    for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      const cx = Math.max(0, Math.min(W - 1, gx + ox)), cz = Math.max(0, Math.min(H - 1, gz + oz));
      if (tiles[I(cx, cz)] !== T_VOID) { s += floorH[I(cx, cz)]; c++; }
    }
    return c ? s / c : 0;
  };

  const wallFace = (b: MB, cx: number, cy: number, nx: number, ny: number, ya: number, yb: number, room: number, isSky: boolean, tint: THREE.Color) => {
    const x0 = cx * CELL, x1 = x0 + CELL, z0 = cy * CELL, z1 = z0 + CELL; const v0 = ya / CELL, v1 = yb / CELL;
    if (nx === 1) quad(b, [[x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1]], [[cy + 1, v0], [cy, v0], [cy, v1], [cy + 1, v1]], room, isSky, tint, 0.9);
    else if (nx === -1) quad(b, [[x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0]], [[cy, v0], [cy + 1, v0], [cy + 1, v1], [cy, v1]], room, isSky, tint, 0.9);
    else if (ny === 1) quad(b, [[x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1]], [[cx, v0], [cx + 1, v0], [cx + 1, v1], [cx, v1]], room, isSky, tint, 1.0);
    else quad(b, [[x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0]], [[cx + 1, v0], [cx, v0], [cx, v1], [cx + 1, v1]], room, isSky, tint, 1.0);
  };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tiles[I(x, y)];
    if (t === T_VOID) continue;
    if (t === T_TREE) {
      const rid = roomOf[I(x, y)]; const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
      quad(yardFloors, [[x0, cornerH(x, y), z0], [x0, cornerH(x, y + 1), z1], [x1, cornerH(x + 1, y + 1), z1], [x1, cornerH(x + 1, y), z0]], [[x, y], [x, y + 1], [x + 1, y + 1], [x + 1, y]], rid, true, cGround, 1);
      continue;
    }
    if (t === T_WALL || t === T_PILLAR || t === T_CLIFF) {
      const wt = wallTop[I(x, y)]; if (wt <= 0) continue;
      const isCliff = t === T_CLIFF;
      const isRockPillar = t === T_PILLAR && (roomOf[I(x, y)] >= 0 ? lv.rooms[roomOf[I(x, y)]].outdoor : false);
      const buf = isCliff ? cliffs : t === T_PILLAR ? pillars : walls;
      let capRid = -1; let hasAnyNeighborSky = false;
      for (const [nx, ny] of N4) {
        const xx = x + nx, yy = y + ny; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const ni = I(xx, yy); const nt = tiles[ni];
        if (nt === T_VOID) {
          wallFace(buf, x, y, nx, ny, fH(x, y) - 0.5, wt, -1, true, isCliff || isRockPillar ? cRock : cWall2);
          hasAnyNeighborSky = true;
          continue;
        }
        const bottom = Math.min(cornerH(xx, yy), cornerH(xx + 1, yy), cornerH(xx, yy + 1), cornerH(xx + 1, yy + 1)) - 0.05;
        if (passable(nt) || nt === T_TREE) {
          const rid = roomOf[ni]; const isSky = sky[ni] === 1 || nt === T_TREE; const top = isSky ? wt : ceil[ni];
          wallFace(buf, x, y, nx, ny, bottom, top, rid, isSky, isCliff || isRockPillar ? cRock : t === T_PILLAR ? cPillar : roomTint(rid));
          if (isSky) { hasAnyNeighborSky = true; capRid = rid; }
        } else {
          const hn = wallTop[ni];
          if (hn < wt - 0.01) {
            wallFace(buf, x, y, nx, ny, hn > 0 ? hn : fH(xx, yy) - 0.6, wt, -1, true, isCliff || isRockPillar ? cRock : cWall2);
            hasAnyNeighborSky = true;
          }
        }
      }
      // Solid top cap on EVERY building wall / cliff / pillar so roofs and edges are 100% solid from outside!
      if (hasAnyNeighborSky || !isCliff) {
        const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
        quad(buf, [[x0, wt, z0], [x0, wt, z1], [x1, wt, z1], [x1, wt, z0]], [[x, y], [x, y + 1], [x + 1, y + 1], [x + 1, y]], capRid, true, isCliff || isRockPillar ? cRock : cRoof, 1.1);
      }
    } else {
      const rid = roomOf[I(x, y)]; const isSky = sky[I(x, y)] === 1; const h = ceil[I(x, y)];
      const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
      const h00 = cornerH(x, y), h01 = cornerH(x, y + 1), h11 = cornerH(x + 1, y + 1), h10 = cornerH(x + 1, y);
      const fb = Math.min(h00, h01, h11, h10);
      const useMetalDeck = !isSky || lv.env === 'skybridge';
      quad(useMetalDeck ? floors : yardFloors, [[x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0]], [[x, y], [x, y + 1], [x + 1, y + 1], [x + 1, y]], rid, isSky, useMetalDeck ? cFloor : cGround, 1);
      if (lv.env === 'skybridge' && isSky) {
        // underside & rim skirt for floating platform tiles over the abyss
        const sk = fb - 0.42;
        quad(roofs, [[x0, sk, z0], [x1, sk, z0], [x1, sk, z1], [x0, sk, z1]], [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], rid, true, cWall2, 0.7);
        for (const [nx, ny] of N4) {
          const xx = x + nx, yy = y + ny; if (xx < 0 || yy < 0 || xx >= W || yy >= H || tiles[I(xx, yy)] === T_VOID) {
            wallFace(roofs, x, y, nx, ny, sk, fb, -1, true, cWall2);
          }
        }
      }
      if (!isSky) {
        // Interior ceiling (-Y normal)
        quad(ceils, [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], rid, false, cCeil, 0.85);
        // Solid exterior roof (+Y normal) so buildings are NEVER see-through from outside!
        const rh = h + 0.45;
        quad(roofs, [[x0, rh, z0], [x0, rh, z1], [x1, rh, z1], [x1, rh, z0]], [[x, y], [x, y + 1], [x + 1, y + 1], [x + 1, y]], -1, true, cRoof, 1.05);
        for (const [nx, ny] of N4) {
          const xx = x + nx, yy = y + ny; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const nt = tiles[I(xx, yy)];
          if (passable(nt) && !sky[I(xx, yy)]) {
            const hn = ceil[I(xx, yy)];
            if (hn < h - 0.01) {
              wallFace(walls, xx, yy, -nx, -ny, hn, h, rid, false, roomTint(rid));
              wallFace(roofs, xx, yy, -nx, -ny, hn + 0.45, rh, -1, true, cRoof);
            }
          } else if (sky[I(xx, yy)] === 1 || nt === T_VOID) {
            wallFace(roofs, x, y, nx, ny, h, rh, -1, true, cRoof);
          }
        }
      }
      if (t === T_CRATE) {
        const ch = fb + CRATE_H; const tint = cCrate;
        quad(crates, [[x0, ch, z0], [x0, ch, z1], [x1, ch, z1], [x1, ch, z0]], [[0, 0], [0, 1], [1, 1], [1, 0]], rid, isSky, tint, 1.1);
        quad(crates, [[x1, fb, z1], [x1, fb, z0], [x1, ch, z0], [x1, ch, z1]], [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], rid, isSky, tint, 0.9);
        quad(crates, [[x0, fb, z0], [x0, fb, z1], [x0, ch, z1], [x0, ch, z0]], [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], rid, isSky, tint, 0.9);
        quad(crates, [[x0, fb, z1], [x1, fb, z1], [x1, ch, z1], [x0, ch, z1]], [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], rid, isSky, tint, 1.0);
        quad(crates, [[x1, fb, z0], [x0, fb, z0], [x0, ch, z0], [x1, ch, z0]], [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], rid, isSky, tint, 1.0);
      }
    }
  }

  const mk = (tex: THREE.Texture) => { const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }); patch(m); return m; };
  const wallMat = mk(makeTexture(th.wallStyle)), cliffMat = mk(makeTexture(planet.id === 'uranus' ? 'ice' : 'rock')), floorMat = mk(makeTexture(th.floorStyle)), ceilMat = mk(makeTexture(th.wallStyle === 'ice' ? 'ice' : 'panel')), roofMat = mk(makeTexture('panel')), crateMat = mk(makeTexture('crate')), pillarMat = mk(makeTexture(th.wallStyle === 'brick' ? 'rock' : th.wallStyle));
  const groundMat = mk(makeTexture(planet.id === 'uranus' ? 'ice' : planet.id === 'saturn' || planet.id === 'pluto' ? 'rock' : 'dirt'));
  for (const [b, m] of [[walls, wallMat], [cliffs, cliffMat], [floors, floorMat], [yardFloors, groundMat], [ceils, ceilMat], [roofs, roofMat], [crates, crateMat], [pillars, pillarMat]] as [MB, THREE.Material][]) {
    if (b.n) { const mesh = new THREE.Mesh(geoOf(b), m); mesh.frustumCulled = false; group.add(mesh); }
  }

  // ---- doors
  const doorTex = makeTexture('door'); const doorMat = new THREE.MeshBasicMaterial({ map: doorTex, color: new THREE.Color(th.wall2).multiplyScalar(1.4) }); patch(doorMat);
  const stripMat = new THREE.MeshBasicMaterial({ color: th.lamp });
  const panelGeoX = new THREE.BoxGeometry(0.9, CORR_H, CELL), panelGeoZ = new THREE.BoxGeometry(CELL, CORR_H, 0.9);
  const stripGeoX = new THREE.BoxGeometry(0.96, 0.25, CELL * 0.9), stripGeoZ = new THREE.BoxGeometry(CELL * 0.9, 0.25, 0.96);
  lv.doors.forEach(d => {
    d.cells.forEach((c) => {
      const fy = floorH[I(c.x, c.y)];
      const m = new THREE.Mesh(d.axis === 'x' ? panelGeoX : panelGeoZ, doorMat); m.position.set((c.x + 0.5) * CELL, fy + CORR_H / 2, (c.y + 0.5) * CELL);
      const s = new THREE.Mesh(d.axis === 'x' ? stripGeoX : stripGeoZ, stripMat); s.position.y = 1.2; m.add(s); const s2 = s.clone(); s2.position.y = -1.3; m.add(s2);
      m.userData.base = m.position.clone(); group.add(m); d.panels.push(m);
    });
  });

  // ---- secret panels
  const secretWallMat = mk(makeTexture(th.wallStyle)), secretRockMat = mk(makeTexture(planet.id === 'uranus' ? 'ice' : 'rock'));
  lv.secrets.forEach(sc => {
    const b = mb(); const rid = sc.room; const tint = (sc.isRock ? cRock : roomTint(rid)).clone().multiplyScalar(0.965);
    const fx = -sc.dx, fy = -sc.dy; const cx = sc.x, cy = sc.y; const x0 = cx * CELL, x1 = x0 + CELL, z0 = cy * CELL, z1 = z0 + CELL; const fl = floorH[I(cx, cy)]; const h = fl + CORR_H; const e = 0.02;
    if (fx === 1) quad(b, [[x1 + e, fl, z1], [x1 + e, fl, z0], [x1 + e, h, z0], [x1 + e, h, z1]], [[cy + 1, 0], [cy, 0], [cy, CORR_H / CELL], [cy + 1, CORR_H / CELL]], rid, sc.isRock, tint, 0.9);
    else if (fx === -1) quad(b, [[x0 - e, fl, z0], [x0 - e, fl, z1], [x0 - e, h, z1], [x0 - e, h, z0]], [[cy, 0], [cy + 1, 0], [cy + 1, CORR_H / CELL], [cy, CORR_H / CELL]], rid, sc.isRock, tint, 0.9);
    else if (fy === 1) quad(b, [[x0, fl, z1 + e], [x1, fl, z1 + e], [x1, h, z1 + e], [x0, h, z1 + e]], [[cx, 0], [cx + 1, 0], [cx + 1, CORR_H / CELL], [cx, CORR_H / CELL]], rid, sc.isRock, tint, 1);
    else quad(b, [[x1, fl, z0 - e], [x0, fl, z0 - e], [x0, h, z0 - e], [x1, h, z0 - e]], [[cx + 1, 0], [cx, 0], [cx, CORR_H / CELL], [cx + 1, CORR_H / CELL]], rid, sc.isRock, tint, 1);
    const mesh = new THREE.Mesh(geoOf(b), sc.isRock ? secretRockMat : secretWallMat); mesh.frustumCulled = false; mesh.userData.base = mesh.position.clone(); group.add(mesh); sc.mesh = mesh;
  });

  // ---- interior decks, staircases & climbable ladders
  const deckMat = new THREE.MeshLambertMaterial({ map: makeTexture('grate'), color: new THREE.Color(th.wall2).multiplyScalar(1.3), flatShading: true });
  const trimMat = new THREE.MeshBasicMaterial({ color: th.lamp });
  const railMat = new THREE.MeshLambertMaterial({ color: 0x707a8a, flatShading: true });
  lv.decks.forEach(dk => {
    const w = dk.x1 - dk.x0, d = dk.z1 - dk.z0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, dk.thick, d), deckMat);
    m.position.set((dk.x0 + dk.x1) / 2, dk.y - dk.thick / 2, (dk.z0 + dk.z1) / 2);
    group.add(m);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), trimMat);
    edge.position.set((dk.x0 + dk.x1) / 2, dk.y - 0.04, dk.z0 > (lv.rooms[dk.room].cy * CELL) ? dk.z0 + 0.04 : dk.z1 - 0.04);
    group.add(edge);
  });
  lv.stairs.forEach(st => {
    const w = st.x1 - st.x0, d = st.z1 - st.z0, h = st.y1 - st.y0;
    for (let i = 0; i < st.steps; i++) {
      const t0 = i / st.steps, t1 = (i + 1) / st.steps;
      const sh = t1 * h;
      const sw = st.axis === 'x' ? w / st.steps : w;
      const sd = st.axis === 'z' ? d / st.steps : d;
      const cx = st.axis === 'x' ? (st.dir > 0 ? st.x0 + (t0 + t1) * 0.5 * w : st.x1 - (t0 + t1) * 0.5 * w) : (st.x0 + st.x1) / 2;
      const cz = st.axis === 'z' ? (st.dir > 0 ? st.z0 + (t0 + t1) * 0.5 * d : st.z1 - (t0 + t1) * 0.5 * d) : (st.z0 + st.z1) / 2;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), deckMat);
      tread.position.set(cx, st.y0 + sh / 2, cz);
      group.add(tread);
    }
  });
  lv.ladders.forEach(ld => {
    const h = ld.y1 - ld.y0; const lg = new THREE.Group(); lg.position.set(ld.x, ld.y0, ld.z);
    for (const s of [-0.45, 0.45]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, h + 0.3, 0.08), railMat); rail.position.set(s, h / 2, 0); lg.add(rail); }
    const rungs = Math.max(4, Math.floor(h / 0.42));
    for (let i = 1; i <= rungs; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), trimMat); r.position.set(0, (i / (rungs + 0.5)) * h, 0); lg.add(r); }
    group.add(lg);
  });

  // ---- antigravity plates under suspended buildings & floating platforms (skybridge levels)
  lv.antigravPads.forEach(pad => {
    const pg = new THREE.Group(); pg.position.set(pad.x, pad.y, pad.z);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(pad.w, 0.5, pad.d), new THREE.MeshLambertMaterial({ color: 0x262d3a, flatShading: true })); pg.add(slab);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(pad.w + 0.2, 0.16, pad.d + 0.2), new THREE.MeshBasicMaterial({ color: pad.color })); rim.position.y = 0.05; pg.add(rim);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(pad.w, pad.d) * 0.28, Math.min(pad.w, pad.d) * 0.18, 0.6, 12), new THREE.MeshBasicMaterial({ color: pad.color }));
    core.position.y = -0.35; pg.add(core);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(Math.min(pad.w, pad.d) * 0.26, 4.5, 10, 1, true), new THREE.MeshBasicMaterial({ color: pad.color, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    jet.rotation.x = Math.PI; jet.position.y = -2.6; pg.add(jet);
    group.add(pg);
  });

  // ---- indoor rafters
  const beamMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(th.ceil).multiplyScalar(0.75), flatShading: true });
  lv.rooms.forEach(r => {
    if (r.outdoor || r.kind === 'secret' || r.kind === 'hut') return;
    const rw = (r.x1 - r.x0 + 1) * CELL; const zMid = ((r.y0 + r.y1 + 1) / 2) * CELL; const xMid = ((r.x0 + r.x1 + 1) / 2) * CELL; const yb = r.fy + r.ceil - 0.18;
    const beamG = new THREE.BoxGeometry(rw, 0.35, 0.45);
    for (let z = (r.y0 + 2) * CELL; z < r.y1 * CELL; z += CELL * 3) { const bm = new THREE.Mesh(beamG, beamMat); bm.position.set(xMid, yb, z); group.add(bm); }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, (r.y1 - r.y0 + 1) * CELL), beamMat); spine.position.set(xMid, yb, zMid); group.add(spine);
  });

  // ---- terrain / skybridge abyss
  let skirtAt: ((x: number, z: number) => number) | null = null;
  if (lv.env === 'skybridge') {
    // Cloud/storm decks deep below the suspended platforms
    const cloudMat = new THREE.MeshBasicMaterial({ color: th.sky, transparent: true, opacity: 0.72 });
    const deck1 = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), cloudMat); deck1.rotation.x = -Math.PI / 2; deck1.position.set((W * CELL) / 2, lv.minFloorY - 28, (H * CELL) / 2); group.add(deck1);
    const deck2 = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: th.fog })); deck2.rotation.x = -Math.PI / 2; deck2.position.set((W * CELL) / 2, lv.minFloorY - 52, (H * CELL) / 2); group.add(deck2);
  } else if (lv.env !== 'indoor') {
    // Undulating exterior terrain skirt around the whole world (hills, ridges, valleys)
    const surfTex = makeTexture(th.floorStyle).clone(); surfTex.repeat.set(90, 90); surfTex.needsUpdate = true;
    const SK = 1600, SEG = 72, STEP = SK / SEG;
    const geo = new THREE.PlaneGeometry(SK, SK, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cxw = (W * CELL) / 2, czw = (H * CELL) / 2;
    const skirtH = (wx: number, wz: number) => {
      const gx = Math.floor(wx / CELL), gz = Math.floor(wz / CELL);
      if (gx >= 0 && gz >= 0 && gx < W && gz < H && tiles[I(gx, gz)] !== T_CLIFF) return fH(gx, gz) - 2.5; // hidden backstop under the playable area
      const edgeDist = Math.max(0, Math.max(-wx, wx - W * CELL, -wz, wz - H * CELL));
      const hills = Math.sin(wx * 0.035) * Math.cos(wz * 0.035) * 6 + Math.sin(wx * 0.08 + wz * 0.06) * 3.5 + Math.min(20, edgeDist * 0.05);
      return lv.minFloorY - 1.5 + hills;
    };
    const grid = new Float32Array((SEG + 1) * (SEG + 1));
    for (let iz = 0; iz <= SEG; iz++) for (let ix = 0; ix <= SEG; ix++) grid[iz * (SEG + 1) + ix] = skirtH(cxw - SK / 2 + ix * STEP, czw - SK / 2 + iz * STEP);
    skirtAt = (wx: number, wz: number) => {
      const fx = (wx - (cxw - SK / 2)) / STEP, fz = (wz - (czw - SK / 2)) / STEP;
      const ix = Math.max(0, Math.min(SEG - 1, Math.floor(fx))), iz = Math.max(0, Math.min(SEG - 1, Math.floor(fz))); const tx = Math.max(0, Math.min(1, fx - ix)), tz = Math.max(0, Math.min(1, fz - iz));
      const a = grid[iz * (SEG + 1) + ix], b = grid[iz * (SEG + 1) + ix + 1], c = grid[(iz + 1) * (SEG + 1) + ix], e = grid[(iz + 1) * (SEG + 1) + ix + 1];
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
    };
    for (let i = 0; i < pos.count; i++) pos.setY(i, skirtH(pos.getX(i) + cxw, pos.getZ(i) + czw));
    geo.computeVertexNormals();
    const surfMat = new THREE.MeshLambertMaterial({ map: surfTex, color: new THREE.Color(th.floor).multiplyScalar(0.72), flatShading: true });
    const surfPlane = new THREE.Mesh(geo, surfMat); surfPlane.position.set(cxw, 0, czw); group.add(surfPlane);
  }

  // ---- mountains (instanced)
  const d = new THREE.Object3D();
  if (lv.mountains.length) {
    const isEarth = planet.id === 'earth';
    const mtnMat = new THREE.MeshLambertMaterial({ color: isEarth ? 0x3a4a3c : new THREE.Color(th.wall2).multiplyScalar(0.8), flatShading: true });
    const mtn = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mtnMat, lv.mountains.length);
    lv.mountains.forEach((m, i) => { if (skirtAt) m.baseY = Math.min(m.baseY, skirtAt(m.x, m.z) - 1.5); d.position.set(m.x, m.baseY + m.h / 2, m.z); d.scale.set(m.r, m.h, m.r); d.rotation.set(0, i * 0.7, 0); d.updateMatrix(); mtn.setMatrixAt(i, d.matrix); });
    mtn.frustumCulled = false; group.add(mtn);
    if (isEarth) {
      const snow = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshLambertMaterial({ color: 0xdfe8f2, flatShading: true }), lv.mountains.length); let sc = 0;
      lv.mountains.forEach((m, i) => { if (m.h < 22) return; d.position.set(m.x, m.baseY + m.h - m.h * 0.14, m.z); d.scale.set(m.r * 0.28, m.h * 0.28, m.r * 0.28); d.rotation.set(0, i * 0.7, 0); d.updateMatrix(); snow.setMatrixAt(sc++, d.matrix); });
      snow.count = sc; snow.frustumCulled = false; group.add(snow);
    }
  }

  // ---- trees
  const treeSpots: TreeSpot[] = lv.trees.map(t => (skirtAt ? { ...t, fy: skirtAt(t.x, t.z) - 0.15 } : t));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[I(x, y)] === T_TREE) treeSpots.push({ x: (x + 0.5) * CELL, z: (y + 0.5) * CELL, fy: floorH[I(x, y)], s: 1.1 });
  if (treeSpots.length) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.5, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x4a3220, flatShading: true }), treeSpots.length);
    const fol1 = new THREE.InstancedMesh(new THREE.ConeGeometry(2.1, 3.4, 7), new THREE.MeshLambertMaterial({ color: 0x1f4a2a, flatShading: true }), treeSpots.length);
    const fol2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2.8, 7), new THREE.MeshLambertMaterial({ color: 0x2a6238, flatShading: true }), treeSpots.length);
    treeSpots.forEach((t, i) => {
      d.rotation.set(0, i * 1.3, 0); d.scale.setScalar(t.s);
      d.position.set(t.x, t.fy + 1.7 * t.s, t.z); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
      d.position.set(t.x, t.fy + 4.1 * t.s, t.z); d.updateMatrix(); fol1.setMatrixAt(i, d.matrix); // canopy bottom ~2.6 m: walk beneath freely
      d.position.set(t.x, t.fy + 6.0 * t.s, t.z); d.updateMatrix(); fol2.setMatrixAt(i, d.matrix);
    });
    [trunk, fol1, fol2].forEach(m => { m.frustumCulled = false; group.add(m); });
  }

  // ---- ceiling lamp fixtures
  const lampGeo = new THREE.BoxGeometry(1.6, 0.14, 1.6); const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lm = new THREE.InstancedMesh(lampGeo, lampMat, Math.max(1, lv.lamps.length)); const m4 = new THREE.Matrix4();
  lv.lamps.forEach((l, i) => { m4.makeTranslation(l.x, l.y + 0.2, l.z); lm.setMatrixAt(i, m4); lm.setColorAt(i, new THREE.Color(l.color).multiplyScalar(1.4)); });
  lm.count = lv.lamps.length; lm.frustumCulled = false; group.add(lm);
  return group;
}
