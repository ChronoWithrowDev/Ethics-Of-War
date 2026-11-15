import * as THREE from 'three';
import { MAP_ORDER, WEAPONS } from './data';
import type { PlanetId } from './data';
import {
  CELL, CORR_H, T_CLIFF, T_CRATE, T_FLOOR, T_PILLAR, T_TREE, T_VOID,
} from './level';
import type { LevelData, ArenaSpawn, Deck, Stair, Ladder, AntigravPad, Room } from './level';
import { glowTexture, mulberry } from './textures';

export interface ArenaDef {
  name: string;
  subtitle: string;
  description: string;
  feature: string;
  void: boolean;
  accent: number;
}

export const ARENAS: Record<PlanetId, ArenaDef> = {
  earth: {
    name: 'Spanish Peaks Quarry', subtitle: 'Abandoned rock works',
    description: 'Run an S-shaped mountain valley from a forested basin, through terraced quarry cuts, to a ridge-top ore crusher.',
    feature: 'S-valley / forested basin / terraced quarry / ridge crusher', void: false, accent: 0xffbd76,
  },
  moon: {
    name: 'Tycho Relay', subtitle: 'Far-side comms station',
    description: 'Cross an outer crater ring, drop through breach gates into the bowl, and fight for scaffolds around the central relay dish.',
    feature: 'Crater ring / breach gates / inner bowl / relay dish', void: false, accent: 0xe2f2ff,
  },
  mars: {
    name: 'Cold Archive Breach', subtitle: 'Olympus data fortress',
    description: 'Navigate a dense archive city: rooftop decks, narrow service alleys, long avenues and a fortified data plaza.',
    feature: 'City-block maze / rooftops / avenues / data plaza', void: false, accent: 0xff7552,
  },
  jupiter: {
    name: 'Tempest Foundry', subtitle: 'Aeolus storm deck',
    description: 'Leap an uneven archipelago of foundry islands. Safe bridges compete with shorter, exposed jump routes to the storm core.',
    feature: 'Island archipelago / uneven heights / risk-reward jumps', void: true, accent: 0xffca70,
  },
  saturn: {
    name: 'Cassini Ringworks', subtitle: 'Suspended crystal refinery',
    description: 'Own the circular ring road, dive through spoke bridges to the crystal island, or snipe from outer mining satellites.',
    feature: 'Ring road / spoke bridges / crystal island / satellites', void: true, accent: 0xffe3a5,
  },
  uranus: {
    name: 'Sideways Vault', subtitle: 'Miranda polar scaffold',
    description: 'Climb a zig-zag chain of ice terraces over the void, with side spurs and shortcuts cutting across the switchbacks.',
    feature: 'Switchback terraces / diagonal causeways / ice spurs', void: true, accent: 0x8df6ef,
  },
  neptune: {
    name: 'Triton Pressure Rig', subtitle: 'Storm-facing deep lab',
    description: 'Fight along two long pressure lanes joined by three crosswalks, then assault the reactor headland at the east end.',
    feature: 'Twin lanes / cross bridges / reactor headland', void: true, accent: 0x63c9ff,
  },
  pluto: {
    name: 'Hollow Crown', subtitle: 'Kuiper frontier citadel',
    description: 'Battle through six ruined sectors divided by broken radial walls, using gatehouses and battlements to circle the sun-eater spire.',
    feature: 'Radial sectors / broken walls / gatehouses / spire', void: false, accent: 0xe170ff,
  },
};

const W = 80, H = 80, C = 40;
const IN = (x: number, z: number) => x >= 2 && z >= 2 && x < W - 2 && z < H - 2;
const S = (x: number, z: number) => z * W + x;
const world = (v: number) => (v + 0.5) * CELL;

export function arenaOutposts(planet: PlanetId): [number, number][] {
  if (planet === 'uranus' || planet === 'neptune') return [[C - 19, C - 19], [C + 19, C - 19], [C + 19, C + 19], [C - 19, C + 19]];
  if (planet === 'saturn') return [[C - 23, C], [C, C - 23], [C + 23, C], [C, C + 23]];
  if (planet === 'jupiter') return [[C - 27, C], [C, C - 27], [C + 27, C], [C, C + 27]];
  return [[C - 18, C - 10], [C + 18, C - 10], [C + 18, C + 10], [C - 18, C + 10]];
}

function calcTerrain(planet: PlanetId, x: number, z: number) {
  const r = Math.hypot(x - C, z - C);
  const blend = Math.min(1, Math.max(0, (r - 14) / 12));
  const undulate = Math.sin(x * 0.19 + 0.6) * Math.cos(z * 0.16 - 0.4) + Math.sin(x * 0.09 + z * 0.22) * 0.45;
  if (planet === 'earth') return blend * (undulate * 0.58 - 0.3);
  if (planet === 'moon') return blend * (0.45 + undulate * 0.36);
  if (planet === 'mars') return blend * (undulate * 0.55 + Math.sin(z * 0.3) * 0.18);
  if (planet === 'pluto') return blend * (undulate * 0.42 + 0.15);
  return 0;
}

/** Eight authored PvP layouts. They share physics/rendering, not a floor plan. */
export function generateArena(planet: PlanetId): LevelData {
  const def = ARENAS[planet]; const voidMap = def.void;
  const seed = MAP_ORDER.indexOf(planet) * 7213 + 20891;
  const rnd = mulberry(seed);
  const tiles = new Uint8Array(W * H).fill(voidMap ? T_VOID : T_CLIFF);
  const floorH = new Float32Array(W * H);
  const ceil = new Float32Array(W * H);
  const sky = new Uint8Array(W * H);
  const wallTop = new Float32Array(W * H);
  const roomOf = new Int16Array(W * H).fill(-1);
  const reach = new Uint8Array(W * H);
  const rooms: Room[] = [{
    id: 0, x0: 4, y0: 4, x1: 75, y1: 75, cx: C, cy: C,
    ceil: CORR_H, fy: 0, outdoor: true, kind: 'yard', alt: false,
    lamp: def.accent, col: 0,
  }];
  const decks: Deck[] = [], stairs: Stair[] = [], ladders: Ladder[] = [], antigravPads: AntigravPad[] = [];
  const trees: LevelData['trees'] = [], mountains: LevelData['mountains'] = [];
  const pickups: LevelData['pickups'] = [];
  const lamps: LevelData['lamps'] = [{ x: world(C), y: 18, z: world(C), room: 0, color: def.accent, power: 1.2 }];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) floorH[S(x, z)] = calcTerrain(planet, x, z);

  const tileAt = (x: number, z: number) => (x < 0 || z < 0 || x >= W || z >= H ? T_CLIFF : tiles[S(x, z)]);
  const setFloor = (x: number, z: number, y?: number) => {
    if (!IN(x, z)) return;
    const i = S(x, z);
    if (y !== undefined) floorH[i] = y;
    tiles[i] = T_FLOOR; sky[i] = 1; ceil[i] = floorH[i] + CORR_H; roomOf[i] = 0;
  };
  const rect = (x0: number, z0: number, x1: number, z1: number, y?: number) => {
    for (let z = Math.max(2, z0); z <= Math.min(H - 3, z1); z++) for (let x = Math.max(2, x0); x <= Math.min(W - 3, x1); x++) setFloor(x, z, y);
  };
  const disc = (cx: number, cz: number, rad: number, y = 0, rough = 0) => {
    for (let z = Math.max(2, Math.floor(cz - rad - 2)); z <= Math.min(H - 3, Math.ceil(cz + rad + 2)); z++)
      for (let x = Math.max(2, Math.floor(cx - rad - 2)); x <= Math.min(W - 3, Math.ceil(cx + rad + 2)); x++) {
        const a = Math.atan2(z - cz, x - cx), radius = rad + rough * Math.sin(a * 7 + seed) * 0.45;
        if (Math.hypot(x - cx, z - cz) < radius) setFloor(x, z, y);
      }
  };
  const line = (x0: number, z0: number, x1: number, z1: number, width = 1, y0?: number, y1?: number, gapAt = -1, gapCells = 2) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 3;
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      if (gapAt >= 0 && Math.abs(t - gapAt) < (gapCells / Math.max(1, Math.hypot(x1 - x0, z1 - z0))) * 0.52) continue;
      const x = Math.round(x0 + (x1 - x0) * t), z = Math.round(z0 + (z1 - z0) * t);
      const yy = y0 === undefined ? undefined : y0 + ((y1 ?? y0) - y0) * t;
      for (let dz = -width; dz <= width; dz++) for (let dx = -width; dx <= width; dx++) if (dx * dx + dz * dz <= width * width + 0.5) setFloor(x + dx, z + dz, yy);
    }
  };
  const solid = (x: number, z: number, t = T_PILLAR) => { if (IN(x, z)) { tiles[S(x, z)] = t; sky[S(x, z)] = 1; roomOf[S(x, z)] = -1; } };
  const solidRect = (x0: number, z0: number, x1: number, z1: number, t = T_PILLAR) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) solid(x, z, t); };
  const pad = (cx: number, cz: number, tilesWide: number, y = -0.65) => {
    if (!voidMap) return;
    const x = world(cx), z = world(cz);
    if (antigravPads.some(p => Math.hypot(p.x - x, p.z - z) < CELL * 1.5)) return;
    antigravPads.push({ x, y, z, w: tilesWide * CELL, d: tilesWide * CELL, color: def.accent });
  };
  const deck = (cx: number, cz: number, hw: number, hd: number, y: number) => {
    const d: Deck = { id: decks.length, room: 0, x0: world(cx) - hw, z0: world(cz) - hd, x1: world(cx) + hw, z1: world(cz) + hd, y, thick: 0.38 };
    decks.push(d); return d;
  };
  const stairX = (xLow: number, xHigh: number, z: number, yLow: number, yHigh: number) => {
    const dir = xHigh > xLow ? 1 : -1 as 1 | -1;
    stairs.push({ x0: Math.min(xLow, xHigh), x1: Math.max(xLow, xHigh), z0: world(z) - 3.2, z1: world(z) + 3.2, y0: yLow, y1: yHigh, axis: 'x', dir, steps: 12, room: 0 });
  };
  const stairZ = (x: number, zLow: number, zHigh: number, yLow: number, yHigh: number) => {
    const dir = zHigh > zLow ? 1 : -1 as 1 | -1;
    stairs.push({ x0: world(x) - 3.2, x1: world(x) + 3.2, z0: Math.min(zLow, zHigh), z1: Math.max(zLow, zHigh), y0: yLow, y1: yHigh, axis: 'z', dir, steps: 12, room: 0 });
  };
  const ladder = (x: number, z: number, nz: 1 | -1, y0: number, y1: number) => ladders.push({ x, z, nx: 0, nz, y0, y1, room: 0 });
  // A deck plus one stair and one ladder route. Stair feet are placed on walkable ground.
  const tower = (cx: number, cz: number, hw: number, hd: number, baseY: number, heights: number[], stairSide: 'W' | 'E' | 'N' | 'S' = 'W') => {
    if (!voidMap) { const px = Math.ceil(hw / CELL) + 5, pz = Math.ceil(hd / CELL) + 5; rect(cx - px, cz - pz, cx + px, cz + pz, baseY); }
    let prevY = baseY; let prev: Deck | null = null;
    heights.forEach((h, idx) => {
      const shrink = idx * 2.2;
      const d = deck(cx, cz, Math.max(5, hw - shrink), Math.max(5, hd - shrink), baseY + h);
      const wx = world(cx), wz = world(cz);
      if (idx === 0) {
        if (stairSide === 'W') stairX(wx - hw - 15, d.x0, cz, baseY, d.y);
        else if (stairSide === 'E') stairX(wx + hw + 15, d.x0 + (d.x1 - d.x0), cz, baseY, d.y);
        else if (stairSide === 'N') stairZ(cx, wz - hd - 15, d.z0, baseY, d.y);
        else stairZ(cx, wz + hd + 15, d.z0 + (d.z1 - d.z0), baseY, d.y);
        ladder(wx + hw - 3, d.z1 + 0.3, 1, baseY, d.y);
      } else if (prev) {
        // Each tier gets its own face so no stair footprint ever overlaps another.
        const face = idx === 1 ? (stairSide === 'N' ? 'E' : 'N') : (stairSide === 'S' ? 'W' : 'S');
        if (face === 'N') stairs.push({ x0: wx - 3.2, x1: wx + 3.2, z0: d.z0 - 11, z1: d.z0, y0: prevY, y1: d.y, axis: 'z', dir: 1, steps: 12, room: 0 });
        else if (face === 'S') stairs.push({ x0: wx - 3.2, x1: wx + 3.2, z0: d.z1, z1: d.z1 + 11, y0: prevY, y1: d.y, axis: 'z', dir: -1, steps: 12, room: 0 });
        else if (face === 'E') stairs.push({ x0: d.x1, x1: d.x1 + 11, z0: wz - 3.2, z1: wz + 3.2, y0: prevY, y1: d.y, axis: 'x', dir: -1, steps: 12, room: 0 });
        else stairs.push({ x0: d.x0 - 11, x1: d.x0, z0: wz - 3.2, z1: wz + 3.2, y0: prevY, y1: d.y, axis: 'x', dir: 1, steps: 12, room: 0 });
        ladder(wx - hw + shrink + 2, d.z0 - 0.3, -1, prevY, d.y);
      }
      prevY = d.y; prev = d;
    });
    return prev;
  };
  const cover = (spots: [number, number, number?][]) => spots.forEach(([x, z, t]) => { if (tileAt(x, z) === T_FLOOR) solid(x, z, t ?? (Math.abs(x * 7 + z * 13) % 3 ? T_CRATE : T_PILLAR)); });
  const reward = (kind: 'health' | 'armor' | 'ammo', x: number, z: number, y: number, value: number, ammo?: LevelData['pickups'][number]['ammo']) => pickups.push({ kind, x, z, y, value, ammo, secret: false });
  const spawnList: [number, number, number?][] = [];

  if (planet === 'earth') {
    // S-valley: forested west basin -> winding cuts -> quarry bowl -> east amphitheatre.
    disc(17, 43, 13, 0, 1); disc(66, 38, 12, 0.4, 1);
    line(17, 43, 31, 31, 2, 0, 0.2); line(31, 31, 43, 48, 2, 0.2, 0.5); line(43, 48, 57, 32, 2, 0.5, 0.4); line(57, 32, 66, 38, 2, 0.4, 0.4);
    disc(42, 39, 12, 0.45, 1.4); disc(52, 25, 8, 0.8);
    // Elevated north ridge joining both ends without crossing the valley floor.
    rect(15, 15, 68, 19, 2.6); line(17, 43, 17, 19, 1, 0, 2.6); line(66, 38, 66, 19, 1, 0.4, 2.6);
    deck(40, 17, 34, 5, 3.1);
    tower(53, 27, 11, 9, 0.8, [3, 6.2, 9.2], 'S');
    disc(28, 55, 10, 0.1); tower(28, 55, 9, 7, 0.1, [2.6, 5.4], 'E');
    for (let i = 0; i < 46; i++) { const a = rnd() * 6.28, r = 5 + rnd() * 8; const x = Math.round(17 + Math.cos(a) * r), z = Math.round(43 + Math.sin(a) * r); if (tileAt(x, z) === T_FLOOR && rnd() < 0.75) solid(x, z, T_TREE); }
    cover([[36, 35], [46, 43], [61, 34], [30, 50], [55, 47], [22, 36], [69, 44]]);
    spawnList.push([10, 43], [73, 38], [17, 17, 2.6], [66, 17, 2.6], [31, 31], [57, 32], [42, 47], [53, 18]);
    reward('ammo', world(53), world(27), 10, 1, 'vector'); reward('ammo', world(40), world(17), 3.1, 6, 'rockets'); reward('armor', world(28), world(55), 5.5, 50);
  } else if (planet === 'moon') {
    // Crater annulus with four breaches into a raised inner bowl.
    disc(C, C, 30, 0.2, 1.2); disc(C, C, 10, 1.1);
    for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; const x = Math.round(C + Math.cos(a) * 16), z = Math.round(C + Math.sin(a) * 16); if (![0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4].some(g => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 3.05)) solid(x, z, T_PILLAR); }
    line(24, C, 56, C, 1, 0.2, 0.2); line(C, 24, C, 56, 1, 0.2, 0.2);
    tower(C, C, 10, 10, 1.1, [3.2, 6.4], 'W');
    disc(18, 18, 9, 0.2); disc(62, 62, 9, 0.2); disc(62, 18, 9, 0.2); disc(18, 62, 9, 0.2);
    tower(18, 18, 8, 6, 0.2, [2.8], 'E'); tower(62, 62, 8, 6, 0.2, [2.8], 'W'); tower(62, 18, 7, 6, 0.2, [2.8], 'S'); tower(18, 62, 7, 6, 0.2, [2.8], 'N');
    cover([[29, 29], [51, 29], [29, 51], [51, 51], [35, 61], [61, 35], [19, 45], [45, 19]]);
    spawnList.push([12, C], [68, C], [C, 12], [C, 68], [24, 24], [56, 56], [56, 24], [24, 56]);
    reward('ammo', world(C), world(C), 7.5, 1, 'vector'); reward('armor', world(18), world(18), 3, 50); reward('ammo', world(62), world(62), 3, 6, 'rockets');
  } else if (planet === 'mars') {
    // Archive city grid: blocks, alleys, avenues and rooftop decks.
    rect(7, 7, 72, 72, 0);
    const blocks: [number, number, number, number][] = [[12, 12, 23, 23], [30, 10, 41, 21], [49, 12, 62, 24], [11, 31, 22, 43], [50, 32, 63, 44], [13, 52, 24, 65], [31, 55, 42, 67], [50, 54, 62, 66], [28, 29, 34, 36], [46, 43, 52, 50]];
    blocks.forEach(([x0, z0, x1, z1]) => solidRect(x0, z0, x1, z1, T_PILLAR));
    rect(35, 35, 45, 45, 0); // data plaza stays open
    tower(C, C, 9, 9, 0, [3.4, 6.8], 'W');
    tower(17, 17, 8, 8, 0, [3.2], 'E'); tower(56, 18, 8, 8, 0, [3.2], 'S'); tower(18, 59, 8, 8, 0, [3.2], 'N'); tower(57, 60, 8, 8, 0, [3.2], 'W');
    cover([[26, 27], [45, 27], [26, 49], [54, 49], [36, 25], [44, 55], [24, 39], [56, 39]]);
    spawnList.push([9, 9], [70, 70], [70, 9], [9, 70], [26, C], [55, 27], [C, 26], [C, 54]);
    reward('ammo', world(C), world(C), 6.8, 1, 'vector'); reward('armor', world(17), world(17), 3.2, 50); reward('ammo', world(57), world(60), 3.2, 40, 'bullets');
  } else if (planet === 'jupiter') {
    // Uneven foundry archipelago: two routes to the offset storm core.
    const islands: [number, number, number, number][] = [[15, 42, 7, 0], [27, 23, 5, 1], [46, 17, 6, 2], [65, 27, 5, 1], [59, 55, 6, 0], [33, 61, 7, 0], [42, 41, 5, 1.6], [54, 43, 3, 2.6]];
    islands.forEach(([x, z, r, y]) => { disc(x, z, r, y); pad(x, z, r * 1.7, y - 0.65); });
    line(15, 42, 27, 23, 1, 0, 1); line(27, 23, 46, 17, 1, 1, 2, 0.55); line(46, 17, 65, 27, 1, 2, 1);
    line(65, 27, 42, 41, 1, 1, 1.6, 0.5); line(42, 41, 59, 55, 1, 1.6, 0); line(59, 55, 33, 61, 1, 0, 0, 0.58); line(33, 61, 15, 42, 1, 0, 0); line(15, 42, 42, 41, 1, 0, 1.6, 0.62); line(42, 41, 54, 43, 1, 1.6, 2.6);
    tower(46, 17, 9, 8, 2, [3, 6], 'S'); tower(15, 42, 8, 7, 0, [3], 'E'); tower(59, 55, 8, 7, 0, [3], 'W');
    cover([[42, 41], [27, 23], [65, 27], [33, 61]]);
    spawnList.push([11, 42], [46, 13], [68, 27], [59, 59], [29, 64], [42, 37], [54, 43, 2.6], [24, 20]);
    reward('ammo', world(46), world(17), 8, 1, 'vector'); reward('armor', world(39), world(38), 1.6, 50); reward('ammo', world(54), world(43), 2.6, 6, 'rockets');
  } else if (planet === 'saturn') {
    // True ring road around a void heart, with a small crystal island and satellites.
    for (let z = 8; z < 72; z++) for (let x = 8; x < 72; x++) { const r = Math.hypot(x - C, z - C); if (r >= 17 && r <= 25) setFloor(x, z, 0); }
    disc(C, C, 5, 1.6); pad(C, C, 8, 1);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = Math.round(C + Math.cos(a) * 21), z = Math.round(C + Math.sin(a) * 21); disc(x, z, 4, 0); pad(x, z, 7); }
    for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) { const x = Math.round(C + Math.cos(a) * 21), z = Math.round(C + Math.sin(a) * 21); line(x, z, C, C, 1, 0, 1.6, a === 0 ? 0.55 : -1); }
    for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) { const x = Math.round(C + Math.cos(a) * 32), z = Math.round(C + Math.sin(a) * 32); disc(x, z, 3, 0.6); pad(x, z, 5, 0); line(Math.round(C + Math.cos(a) * 21), Math.round(C + Math.sin(a) * 21), x, z, 1, 0, 0.6, 0.5); }
    tower(C, C, 7, 7, 1.6, [3, 6], 'W'); tower(C - 21, C, 7, 6, 0, [3], 'E'); tower(C, C - 21, 7, 6, 0, [3], 'S'); tower(C + 21, C, 7, 6, 0, [3], 'W'); tower(C, C + 21, 7, 6, 0, [3], 'N');
    spawnList.push([19, C], [61, C], [C, 19], [C, 61], [25, 25], [55, 55], [55, 25], [25, 55]);
    reward('ammo', world(C), world(C), 7.6, 1, 'vector'); reward('armor', world(C - 21), world(C), 3, 50); reward('ammo', world(C), world(C + 21), 3, 40, 'bullets');
  } else if (planet === 'uranus') {
    // Switchback chain of ice terraces, with two exposed shortcut jumps.
    const chain: [number, number, number, number][] = [[13, 63, 6, 0], [26, 51, 5, 0.8], [19, 36, 5, 1.6], [34, 27, 6, 2.4], [49, 35, 5, 3.2], [58, 22, 6, 4], [67, 12, 5, 4.8]];
    chain.forEach(([x, z, r, y]) => { disc(x, z, r, y); pad(x, z, r * 1.6, y - 0.65); });
    for (let i = 0; i < chain.length - 1; i++) { const [x, z, , y] = chain[i], [nx, nz, , ny] = chain[i + 1]; line(x, z, nx, nz, 1, y, ny, i === 2 ? 0.52 : -1); }
    disc(55, 58, 4, 1.2); pad(55, 58, 6, 0.55); line(34, 27, 55, 58, 1, 2.4, 1.2, 0.58); disc(12, 18, 4, 2.8); pad(12, 18, 6, 2.15); line(19, 36, 12, 18, 1, 1.6, 2.8);
    tower(34, 27, 9, 8, 2.4, [3, 6], 'S'); tower(58, 22, 8, 7, 4, [3], 'W'); tower(13, 63, 8, 7, 0, [3], 'E');
    spawnList.push([9, 66], [70, 9], [26, 47], [19, 32], [49, 39], [62, 18], [55, 58, 1.2], [12, 18, 2.8]);
    reward('ammo', world(34), world(27), 8.4, 1, 'vector'); reward('armor', world(58), world(22), 7, 50); reward('ammo', world(13), world(63), 3, 6, 'rockets');
  } else if (planet === 'neptune') {
    // Twin pressure lanes, three crosswalks and a reactor headland.
    rect(9, 15, 71, 25, 0); rect(9, 55, 71, 65, 0);
    rect(17, 25, 23, 55, 0); rect(37, 25, 43, 55, 0); rect(57, 25, 63, 55, 0);
    for (const z of [39, 40]) for (const x of [39, 40]) tiles[S(x, z)] = T_VOID; // broken middle crosswalk
    disc(66, 40, 7, 1.2); pad(66, 40, 11, 0.55); line(63, 40, 66, 40, 1, 0, 1.2);
    disc(13, 40, 5, 0.6); pad(13, 40, 8, -0.05); line(13, 40, 20, 40, 1, 0.6, 0);
    tower(66, 40, 9, 9, 1.2, [3.2, 6.4], 'W'); tower(20, 20, 8, 6, 0, [3], 'S'); tower(60, 60, 8, 6, 0, [3], 'N');
    cover([[28, 20], [52, 20], [28, 60], [52, 60], [40, 31], [40, 49], [15, 59], [65, 21]]);
    spawnList.push([11, 20], [69, 60], [69, 20], [11, 60], [20, 40], [60, 40], [40, 20], [40, 60]);
    reward('ammo', world(66), world(40), 7.6, 1, 'vector'); reward('armor', world(20), world(20), 3, 50); reward('ammo', world(60), world(60), 3, 40, 'bullets');
  } else {
    // Pluto: six radial sectors split by broken walls and gate gaps.
    disc(C, C, 30, 0.2, 1.5);
    for (let s = 0; s < 6; s++) {
      const a = s * Math.PI / 3 + 0.25;
      for (let r = 10; r <= 27; r++) { if (r === 18 || r === 19) continue; const x = Math.round(C + Math.cos(a) * r), z = Math.round(C + Math.sin(a) * r); solid(x, z, T_PILLAR); solid(Math.round(C + Math.cos(a + 0.035) * r), Math.round(C + Math.sin(a + 0.035) * r), T_PILLAR); }
    }
    for (let i = 0; i < 140; i++) { const a = i / 140 * Math.PI * 2; if ([0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].some(g => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.12)) continue; solid(Math.round(C + Math.cos(a) * 29), Math.round(C + Math.sin(a) * 29), T_PILLAR); }
    tower(C, C, 9, 9, 0.2, [3.4, 6.8, 10], 'W');
    tower(24, 24, 7, 6, 0.2, [3], 'E'); tower(56, 24, 7, 6, 0.2, [3], 'S'); tower(24, 56, 7, 6, 0.2, [3], 'N'); tower(56, 56, 7, 6, 0.2, [3], 'W');
    cover([[31, 22], [49, 22], [31, 58], [49, 58], [22, 40], [58, 40]]);
    spawnList.push([24, 24], [56, 56], [48, 20], [20, 48], [C, 20], [C, 60], [20, C], [60, C]);
    reward('ammo', world(C), world(C), 10.2, 1, 'vector'); reward('armor', world(24), world(24), 3.2, 50); reward('ammo', world(56), world(56), 3.2, 6, 'rockets');
  }

  // Shared competitive rewards away from the signature top-tier prize.
  const rewardSpots: [number, number][] = [[14, 14], [66, 14], [66, 66], [14, 66], [C, 12], [C, 68], [12, C], [68, C]];
  rewardSpots.forEach(([x, z], i) => {
    let best: [number, number] | null = null;
    for (let r = 0; r < 9 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (tileAt(x + dx, z + dz) === T_FLOOR) { best = [x + dx, z + dz]; dz = 99; break; }
    if (!best) return; const [bx, bz] = best;
    if (i % 3 === 0) reward('health', world(bx), world(bz), floorH[S(bx, bz)], 30);
    else if (i % 3 === 1) reward('armor', world(bx), world(bz), floorH[S(bx, bz)], 30);
    else reward('ammo', world(bx), world(bz), floorH[S(bx, bz)], 24, i % 2 ? 'cells' : 'nails');
  });

  // Boundaries and wall heights.
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) {
    const i = S(x, z), t = tiles[i];
    if (t === T_TREE) { wallTop[i] = floorH[i] + 7; continue; }
    if (t === T_PILLAR) { wallTop[i] = floorH[i] + 4.2; continue; }
    if (t !== T_CLIFF) continue;
    const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const n = tileAt(x + dx, z + dz); return n === T_FLOOR || n === T_CRATE || n === T_TREE; });
    if (adjacent) wallTop[i] = floorH[i] + 8 + Math.abs(Math.sin(x * 1.7 + z * 2.1)) * 4;
  }
  if (!voidMap) for (let k = 0; k < 84; k++) {
    const a = k * Math.PI * 2 / 84, r = 40 + rnd() * 10, h = 18 + rnd() * 26;
    mountains.push({ x: world(C) + Math.cos(a) * r * CELL, z: world(C) + Math.sin(a) * r * CELL, r: 8 + rnd() * 6, h, baseY: -3 });
  }

  const spawns: ArenaSpawn[] = spawnList.map(([x, z, y]) => ({ x: world(x), y: y ?? floorH[S(x, z)], z: world(z) }));
  const start = spawns[0];
  const q: number[] = [S(Math.floor(start.x / CELL), Math.floor(start.z / CELL))]; reach[q[0]] = 1;
  for (let head = 0; head < q.length; head++) {
    const i = q[head], x = i % W, z = Math.floor(i / W);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz; if (!IN(nx, nz)) continue;
      const n = S(nx, nz);
      if (tiles[n] === T_FLOOR && !reach[n]) { reach[n] = 1; q.push(n); }
      if (voidMap && tiles[n] === T_VOID) for (let hop = 2; hop <= 3; hop++) {
        const hx = x + dx * hop, hz = z + dz * hop; if (!IN(hx, hz)) break;
        const hi = S(hx, hz); if (tiles[hi] === T_VOID) continue;
        if (tiles[hi] === T_FLOOR && !reach[hi]) { reach[hi] = 1; q.push(hi); }
        break;
      }
    }
  }
  let minFloorY = 0;
  for (let i = 0; i < W * H; i++) if (tiles[i] !== T_VOID) minFloorY = Math.min(minFloorY, floorH[i]);

  return {
    planet, level: 0, name: def.name, arena: { name: def.name, description: def.description, spawns }, env: voidMap ? 'skybridge' : 'outdoor', isBoss: false, seed,
    W, H, tiles, ceil, sky, wallTop, floorH, roomOf, reach,
    rooms, doors: [], secrets: [], lamps, trees, mountains, decks, stairs, ladders, antigravPads,
    spawn: { ...start, yaw: -Math.PI / 2 }, exit: { x: world(C), y: 0, z: world(C) }, exitKind: 'portal', exitYaw: 0,
    enemies: [], pickups, totalSecrets: 0, minFloorY,
  };
}

const material = (color: number, emissive = 0) => new THREE.MeshLambertMaterial({ color, emissive, flatShading: true });
const luminous = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });

/** Landmarks aligned to each authored layout (visual identity; collision lives in decks/tiles). */
export function buildArenaDetails(planet: PlanetId): THREE.Group {
  const g = new THREE.Group(); const def = ARENAS[planet];
  const metal = material(0x303848), trim = luminous(def.accent);
  const movable: { mesh: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }[] = [];
  const block = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m;
  };
  const cylinder = (parent: THREE.Object3D, x: number, y: number, z: number, r1: number, r2: number, h: number, mat: THREE.Material, sides = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, sides), mat); m.position.set(x, y, z); parent.add(m); return m;
  };
  const halo = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 6, 32), mat); m.position.set(x, y, z); parent.add(m); return m;
  };
  const W2 = (v: number) => world(v);
  const plaque = document.createElement('canvas'); plaque.width = 512; plaque.height = 96;
  const ctx = plaque.getContext('2d')!; ctx.fillStyle = '#080c14'; ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#' + def.accent.toString(16).padStart(6, '0'); ctx.lineWidth = 3; ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = '#e7faff'; ctx.textAlign = 'center'; ctx.font = 'bold 28px monospace'; ctx.fillText(def.name.toUpperCase(), 256, 59);
  const signTexture = new THREE.CanvasTexture(plaque); signTexture.colorSpace = THREE.SRGBColorSpace;
  const signAt = (x: number, y: number, z: number, ry = 0) => { const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.5), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide })); sign.position.set(x, y, z); sign.rotation.y = ry; g.add(sign); };

  if (planet === 'earth') {
    const x = W2(53), z = W2(27); signAt(x, 12.5, z - 10);
    for (const sd of [-1, 1]) { block(g, x + sd * 6, 14, z, 0.9, 9, 0.9, material(0x665042)); const jib = block(g, x + sd * 3, 19, z, 7, 0.45, 0.7, material(0x8c6944)); jib.rotation.z = sd * 0.3; }
    cylinder(g, x, 15.5, z, 2.7, 3.6, 10, material(0x57463a));
    const beacon = halo(g, x, 21, z, 1.7, luminous(0xbf66ff)); beacon.rotation.x = 1.2; movable.push({ mesh: beacon, speed: 0.6, axis: 'y' });
    // Ridge gantry lights along the north route.
    for (let i = 0; i < 7; i++) block(g, W2(18 + i * 8), 5.6, W2(17), 0.35, 5, 0.35, i % 2 ? trim : metal);
  } else if (planet === 'moon') {
    const x = W2(C), z = W2(C); signAt(x, 10, z - 12);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(0xb9c6d0));
    dish.position.set(x, 13.5, z); dish.rotation.x = 0.65; g.add(dish);
    cylinder(g, x, 15, z, 0.3, 0.55, 10, metal); halo(g, x, 17.5, z, 5.5, trim).rotation.x = 0.7;
    for (const [gx, gz] of [[18, 18], [62, 62], [62, 18], [18, 62]]) { const dx = W2(gx), dz = W2(gz); const mini = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), material(0xa7b8c5)); mini.position.set(dx + 7, 5.4, dz + 7); mini.rotation.x = 0.5; g.add(mini); }
  } else if (planet === 'mars') {
    const x = W2(C), z = W2(C); signAt(x, 9.5, z - 11);
    for (let i = -2; i <= 2; i++) for (const sd of [-1, 1]) { block(g, x + sd * 9, 10.5, z + i * 2, 0.9, 7, 1.2, material(0x3c4655)); block(g, x + sd * 9, 11, z + i * 2 - 0.65, 0.6, 5, 0.08, luminous(0x37cfe4, 0.85)); }
    const core = cylinder(g, x, 12, z, 2.4, 3.1, 10, luminous(0xff824f, 0.85)); movable.push({ mesh: core, speed: 0.18, axis: 'y' }); halo(g, x, 17.5, z, 4.7, trim).rotation.x = 1.1;
    for (const [gx, gz] of [[17, 17], [56, 18], [18, 59], [57, 60]]) block(g, W2(gx), 6.5, W2(gz), 3, 6, 2, metal);
  } else if (planet === 'jupiter') {
    const x = W2(46), z = W2(17); signAt(x, 11, z - 9);
    cylinder(g, x, 14, z, 1.5, 2.7, 7, metal);
    for (let i = 0; i < 4; i++) { const h = halo(g, x, 12.5 + i * 2.4, z, 3.5 - i * 0.35, trim); h.rotation.x = 0.7; movable.push({ mesh: h, speed: (i % 2 ? -1 : 1) * (0.3 + i * 0.1), axis: 'y' }); }
    const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); orb.position.set(x, 21, z); orb.scale.setScalar(14); g.add(orb);
    for (const [gx, gz] of [[15, 42], [27, 23], [65, 27], [59, 55], [33, 61], [42, 41]]) { const px = W2(gx), pz = W2(gz); block(g, px, 3, pz, 1, 6, 1, metal); block(g, px, 6.2, pz, 2, 0.3, 2, trim); }
  } else if (planet === 'saturn') {
    const x = W2(C), z = W2(C); signAt(x, 10.5, z - 8);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(4, 0), material(0xbfe9fc, 0x225080)); crystal.position.set(x, 10.5, z); g.add(crystal); movable.push({ mesh: crystal, speed: 0.3, axis: 'y' });
    for (const [r, ry] of [[6.5, 0.85], [9, 1.25], [11, 0.4]]) { const ring = halo(g, x, 10.5, z, r, luminous(0xe7c98a, 0.8)); ring.rotation.x = ry; movable.push({ mesh: ring, speed: r < 7 ? -0.25 : 0.2, axis: 'z' }); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), luminous(0xbceaff, 0.85)); shard.position.set(x + Math.cos(a) * 84, 5, z + Math.sin(a) * 84); g.add(shard); }
  } else if (planet === 'uranus') {
    const x = W2(34), z = W2(27); signAt(x, 11.5, z - 10);
    const lens = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 0), material(0x9de9f1, 0x144550)); lens.position.set(x, 12.5, z); g.add(lens); movable.push({ mesh: lens, speed: 0.2, axis: 'z' });
    for (const [r, ry] of [[7.5, 0.2], [10, 1.25]]) { const h = halo(g, x, 12.5, z, r, luminous(0x78ffe9, 0.8)); h.rotation.y = ry; movable.push({ mesh: h, speed: -0.18, axis: 'x' }); }
    for (const [gx, gz] of [[13, 63], [26, 51], [19, 36], [49, 35], [58, 22], [67, 12]]) { const px = W2(gx), pz = W2(gz); const ice = new THREE.Mesh(new THREE.ConeGeometry(1.8, 7, 5), material(0x97dce7, 0x144859)); ice.position.set(px + 8, 5, pz + 8); g.add(ice); }
  } else if (planet === 'neptune') {
    const x = W2(66), z = W2(40); signAt(x - 12, 10.5, z, Math.PI / 2);
    const tank = cylinder(g, x, 11.5, z, 4.1, 4.1, 9, luminous(0x439eff, 0.55), 16); movable.push({ mesh: tank, speed: 0.07, axis: 'y' });
    for (const y of [8, 11, 14]) halo(g, x, y, z, 4.5, trim).rotation.x = Math.PI / 2;
    for (const gx of [20, 40, 60]) for (const gz of [20, 60]) block(g, W2(gx), 6, W2(gz), 1, 7, 1, metal);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x64e8ff, transparent: true, depthWrite: false })); beacon.position.set(x, 17, z); beacon.scale.setScalar(15); g.add(beacon);
  } else {
    const x = W2(C), z = W2(C); signAt(x, 13.5, z - 11);
    const obsidian = material(0x17101f, 0x17092a);
    const monolith = block(g, x, 14.5, z, 4.8, 17, 3, obsidian); monolith.rotation.y = Math.PI / 4;
    for (const y of [10, 16, 22]) { const h = halo(g, x, y, z, 4, luminous(0xe170ff, 0.85)); h.rotation.x = 1.2; movable.push({ mesh: h, speed: y % 2 ? -0.25 : 0.32, axis: 'z' }); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const b = block(g, x + Math.cos(a) * 76, 7, z + Math.sin(a) * 76, 3, 14, 3, obsidian); b.rotation.y = a; }
  }
  g.userData.animate = (dt: number) => { for (const o of movable) o.mesh.rotation[o.axis] += dt * o.speed; };
  return g;
}

// Arena players start with the same gear regardless of campaign progress.
export const ARENA_LOADOUT = {
  owned: WEAPONS.map(w => w.id),
  ammo: { pellets: 20, shells: 16, bullets: 120, nails: 90, grenades: 8, cells: 80, rockets: 8, slugs: 8, vector: 1 },
};