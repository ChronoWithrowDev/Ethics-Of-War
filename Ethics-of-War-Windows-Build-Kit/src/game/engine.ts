import * as THREE from 'three';
import { PLANETS, ENEMY_BY_ID, BOSSES, POLITICIANS, WEAPONS, WEAPON_BY_ID, AMMO_MAX, AMMO_COLOR } from './data';
import type { PlanetId, Planet, EnemyDef, AmmoType, ProjDef } from './data';
import { generateLevel, buildLevelMesh, stairHeightAt, CELL, CRATE_H, CORR_H, T_WALL, T_FLOOR, T_DOOR, T_DOORO, T_SECRET, T_CRATE, T_PILLAR, T_TREE, T_CLIFF, T_VOID, isSolidT, levelUniforms } from './level';
import type { LevelData } from './level';
import { buildWeaponModel } from './weaponModels';
import type { WeaponModel } from './weaponModels';
import { buildCreature } from './creatures';
import type { CreatureModel } from './creatures';
import { audio } from './audio';
import { glowTexture } from './textures';
import { updateEnemy } from './ai';
import type { MPGameCfg } from './net';
import { ARENA_LOADOUT, ARENAS, buildArenaDetails, generateArena } from './arena';

const V3 = THREE.Vector3;
type V3 = THREE.Vector3;
const rand = Math.random;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export interface Settings { sens: number; fov: number; volume: number; music: number; difficulty: 0 | 1 | 2 }
export interface Inventory { owned: string[]; ammo: Record<string, number>; armor: number }
export interface LevelStats { kills: number; totalKills: number; secrets: number; totalSecrets: number; time: number }
export interface DevFlags { enabled: boolean; god: boolean; infAmmo: boolean; noclip: boolean; reveal: boolean; speed: number; timeScale: number; stats: boolean }
export interface HudState {
  hp: number; armor: number; weaponIdx: number; ammoText: string; ammoLabel: string; owned: boolean[]; ammos: Record<string, number>; maxAmmo: Record<string, number>;
  pumps: number; loaded: boolean; loadP: number; revMag: number; kills: number; totalKills: number; secrets: number; totalSecrets: number; time: number;
  banner: { title: string; text: string } | null; msg: string; hit: number; hitHead: boolean; hurt: number; pickup: number; warp: number; zoom: boolean; ads: number; charge: number;
  boss: { name: string; title: string; hp: number; max: number } | null; mp: { mode: string; code: string; kills: number; deaths: number; peers: { name: string; color: string; hp: number; kills: number; deaths: number; dead: boolean }[] } | null; stamina: number; exhausted: boolean; sprinting: boolean; fps: number; dead: boolean; slow: boolean; levelName: string; planet: string; level: number;
  devInfo: string; portalOpen: boolean; vecCharge: number;
}
export interface GameCallbacks { onHud: (h: HudState) => void; onComplete: (s: LevelStats, inv: Inventory) => void; onDead: () => void; onPause: () => void }
export interface GameOptions { planet: PlanetId; level: number; inv: Inventory; settings: Settings; dev: boolean; cb: GameCallbacks; mp?: MPGameCfg | null }

export interface Enemy {
  id: number; def: EnemyDef; pos: THREE.Vector3; vel: THREE.Vector3; kb: THREE.Vector3; yaw: number; hp: number; maxHp: number;
  state: 'dormant' | 'idle' | 'chase' | 'attack' | 'dead'; room: number; ambush: boolean; awake: boolean; model: CreatureModel | null;
  t: number; atkCD: number; atkT: number; atkDone: boolean; painT: number; flash: number; deadT: number; seed: number; los: boolean; losT: number;
  strafe: number; strafeT: number; blinkCD: number; mode: 'walk' | 'windup' | 'leap' | 'cwind' | 'charge' | 'stun' | 'swing'; modeT: number; dirX: number; dirZ: number; vy: number;
  isBoss: boolean; phase: number; summonCD: number; burst: number; burstT: number; pattern: string; removed: boolean; counted: boolean; moveAmt: number; tauntT: number; hitOnce: boolean; moved: number; summoned: boolean;
  snapPos?: THREE.Vector3; snapYaw: number;
}
interface Proj { ghost?: boolean; obj: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; hostile: boolean; dmg: number; life: number; radius: number; grav: number; bounce: boolean; fuse: number; splash: number; style: string; slow: boolean; trailT: number; color: number; spin: number }
interface Pickup { kind: string; ammo?: AmmoType; weapon?: string; value: number; obj: THREE.Object3D; pos: THREE.Vector3; t: number; taken: boolean; respawnT: number; secret: boolean }
interface FX { obj: THREE.Object3D; life: number; max: number; kind: 'beam' | 'blast' | 'ring' | 'sprite'; s0: number; s1: number; mat?: THREE.Material & { opacity: number } }
interface RayHit { t: number; nx: number; ny: number; nz: number; hit: boolean }
export interface RemotePlayer { id: string; name: string; color: number; group: THREE.Group; gun: THREE.Group; flash: THREE.Sprite; target: THREE.Vector3; yaw: number; pitch: number; hp: number; weapon: string; firing: boolean; dead: boolean; kills: number; deaths: number; nameSprite: THREE.Sprite }

// ============================================================ particles
class Particles {
  floorFn: ((x: number, z: number) => number) | null = null;
  N = 900; mesh: THREE.InstancedMesh; pos = new Float32Array(this.N * 3); vel = new Float32Array(this.N * 3); life = new Float32Array(this.N); max = new Float32Array(this.N); size = new Float32Array(this.N); grav = new Float32Array(this.N); cur = 0;
  private d = new THREE.Object3D(); private c = new THREE.Color();
  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.N);
    this.mesh.frustumCulled = false; for (let i = 0; i < this.N; i++) { this.mesh.setColorAt(i, this.c.setRGB(1, 1, 1)); this.d.scale.setScalar(0); this.d.updateMatrix(); this.mesh.setMatrixAt(i, this.d.matrix); }
    scene.add(this.mesh);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav: number) {
    const i = this.cur; this.cur = (this.cur + 1) % this.N; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz; this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grav[i] = grav;
    this.mesh.setColorAt(i, this.c.setHex(color)); if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  burst(p: THREE.Vector3, n: number, color: number, speed: number, life: number, size: number, grav = 12, up = 0.3) {
    for (let i = 0; i < n; i++) { const a = rand() * 6.283, b = rand() * 2 - 1 + up, s = speed * (0.3 + rand() * 0.7); const r = Math.sqrt(Math.max(0, 1 - clamp(b, -1, 1) ** 2)); this.emit(p.x, p.y, p.z, Math.cos(a) * r * s, clamp(b, -1, 1) * s, Math.sin(a) * r * s, life * (0.5 + rand() * 0.5), size * (0.5 + rand()), color, grav); }
  }
  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      const k = i * 3; const d = this.d;
      if (this.life[i] > 0) {
        this.life[i] -= dt; this.vel[k + 1] -= this.grav[i] * dt; this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
        const fl = (this.floorFn ? this.floorFn(this.pos[k], this.pos[k + 2]) : 0) + 0.04;
        if (this.pos[k + 1] < fl) { this.pos[k + 1] = fl; this.vel[k + 1] *= -0.3; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
        d.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]); d.scale.setScalar(this.size[i] * Math.max(0, this.life[i] / this.max[i])); d.rotation.set(i, i * 2, 0);
      } else d.scale.setScalar(0);
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Game {
  opts: GameOptions; settings: Settings; cb: GameCallbacks; planet: Planet; levelNum: number;
  container: HTMLElement; renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; wScene = new THREE.Scene(); wCamera: THREE.PerspectiveCamera;
  lv!: LevelData; lvGroup!: THREE.Group; particles!: Particles; dev: DevFlags;
  player = { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, hp: 100, armor: 0, onGround: true, stamina: 1, sprinting: false, exhausted: false, sprintK: 0, regenDelay: 0, slowT: 0, dead: false, bob: 0, deadT: 0, landKick: 0, pitchKick: 0, safePos: new V3(), onLadder: false, ladderCD: 0 };
  enemies: Enemy[] = []; projs: Proj[] = []; pickups: Pickup[] = []; fx: FX[] = [];
  keys = new Set<string>(); mouse = { left: false, right: false }; fireEdge = false; altEdge = false;
  paused = true; finished = false; fallbackLook = false; time = 0; fps = 60; raf = 0; last = 0; hudT = 0; mapT = 0; flowT = 0; flowCell = -1;
  owned: Set<string>; ammo: Record<string, number>;
  cur = 0; lastW = 0; swap = -1; swapTo = 0; swapped = false; fireCD = 0; recoil = 0; cycle = 1; cycleDur = 0.3; shots = 0; flashT = 0; spin = 0; charge = 0; fanning = false; zoom = false;
  revMag = 6; revReload = -1; revEjected = false; sprintPose = 0; spinWasFiring = false; plPumps = 0; plLoaded = true; plLoadT = -1; plPumpT = 1; plPumpCD = 0; plHoldWait = 0; ads = 0; arcOn = false; arcT = 0;
  vec = { active: false, t: 0, dur: 2.4, pos: new V3(), dir: new V3(), origin: new V3() }; enemyTime = 1; warp = 0; vecMesh: THREE.Group | null = null;
  models = new Map<string, WeaponModel>(); flashSprites = new Map<string, THREE.Sprite>(); wHolder = new THREE.Group();
  kills = 0; totalKills = 0; secretsFound = 0; noiseT = 0; hpMul = 1; dmgMul = 1; shake = 0; hurt = 0; pickupFlash = 0; hit = 0; hitHead = false; flashLight!: THREE.PointLight; flashBoost = 0;
  message = ''; msgT = 0; banner: { title: string; text: string; t: number } | null = null; bossRef: Enemy | null = null; portalOpen = true; portal!: THREE.Group; exitPos = new V3(); elevator: THREE.Group | null = null; elevDoors: THREE.Mesh[] = []; exitT = -1;
  flow!: Int16Array; explored!: Uint8Array; minimap: HTMLCanvasElement | null = null; enemyId = 0; rh: RayHit = { t: 0, nx: 0, ny: 0, nz: 0, hit: false };
  mpCfg: MPGameCfg | null = null; remotes = new Map<string, RemotePlayer>(); netT = 0; netEnemyT = 0; netApplying = false; shotSource: THREE.Vector3 | null = null; localKills = 0; localDeaths = 0; spawnPoints: THREE.Vector3[] = [];
  arenaDetails: THREE.Group | null = null;
  stars!: THREE.Points; sky!: THREE.Sprite; skyLandmarks!: THREE.Group; wasLocked = false; lookDX = 0; lookDY = 0; swayX = 0; swayY = 0; startedAt = 0; bossName = ''; secretMat: THREE.Material | null = null; revealMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });

  constructor(container: HTMLElement, opts: GameOptions) {
    this.container = container; this.opts = opts; this.settings = opts.settings; this.cb = opts.cb; this.planet = PLANETS[opts.planet]; this.levelNum = opts.level;
    this.dev = { enabled: opts.dev, god: false, infAmmo: false, noclip: false, reveal: false, speed: 1, timeScale: 1, stats: opts.dev };
    this.mpCfg = opts.mp ?? null;
    this.owned = new Set(this.mpCfg?.mode === 'arena' ? ARENA_LOADOUT.owned : opts.inv.owned);
    this.ammo = this.mpCfg?.mode === 'arena' ? { ...ARENA_LOADOUT.ammo } : { ...opts.inv.ammo };
    this.player.armor = this.mpCfg?.mode === 'arena' ? 25 : opts.inv.armor;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;outline:none';
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.05, 500); this.camera.rotation.order = 'YXZ';
    this.wCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.resize(); audio.init(); audio.setVolumes(this.settings.volume, this.settings.music);
    this.buildWorld(); this.bind();
    this.equipInstant(this.mpCfg?.mode === 'arena' ? 0 : this.bestWeaponIndex());
    const d = this.settings.difficulty; this.dmgMul = [0.6, 1, 1.5][d] * (this.planet.id === 'moon' ? 1.5 : 1 + 0.03 * this.planet.tier);
    this.hpMul = [0.85, 1, 1.2][d] * (this.planet.id === 'moon' ? 2.2 : 1 + 0.05 * this.planet.tier + 0.012 * this.levelNum);
    this.enemies.forEach(e => { if (!e.isBoss) e.hp = e.maxHp = e.def.hp * this.hpMul; });
    this.setupMultiplayer();
    this.banner = this.lv.arena
      ? { title: this.lv.arena.name, text: ARENAS[this.planet.id].feature, t: 7 }
      : { title: `${this.planet.name} · ${this.levelNum}/${this.planet.levels}`, text: `${this.lv.name}${this.planet.beats[this.levelNum] ? ' — ' + this.planet.beats[this.levelNum] : ''}`, t: 7 };
    this.updateCamera(0.016);
    this.last = performance.now(); this.startedAt = 0; this.raf = requestAnimationFrame(this.frame);
  }

  bestWeaponIndex() { for (let i = WEAPONS.length - 1; i >= 0; i--) if (this.owned.has(WEAPONS[i].id) && WEAPONS[i].id !== 'vector') return i; return 0; }

  // ============================================================ world
  buildWorld() {
    const pl = this.planet, th = pl.theme; const seed = hashStr(pl.id + ':' + this.levelNum);
    this.lv = this.mpCfg?.mode === 'arena' ? generateArena(pl.id) : generateLevel(pl.id, this.levelNum, seed, [...this.owned]);
    const lv = this.lv;
    this.scene.background = new THREE.Color(th.sky); this.scene.fog = new THREE.Fog(th.fog, lv.arena ? 20 : 6, lv.arena ? 190 : th.fogFar);
    this.lvGroup = buildLevelMesh(lv, pl); this.scene.add(this.lvGroup);
    if (lv.arena) { this.arenaDetails = buildArenaDetails(pl.id); this.scene.add(this.arenaDetails); }
    this.scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.95)); const dl = new THREE.DirectionalLight(0xfff0e0, Math.PI * 0.55); dl.position.set(0.4, 1, 0.3); this.scene.add(dl);
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 36, 1.6); this.scene.add(this.flashLight);
    this.wScene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.9)); const wd = new THREE.DirectionalLight(0xfff4e8, Math.PI * 0.7); wd.position.set(0.5, 1, 0.8); this.wScene.add(wd); this.wScene.add(this.wHolder);
    // stars + sky body
    const sp = new Float32Array(900); for (let i = 0; i < 300; i++) { const a = rand() * 6.283, b = Math.acos(rand() * 1.8 - 0.9), r = 300; sp[i * 3] = Math.sin(b) * Math.cos(a) * r; sp[i * 3 + 1] = Math.cos(b) * r; sp[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false })); this.stars.frustumCulled = false; this.scene.add(this.stars);
    this.sky = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: th.lamp, fog: false, depthWrite: false, transparent: true, opacity: 0.85 })); this.sky.scale.setScalar(pl.id === 'earth' ? 90 : 60); this.scene.add(this.sky);
    this.skyLandmarks = this.buildSkyLandmarks(pl.id); this.scene.add(this.skyLandmarks);
    this.particles = new Particles(this.scene); this.particles.floorFn = (x, z) => this.floorAt(x, z);
    // player
    this.player.pos.set(lv.spawn.x, lv.spawn.y, lv.spawn.z); this.player.safePos.copy(this.player.pos); this.player.yaw = lv.spawn.yaw; this.player.hp = Math.max(100, this.opts.inv.armor ? 100 : 100);
    // enemies
    const boss = BOSSES[pl.bossId];
    lv.enemies.forEach(s => { const d = ENEMY_BY_ID[s.def]; const e = this.makeEnemy(d, s.x, s.z, s.room, s.ambush, s.y); e.counted = true; this.totalKills++; this.enemies.push(e); });
    if (lv.isBoss && lv.bossPos) {
      const name = pl.id === 'earth' ? POLITICIANS[Math.floor(rand() * POLITICIANS.length)] : boss.name; this.bossName = name;
      const bd: EnemyDef = { id: 'boss_' + boss.id, name, size: 'boss', hp: boss.hp, speed: boss.speed, dmg: boss.dmg, ai: 'shooter', radius: boss.radius, height: boss.height, look: boss.look, rate: 1.6, range: 60, intro: [0, 0], weight: 0, flying: boss.flying, hover: boss.flying ? 3.5 : undefined, blurb: boss.title, proj: { speed: 22, dmg: boss.dmg, color: boss.color, size: 0.3, style: 'orb' } };
      const e = this.makeEnemy(bd, lv.bossPos.x, lv.bossPos.z, lv.rooms.length ? lv.rooms.findIndex(r => r.kind === 'boss') : 0, false); e.isBoss = true; e.counted = true; e.hp = e.maxHp = bd.hp * [0.8, 1, 1.25][this.settings.difficulty]; this.totalKills++;
      this.bossRef = e; this.enemies.push(e); this.portalOpen = false;
    }
    // pickups
    lv.pickups.forEach(p => this.makePickup(p.kind, p.value, p.x, p.z, p.ammo, p.weapon, p.secret, p.y));
    // exit portal
    this.exitPos.set(lv.exit.x, this.floorAt(lv.exit.x, lv.exit.z), lv.exit.z);
    this.portal = new THREE.Group(); this.portal.position.copy(this.exitPos);
    const pm = new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.7 - i * 0.25, 0.08, 6, 24), pm); r.position.y = 1.9; r.rotation.y = i * 1.0; this.portal.add(r); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 10, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 5; this.portal.add(beam);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.05; this.portal.add(pad);
    this.portal.visible = this.portalOpen && lv.exitKind === 'portal' && !lv.arena; this.scene.add(this.portal);
    if (lv.exitKind === 'elevator') this.buildElevator();
    this.flow = new Int16Array(lv.W * lv.H); this.explored = new Uint8Array(lv.W * lv.H);
    lv.secrets.forEach(s => { s.mesh!.userData.mat = s.mesh!.material; });
    audio.startMusic(pl.music, seed);
  }

  makeEnemy(def: EnemyDef, x: number, z: number, room: number, ambush: boolean, baseY?: number): Enemy {
    const fl = !!def.flying;
    const by = baseY !== undefined ? baseY : this.floorAt(x, z);
    return {
      id: this.enemyId++, def, pos: new V3(x, by + (fl ? 1 + (def.hover ?? 2) - def.height / 2 : 0), z), vel: new V3(), kb: new V3(), yaw: rand() * 6.28, hp: def.hp, maxHp: def.hp, state: ambush ? 'dormant' : 'idle', room, ambush, awake: false, model: null,
      t: rand() * 10, atkCD: 0.5 + rand(), atkT: -1, atkDone: false, painT: 0, flash: 0, deadT: 0, seed: rand() * 6.28, los: false, losT: rand() * 0.2, strafe: rand() < 0.5 ? 1 : -1, strafeT: 1 + rand() * 2, blinkCD: 2 + rand() * 3,
      snapYaw: 0, mode: 'walk', modeT: 0, dirX: 0, dirZ: 1, vy: 0, isBoss: false, phase: 1, summonCD: 6, burst: 0, burstT: 0, pattern: '', removed: false, counted: false, moveAmt: 0, tauntT: 12, hitOnce: false, moved: 0, summoned: false,
    };
  }
  ensureModel(e: Enemy) {
    if (e.model) return; const d = e.def;
    e.model = buildCreature(d.look, d.height, d.ai === 'shooter' || d.ai === 'floater' || e.isBoss); this.scene.add(e.model.group);
  }
  spawnEnemy(id: string, x: number, z: number, awake = true, summoned = true) {
    const d = ENEMY_BY_ID[id]; if (!d) return null; const e = this.makeEnemy(d, x, z, -1, false); e.hp = e.maxHp = d.hp * this.hpMul; e.summoned = summoned; if (awake) { e.awake = true; e.state = 'chase'; }
    this.enemies.push(e); this.particles.burst(new V3(x, 1, z), 14, d.look.glow, 6, 0.6, 0.18, 2); audio.play('teleport', 0.5); return e;
  }
  wakeEnemy(e: Enemy) {
    if (e.awake) return; e.awake = true; e.state = 'chase';
    if (e.isBoss) { this.banner = { title: e.def.name, text: e.def.blurb, t: 5 }; audio.play('bossTaunt', 1); this.msg(BOSSES[this.planet.bossId].taunts[0], 4); }
  }
  // wake a pack when one member notices you
  alertNear(e: Enemy) { for (const o of this.enemies) if (!o.awake && o.state === 'idle' && o.room === e.room && e.room >= 0) this.wakeEnemy(o); }

  makePickup(kind: string, value: number, x: number, z: number, ammo?: AmmoType, weapon?: string, secret = false, baseY?: number) {
    const g = new THREE.Group(); const M = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: e }); const glowM = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    let y = 0.7;
    if (kind === 'health') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), M(0xf2f2f2)); g.add(b); const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.52), glowM(0xe02020)), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.52), glowM(0xe02020)); g.add(c1, c2); }
    else if (kind === 'armor') { const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), M(0x3a7ae0, 0x102040)); b.scale.set(1, 1.2, 0.5); g.add(b); const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 5, 10), glowM(0xffd060)); g.add(r); }
    else if (kind === 'ammo') { const col = ammo ? AMMO_COLOR[ammo] : 0xffffff; if (ammo === 'vector') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 8), glowM(0xe060ff)); g.add(c); const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 5, 12), glowM(0xffffff)); r.rotation.x = 1.4; g.add(r); y = 1.0; } else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.42), M(0x55584a)); g.add(b); const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.44), glowM(col)); s.position.y = 0.08; g.add(s); } }
    else if (kind === 'weapon' && weapon) { const m = buildWeaponModel(weapon); m.group.scale.setScalar(1.15); m.group.rotation.y = -Math.PI / 2; const wg = new THREE.Group(); wg.add(m.group); m.group.position.set(0, 0, 0.1); g.add(wg); y = 1.3; const col = new THREE.Color(WEAPON_BY_ID[weapon].css); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 14, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 6; g.add(beam); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.setScalar(3.2); g.add(sp); }
    g.position.set(x, y, z); this.scene.add(g);
    const fy = baseY !== undefined ? baseY : this.floorAt(x, z); g.position.y += fy;
    this.pickups.push({ kind, ammo, weapon, value, obj: g, pos: new V3(x, fy, z), t: rand() * 6, taken: false, respawnT: 0, secret });
  }

  // ============================================================ events
  bind() {
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); window.addEventListener('mousedown', this.onMouseDown); window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove); window.addEventListener('wheel', this.onWheel, { passive: true }); window.addEventListener('contextmenu', this.onCtx); window.addEventListener('resize', this.resize);
    document.addEventListener('pointerlockchange', this.onLock); document.addEventListener('pointerlockerror', this.onLockErr); window.addEventListener('blur', this.onBlur);
  }
  unbind() {
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('mousedown', this.onMouseDown); window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove); window.removeEventListener('wheel', this.onWheel); window.removeEventListener('contextmenu', this.onCtx); window.removeEventListener('resize', this.resize);
    document.removeEventListener('pointerlockchange', this.onLock); document.removeEventListener('pointerlockerror', this.onLockErr); window.removeEventListener('blur', this.onBlur);
  }
  onBlur = () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; };
  onCtx = (e: Event) => { if (!this.paused) e.preventDefault(); };
  onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') { if (!this.paused && !document.pointerLockElement) { this.setPaused(true); this.cb.onPause(); } return; }
    if (this.paused) return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return; this.keys.add(e.code);
    const m = /^Digit(\d)$/.exec(e.code); if (m) { const n = +m[1]; this.selectWeapon(n === 0 ? 9 : n - 1); }
    if (e.code === 'KeyR') this.reloadKey(); if (e.code === 'KeyE') this.useKey(); if (e.code === 'KeyQ') this.selectWeapon(this.lastW);
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  onMouseDown = (e: MouseEvent) => { if (this.paused) return; if (e.button === 0) { this.mouse.left = true; this.fireEdge = true; } if (e.button === 2) { this.mouse.right = true; this.altEdge = true; } };
  onMouseUp = (e: MouseEvent) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; };
  onMouseMove = (e: MouseEvent) => {
    if (this.paused || this.player.dead) return; if (!document.pointerLockElement && !this.fallbackLook) return;
    const k = this.settings.sens * 0.0021 * (this.zoom ? 0.4 : this.ads > 0.3 ? 0.65 : 1); this.player.yaw -= e.movementX * k; this.player.pitch = clamp(this.player.pitch - e.movementY * k, -1.5, 1.5); this.lookDX += e.movementX; this.lookDY += e.movementY;
  };
  onWheel = (e: WheelEvent) => { if (this.paused) return; const dir = e.deltaY > 0 ? 1 : -1; let i = this.cur; for (let n = 0; n < 10; n++) { i = (i + dir + 10) % 10; if (this.owned.has(WEAPONS[i].id)) { this.selectWeapon(i); break; } } };
  autoTry = false; retried = false;
  onLock = () => { const locked = !!document.pointerLockElement; if (locked) this.fallbackLook = false; if (!locked && this.wasLocked && !this.paused) { this.setPaused(true); this.cb.onPause(); } this.wasLocked = locked; };
  onLockErr = () => {
    if (this.autoTry) { this.autoTry = false; if (!this.paused) { this.setPaused(true); this.cb.onPause(); } return; }
    this.fallbackLook = true;
    if (!this.retried) { this.retried = true; window.setTimeout(() => { if (!this.paused && !document.pointerLockElement) this.lock(); }, 1300); }
  };
  resize = () => { const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.wCamera.aspect = w / h; this.wCamera.updateProjectionMatrix(); };
  lock() { try { const r = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined; if (r && r.catch) r.catch(() => this.onLockErr()); } catch { this.onLockErr(); } }
  resume(auto = false) { this.paused = false; this.autoTry = auto; this.retried = false; this.lock(); this.last = performance.now(); audio.init(); }
  setPaused(p: boolean) { this.paused = p; if (p) { this.keys.clear(); this.mouse.left = this.mouse.right = false; this.fanning = false; this.zoom = false; this.stopArc(); if (document.pointerLockElement) document.exitPointerLock(); } }
  dispose() {
    if (this.mpCfg) { this.mpCfg.session.onPacket = null; this.mpCfg.session.onPeerLeft = null; }
    cancelAnimationFrame(this.raf); this.unbind(); audio.stopMusic(); audio.arcStop(); if (document.pointerLockElement) document.exitPointerLock();
    this.enemies.forEach(e => e.model?.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
  getInventory(): Inventory { return { owned: [...this.owned], ammo: { ...this.ammo }, armor: Math.round(this.player.armor) }; }
  msg(t: string, d = 2.6) { this.message = t; this.msgT = d; }

  // ============================================================ spatial helpers
  tileAt(cx: number, cz: number) { const lv = this.lv; if (cx < 0 || cz < 0 || cx >= lv.W || cz >= lv.H) return T_WALL; return lv.tiles[cz * lv.W + cx]; }
  tileWorld(x: number, z: number) { return this.tileAt(Math.floor(x / CELL), Math.floor(z / CELL)); }
  floorAt(x: number, z: number) {
    const lv = this.lv; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= lv.W || cz >= lv.H) return lv.env === 'skybridge' ? -999 : 0;
    if (lv.tiles[cz * lv.W + cx] === T_VOID) return -999;
    const fx = x / CELL - 0.5, fz = z / CELL - 0.5; const x0 = Math.floor(fx), z0 = Math.floor(fz); const tx = fx - x0, tz = fz - z0;
    const h = (gx: number, gz: number) => {
      const ix = clamp(gx, 0, lv.W - 1), iz = clamp(gz, 0, lv.H - 1);
      const id = iz * lv.W + ix;
      return lv.tiles[id] === T_VOID ? lv.floorH[cz * lv.W + cx] : lv.floorH[id];
    };
    return lerp(lerp(h(x0, z0), h(x0 + 1, z0), tx), lerp(h(x0, z0 + 1), h(x0 + 1, z0 + 1), tx), tz);
  }
  groundAt(x: number, z: number, curY = 0) {
    let best = this.floorAt(x, z);
    if (best > -900 && this.tileWorld(x, z) === T_CRATE) best += CRATE_H;
    for (const st of this.lv.stairs) {
      if (x >= st.x0 - 0.2 && x <= st.x1 + 0.2 && z >= st.z0 - 0.2 && z <= st.z1 + 0.2) {
        const sy = stairHeightAt(st, x, z);
        if (curY >= sy - 0.9 && sy > best) best = sy;
      }
    }
    for (const dk of this.lv.decks) {
      if (x >= dk.x0 && x <= dk.x1 && z >= dk.z0 && z <= dk.z1 && curY >= dk.y - 0.75 && dk.y > best) best = dk.y;
    }
    return best;
  }
  ceilAt(x: number, z: number, curY = 0) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); const lv = this.lv; if (cx < 0 || cz < 0 || cx >= lv.W || cz >= lv.H) return 1e4;
    const i = cz * lv.W + cx; if (lv.tiles[i] === T_VOID) return 1e4;
    let c = lv.sky[i] ? lv.floorH[i] + 80 : lv.ceil[i];
    for (const dk of lv.decks) {
      if (x >= dk.x0 && x <= dk.x1 && z >= dk.z0 && z <= dk.z1 && curY < dk.y - dk.thick - 0.1) c = Math.min(c, dk.y - dk.thick);
    }
    return c;
  }
  resolve(pos: THREE.Vector3, r: number, feetY: number): boolean {
    let hit = false;
    for (let it = 0; it < 3; it++) {
      const cx = Math.floor(pos.x / CELL), cz = Math.floor(pos.z / CELL);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx, gz = cz + dz; const t = this.tileAt(gx, gz);
        if (t === T_TREE) {
          const tcx = (gx + 0.5) * CELL, tcz = (gz + 0.5) * CELL; const ddx = pos.x - tcx, ddz = pos.z - tcz; const rr = r + 0.5; const d2 = ddx * ddx + ddz * ddz;
          if (d2 < rr * rr) { hit = true; if (d2 > 1e-8) { const dd = Math.sqrt(d2); const k = (rr - dd) / dd; pos.x += ddx * k; pos.z += ddz * k; } else pos.x += rr; }
          continue;
        }
        if (!(isSolidT(t) || (t === T_CRATE && feetY < this.lv.floorH[gz * this.lv.W + gx] + CRATE_H - 0.35))) continue;
        const minx = gx * CELL, minz = gz * CELL; const nx = clamp(pos.x, minx, minx + CELL), nz = clamp(pos.z, minz, minz + CELL); const ddx = pos.x - nx, ddz = pos.z - nz; const d2 = ddx * ddx + ddz * ddz;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 1e-8) { const d = Math.sqrt(d2); const k = (r - d) / d; pos.x += ddx * k; pos.z += ddz * k; }
          else { const l = pos.x - minx, rr = minx + CELL - pos.x, tt = pos.z - minz, bb = minz + CELL - pos.z; const m = Math.min(l, rr, tt, bb); if (m === l) pos.x = minx - r; else if (m === rr) pos.x = minx + CELL + r; else if (m === tt) pos.z = minz - r; else pos.z = minz + CELL + r; }
        }
      }
      for (const st of this.lv.stairs) {
        const nx = clamp(pos.x, st.x0, st.x1), nz = clamp(pos.z, st.z0, st.z1); const ddx = pos.x - nx, ddz = pos.z - nz; const d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r || feetY >= stairHeightAt(st, nx, nz) - 0.6) continue;
        hit = true;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); const k = (r - d) / d; pos.x += ddx * k; pos.z += ddz * k; }
        else { const l = pos.x - st.x0, rr = st.x1 - pos.x, tt = pos.z - st.z0, bb = st.z1 - pos.z; const m = Math.min(l, rr, tt, bb); if (m === l) pos.x = st.x0 - r; else if (m === rr) pos.x = st.x1 + r; else if (m === tt) pos.z = st.z0 - r; else pos.z = st.z1 + r; }
      }
    }
    return hit;
  }
  solidAtPoint(x: number, y: number, z: number) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); const lv = this.lv; if (cx < 0 || cz < 0 || cx >= lv.W || cz >= lv.H) return false;
    const i = cz * lv.W + cx; const t = lv.tiles[i];
    for (const dk of lv.decks) if (x >= dk.x0 && x <= dk.x1 && z >= dk.z0 && z <= dk.z1 && y >= dk.y - dk.thick && y <= dk.y) return true;
    for (const st of lv.stairs) if (x >= st.x0 && x <= st.x1 && z >= st.z0 && z <= st.z1 && y >= st.y0 && y <= stairHeightAt(st, x, z)) return true;
    if (t === T_VOID) return false;
    if (y < lv.floorH[i]) return true;
    if (t === T_TREE) { const ddx = x - (cx + 0.5) * CELL, ddz = z - (cz + 0.5) * CELL; return ddx * ddx + ddz * ddz < 0.36 && y < lv.floorH[i] + 3.2; }
    if (isSolidT(t)) { if ((t === T_WALL || t === T_PILLAR || t === T_CLIFF) && y > lv.wallTop[i]) return false; return true; }
    if (t === T_CRATE && y < lv.floorH[i] + CRATE_H) return true;
    if (!lv.sky[i] && y > lv.ceil[i]) return true;
    return false;
  }
  private rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, max: number): number | null {
    const invx = dx !== 0 ? 1 / dx : 1e9, invy = dy !== 0 ? 1 / dy : 1e9, invz = dz !== 0 ? 1 / dz : 1e9;
    const tx1 = (x0 - ox) * invx, tx2 = (x1 - ox) * invx, ty1 = (y0 - oy) * invy, ty2 = (y1 - oy) * invy, tz1 = (z0 - oz) * invz, tz2 = (z1 - oz) * invz;
    const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
    if (tmax < 0 || tmin > tmax || tmin > max) return null;
    return Math.max(0, tmin);
  }
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): RayHit {
    const h = this.rh; h.t = max; h.nx = 0; h.ny = 0; h.nz = 0; h.hit = false; const lv = this.lv; const W = lv.W;
    let subT = max;
    for (const dk of lv.decks) { const t = this.rayBox(ox, oy, oz, dx, dy, dz, dk.x0, dk.y - dk.thick, dk.z0, dk.x1, dk.y, dk.z1, subT); if (t !== null && t < subT) { subT = t; h.ny = dy > 0 ? -1 : 1; } }
    for (const st of lv.stairs) { const t = this.rayBox(ox, oy, oz, dx, dy, dz, st.x0, st.y0, st.z0, st.x1, st.y1, st.z1, subT); if (t !== null && t < subT) { subT = t; h.ny = 1; } }
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL); const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? CELL / Math.abs(dx) : Infinity, tdz = dz !== 0 ? CELL / Math.abs(dz) : Infinity;
    let tmx = dx > 0 ? ((cx + 1) * CELL - ox) / dx : dx < 0 ? (cx * CELL - ox) / dx : Infinity; let tmz = dz > 0 ? ((cz + 1) * CELL - oz) / dz : dz < 0 ? (cz * CELL - oz) / dz : Infinity;
    let tE = 0, nx = 0, nz = 0;
    for (let i = 0; i < 500; i++) {
      if (tE >= subT) break;
      if (cx < 0 || cz < 0 || cx >= W || cz >= lv.H) break;
      const idx = cz * W + cx; const t = lv.tiles[idx]; const yE = oy + dy * tE; const fy = lv.floorH[idx];
      if (t !== T_VOID) {
        if (t === T_TREE) {
          // only the trunk blocks shots & sight lines; foliage is soft
          const qx = ox - (cx + 0.5) * CELL, qz = oz - (cz + 0.5) * CELL;
          const a = dx * dx + dz * dz, b = 2 * (qx * dx + qz * dz), c = qx * qx + qz * qz - 0.3025; const disc = b * b - 4 * a * c;
          if (a > 1e-9 && disc >= 0) {
            const t0 = (-b - Math.sqrt(disc)) / (2 * a);
            if (t0 >= tE - 1e-4 && t0 >= 0 && t0 < subT) { const yh = oy + dy * t0; if (yh >= fy - 0.1 && yh <= fy + 3.2) { const hx = qx + dx * t0, hz = qz + dz * t0, hl = Math.hypot(hx, hz) || 1; h.t = t0; h.nx = hx / hl; h.nz = hz / hl; h.ny = 0; h.hit = true; return h; } }
          }
        } else {
          const wallHit = isSolidT(t) && !((t === T_WALL || t === T_PILLAR || t === T_CLIFF) && yE > lv.wallTop[idx]);
          if (wallHit || (t === T_CRATE && yE < fy + CRATE_H && yE >= fy)) { if (tE < subT) { h.t = tE; h.nx = nx; h.nz = nz; h.ny = 0; h.hit = true; return h; } }
        }
        const tN = Math.min(tmx, tmz, subT); const ceilH = lv.sky[idx] ? 1e9 : lv.ceil[idx]; const yN = oy + dy * tN;
        if (dy > 0 && yN > ceilH) { h.t = Math.max(tE, (ceilH - oy) / dy); h.ny = -1; h.hit = true; return h; }
        if (dy < 0) {
          if (t === T_CRATE && yE >= fy + CRATE_H && yN < fy + CRATE_H) { h.t = Math.max(tE, (fy + CRATE_H - oy) / dy); h.ny = 1; h.hit = true; return h; }
          if (yN < fy) { h.t = Math.max(tE, (fy - oy) / dy); h.ny = 1; h.hit = true; return h; }
        }
      }
      const tN = Math.min(tmx, tmz, subT);
      if (tN >= subT) break;
      if (tmx < tmz) { cx += sx; tE = tmx; tmx += tdx; nx = -sx; nz = 0; } else { cz += sz; tE = tmz; tmz += tdz; nz = -sz; nx = 0; }
    }
    if (subT < max) { h.t = subT; h.hit = true; }
    return h;
  }
  hasLOS(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0; const len = Math.hypot(dx, dy, dz); if (len < 0.01) return true;
    const h = this.raycast(x0, y0, z0, dx / len, dy / len, dz / len, len); return !h.hit;
  }
  computeFlow() {
    const lv = this.lv, W = lv.W; const f = this.flow; f.fill(32000); const p = this.player.pos; const s = Math.floor(p.z / CELL) * W + Math.floor(p.x / CELL);
    if (s < 0 || s >= f.length) return; const q = this.queue || (this.queue = new Int32Array(f.length)); let hd = 0, tl = 0; q[tl++] = s; f[s] = 0;
    while (hd < tl) { const c = q[hd++]; const x = c % W, y = (c / W) | 0; const d = f[c] + 1;
      for (let k = 0; k < 4; k++) { const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0); if (nx < 0 || ny < 0 || nx >= W || ny >= lv.H) continue; const n = ny * W + nx; if (f[n] !== 32000) continue; const t = lv.tiles[n]; if (t === T_FLOOR || t === T_DOOR || t === T_DOORO) { f[n] = d; q[tl++] = n; } } }
  }
  queue: Int32Array | null = null;
  flowDir(x: number, z: number): [number, number] | null {
    const lv = this.lv, W = lv.W; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); const cur = this.flow[cz * W + cx]; if (cur === undefined || cur >= 32000 || cur === 0) return null;
    let best = cur, bx = 0, bz = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= lv.H) continue;
      if (dx && dz && (this.flow[cz * W + nx] >= 32000 || this.flow[nz * W + cx] >= 32000)) continue;
      const v = this.flow[nz * W + nx]; if (v < best) { best = v; bx = dx; bz = dz; }
    }
    if (!bx && !bz) return null; const tx = (cx + bx + 0.5) * CELL - x, tz = (cz + bz + 0.5) * CELL - z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l];
  }

  // ============================================================ main loop
  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const raw = (now - this.last) / 1000; this.last = now; this.fps = lerp(this.fps, 1 / Math.max(raw, 0.001), 0.05);
    if (!this.paused && !this.finished) { const dt = Math.min(0.05, raw) * this.dev.timeScale; this.update(dt); }
    this.render();
  };
  render() {
    const r = this.renderer; r.clear(); r.render(this.scene, this.camera); r.clearDepth(); r.render(this.wScene, this.wCamera);
  }
  update(dt: number) {
    this.time += dt; this.noiseT = Math.max(0, this.noiseT - dt); this.hurt = Math.max(0, this.hurt - dt * 1.8); this.pickupFlash = Math.max(0, this.pickupFlash - dt * 2.5); this.hit = Math.max(0, this.hit - dt * 5); this.shake = Math.max(0, this.shake - dt * 3.5);
    if (this.arenaDetails) (this.arenaDetails.userData.animate as ((dt: number) => void) | undefined)?.(dt);
    this.msgT -= dt; if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.updatePlayer(dt); this.updateWeapons(dt); this.updateVector(dt); this.updateDoors(dt);
    const cell = Math.floor(this.player.pos.z / CELL) * this.lv.W + Math.floor(this.player.pos.x / CELL);
    this.flowT -= dt; if (cell !== this.flowCell || this.flowT <= 0) { this.flowCell = cell; this.flowT = 0.5; this.computeFlow(); }
    this.netTick(dt); this.updateEnemies(dt); this.updateProjectiles(dt); this.updatePickups(dt); this.updateFX(dt); this.particles.update(dt);
    this.flashBoost = Math.max(0, this.flashBoost - dt * 7); this.flashLight.intensity = this.flashBoost * 30;
    audio.intensity = clamp(this.enemies.filter(e => e.awake && e.state !== 'dead').length / 8, 0.1, 1);
    // portal
    if (this.portal.visible) { this.portal.children.forEach((c, i) => { if (i < 3) { c.rotation.y += dt * (1.2 + i * 0.5); c.rotation.x += dt * 0.3 * i; } }); const d = Math.hypot(this.player.pos.x - this.exitPos.x, this.player.pos.z - this.exitPos.z); if (d < 2.4 && !this.player.dead && this.mpCfg?.mode !== 'arena' && this.mpCfg?.session.role !== 'guest') this.finish(); }
    if (this.elevator && !this.player.dead && this.mpCfg?.mode !== 'arena' && this.mpCfg?.session.role !== 'guest') {
      const inCab = Math.abs(this.player.pos.x - this.exitPos.x) < 3.6 && Math.abs(this.player.pos.z - this.exitPos.z) < 2.6;
      if (this.exitT < 0 && inCab) { this.exitT = 0; audio.play('door', 0.8); this.msg('Elevator engaged — descending deeper…', 3); }
      if (this.exitT >= 0) {
        this.exitT += dt; const k = clamp(this.exitT / 0.8, 0, 1);
        this.elevDoors.forEach((m, i) => { const base = m.userData.base as THREE.Vector3; m.position.z = base.z + (i === 0 ? 1 : -1) * (1 - k) * 1.9; });
        this.player.pos.x = lerp(this.player.pos.x, this.exitPos.x, Math.min(1, dt * 3)); this.shake = Math.max(this.shake, 0.15);
        if (this.exitT > 1.5) this.finish();
      }
    }
    this.updateCamera(dt); this.explore(dt);
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.05; this.cb.onHud(this.hudState()); this.drawMinimap(); }
  }
  finish() {
    if (this.finished) return; this.finished = true; if (this.mpCfg?.session.role === 'host' && this.mpCfg.mode === 'coop') this.mpCfg.session.send({ t: 'finish', stats: { kills: this.kills, totalKills: this.totalKills, secrets: this.secretsFound, totalSecrets: this.lv.totalSecrets, time: this.time } }); audio.play('portal', 1); audio.arcStop(); this.mouse.left = this.mouse.right = false; if (document.pointerLockElement) document.exitPointerLock();
    this.cb.onComplete({ kills: this.kills, totalKills: this.totalKills, secrets: this.secretsFound, totalSecrets: this.lv.totalSecrets, time: this.time }, this.getInventory());
  }

  // ============================================================ player
  updatePlayer(dt: number) {
    const p = this.player, k = this.keys, d = this.dev;
    if (p.dead) { p.deadT += dt; p.pitch = lerp(p.pitch, -0.6, dt * 2); p.sprinting = false; if (this.mpCfg?.mode === 'arena' && p.deadT > 3) this.respawnArena(); return; }
    p.slowT = Math.max(0, p.slowT - dt); p.landKick = Math.max(0, p.landKick - dt * 5); p.pitchKick = lerp(p.pitchKick, 0, Math.min(1, dt * 9));
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0), str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw); let wx = -sn * fwd + cs * str, wz = -cs * fwd - sn * str; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    if (d.noclip) {
      const cp = Math.cos(p.pitch); const fx = -sn * cp, fy = Math.sin(p.pitch), fz = -cs * cp; const sp = (k.has('ShiftLeft') ? 50 : 22) * d.speed;
      p.pos.x += (fx * fwd + cs * str) * sp * dt; p.pos.y += (fy * fwd + (k.has('Space') ? 1 : 0) * 0.6) * sp * dt; p.pos.z += (fz * fwd - sn * str) * sp * dt; p.vel.set(0, 0, 0); p.pos.y = Math.max(this.floorAt(p.pos.x, p.pos.z), p.pos.y); return;
    }
    // ---- sprint: limited stamina, builds momentum, and can only be STARTED with your feet on the ground
    const shift = k.has('ShiftLeft') || k.has('ShiftRight');
    const canSprint = wl > 0 && fwd >= 0 && !p.onLadder && this.ads < 0.3;
    if (p.onGround) {
      if (p.exhausted && p.stamina >= 0.35) p.exhausted = false;
      const want = shift && canSprint && !p.exhausted && p.stamina > 0;
      if (want && !p.sprinting) audio.play('dash', 0.22);
      p.sprinting = want;
    } else if (!shift) p.sprinting = false; // mid-air: pressing shift does nothing until you land
    if (p.sprinting && p.onGround) {
      p.stamina = Math.max(0, p.stamina - dt / 4.2); p.regenDelay = 0.9;
      if (p.stamina <= 0) { p.sprinting = false; p.exhausted = true; this.msg('Out of breath — stamina recovering', 1.4); }
    } else if (!p.sprinting) {
      p.regenDelay -= dt; if (p.regenDelay <= 0) p.stamina = Math.min(1, p.stamina + dt / 3.4);
    }
    if (p.onGround) p.sprintK = p.sprinting ? Math.min(1, p.sprintK + dt / 0.5) : Math.max(0, p.sprintK - dt / 0.6);
    const runSpeed = 11.5 * d.speed * (p.slowT > 0 ? 0.55 : 1);
    const maxSpeed = runSpeed * (1 + 0.5 * p.sprintK);
    const accel = (ax: number, az: number, ws: number, ac: number) => { const cur = p.vel.x * ax + p.vel.z * az; const add = ws - cur; if (add <= 0) return; const a = Math.min(add, ac * dt * ws); p.vel.x += ax * a; p.vel.z += az * a; };
    if (p.onGround) {
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (wl > 0 && sp > maxSpeed + 0.05) {
        // carrying momentum above the cap: steer toward the input and bleed speed off gently
        const target = Math.max(maxSpeed, sp - (sp - maxSpeed) * 2.4 * dt - 1.5 * dt);
        const st = Math.min(1, 7 * dt); const vx = p.vel.x + (wx * sp - p.vel.x) * st, vz = p.vel.z + (wz * sp - p.vel.z) * st; const vl = Math.hypot(vx, vz) || 1;
        p.vel.x = (vx / vl) * target; p.vel.z = (vz / vl) * target;
      } else {
        if (sp > 0.05) { const ns = Math.max(0, sp - Math.max(sp, 3) * 9 * dt) / sp; p.vel.x *= ns; p.vel.z *= ns; } else { p.vel.x = 0; p.vel.z = 0; }
        if (wl > 0) accel(wx, wz, maxSpeed, 10);
      }
    } else if (wl > 0) accel(wx, wz, Math.min(runSpeed, 6.5), 14); // air control never adds speed beyond a run, but never removes momentum
    // ---- ladders (smooth climb up and clean step onto upper platform without re-latching at the top)
    p.ladderCD = Math.max(0, p.ladderCD - dt);
    const upKey = k.has('KeyW') || k.has('ArrowUp') || k.has('Space');
    const dnKey = k.has('KeyS') || k.has('ArrowDown');
    const lad = p.ladderCD > 0 ? undefined : this.lv.ladders.find(l => {
      if (Math.hypot(p.pos.x - l.x, p.pos.z - l.z) >= 1.25) return false;
      if (p.pos.y >= l.y0 - 0.5 && p.pos.y < l.y1 - 0.02) return true;
      // At the top lip: allow finishing an active climb-up, or grabbing to climb down with S
      if (upKey && !p.onGround && p.pos.y >= l.y1 - 0.15 && p.pos.y <= l.y1 + 0.15) return true;
      return dnKey && Math.abs(p.pos.y - l.y1) <= 0.35 && Math.hypot(p.pos.x - l.x, p.pos.z - l.z) < 1.1;
    });
    p.onLadder = !!lad && (upKey || dnKey || !p.onGround);
    const g = this.planet.theme.gravity;
    if (p.onLadder && lad) {
      p.sprinting = false;
      p.vel.x = 0; p.vel.z = 0;
      if (upKey) {
        p.vel.y = 7.4; p.onGround = false;
        p.pos.x = lerp(p.pos.x, lad.x, Math.min(1, dt * 8));
        p.pos.z = lerp(p.pos.z, lad.z + lad.nz * 0.45, Math.min(1, dt * 8));
        if (p.pos.y >= lad.y1 - 0.14) {
          // Step cleanly onto the platform top and let the player walk freely
          p.pos.y = lad.y1;
          p.pos.z = lad.z - lad.nz * 1.15;
          p.vel.set(0, 0, -lad.nz * 4.5);
          p.onLadder = false; p.onGround = true; p.ladderCD = 0.45;
        }
      } else if (dnKey) {
        if (p.pos.y >= lad.y1 - 0.15) {
          p.pos.y = lad.y1 - 0.2;
          p.pos.z = lad.z + lad.nz * 0.55;
        }
        p.vel.y = -6.0;
        if (p.pos.y <= lad.y0 + 0.05) {
          p.pos.y = lad.y0; p.vel.set(0, 0, 0);
          p.onLadder = false; p.onGround = true; p.ladderCD = 0.35;
        }
      } else {
        p.vel.y = 0;
        // Allow strafing left/right off the ladder mid-climb
        p.pos.x += cs * str * 5 * dt;
        p.pos.z += -sn * str * 5 * dt;
      }
    } else if (k.has('Space') && p.onGround) {
      p.vel.y = Math.sqrt(2 * g * 1.75); p.onGround = false; audio.play('jump', 0.4);
    }
    // ---- integrate: horizontal, then vertical with a swept landing test (no tunnelling, no snapping onto ledges from below)
    if (!p.onLadder) { p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; }
    this.resolve(p.pos, 0.55, p.pos.y);
    const wasGround = p.onGround; const prevY = p.pos.y;
    if (!p.onLadder) p.vel.y -= g * dt;
    p.pos.y += p.vel.y * dt;
    const gh = this.groundAt(p.pos.x, p.pos.z, Math.max(prevY, p.pos.y));
    if (gh > -900 && p.pos.y <= gh && prevY >= gh - 0.6) {
      if (p.vel.y < -9) { p.landKick = Math.min(1, -p.vel.y / 22); audio.play('land', 0.5); }
      p.pos.y = gh; p.vel.y = 0; p.onGround = true;
      if (this.tileWorld(p.pos.x, p.pos.z) !== T_VOID) p.safePos.copy(p.pos);
    } else if (gh > -900 && wasGround && p.vel.y <= 0 && p.pos.y > gh && p.pos.y - gh < 0.5) {
      p.pos.y = gh; p.vel.y = 0; p.onGround = true; // stick to slopes & stairs when walking downhill
    } else if (gh > -900 && this.lv.env !== 'skybridge' && p.pos.y < gh - 0.6 && this.tileWorld(p.pos.x, p.pos.z) !== T_VOID) {
      p.pos.y = gh; p.vel.y = Math.max(0, p.vel.y); p.onGround = true; // recover if anything ever pushed us below the floor
    } else p.onGround = false;
    const ch = this.ceilAt(p.pos.x, p.pos.z, p.pos.y); if (p.pos.y + 1.75 > ch) { p.pos.y = ch - 1.75; if (p.vel.y > 0) p.vel.y = 0; }
    const hs = Math.hypot(p.vel.x, p.vel.z); p.bob += dt * hs * 0.62 * (p.onGround ? 1 : 0.2);
    if (d.god) p.hp = Math.max(p.hp, 100);
    // ---- skybridge abyss
    if (p.pos.y < this.lv.minFloorY - 16) {
      if (d.god) { p.pos.copy(p.safePos); p.vel.set(0, 0, 0); this.msg('Rescued from the abyss (God mode)', 1.5); }
      else { this.msg('Swallowed by the storm abyss!', 2); this.damagePlayer(99999, null); }
    }
  }
  damagePlayer(amount: number, from?: THREE.Vector3 | null, slow = false) {
    const p = this.player; if (p.dead || this.dev.god || this.finished) return;
    amount *= this.dmgMul; const ab = Math.min(p.armor, amount * 0.6); p.armor -= ab; p.hp -= amount - ab; this.hurt = Math.min(1, this.hurt + amount / 25 + 0.25); this.shake = Math.min(1.2, this.shake + amount / 40); p.pitchKick += 0.03; audio.play('hurt', 0.8);
    if (slow) p.slowT = 2.5; void from;
    if (p.hp <= 0) this.playerDie(null);
  }
  heal(n: number) { const p = this.player; if (p.hp >= 100) return false; p.hp = Math.min(100, p.hp + n); return true; }

  // ============================================================ secrets/doors/use
  useKey() {
    const p = this.player; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (const s of this.lv.secrets) { if (s.opening) continue; const dx = s.cx - p.pos.x, dz = s.cz - p.pos.z; const d = Math.hypot(dx, dz); if (d < 4.8 && (dx * fx + dz * fz) / (d || 1) > 0.5) { s.opening = true; s.found = true; this.secretsFound++; audio.play('secret', 1); this.msg('You found a secret!', 3); this.shake = 0.4; return; } }
    audio.play('click', 0.3);
  }
  updateDoors(dt: number) {
    const lv = this.lv; const p = this.player; const near = (x: number, z: number, r: number) => { for (const e of this.enemies) if (e.awake && e.state !== 'dead' && Math.hypot(e.pos.x - x, e.pos.z - z) < r) return true; return false; };
    for (const d of lv.doors) {
      const pd = Math.hypot(p.pos.x - d.cx, p.pos.z - d.cz); const want = pd < 7 || near(d.cx, d.cz, 4.5);
      if (want) { if (d.state === 'closed') { audio.play('door', pd < 20 ? 0.5 : 0.2); d.state = 'open'; } d.hold = 1.0; }
      else { d.hold -= dt; if (d.hold <= 0 && d.state === 'open' && pd > 3.2 && !near(d.cx, d.cz, 3.2)) { d.state = 'closed'; audio.play('door', pd < 20 ? 0.3 : 0.1); } }
      const target = d.state === 'open' ? 1 : 0; d.open = clamp(d.open + Math.sign(target - d.open) * dt * 2.6, 0, 1); if (Math.abs(d.open - target) < 0.001) d.open = target;
      d.panels.forEach((m, i) => { const base = m.userData.base as THREE.Vector3; const off = (i === 0 ? -1 : 1) * CELL * d.open * 0.98; if (d.axis === 'x') m.position.set(base.x, base.y, base.z + off); else m.position.set(base.x + off, base.y, base.z); m.visible = d.open < 0.99; });
      const t = d.open > 0.6 ? T_DOORO : T_DOOR; d.cells.forEach(c => { lv.tiles[c.y * lv.W + c.x] = t; });
    }
    for (const s of lv.secrets) if (s.opening && s.open < 1) {
      s.open = Math.min(1, s.open + dt * 0.7); s.mesh!.position.y = s.open * CORR_H; if (s.open > 0.45) lv.tiles[s.y * lv.W + s.x] = T_FLOOR; if (s.open >= 1) s.mesh!.visible = false;
      if (rand() < 0.5) this.particles.emit(s.cx + (rand() - 0.5) * 3, 0.2, s.cz + (rand() - 0.5) * 3, 0, 1.5, 0, 0.8, 0.12, 0x9a8a7a, 3);
    }
  }
  explore(dt: number) {
    this.mapT -= dt; if (this.mapT > 0) return; this.mapT = 0.2; const lv = this.lv; const cx = Math.floor(this.player.pos.x / CELL), cz = Math.floor(this.player.pos.z / CELL);
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { if (dx * dx + dz * dz > 40) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= lv.W || z >= lv.H) continue; if (lv.tiles[z * lv.W + x] === T_SECRET) continue; this.explored[z * lv.W + x] = 1; }
  }
  drawMinimap() {
    const cv = this.minimap; if (!cv) return; const g = cv.getContext('2d'); if (!g) return; const S = cv.width; const lv = this.lv; const sc = 4; const R = Math.floor(S / sc / 2);
    const px = this.player.pos.x / CELL, pz = this.player.pos.z / CELL; const cx = Math.floor(px), cz = Math.floor(pz);
    g.clearRect(0, 0, S, S); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, S, S);
    const rev = this.dev.reveal;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= lv.W || z >= lv.H) continue; const i = z * lv.W + x; if (!this.explored[i] && !rev) continue; const t = lv.tiles[i];
      const sx = S / 2 + (x - px) * sc, sy = S / 2 + (z - pz) * sc;
      if (t === T_VOID) continue;
      g.fillStyle = t === T_WALL ? '#3a3f4a' : t === T_CLIFF ? '#524438' : t === T_PILLAR ? '#4a505e' : t === T_DOOR || t === T_DOORO ? '#e8c040' : t === T_CRATE ? '#8a6a3a' : t === T_TREE ? '#2f6a3a' : t === T_SECRET ? (rev ? '#ff40ff' : '#3a3f4a') : '#9aa4b8'; g.fillRect(sx, sy, sc, sc);
    }
    const ex = S / 2 + (this.exitPos.x / CELL - px) * sc, ey = S / 2 + (this.exitPos.z / CELL - pz) * sc; if (this.explored[Math.floor(this.exitPos.z / CELL) * lv.W + Math.floor(this.exitPos.x / CELL)] || rev) { g.fillStyle = this.portalOpen ? '#40ffb0' : '#ff4040'; g.fillRect(ex - 2, ey - 2, 5, 5); }
    if (rev) { g.fillStyle = '#ff3030'; this.enemies.forEach(e => { if (e.state !== 'dead') g.fillRect(S / 2 + (e.pos.x / CELL - px) * sc - 1, S / 2 + (e.pos.z / CELL - pz) * sc - 1, 3, 3); }); g.fillStyle = '#40e0ff'; this.pickups.forEach(pk => { if (!pk.taken) g.fillRect(S / 2 + (pk.pos.x / CELL - px) * sc - 1, S / 2 + (pk.pos.z / CELL - pz) * sc - 1, 3, 3); }); }
    g.save(); g.translate(S / 2, S / 2); g.rotate(-this.player.yaw); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore();
  }

  // ============================================================ camera / viewmodel
  updateCamera(dt: number) {
    const p = this.player; const cam = this.camera; const hs = Math.hypot(p.vel.x, p.vel.z);
    const bobY = p.onGround ? Math.sin(p.bob * 2) * 0.045 * Math.min(1, hs / 8) * (1 + p.sprintK * 0.45) : 0; const dead = p.dead ? Math.min(1, p.deadT * 1.5) : 0;
    cam.position.set(p.pos.x, p.pos.y + 1.65 - dead * 1.1 + bobY - p.landKick * 0.18, p.pos.z);
    if (this.shake > 0) cam.position.add(new V3((rand() - 0.5) * this.shake * 0.2, (rand() - 0.5) * this.shake * 0.2, (rand() - 0.5) * this.shake * 0.2));
    const str = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    cam.rotation.set(p.pitch + p.pitchKick, p.yaw, lerp(cam.rotation.z, -str * 0.025 + dead * 0.8, Math.min(1, dt * 8)));
    let fov = this.settings.fov + Math.min(14, hs * 0.35) + p.sprintK * 5 + this.warp * 22 * Math.sin(this.time * 14) * 0.3 + this.warp * 10; if (this.zoom) fov = 22; else if (this.ads > 0.01) fov = lerp(fov, this.settings.fov * 0.68, this.ads);
    cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 10)); cam.updateProjectionMatrix();
    levelUniforms.uPlayer.value.copy(cam.position); levelUniforms.uBoost.value = 0.38 + (this.flashT > 0 ? 0.55 : 0) + this.flashBoost * 1.2;
    this.stars.position.copy(cam.position); this.sky.position.set(cam.position.x + 160, 120, cam.position.z - 220);
    this.skyLandmarks.position.set(cam.position.x, 0, cam.position.z);
    // viewmodel
    const w = WEAPONS[this.cur]; const m = this.models.get(w.id); if (!m) return;
    const lower = this.swap < 0 ? 0 : this.swap < 0.5 ? this.swap * 2 : (1 - this.swap) * 2;
    this.swayX = lerp(this.swayX, clamp(-this.lookDX * 0.0006, -0.04, 0.04), Math.min(1, dt * 10)); this.swayY = lerp(this.swayY, clamp(this.lookDY * 0.0006, -0.04, 0.04), Math.min(1, dt * 10)); this.lookDX = this.lookDY = 0;
    const sprintT = p.sprinting && p.onGround && hs > 7 && !this.mouse.left && this.ads < 0.05 && this.swap < 0 && this.revReload < 0 && this.plLoadT < 0 ? 1 : 0;
    this.sprintPose = lerp(this.sprintPose, sprintT, Math.min(1, dt * 10)); const spz = this.sprintPose;
    const mv = Math.min(1, hs / 9) * (p.onGround ? 1 : 0.1) * (1 - this.ads * 0.75) * (1 + spz * 1.3);
    const off = m.offset; const adsK = w.id === 'powerline' ? this.ads : 0;
    const px = lerp(off[0], 0, adsK) + Math.sin(p.bob) * 0.012 * mv + this.swayX * (1 - adsK * 0.6);
    const py = lerp(off[1], -0.0705, adsK) + Math.abs(Math.cos(p.bob)) * 0.012 * mv - lower * 0.4 - p.landKick * 0.04 * (1 - adsK * 0.6) + this.swayY * (1 - adsK * 0.6) - (this.zoom ? 5 : 0);
    const pz = lerp(off[2], -0.24, adsK) + this.recoil * 0.02;
    this.wHolder.scale.setScalar(0.88); this.wHolder.position.set(px + 0.035 * spz, py - 0.07 * spz, pz + 0.05 * spz);
    this.wHolder.rotation.set(lower * 0.9 + this.swayY * 2 * (1 - adsK * 0.7) - 0.3 * spz, this.swayX * 1.5 * (1 - adsK * 0.7) + 0.42 * spz, (-str * 0.03 + Math.sin(p.bob) * 0.01 * mv) * (1 - adsK * 0.8) + 0.16 * spz);
    this.wCamera.fov = lerp(this.settings.fov * 0.9, this.settings.fov * 0.72, adsK) + this.warp * 8; this.wCamera.updateProjectionMatrix();
    m.update(dt, { t: this.time, recoil: this.recoil, cycle: this.cycle, reload: this.currentReloadP(), pumpAnim: this.plPumpT, pumps: this.plPumps, loaded: this.plLoaded, spin: this.spin, charge: this.charge, firing: this.isFiring(), ammo: this.ammo[w.ammo] ?? 0, ammoFrac: this.ammoFrac(), shots: this.shots, fan: this.fanning, mag: this.revMag, ads: adsK });
    this.wHolder.updateMatrixWorld(true); this.wCamera.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    const fs = this.flashSprites.get(w.id); if (fs) { fs.visible = this.flashT > 0; fs.scale.setScalar(0.28 + rand() * 0.2); (fs.material as THREE.SpriteMaterial).rotation = rand() * 6; }
  }
  currentReloadP() { const id = WEAPONS[this.cur].id; if (id === 'revolver') return this.revReload >= 0 ? this.revReload / 1.1 : -1; if (id === 'powerline') return this.plLoadT >= 0 ? this.plLoadT / 5 : -1; return -1; }
  ammoFrac() { const w = WEAPONS[this.cur]; if (w.ammo === 'inf') return 1; return clamp((this.ammo[w.ammo] ?? 0) / Math.min(AMMO_MAX[w.ammo], w.id === 'arc' ? 100 : 40), 0, 1); }
  isFiring() { const id = WEAPONS[this.cur].id; return (id === 'arc' && this.arcOn) || (id === 'chaingun' && this.spin > 0.3 && this.mouse.left) || (id === 'vector' && this.vec.active) || (id === 'rail' && this.charge > 0.05); }
  ensureWeaponModel(id: string) {
    let m = this.models.get(id); if (m) return m; m = buildWeaponModel(id); m.group.visible = false; this.wHolder.add(m.group); this.models.set(id, m);
    const col = new THREE.Color(WEAPON_BY_ID[id].css); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.visible = false; m.muzzle.add(sp); this.flashSprites.set(id, sp); return m;
  }
  equipInstant(i: number) { this.cur = i; this.lastW = i; this.models.forEach(m => { m.group.visible = false; }); this.ensureWeaponModel(WEAPONS[i].id).group.visible = true; }
  selectWeapon(i: number) {
    if (i === this.cur || this.swap >= 0 || this.player.dead) return; const w = WEAPONS[i]; if (!this.owned.has(w.id)) { return; }
    this.swapTo = i; this.swap = 0; this.swapped = false; this.stopArc(); this.zoom = false; audio.play('equip', 0.6);
  }
  // ============================================================ weapons
  hasAmmo(t: AmmoType, n = 1) { return t === 'inf' || this.dev.infAmmo || (this.ammo[t] ?? 0) >= n; }
  useAmmo(t: AmmoType, n = 1) { if (t === 'inf' || this.dev.infAmmo) return true; if ((this.ammo[t] ?? 0) < n) return false; this.ammo[t] -= n; return true; }
  addAmmo(t: AmmoType, n: number) { const mx = AMMO_MAX[t]; if ((this.ammo[t] ?? 0) >= mx) return false; this.ammo[t] = Math.min(mx, (this.ammo[t] ?? 0) + n); return true; }
  stopArc() { if (this.arcOn) { this.arcOn = false; audio.arcStop(); } this.arcLines.forEach(l => { l.visible = false; }); }
  arcLines: THREE.Line[] = [];
  private _mw = new V3();
  muzzleWorld(out: THREE.Vector3) {
    const w = WEAPONS[this.cur]; const m = this.models.get(w.id);
    if (m) {
      this.wHolder.updateMatrixWorld(true);
      m.muzzle.getWorldPosition(this._mw);
      this._mw.project(this.wCamera);
      this._mw.z = 0.5;
      this._mw.unproject(this.camera);
      this._mw.sub(this.camera.position).normalize();
      out.copy(this.camera.position).addScaledVector(this._mw, 0.95);
      return out;
    }
    const c = this.camera; out.set(0.22, -0.16, -0.95).applyQuaternion(c.quaternion).add(c.position); return out;
  }
  aimDir(spread: number, out: THREE.Vector3) {
    out.set((rand() - 0.5) * 2 * spread, (rand() - 0.5) * 2 * spread, -1).normalize().applyQuaternion(this.camera.quaternion); return out;
  }
  kickFire(recoil: number, shake: number, noise = true, flash = true) {
    this.recoil = recoil; this.cycle = 0; this.shots++; if (flash) { this.flashT = 0.055; this.flashBoost = Math.max(this.flashBoost, 0.5); } this.player.pitchKick += 0.012 * recoil; this.shake = Math.max(this.shake, shake); if (noise) this.noiseT = 0.7;
  }
  updateWeapons(dt: number) {
    const p = this.player; this.fireCD -= dt; this.recoil = Math.max(0, this.recoil - dt * 7); this.cycle = Math.min(1, this.cycle + dt / this.cycleDur); this.flashT -= dt; this.plPumpT = Math.min(1, this.plPumpT + dt / 0.42); this.plPumpCD -= dt;
    if (this.swap >= 0) { this.swap += dt / 0.3; if (this.swap >= 0.5 && !this.swapped) { this.swapped = true; this.lastW = this.cur; this.cur = this.swapTo; this.models.forEach(m => { m.group.visible = false; }); this.ensureWeaponModel(WEAPONS[this.cur].id).group.visible = true; this.revReload = -1; this.plLoadT = -1; this.charge = 0; this.spin = 0; this.fanning = false; } if (this.swap >= 1) this.swap = -1; }
    const edgeL = this.fireEdge, edgeR = this.altEdge; this.fireEdge = false; this.altEdge = false;
    if (p.dead || this.swap >= 0) { if (this.swap >= 0) { this.stopArc(); } return; }
    const L = this.mouse.left, A = this.mouse.right; const id = WEAPONS[this.cur].id; const org = new V3(), dir = new V3(); this.muzzleWorld(org);
    // powerline loading runs in the background even when not selected? only while selected.
    switch (id) {
      case 'revolver': {
        if (this.revReload >= 0) {
          this.revReload += dt;
          if (!this.revEjected && this.revReload >= 0.22) { this.revEjected = true; audio.play('click', 0.45); }
          if (this.revReload >= 1.1) { this.revReload = -1; this.revMag = 6; audio.play('loadDone', 0.5); }
          break;
        }
        this.fanning = A && this.revMag > 0;
        const fan = this.fanning; if (this.fireCD <= 0 && this.revMag > 0 && ((fan) || (L && (edgeL || this.fireCD < -0.02)))) {
          this.revMag--; this.fireCD = fan ? 0.09 : 0.27; this.cycleDur = 0.2; this.kickFire(fan ? 0.5 : 1, fan ? 0.1 : 0.15); this.aimDir(fan ? 0.055 : 0.003, dir); this.fireHit(org, dir, fan ? 24 : 36, 200, 1, 1.5, 0xffe0a0, 0.03, 'fire'); audio.play(fan ? 'fan' : 'revolver', 0.9);
        } else if ((L || A) && this.revMag === 0 && this.fireCD <= 0) { this.reloadKey(); }
        break;
      }
      case 'powerline': {
        if (this.plLoadT >= 0) { this.plLoadT += dt; if (this.plLoadT >= 5) { this.plLoadT = -1; this.plLoaded = true; this.plHoldWait = 0.35; audio.play('loadDone', 0.8); this.msg('Pellet loaded — press R to pump', 1.6); } }
        // Right-click = Iron Sights! R = Load pellet & pump lever!
        const wantAds = A && this.plLoadT < 0 && !p.dead;
        this.ads = lerp(this.ads, wantAds ? 1 : 0, Math.min(1, dt * 14));
        if (this.keys.has('KeyR') && this.plLoaded && this.plLoadT < 0) {
          this.plHoldWait -= dt;
          if (this.plHoldWait <= 0 && this.plPumpCD <= 0 && this.plPumpT >= 1 && this.plPumps < 10) this.pump();
        } else this.plHoldWait = 0.28;
        if (edgeL) {
          if (!this.plLoaded) { this.msg(this.plLoadT >= 0 ? 'Loading pellet…' : 'Load a pellet — press R', 1.5); audio.play('click', 0.5); }
          else if (this.plPumps < 3) { this.msg(`Not enough pressure — press R to pump (${this.plPumps}/3 min)`, 1.5); audio.play('click', 0.7); }
          else if (this.fireCD <= 0) this.firePowerline(org, dir);
        }
        break;
      }
      case 'scatter': {
        if (this.fireCD > 0) break;
        if (edgeR && this.hasAmmo('shells', 2)) { this.useAmmo('shells', 2); this.fireCD = 1.0; this.cycleDur = 0.9; this.kickFire(2.2, 0.5); for (let i = 0; i < 16; i++) { this.aimDir(0.095, dir); this.fireHit(org, dir, 10, 70, 1, 1, 0xffc070, 0.02, 'pellet'); } this.beamFlash(); audio.play('scatter', 1); window.setTimeout(() => audio.play('scatterPump', 0.75), 360); this.player.vel.addScaledVector(dir.set(0, 0, 1).applyQuaternion(this.camera.quaternion).setY(0).normalize(), 4); }
        else if ((L && (edgeL || true)) && !edgeR) { if (!this.hasAmmo('shells')) { if (edgeL) { audio.play('click', 0.6); this.msg('Out of shells'); } break; } this.useAmmo('shells'); this.fireCD = 0.72; this.cycleDur = 0.6; this.kickFire(1.3, 0.3); for (let i = 0; i < 8; i++) { this.aimDir(0.07, dir); this.fireHit(org, dir, 11, 70, 1, 1, 0xffc070, 0.02, 'pellet'); } audio.play('scatter', 1); window.setTimeout(() => audio.play('scatterPump', 0.7), 260); }
        break;
      }
      case 'chaingun': {
        if (L && this.hasAmmo('bullets')) { if (this.spin === 0) audio.play('chainSpinUp', 0.8); this.spinWasFiring = true; this.spin = Math.min(1, this.spin + dt / 0.85); if (this.spin > 0.3 && this.fireCD <= 0) { this.useAmmo('bullets'); this.fireCD = lerp(0.14, 0.045, (this.spin - 0.3) / 0.7); this.cycleDur = 0.1; this.kickFire(0.35, 0.05, true); this.aimDir(0.012 + this.spin * 0.02, dir); this.fireHit(org, dir, 12, 220, 1, 1.4, 0xffe070, 0.025, 'bullet'); audio.play('chaingun', 0.55); } else if (this.spin <= 0.3 && edgeL) audio.play('click', 0.4); }
        else { if (this.spin > 0.3 && this.spinWasFiring) audio.play('chainSpinDown', 0.7); this.spinWasFiring = false; this.spin = Math.max(0, this.spin - dt / 0.7); if (L && !this.hasAmmo('bullets') && edgeL) { audio.play('click', 0.6); this.msg('Out of rounds'); } }
        break;
      }
      case 'rivet': {
        if (this.fireCD > 0) break;
        if (edgeR && this.hasAmmo('nails', 5)) { this.useAmmo('nails', 5); this.fireCD = 0.5; this.cycleDur = 0.2; this.kickFire(1.2, 0.15); for (let i = 0; i < 5; i++) { this.aimDir(0.06, dir); this.fireProj(org, dir, { speed: 75, dmg: 24, color: 0xffa040, size: 0.09, style: 'bolt' }, 24, false, 'nail'); } audio.play('rivet', 0.9); }
        else if (L) { if (!this.hasAmmo('nails')) { if (edgeL) { audio.play('click', 0.6); this.msg('Out of rivets'); } break; } this.useAmmo('nails'); this.fireCD = 0.095; this.cycleDur = 0.09; this.kickFire(0.5, 0.05); this.aimDir(0.012, dir); this.fireProj(org, dir, { speed: 80, dmg: 22, color: 0xffa040, size: 0.09, style: 'bolt' }, 22, false, 'nail'); audio.play('rivet', 0.6); }
        break;
      }
      case 'thumper': {
        if (edgeR) this.detonateGrenades();
        if (this.fireCD <= 0 && L && edgeL) { if (!this.hasAmmo('grenades')) { audio.play('click', 0.6); this.msg('Out of grenades'); break; } this.useAmmo('grenades'); this.fireCD = 0.6; this.cycleDur = 0.4; this.kickFire(1.6, 0.25); this.aimDir(0.004, dir); dir.y += 0.12; dir.normalize(); this.fireProj(org, dir, { speed: 24, dmg: 95, color: 0x60c040, size: 0.2, style: 'orb', splash: 6 }, 95, false, 'grenade'); audio.play('thump', 1); }
        break;
      }
      case 'arc': {
        const want = L && this.hasAmmo('cells');
        if (want) { if (!this.arcOn) { this.arcOn = true; audio.arcStart(); } this.arcT -= dt; this.fireArc(org, dir, this.arcT <= 0); if (this.arcT <= 0) this.arcT = 0.05; this.recoil = 0.2; this.flashT = 0.05; this.noiseT = 0.3; }
        else { this.stopArc(); if (L && edgeL) { audio.play('click', 0.6); this.msg('Out of arc cells'); } }
        break;
      }
      case 'rocket': {
        if (this.fireCD <= 0 && L && edgeL) { if (!this.hasAmmo('rockets')) { audio.play('click', 0.6); this.msg('Out of rockets'); break; } this.useAmmo('rockets'); this.fireCD = 0.78; this.cycleDur = 0.5; this.kickFire(1.9, 0.35); this.aimDir(0.003, dir); this.fireProj(org, dir, { speed: 32, dmg: 120, color: 0xff7a30, size: 0.28, style: 'rocket', splash: 7 }, 120, false, 'rocket'); audio.play('rocket', 1); }
        break;
      }
      case 'rail': {
        this.zoom = A && !this.player.dead;
        if (L && this.fireCD <= 0 && this.hasAmmo('slugs')) { if (this.charge === 0) audio.play('railCharge', 0.6); this.charge = Math.min(1, this.charge + dt / 0.6); if (this.charge >= 1) this.fireRail(org, dir); }
        else if (this.charge > 0) { if (this.charge >= 0.45 && this.fireCD <= 0) this.fireRail(org, dir); else this.charge = Math.max(0, this.charge - dt * 3); }
        if (L && edgeL && !this.hasAmmo('slugs')) { audio.play('click', 0.6); this.msg('Out of slugs'); }
        break;
      }
      case 'vector': {
        if (L && edgeL && !this.vec.active && this.fireCD <= 0) { if (!this.hasAmmo('vector')) { audio.play('click', 0.7); this.msg('Vector cells depleted'); } else this.startVector(org); }
        break;
      }
      default: break;
    }
    if (id !== 'arc') this.stopArc(); if (id !== 'rail') { this.zoom = false; this.charge = 0; } if (id !== 'chaingun') this.spin = Math.max(0, this.spin - dt);
    if (id !== 'revolver') this.fanning = false; if (id !== 'powerline') this.ads = 0;
  }
  pump() {
    if (this.plPumps >= 10) { this.msg('Max pressure!', 0.8); audio.play('click', 0.5); this.plPumpCD = 0.3; return; }
    this.plPumps++; this.plPumpT = 0; this.plPumpCD = 0.42; audio.play('pump', 0.8);
  }
  reloadKey() {
    const id = WEAPONS[this.cur].id;
    if (id === 'revolver' && this.revReload < 0 && this.revMag < 6) { this.revReload = 0; this.revEjected = false; audio.play('load', 0.7); }
    if (id === 'powerline') {
      if (this.plLoadT >= 0) return;
      if (!this.plLoaded) {
        if (!this.hasAmmo('pellets')) { this.msg('No pellets left!', 1.5); audio.play('click', 0.6); return; }
        this.useAmmo('pellets'); this.plLoadT = 0; audio.play('load', 0.9); this.msg('Loading pellet… (5 s)', 1.5);
      } else if (this.plPumpCD <= 0) {
        this.pump();
      }
    }
  }
  firePowerline(org: THREE.Vector3, dir: THREE.Vector3) {
    const pumps = this.plPumps; const dmg = 1000 * (pumps * 0.1); const pierce = pumps >= 10 ? 3 : pumps >= 7 ? 2 : 1;
    this.plLoaded = false; this.plPumps = 0; this.fireCD = 0.4; this.cycleDur = 0.4; this.kickFire(1.0 + pumps * 0.12, 0.1 + pumps * 0.03);
    this.aimDir(0.0, dir); this.fireHit(org, dir, dmg, 400, pierce, 2, 0xcfe8ff, 0.05 + pumps * 0.006, 'pellet'); audio.play('powerline', 0.6 + pumps * 0.06);
    this.msg(`Shot @ ${pumps * 10}% power — press R to load another pellet`, 2.5);
  }
  fireRail(org: THREE.Vector3, dir: THREE.Vector3) {
    const c = this.charge; this.charge = 0; this.useAmmo('slugs'); this.fireCD = 0.9; this.cycleDur = 0.7; this.kickFire(2.2, 0.55); this.aimDir(0, dir);
    this.fireHit(org, dir, 230 * (0.5 + c * 0.5), 300, 99, 2, 0xa8c8ff, 0.2, 'rail'); audio.play('rail', 1);
  }
  beamFlash() { this.flashBoost = 1; }
  // generic hitscan: damages up to `pierce` enemies along the ray, stops at walls
  fireHit(org: THREE.Vector3, dir: THREE.Vector3, dmg: number, range: number, pierce: number, hsMul: number, color: number, width: number, kind: string) {
    const h = this.raycast(org.x, org.y, org.z, dir.x, dir.y, dir.z, range); const wallT = h.t; const hits: { e: Enemy; t: number; hy: number }[] = [];
    // ray starts at muzzle (offset from camera) — aim from camera for accuracy
    const cam = this.shotSource ?? this.camera.position; const co = new V3().copy(cam);
    const hc = this.raycast(co.x, co.y, co.z, dir.x, dir.y, dir.z, range); const wallC = hc.t; const nrm = new V3(hc.nx, hc.ny, hc.nz); const wallHit = hc.hit; void wallT;
    for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'dormant' || e.removed) continue; const t = this.rayCyl(co, dir, e, wallC); if (t !== null) hits.push({ e, t, hy: co.y + dir.y * t }); }
    hits.sort((a, b) => a.t - b.t); let end = wallC; let n = 0;
    for (const hh of hits) { if (n >= pierce) break; const e = hh.e; const head = e.def.look.kind !== 'floater' && e.def.look.kind !== 'crawler' && hh.hy > e.pos.y + e.def.height * 0.78; const pt = new V3().copy(co).addScaledVector(dir, hh.t); this.damageEnemy(e, dmg * (head ? hsMul : 1), pt, head, dir); n++; end = hh.t; if (kind === 'rail') end = wallC; }
    if (pierce > 1 && n < pierce) end = wallC; if (n >= pierce && pierce < 99) end = hits[n - 1].t;
    const endP = new V3().copy(co).addScaledVector(dir, end);
    if (kind !== 'pellet' || width > 0.04) this.beam(org, endP, color, width, kind === 'rail' ? 0.45 : kind === 'pellet' ? 0.25 : 0.07);
    else this.beam(org, endP, color, width, 0.06);
    if (wallHit && end >= wallC - 0.01) { this.impact(endP, nrm, kind === 'rail' ? 0xa8c8ff : 0xffd080, kind === 'rail' || dmg > 150 ? 14 : 4); }
    if (kind === 'rail') this.particles.burst(endP, 16, 0xa8c8ff, 8, 0.5, 0.12, 4);
    if (!this.shotSource) this.netFire('hit', co, dir, WEAPONS[this.cur].id);
    if (this.mpCfg?.mode === 'arena' && !this.shotSource) {
      let bestT = wallC, bestR: RemotePlayer | null = null;
      for (const r of this.remotes.values()) { if (r.dead) continue; const fake = { pos: r.group.position, def: { radius: 0.55, height: 1.8 } } as unknown as Enemy; const t = this.rayCyl(co, dir, fake, bestT); if (t !== null && t < bestT) { bestT = t; bestR = r; } }
      if (bestR) { const head = co.y + dir.y * bestT > bestR.group.position.y + 1.45; this.netSendDamage(bestR.id, dmg * (head ? hsMul : 1), this.mpCfg.session.localId); this.hit = 1; this.hitHead = head; audio.play(head ? 'headshot' : 'hit', 0.6); }
    }
  }
  impact(p: THREE.Vector3, n: THREE.Vector3, color: number, count: number) {
    const q = new V3().copy(p).addScaledVector(n, 0.05); this.particles.burst(q, count, color, 5, 0.4, 0.07, 14, 0.4); this.particles.burst(q, Math.ceil(count / 2), 0x8a8478, 2.5, 0.6, 0.12, 4, 0.2);
  }
  rayCyl(o: THREE.Vector3, d: THREE.Vector3, e: Enemy, maxT: number): number | null {
    const r = e.def.radius * 1.08 + 0.05; const ox = o.x - e.pos.x, oz = o.z - e.pos.z; const a = d.x * d.x + d.z * d.z; if (a < 1e-8) return null;
    const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r; const disc = b * b - 4 * a * c; if (disc < 0) return null; const s = Math.sqrt(disc);
    let t = (-b - s) / (2 * a); const t2 = (-b + s) / (2 * a); if (t2 < 0) return null; if (t < 0) t = 0;
    const y0 = e.pos.y - 0.05, y1 = e.pos.y + e.def.height + 0.05; const yy = o.y + d.y * t; if (yy < y0 || yy > y1) { const y2 = o.y + d.y * t2; if (y2 < y0 || y2 > y1) return null; t = Math.max(t, 0); }
    return t <= maxT ? t : null;
  }
  fireArc(org: THREE.Vector3, dir: THREE.Vector3, tick: boolean) {
    this.aimDir(0.0, dir); const cam = this.camera.position; const range = 24;
    const hc = this.raycast(cam.x, cam.y, cam.z, dir.x, dir.y, dir.z, range); let bestE: Enemy | null = null, bt = hc.t;
    for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'dormant' || e.removed) continue; const t = this.rayCyl(cam, dir, e, bt); if (t !== null && t < bt) { bt = t; bestE = e; } }
    while (this.arcLines.length < 4) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => new V3())), new THREE.LineBasicMaterial({ color: 0xaaf4ff })); l.frustumCulled = false; this.scene.add(l); this.arcLines.push(l); }
    const end = new V3().copy(cam).addScaledVector(dir, bt); const chain: V3[] = [org.clone(), end]; const hitEs: Enemy[] = [];
    if (bestE) { hitEs.push(bestE); let from: Enemy = bestE; for (let k = 0; k < 3; k++) { let nb: Enemy | null = null, nd = 9; for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'dormant' || e.removed || hitEs.includes(e)) continue; const d = Math.hypot(e.pos.x - from.pos.x, e.pos.z - from.pos.z); if (d < nd && this.hasLOS(from.pos.x, from.pos.y + 1, from.pos.z, e.pos.x, e.pos.y + 1, e.pos.z)) { nd = d; nb = e; } } if (!nb) break; hitEs.push(nb); from = nb; } }
    if (tick) { this.useAmmo('cells'); this.netFire('arc', cam, dir, 'arc'); hitEs.forEach((e, i) => this.damageEnemy(e, i === 0 ? 8 : 5, new V3(e.pos.x, e.pos.y + e.def.height * 0.6, e.pos.z), false, dir, true)); if (!bestE && hc.hit) this.impact(end, new V3(hc.nx, hc.ny, hc.nz), 0x80f0ff, 3); }
    const pathFor = (a: V3, b: V3, line: THREE.Line) => { const pos = line.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < 10; i++) { const t = i / 9; const j = i === 0 || i === 9 ? 0 : Math.sin(t * Math.PI) * 0.28; pos.setXYZ(i, lerp(a.x, b.x, t) + (rand() - 0.5) * j, lerp(a.y, b.y, t) + (rand() - 0.5) * j, lerp(a.z, b.z, t) + (rand() - 0.5) * j); } pos.needsUpdate = true; line.visible = true; };
    pathFor(chain[0], chain[1], this.arcLines[0]); pathFor(chain[0], chain[1], this.arcLines[1]);
    for (let i = 0; i < 2; i++) { const l = this.arcLines[2 + i]; const a = hitEs[i], b = hitEs[i + 1]; if (a && b) pathFor(new V3(a.pos.x, a.pos.y + 1, a.pos.z), new V3(b.pos.x, b.pos.y + 1, b.pos.z), l); else l.visible = false; }
  }
  detonateGrenades() { for (const pr of [...this.projs]) if (pr.style === 'grenade') this.killProj(pr, true); }

  // ============================================================ vector state ray
  startVector(org: THREE.Vector3) {
    this.useAmmo('vector'); this.netFire('vector', org, new V3(0, 0, -1).applyQuaternion(this.camera.quaternion), 'vector'); const v = this.vec; v.active = true; v.t = 0; v.origin.copy(org); this.fireCD = 3; this.cycleDur = 1; this.kickFire(2.5, 0.8); audio.play('vector', 1);
    if (!this.vecMesh) {
      const g = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000 })); g.add(core);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 14), new THREE.MeshBasicMaterial({ color: 0xc040ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })); g.add(halo);
      for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(2 + i * 0.7, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffffff : 0xe060ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = 1.1 + i * 0.3; r.rotation.y = i; g.add(r); }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8a0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); beam.geometry.rotateX(Math.PI / 2); beam.name = 'beam'; g.add(beam);
      const beam2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); beam2.geometry.rotateX(Math.PI / 2); beam2.name = 'beam2'; g.add(beam2);
      this.vecMesh = g; this.scene.add(g);
    }
    this.vecMesh.visible = true;
  }
  updateVector(dt: number) {
    const v = this.vec; if (!v.active) { this.enemyTime = lerp(this.enemyTime, 1, Math.min(1, dt * 5)); this.warp = Math.max(0, this.warp - dt * 2); return; }
    v.t += dt; const k = v.t / v.dur; this.enemyTime = 0.22; this.warp = Math.min(1, v.t * 4) * (1 - Math.max(0, (k - 0.85) / 0.15));
    const cam = this.camera.position; v.dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion); const h = this.raycast(cam.x, cam.y, cam.z, v.dir.x, v.dir.y, v.dir.z, 55);
    const L = Math.max(4, h.t - 1.5); v.pos.copy(cam).addScaledVector(v.dir, L); const vf = this.floorAt(v.pos.x, v.pos.z) + 1; if (v.pos.y < vf) v.pos.y = vf;
    const g = this.vecMesh!; g.position.copy(v.pos); const grow = Math.min(1, v.t * 3) * (k > 0.85 ? 1 + (k - 0.85) * 6 : 1); const coreS = 0.9 + Math.sin(this.time * 20) * 0.1; g.children[0].scale.setScalar(coreS * (k > 0.9 ? (1 - k) * 8 + 0.2 : 1) * grow); g.children[1].scale.setScalar(grow * 1.2); g.children.forEach((c, i) => { if (i >= 2 && i < 5) { c.rotation.z += dt * (3 + i); c.scale.setScalar(grow); } });
    const org = this.muzzleWorld(new V3()); const bm = g.getObjectByName('beam') as THREE.Mesh, b2 = g.getObjectByName('beam2') as THREE.Mesh; const mid = new V3().addVectors(org, v.pos).multiplyScalar(0.5); const len = org.distanceTo(v.pos);
    for (const [m, w] of [[bm, 0.55 + Math.sin(this.time * 40) * 0.1], [b2, 0.2]] as [THREE.Mesh, number][]) { m.position.copy(mid).sub(v.pos); m.lookAt(org); m.scale.set(w, w, len); }
    for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'dormant' || e.removed) continue; const ex = e.pos.x - v.pos.x, ey = e.pos.y + e.def.height / 2 - v.pos.y, ez = e.pos.z - v.pos.z; const d = Math.hypot(ex, ey, ez); const resist = e.isBoss ? 0.25 : e.def.size === 'large' ? 0.6 : 1;
      if (d < 30) { const pull = (6 + (1 - d / 30) * 26) * resist; const inv = 1 / (d || 1); e.kb.x -= ex * inv * pull * dt * 6; e.kb.z -= ez * inv * pull * dt * 6; if (e.def.flying) e.pos.y -= ey * inv * pull * dt * 0.6; e.pos.x -= ex * inv * pull * dt * 0.5; e.pos.z -= ez * inv * pull * dt * 0.5; if (!e.awake) this.wakeEnemy(e); }
      if (d < 4.5) this.damageEnemy(e, 170 * dt, new V3(e.pos.x, e.pos.y + e.def.height / 2, e.pos.z), false, null, true);
      const t = ((e.pos.x - org.x) * v.dir.x + (e.pos.y + 1 - org.y) * v.dir.y + (e.pos.z - org.z) * v.dir.z); if (t > 0 && t < len) { const cx = org.x + v.dir.x * t - e.pos.x, cy = org.y + v.dir.y * t - e.pos.y - 1, cz = org.z + v.dir.z * t - e.pos.z; if (cx * cx + cy * cy + cz * cz < 2.6) this.damageEnemy(e, 110 * dt, new V3(e.pos.x, e.pos.y + 1, e.pos.z), false, null, true); } }
    if (rand() < 0.8) { const a = rand() * 6.28; this.particles.emit(v.pos.x + Math.cos(a) * 5, v.pos.y + (rand() - 0.5) * 4, v.pos.z + Math.sin(a) * 5, 0, 0, 0, 0.5, 0.2, 0xe060ff, 0); }
    this.particles.burst(v.pos, 2, 0xffffff, 8, 0.4, 0.15, 0);
    if (v.t >= v.dur) { v.active = false; g.visible = false; this.flashBoost = 2.5; this.explode(v.pos, 13, 480, 'player', 0.1); this.spawnBlast(v.pos, 13, 0xe060ff); audio.play('vectorEnd', 1); this.shake = 1.5; }
  }

  // ============================================================ projectiles
  fireProj(origin: THREE.Vector3, dir: THREE.Vector3, pd: ProjDef, dmg: number, hostile: boolean, kind = 'enemy', ghost = false) {
    const mkSprite = (c: number, s: number) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.setScalar(s); return sp; };
    const g = new THREE.Group(); const bm = new THREE.MeshBasicMaterial({ color: pd.color });
    let radius = pd.size, grav = 0, bounce = false, fuse = 0;
    if (kind === 'grenade') {
      const can = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2e3238, flatShading: true })); can.scale.set(1, 0.92, 1.3); g.add(can);
      const bandM = new THREE.MeshBasicMaterial({ color: 0x51ff62 });
      for (const bz of [-0.09, 0.09]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.02, 6, 14), bandM); band.position.z = bz; g.add(band); }
      const fuseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x565e68, flatShading: true })); fuseCap.rotation.x = Math.PI / 2; fuseCap.position.z = 0.26; g.add(fuseCap);
      const pin = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), bandM); pin.position.z = 0.3; g.add(pin);
      g.add(mkSprite(0x51ff62, 0.65)); grav = 18; bounce = true; fuse = 2.0; radius = 0.25;
    }
    else if (kind === 'nail') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), bm); g.add(m); g.add(mkSprite(0xffa040, 0.5)); radius = 0.12; }
    else if (pd.style === 'orb') { g.add(new THREE.Mesh(new THREE.SphereGeometry(pd.size, 8, 6), bm)); g.add(mkSprite(pd.color, pd.size * 5)); radius = pd.size + 0.15; }
    else if (pd.style === 'bolt') { g.add(new THREE.Mesh(new THREE.BoxGeometry(pd.size * 0.7, pd.size * 0.7, pd.size * 7), bm)); g.add(mkSprite(pd.color, pd.size * 5)); radius = pd.size + 0.12; }
    else if (pd.style === 'rocket') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 7), new THREE.MeshLambertMaterial({ color: 0xcccccc })); c.rotation.x = -Math.PI / 2; g.add(c); g.add(mkSprite(pd.color, 1.5)); radius = 0.3; }
    else if (pd.style === 'ice') { g.add(new THREE.Mesh(new THREE.OctahedronGeometry(pd.size), bm)); g.add(mkSprite(pd.color, pd.size * 5)); radius = pd.size + 0.15; }
    else { const c = new THREE.Mesh(new THREE.ConeGeometry(pd.size, pd.size * 6, 5), bm); c.rotation.x = -Math.PI / 2; g.add(c); g.add(mkSprite(pd.color, pd.size * 4)); radius = pd.size + 0.12; }
    g.position.copy(origin); g.lookAt(origin.clone().add(dir)); this.scene.add(g);
    const style = kind === 'grenade' ? 'grenade' : kind === 'nail' ? 'nail' : kind === 'rocket' ? 'rocket' : pd.style;
    this.projs.push({ ghost, obj: g, pos: origin.clone(), vel: dir.clone().multiplyScalar(pd.speed), hostile, dmg, life: 6, radius, grav, bounce, fuse, splash: pd.splash ?? 0, style, slow: !!pd.slow, trailT: 0, color: pd.color, spin: rand() * 6 });
    if (!ghost && !hostile) this.netFire('proj', origin, dir, WEAPONS[this.cur].id, style);
  }
  killProj(p: Proj, explode: boolean) {
    const i = this.projs.indexOf(p); if (i >= 0) this.projs.splice(i, 1); this.scene.remove(p.obj); p.obj.traverse(o => { const m = o as THREE.Mesh; if (m.geometry && (o as THREE.Sprite).type !== 'Sprite') m.geometry.dispose(); const mt = m.material as THREE.Material | undefined; if (mt) mt.dispose(); });
    if (explode && p.splash > 0 && !p.ghost) this.explode(p.pos, p.splash, p.dmg, p.hostile ? 'enemy' : 'player');
    else if (explode) this.particles.burst(p.pos, 6, p.color, 4, 0.3, 0.08);
  }
  updateProjectiles(dt: number) {
    const pl = this.player;
    for (const p of [...this.projs]) {
      const sdt = p.hostile ? dt * this.enemyTime : dt; p.life -= sdt; p.fuse > 0 && (p.fuse -= sdt);
      if (p.life <= 0) { this.killProj(p, p.style === 'grenade'); continue; } if (p.style === 'grenade' && p.fuse <= 0) { this.killProj(p, true); continue; }
      const steps = Math.max(1, Math.ceil((p.vel.length() * sdt) / 0.5)); const h = sdt / steps; let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        p.vel.y -= p.grav * h; const px = p.pos.x, py = p.pos.y, pz = p.pos.z; p.pos.addScaledVector(p.vel, h);
        if (this.solidAtPoint(p.pos.x, p.pos.y, p.pos.z)) {
          if (p.bounce) { // reflect on whichever axis is blocked
            let bx = false, by = false, bz = false; if (this.solidAtPoint(p.pos.x, py, pz)) bx = true; if (this.solidAtPoint(px, p.pos.y, pz)) by = true; if (this.solidAtPoint(px, py, p.pos.z)) bz = true; if (!bx && !by && !bz) by = true;
            p.pos.set(px, py, pz); if (bx) p.vel.x *= -0.55; if (by) { p.vel.y *= -0.5; p.vel.x *= 0.8; p.vel.z *= 0.8; } if (bz) p.vel.z *= -0.55; if (by && Math.abs(p.vel.y) < 1) p.vel.y = 0;
          } else { this.impact(p.pos, new V3(0, 1, 0), p.color, 5); this.killProj(p, true); dead = true; break; }
        }
        if (!p.hostile && !p.ghost && this.mpCfg?.mode === 'arena') {
          for (const r of this.remotes.values()) { if (r.dead) continue; const dx = r.group.position.x - p.pos.x, dz = r.group.position.z - p.pos.z; if (dx * dx + dz * dz < (0.55 + p.radius) ** 2 && p.pos.y > r.group.position.y && p.pos.y < r.group.position.y + 1.85) { this.netSendDamage(r.id, p.dmg, this.mpCfg.session.localId); this.killProj(p, p.splash > 0); dead = true; break; } }
          if (dead) break;
        }
        if (!p.hostile && !p.ghost) {
          for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'dormant' || e.removed) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; if (dx * dx + dz * dz < (e.def.radius + p.radius) ** 2 && p.pos.y > e.pos.y - 0.1 && p.pos.y < e.pos.y + e.def.height + 0.1) { if (p.splash > 0) { this.killProj(p, true); } else { this.damageEnemy(e, p.dmg, p.pos.clone(), false, p.vel.clone().normalize()); this.killProj(p, false); } dead = true; break; } }
        } else {
          const dx = pl.pos.x - p.pos.x, dz = pl.pos.z - p.pos.z; if (!pl.dead && dx * dx + dz * dz < (0.55 + p.radius) ** 2 && p.pos.y > pl.pos.y - 0.1 && p.pos.y < pl.pos.y + 1.85) { if (p.splash > 0) this.killProj(p, true); else { this.damagePlayer(p.dmg, p.pos, p.slow); this.killProj(p, false); } dead = true; break; }
        }
      }
      if (dead) continue;
      p.obj.position.copy(p.pos); if (p.style !== 'grenade') { const tv = p.vel; if (tv.lengthSq() > 0.01) p.obj.lookAt(p.pos.x + tv.x, p.pos.y + tv.y, p.pos.z + tv.z); } else p.obj.rotation.x += dt * 8;
      p.trailT -= dt; if (p.trailT <= 0 && (p.style === 'rocket' || p.style === 'grenade' || p.style === 'orb' || p.style === 'ice')) { p.trailT = 0.03; this.particles.emit(p.pos.x, p.pos.y, p.pos.z, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, 0.4, p.style === 'rocket' ? 0.2 : 0.1, p.style === 'rocket' ? 0xffaa40 : p.color, 0); }
    }
  }

  // ============================================================ explosions / fx
  spawnBlast(p: THREE.Vector3, r: number, color: number) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), m); s.position.copy(p); this.scene.add(s);
    this.fx.push({ obj: s, life: 0.4, max: 0.4, kind: 'blast', s0: 0.3, s1: r * 0.9, mat: m });
    const m2 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const rg = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), m2); rg.position.copy(p); rg.rotation.x = -Math.PI / 2; rg.position.y = Math.max(0.1, p.y * 0.2); this.scene.add(rg);
    this.fx.push({ obj: rg, life: 0.5, max: 0.5, kind: 'ring', s0: 0.5, s1: r * 1.3, mat: m2 });
    this.particles.burst(p, 26, color, r * 1.6, 0.8, 0.28, 8); this.particles.burst(p, 14, 0xffffff, r, 0.5, 0.18, 6); this.flashBoost = Math.max(this.flashBoost, 1);
    this.flashLight.position.copy(p); this.flashLight.color.setHex(color);
  }
  explode(pos: THREE.Vector3, radius: number, dmg: number, owner: 'player' | 'enemy' | 'neutral', selfMul = 0.45) {
    const color = owner === 'enemy' ? 0xff8a30 : 0xffa040; if (selfMul !== 0.1) this.spawnBlast(pos, radius, color); audio.play('explode', clamp(1 - this.player.pos.distanceTo(pos) / 60, 0.2, 1));
    if (owner !== 'enemy') for (const e of this.enemies) { if (e.state === 'dead' || e.removed || e.state === 'dormant') continue; const c = new V3(e.pos.x, e.pos.y + e.def.height / 2, e.pos.z); const d = c.distanceTo(pos) - e.def.radius * 0.6; if (d < radius) { const f = 1 - Math.max(0, d) / radius; this.damageEnemy(e, dmg * (0.3 + 0.7 * f), c, false, c.clone().sub(pos).normalize(), true); const dir = c.clone().sub(pos).setY(0).normalize(); if (!e.isBoss && e.def.size !== 'large') { e.kb.x += dir.x * 14 * f; e.kb.z += dir.z * 14 * f; } } }
    if (this.mpCfg?.mode === 'arena' && owner !== 'enemy') for (const r of this.remotes.values()) { if (r.dead) continue; const rc = new V3(r.group.position.x, r.group.position.y + 0.9, r.group.position.z); const rd = rc.distanceTo(pos); if (rd < radius) this.netSendDamage(r.id, dmg * (1 - rd / radius), this.mpCfg.session.localId); }
    const pc = new V3(this.player.pos.x, this.player.pos.y + 0.9, this.player.pos.z); const d = pc.distanceTo(pos); const pl = this.player;
    if (d < radius * 1.1) { const f = 1 - d / (radius * 1.1); const dir = pc.clone().sub(pos).normalize(); if (owner === 'enemy') this.damagePlayer(dmg * (0.4 + 0.6 * f), pos); else { this.damagePlayer(dmg * f * selfMul, pos); } if (owner !== 'enemy' && selfMul > 0.1) { pl.vel.x += dir.x * 20 * f; pl.vel.z += dir.z * 20 * f; pl.vel.y = Math.max(pl.vel.y, dir.y * 20 * f + 5 * f); pl.onGround = false; } this.shake = Math.min(1.5, this.shake + f); }
  }
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, width: number, life: number) {
    const len = a.distanceTo(b); if (len < 0.05) return; const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const g = this.beamGeo || (this.beamGeo = (() => { const q = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); q.rotateX(Math.PI / 2); return q; })()); const mesh = new THREE.Mesh(g, m);
    mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.lookAt(b); mesh.scale.set(width, width, len); this.scene.add(mesh); this.fx.push({ obj: mesh, life, max: life, kind: 'beam', s0: width, s1: width * 0.2, mat: m });
  }
  beamGeo: THREE.BufferGeometry | null = null;
  updateFX(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.life -= dt; const k = 1 - f.life / f.max;
      if (f.mat) f.mat.opacity = Math.max(0, 1 - k) * (f.kind === 'blast' ? 0.85 : 0.9);
      if (f.kind === 'blast' || f.kind === 'ring') f.obj.scale.setScalar(lerp(f.s0, f.s1, Math.sqrt(k))); else if (f.kind === 'beam') { f.obj.scale.x = f.obj.scale.y = lerp(f.s0, f.s1, k); }
      if (f.life <= 0) { this.scene.remove(f.obj); if (f.kind !== 'beam') (f.obj as THREE.Mesh).geometry.dispose(); f.mat?.dispose(); this.fx.splice(i, 1); }
    }
  }

  // ============================================================ enemies
  damageEnemy(e: Enemy, amount: number, point: THREE.Vector3 | null, head: boolean, dir: THREE.Vector3 | null, silent = false) {
    if (this.mpCfg?.session.role === 'guest' && !this.netApplying) { e.flash = 1; return; } // host-simulated in co-op
    if (e.state === 'dead' || e.state === 'dormant') return;
    e.hp -= amount; e.flash = 1; if (!e.awake) { this.wakeEnemy(e); this.alertNear(e); }
    if (!silent) { this.hit = 1; this.hitHead = head; audio.play(head ? 'headshot' : 'hit', 0.6); }
    if (point) this.particles.burst(point, silent ? 2 : 6, e.def.look.glow, 4, 0.5, 0.1, 10, 0.3);
    if (!e.isBoss && amount > e.maxHp * 0.18 && rand() < 0.7 && e.mode !== 'charge') { e.painT = 0.3; if (e.mode === 'windup' || e.mode === 'swing') { e.mode = 'walk'; e.atkT = -1; } }
    if (dir && !e.isBoss && e.def.size !== 'large') { e.kb.x += dir.x * Math.min(8, amount * 0.05); e.kb.z += dir.z * Math.min(8, amount * 0.05); }
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e: Enemy) {
    if (e.state === 'dead') return; e.state = 'dead'; e.deadT = 0; e.hp = 0; e.atkT = -1; if (e.counted) this.kills++; audio.play('kill', 0.7);
    const c = new V3(e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z); this.particles.burst(c, 22 + (e.def.size === 'large' ? 20 : 0), e.def.look.color, 7, 1.0, 0.2, 14); this.particles.burst(c, 10, e.def.look.glow, 5, 0.8, 0.14, 8);
    if (e.def.id === 'gasbag') this.explode(c, 5.5, 45, 'neutral', 0.9);
    if (e.isBoss) this.onBossDeath(e); else if (rand() < 0.3 && !e.summoned) { const r = rand(); if (r < 0.45) this.makePickup('health', 15, e.pos.x, e.pos.z); else { const owned = [...this.owned].map(id => WEAPON_BY_ID[id].ammo).filter(a => a !== 'inf' && a !== 'vector'); if (owned.length) { const a = owned[Math.floor(rand() * owned.length)]; this.makePickup('ammo', Math.max(1, Math.round({ pellets: 4, shells: 4, bullets: 30, nails: 25, grenades: 3, cells: 20, rockets: 3, slugs: 2, vector: 0, inf: 0 }[a] ?? 3)), e.pos.x, e.pos.z, a); } } }
  }
  onBossDeath(e: Enemy) {
    for (const o of this.enemies) if (o !== e && o.state !== 'dead' && o.summoned) this.killEnemy(o);
    this.portalOpen = true; this.portal.visible = true; this.banner = { title: 'VICTORY', text: `${e.def.name} has fallen. The exit portal is open.`, t: 6 }; audio.play('portal', 1); this.flashBoost = 2; this.shake = 1.2; this.enemyTime = 1;
    const x = e.pos.x, z = e.pos.z; for (let i = 0; i < 4; i++) this.makePickup(i % 2 ? 'armor' : 'health', 50, x + Math.cos(i * 1.57) * 3, z + Math.sin(i * 1.57) * 3);
    if (this.owned.has('vector')) this.makePickup('ammo', 1, x, z + 3, 'vector');
  }
  bossTaunt(e: Enemy) { const t = BOSSES[this.planet.bossId].taunts; this.msg(t[Math.floor(rand() * t.length)], 4); audio.play('bossTaunt', 0.7); void e; }
  bossSummon(e: Enemy) {
    const ids = BOSSES[this.planet.bossId].summon; const n = 2 + e.phase; for (let i = 0; i < n; i++) { const a = rand() * 6.28, r = 5 + rand() * 4; const x = e.pos.x + Math.cos(a) * r, z = e.pos.z + Math.sin(a) * r; if (this.tileWorld(x, z) !== T_FLOOR) continue; this.spawnEnemy(ids[Math.floor(rand() * ids.length)], x, z); }
    audio.play('roar', 1);
  }
  blinkEnemy(e: Enemy) {
    const p = this.player.pos; for (let t = 0; t < 10; t++) { const a = rand() * 6.28, r = 7 + rand() * 8; const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (this.tileWorld(x, z) !== T_FLOOR) continue; if (!this.hasLOS(x, 1.5, z, p.x, 1.5, p.z)) continue; this.particles.burst(new V3(e.pos.x, e.pos.y + 1, e.pos.z), 12, e.def.look.glow, 5, 0.5, 0.15, 0); e.pos.x = x; e.pos.z = z; e.vel.set(0, 0, 0); this.particles.burst(new V3(x, e.pos.y + 1, z), 12, e.def.look.glow, 5, 0.5, 0.15, 0); audio.play('teleport', 0.4); return; }
  }
  enemyShoot(e: Enemy, speedMul = 1) {
    const d = e.def; const pd = d.proj; if (!pd) return; const p = this.player; const o = new V3(e.pos.x, e.pos.y + d.height * 0.65, e.pos.z);
    const dist = Math.hypot(p.pos.x - o.x, p.pos.z - o.z); const lead = clamp(dist / pd.speed, 0, 1) * 0.35;
    const tgt = new V3(p.pos.x + p.vel.x * lead, p.pos.y + 1.1, p.pos.z + p.vel.z * lead); const dir = tgt.sub(o).normalize(); const fwd = new V3(dir.x, 0, dir.z).normalize(); o.addScaledVector(fwd, d.radius + 0.3);
    const n = pd.count ?? 1; for (let i = 0; i < n; i++) { const dd = dir.clone(); const sp = pd.spread ?? 0.02; const ang = n > 1 ? (i - (n - 1) / 2) * sp * 2 : 0; const c = Math.cos(ang), s = Math.sin(ang); const x = dd.x * c - dd.z * s, z = dd.x * s + dd.z * c; dd.x = x; dd.z = z; dd.x += (rand() - 0.5) * 0.02; dd.y += (rand() - 0.5) * 0.02; dd.normalize(); this.fireProj(o, dd, { ...pd, speed: pd.speed * speedMul }, e.isBoss ? d.dmg : pd.dmg, true); }
    audio.play(d.size === 'large' || e.isBoss ? 'enemyBig' : 'enemyShot', clamp(1 - dist / 50, 0.1, 0.8));
  }
  updateEnemies(dt: number) {
    const p = this.player.pos; const et = this.enemyTime; const act: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.removed) continue;
      if (e.state === 'dormant') { // ambush rooms trigger when the player enters the room
        if (this.lv.roomOf[Math.floor(p.z / CELL) * this.lv.W + Math.floor(p.x / CELL)] === e.room) { e.state = 'chase'; e.awake = true; this.particles.burst(new V3(e.pos.x, e.pos.y + 1, e.pos.z), 14, e.def.look.glow, 6, 0.6, 0.16, 0); audio.play('teleport', 0.35); } else continue;
      }
      const dx = p.x - e.pos.x, dz = p.z - e.pos.z; const d2 = dx * dx + dz * dz;
      if (d2 < 75 * 75) this.ensureModel(e); const m = e.model; if (!m) continue;
      if (e.state === 'dead') { e.deadT += dt; if (e.deadT > 7) { this.scene.remove(m.group); m.dispose(); e.model = null; e.removed = true; continue; } }
      else if (this.mpCfg?.session.role === 'guest') {
        if (e.snapPos) { const prevX = e.pos.x, prevZ = e.pos.z; e.pos.lerp(e.snapPos, Math.min(1, dt * 10)); e.yaw = e.snapYaw; e.moveAmt = clamp(Math.hypot(e.pos.x - prevX, e.pos.z - prevZ) / Math.max(dt, 1e-3) / 6, 0, 1); }
        act.push(e);
      }
      else if (d2 < 110 * 110 || e.awake) { updateEnemy(this, e, dt * et); act.push(e); }
      m.group.visible = d2 < (this.planet.theme.fogFar + 15) ** 2; if (!m.group.visible) continue;
      m.group.position.copy(e.pos); m.group.rotation.y = e.yaw; const dead = e.state === 'dead' ? clamp(e.deadT / 0.7, 0, 1) : -1;
      m.update(dt * (e.state === 'dead' ? 1 : et), { t: e.t, move: clamp(e.moveAmt, 0, 1), attack: e.atkT, flash: e.flash, dead, seed: e.seed });
      if (e.state === 'dead' && e.deadT > 5) m.group.scale.setScalar(Math.max(0.01, 1 - (e.deadT - 5) / 2));
    }
    // separation
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j]; if (!a.awake || !b.awake) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const r = a.def.radius + b.def.radius; const d2 = dx * dx + dz * dz; if (d2 < r * r && d2 > 1e-6 && Math.abs(a.pos.y - b.pos.y) < 2) { const d = Math.sqrt(d2); const k = (r - d) * 0.5 / d; const ma = a.isBoss ? 0 : 1, mb = b.isBoss ? 0 : 1; a.pos.x -= dx * k * ma; a.pos.z -= dz * k * ma; b.pos.x += dx * k * mb; b.pos.z += dz * k * mb; }
    }
  }

  // ============================================================ pickups
  updatePickups(dt: number) {
    const p = this.player;
    for (const k of this.pickups) {
      if (k.taken) {
        if (this.lv.arena) { k.respawnT -= dt; if (k.respawnT <= 0) { k.taken = false; this.scene.add(k.obj); } }
        continue;
      }
      k.t += dt; const baseY = k.kind === 'weapon' ? 1.3 : k.kind === 'ammo' && k.ammo === 'vector' ? 1.0 : 0.75; k.obj.position.y = k.pos.y + baseY + Math.sin(k.t * 2.5) * 0.12; k.obj.rotation.y += dt * (k.kind === 'weapon' ? 1.6 : 1.1);
      if (p.dead) continue; const dx = p.pos.x - k.pos.x, dz = p.pos.z - k.pos.z; if (dx * dx + dz * dz > 2.2 * 2.2 || Math.abs(p.pos.y - k.pos.y) > 3.2) continue;
      let ok = false;
      if (k.kind === 'health') { ok = this.heal(k.value); if (ok) this.msg(`+${k.value} health`, 1.2); }
      else if (k.kind === 'armor') { if (p.armor < 100) { p.armor = Math.min(100, p.armor + k.value); ok = true; this.msg(`+${k.value} armor`, 1.2); } }
      else if (k.kind === 'ammo' && k.ammo) { ok = this.addAmmo(k.ammo, k.value); if (ok) this.msg(`+${k.value} ${k.ammo}`, 1.2); }
      else if (k.kind === 'weapon' && k.weapon) { ok = true; this.giveWeapon(k.weapon); }
      if (ok) { k.taken = true; k.respawnT = k.ammo === 'vector' ? 45 : k.kind === 'health' ? 16 : 22; this.scene.remove(k.obj); this.pickupFlash = 1; if (k.kind !== 'weapon') audio.play('pickup', 0.6); }
    }
  }
  giveWeapon(id: string) {
    const w = WEAPON_BY_ID[id]; const first = !this.owned.has(id); this.owned.add(id); const start: Record<string, number> = { pellets: 15, shells: 12, bullets: 100, nails: 80, grenades: 8, cells: 60, rockets: 8, slugs: 8, vector: 3 };
    if (w.ammo !== 'inf') this.addAmmo(w.ammo, start[w.ammo] ?? 10); if (id === 'powerline' && first) { this.plLoaded = true; this.plPumps = 0; }
    audio.play('weapon', 1); this.banner = { title: w.name, text: w.desc, t: 6 }; this.msg(`You got the ${w.name}!`, 3);
    const idx = WEAPONS.findIndex(x => x.id === id); this.selectWeapon(idx);
  }

  // ============================================================ multiplayer (PeerJS / WebRTC)
  setupMultiplayer() {
    const mp = this.mpCfg; if (!mp) return;
    const s = mp.session;
    s.onPacket = (from, p) => this.onNetPacket(from, p as { t?: string });
    s.onPeerLeft = id => { const r = this.remotes.get(id); if (r) { this.scene.remove(r.group); this.remotes.delete(id); } };
    s.peers.forEach(p => { if (p.id !== s.localId) this.ensureRemote(p.id, p.name, p.color); });
    if (mp.mode === 'arena') {
      this.enemies = []; this.totalKills = 0; this.portalOpen = false; this.portal.visible = false;
      this.spawnPoints = (this.lv.arena?.spawns || []).map(p => new V3(p.x, p.y, p.z));
      if (!this.spawnPoints.length) this.spawnPoints = [this.player.pos.clone()];
      const idx = Math.max(0, s.peers.findIndex(p => p.id === s.localId));
      const sp = this.spawnPoints[idx % this.spawnPoints.length]; this.player.pos.copy(sp); this.player.safePos.copy(sp);
      this.explored.fill(1);
      this.banner = { title: this.lv.name, text: 'Free-for-all / All weapons / Upper decks / Respawns on', t: 6 };
    } else {
      this.banner = { title: `CO-OP · ${s.peers.length} PLAYER${s.peers.length === 1 ? '' : 'S'}`, text: s.role === 'host' ? 'You are the host — you run the monsters for the squad.' : 'Linked to host. Monsters are host-simulated.', t: 6 };
    }
  }
  ensureRemote(id: string, name: string, color: number): RemotePlayer {
    let r = this.remotes.get(id);
    if (r) { r.name = name; r.color = color; return r; }
    const group = new THREE.Group();
    const M = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: e });
    const suit = M(0x2a3140), plate = M(color), joint = M(0x4e5b6e), glowM = new THREE.MeshBasicMaterial({ color });
    const bx = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); group.add(o); return o; };
    for (const sd of [-1, 1]) { bx(0.16, 0.8, 0.18, suit, sd * 0.14, 0.4, 0); bx(0.18, 0.1, 0.3, joint, sd * 0.14, 0.05, 0.05); const arm = bx(0.13, 0.62, 0.13, suit, sd * 0.34, 1.12, 0); arm.rotation.x = -0.25; }
    bx(0.52, 0.62, 0.3, suit, 0, 1.18, 0); bx(0.44, 0.34, 0.06, plate, 0, 1.28, 0.16); bx(0.2, 0.12, 0.04, glowM, 0, 1.3, 0.2);
    bx(0.34, 0.3, 0.3, suit, 0, 1.68, 0); bx(0.3, 0.1, 0.03, glowM, 0, 1.7, 0.16); // visor
    bx(0.4, 0.5, 0.16, joint, 0, 1.25, -0.24); // backpack
    const gun = new THREE.Group(); gun.position.set(0.3, 1.32, 0.1); group.add(gun);
    const gb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.62), M(0x1c2027)); gb.position.z = -0.25; gun.add(gb);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), glowM); tip.position.z = -0.58; gun.add(tip);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flash.scale.setScalar(0.7); flash.position.z = -0.66; flash.visible = false; gun.add(flash);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 56; const ctx = cv.getContext('2d')!; ctx.font = 'bold 30px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 6; ctx.strokeText(name, 128, 38); ctx.fillText(name, 128, 38);
    const ntex = new THREE.CanvasTexture(cv); const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, depthWrite: false, transparent: true })); nameSprite.scale.set(2.4, 0.52, 1); nameSprite.position.y = 2.15; group.add(nameSprite);
    group.position.copy(this.player.pos);
    this.scene.add(group);
    r = { id, name, color, group, gun, flash, target: group.position.clone(), yaw: 0, pitch: 0, hp: 100, weapon: 'revolver', firing: false, dead: false, kills: 0, deaths: 0, nameSprite };
    this.remotes.set(id, r); return r;
  }
  private netLocalState() {
    const s = this.mpCfg!.session; const p = this.player;
    return { id: s.localId, name: s.name, color: s.color, pos: [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2)], yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), hp: Math.ceil(p.hp), weapon: WEAPONS[this.cur].id, firing: this.isFiring() || this.flashT > 0, dead: p.dead, kills: this.localKills, deaths: this.localDeaths };
  }
  private applyRemoteState(st: { id: string; name: string; color: number; pos: number[]; yaw: number; pitch: number; hp: number; weapon: string; firing: boolean; dead: boolean; kills: number; deaths: number }) {
    if (!this.mpCfg || st.id === this.mpCfg.session.localId) return;
    const r = this.ensureRemote(st.id, st.name, st.color);
    r.target.set(st.pos[0], st.pos[1], st.pos[2]); r.yaw = st.yaw; r.pitch = st.pitch; r.hp = st.hp; r.weapon = st.weapon; r.firing = st.firing; r.dead = st.dead; r.kills = st.kills; r.deaths = st.deaths;
  }
  onNetPacket(from: string, p: { t?: string }) {
    const mp = this.mpCfg; if (!mp || !p) return; const s = mp.session;
    switch (p.t) {
      case 'state': if (s.role === 'host') this.applyRemoteState(p as never); break;
      case 'states': (p as { list: never[] }).list.forEach(st => this.applyRemoteState(st)); break;
      case 'shot': {
        const shot = p as { from: string; kind: string; o: number[]; d: number[]; w: string; style?: string };
        if (shot.from === s.localId) break;
        if (s.role === 'host') { if (mp.mode === 'coop') this.applyRemoteShot(shot); else this.visualRemoteShot(shot.from, shot); s.broadcast(p, from === 'host' ? undefined : from); }
        else this.visualRemoteShot(shot.from, shot);
        break;
      }
      case 'pdmg': {
        const d = p as { target: string; dmg: number; from: string };
        if (d.target === s.localId) this.damageFromPlayer(d.dmg, d.from);
        else if (s.role === 'host') s.sendTo(d.target, p);
        break;
      }
      case 'kill': {
        const k = p as { killer: string; victim: string };
        if (k.killer === s.localId) this.localKills++;
        const kr = this.remotes.get(k.killer); if (kr) kr.kills++;
        const vr = this.remotes.get(k.victim); if (vr) vr.deaths++;
        if (s.role === 'host') s.broadcast(p, from);
        if (k.victim !== s.localId) this.msg(`${this.remotes.get(k.killer)?.name || 'A player'} fragged ${this.remotes.get(k.victim)?.name || 'a player'}`, 2.5);
        break;
      }
      case 'esnap': if (s.role === 'guest') this.applyEnemySnap((p as { es: never[] }).es); break;
      case 'finish': if (s.role === 'guest' && !this.finished) { this.finished = true; const st = (p as { stats: LevelStats }).stats; this.cb.onComplete(st, this.getInventory()); } break;
      default: break;
    }
  }
  netFire(kind: string, o: THREE.Vector3, d: THREE.Vector3, w: string, style?: string) {
    if (!this.mpCfg || this.netApplying) return;
    this.mpCfg.session.send({ t: 'shot', from: this.mpCfg.session.localId, kind, o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], d: [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)], w, style });
  }
  visualRemoteShot(fromId: string, shot: { kind: string; o: number[]; d: number[]; w: string; style?: string }) {
    const r = this.remotes.get(fromId); const dir = new V3(shot.d[0], shot.d[1], shot.d[2]).normalize();
    const org = r ? new V3(r.group.position.x, r.group.position.y + 1.5, r.group.position.z).addScaledVector(dir, 0.5) : new V3(shot.o[0], shot.o[1], shot.o[2]);
    if (r) { r.flash.visible = true; window.setTimeout(() => { r.flash.visible = false; }, 50); }
    audio.play(shot.w === 'scatter' ? 'scatter' : shot.w, clamp(1 - this.player.pos.distanceTo(org) / 55, 0.08, 0.6));
    if (shot.kind === 'hit') { const h = this.raycast(org.x, org.y, org.z, dir.x, dir.y, dir.z, 90); const end = org.clone().addScaledVector(dir, h.t); this.beam(org, end, new THREE.Color(WEAPON_BY_ID[shot.w]?.css || '#ffffff').getHex(), 0.045, 0.08); if (h.hit) this.impact(end, new V3(h.nx, h.ny, h.nz), 0xffd080, 4); }
    else if (shot.kind === 'arc') { const h = this.raycast(org.x, org.y, org.z, dir.x, dir.y, dir.z, 24); this.beam(org, org.clone().addScaledVector(dir, h.t), 0x7deeff, 0.1, 0.07); }
    else if (shot.kind === 'vector') { const h = this.raycast(org.x, org.y, org.z, dir.x, dir.y, dir.z, 55); const end = org.clone().addScaledVector(dir, h.t); this.beam(org, end, 0xe060ff, 0.3, 0.35); this.particles.burst(end, 14, 0xe060ff, 7, 0.5, 0.16, 0); }
    else if (shot.kind === 'proj') {
      const pd: ProjDef = shot.style === 'rocket' ? { speed: 32, dmg: 0, color: 0xff7a30, size: 0.28, style: 'rocket' } : shot.style === 'grenade' ? { speed: 24, dmg: 0, color: 0x51ff62, size: 0.2, style: 'orb' } : { speed: 80, dmg: 0, color: 0xffa040, size: 0.09, style: 'bolt' };
      this.fireProj(org, dir, pd, 0, false, shot.style === 'rocket' ? 'rocket' : shot.style === 'grenade' ? 'grenade' : 'nail', true);
    }
  }
  applyRemoteShot(shot: { kind: string; o: number[]; d: number[]; w: string; style?: string }) {
    const org = new V3(shot.o[0], shot.o[1], shot.o[2]); const dir = new V3(shot.d[0], shot.d[1], shot.d[2]).normalize();
    this.netApplying = true; this.shotSource = org.clone();
    try {
      this.visualRemoteShot('', { ...shot, o: [org.x, org.y, org.z] });
      if (shot.kind === 'hit') {
        const dmg: Record<string, number> = { revolver: 36, powerline: 600, scatter: 11, chaingun: 12 };
        this.fireHit(org, dir, dmg[shot.w] ?? 20, 220, shot.w === 'powerline' ? 2 : 1, 2, 0xffe0a0, 0.04, 'fire');
      } else if (shot.kind === 'arc') {
        let best: Enemy | null = null; let bt = 24;
        for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'dormant') continue; const t = this.rayCyl(org, dir, e, bt); if (t !== null && t < bt) { bt = t; best = e; } }
        if (best) this.damageEnemy(best, 9, null, false, dir, true);
      } else if (shot.kind === 'proj') {
        const pd: ProjDef = shot.style === 'rocket' ? { speed: 32, dmg: 120, color: 0xff7a30, size: 0.28, style: 'rocket', splash: 7 } : shot.style === 'grenade' ? { speed: 24, dmg: 95, color: 0x51ff62, size: 0.2, style: 'orb', splash: 6 } : { speed: 80, dmg: 22, color: 0xffa040, size: 0.09, style: 'bolt' };
        this.fireProj(org, dir, pd, pd.dmg, false, shot.style === 'rocket' ? 'rocket' : shot.style === 'grenade' ? 'grenade' : 'nail');
      } else if (shot.kind === 'vector') {
        for (const e of this.enemies) { if (e.state === 'dead') continue; const c = new V3(e.pos.x, e.pos.y + 1, e.pos.z); if (c.distanceTo(org.clone().addScaledVector(dir, clamp(c.clone().sub(org).dot(dir), 0, 55))) < 3) this.damageEnemy(e, 260, c, false, dir, true); }
      }
    } finally { this.netApplying = false; this.shotSource = null; }
  }
  applyEnemySnap(list: [number, string, number, number, number, number, number, string, number][]) {
    for (const [id, defId, x, y, z, yaw, hp, state, atkT] of list) {
      let e = this.enemies.find(q => q.id === id);
      if (!e) { e = this.spawnEnemy(defId, x, z, false, false) || undefined; if (!e) continue; e.id = id; e.counted = false; }
      if (!e.snapPos) e.snapPos = new V3(x, y, z); else e.snapPos.set(x, y, z);
      e.snapYaw = yaw; e.hp = hp; e.atkT = atkT;
      if (state === 'dead' && e.state !== 'dead') { e.state = 'dead'; e.deadT = 0; }
      else if (state !== 'dead') { e.state = state as Enemy['state']; e.awake = state !== 'idle'; }
    }
  }
  netTick(dt: number) {
    const mp = this.mpCfg; if (!mp) return; const s = mp.session;
    for (const r of this.remotes.values()) {
      r.group.position.lerp(r.target, Math.min(1, dt * 12));
      r.group.rotation.y = r.yaw; r.gun.rotation.x = r.pitch;
      r.group.visible = !r.dead;
    }
    this.netT -= dt;
    if (this.netT <= 0) {
      this.netT = 0.09;
      if (s.role === 'guest') s.send({ t: 'state', ...this.netLocalState() });
      else s.broadcast({ t: 'states', list: [this.netLocalState(), ...[...this.remotes.values()].map(r => ({ id: r.id, name: r.name, color: r.color, pos: [r.group.position.x, r.group.position.y, r.group.position.z], yaw: r.yaw, pitch: r.pitch, hp: r.hp, weapon: r.weapon, firing: r.firing, dead: r.dead, kills: r.kills, deaths: r.deaths }))] });
    }
    if (s.role === 'host' && mp.mode === 'coop') {
      this.netEnemyT -= dt;
      if (this.netEnemyT <= 0) { this.netEnemyT = 0.12; s.broadcast({ t: 'esnap', es: this.enemies.filter(e => !e.removed).map(e => [e.id, e.def.id, +e.pos.x.toFixed(2), +e.pos.y.toFixed(2), +e.pos.z.toFixed(2), +e.yaw.toFixed(2), Math.ceil(e.hp), e.state, +e.atkT.toFixed(2)]) }); }
    }
  }
  netSendDamage(target: string, dmg: number, from: string) { this.mpCfg?.session.sendTo(target, { t: 'pdmg', target, dmg, from }); }
  damageFromPlayer(dmg: number, fromId: string) {
    const p = this.player; if (p.dead || this.finished) return;
    const ab = Math.min(p.armor, dmg * 0.5); p.armor -= ab; p.hp -= dmg - ab; this.hurt = Math.min(1, this.hurt + 0.4); this.shake = Math.min(1, this.shake + 0.3); audio.play('hurt', 0.7);
    if (p.hp <= 0) this.playerDie(fromId);
  }
  playerDie(killer: string | null) {
    const p = this.player; if (p.dead) return;
    p.hp = 0; p.dead = true; p.deadT = 0; this.stopArc(); this.vec.active = false; this.enemyTime = 1; this.warp = 0; this.mouse.left = this.mouse.right = false;
    if (this.mpCfg?.mode === 'arena') {
      this.localDeaths++;
      if (killer) this.mpCfg.session.send({ t: 'kill', killer, victim: this.mpCfg.session.localId });
    } else window.setTimeout(() => { if (!this.finished) this.cb.onDead(); }, 1600);
  }
  respawnArena() {
    const p = this.player; if (!this.spawnPoints.length) return;
    let best = this.spawnPoints[0], bd = -1;
    for (const sp of this.spawnPoints) { let dmin = 1e9; for (const r of this.remotes.values()) dmin = Math.min(dmin, Math.hypot(r.group.position.x - sp.x, r.group.position.z - sp.z)); if (dmin > bd) { bd = dmin; best = sp; } }
    p.pos.copy(best); p.safePos.copy(best); p.vel.set(0, 0, 0); p.hp = 100; p.armor = 25; p.dead = false; p.deadT = 0; p.pitch = 0;
    this.ammo = { ...ARENA_LOADOUT.ammo }; this.revMag = 6; this.plLoaded = true; this.plPumps = 0;
    this.msg('Back in the fight!', 1.6);
  }

  // ============================================================ dev tools
  devGiveAll() { WEAPONS.forEach(w => { this.owned.add(w.id); if (w.ammo !== 'inf') this.ammo[w.ammo] = AMMO_MAX[w.ammo]; }); this.player.armor = 100; this.player.hp = 100; this.msg('All weapons + full ammo'); }
  devKillAll() { this.enemies.forEach(e => { if (e.state !== 'dead' && e.state !== 'dormant') { e.hp = 0; this.killEnemy(e); } }); }
  devHeal() { this.player.hp = 100; this.player.armor = 100; }
  devGoExit() { this.player.pos.set(this.exitPos.x - 4, this.exitPos.y, this.exitPos.z); this.player.vel.set(0, 0, 0); }
  devSpawn(id: string) { const p = this.player.pos; const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw); this.spawnEnemy(id, p.x + fx * 8, p.z + fz * 8, true, true); }
  devReveal(on: boolean) { this.dev.reveal = on; this.lv.secrets.forEach(s => { if (s.mesh && !s.opening) s.mesh.material = on ? this.revealMat : (s.mesh.userData.mat as THREE.Material); }); }
  buildElevator() {
    const g = new THREE.Group(); const e = this.exitPos; g.position.copy(e); this.scene.add(g); this.elevator = g;
    const M = (c: number, em = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: em });
    const steel = M(0x3a4250), trim = M(0x8a94a8); const glow = new THREE.MeshBasicMaterial({ color: 0x9ad0ff });
    // cab shell: back wall, side walls, ceiling with light strip, floor grate
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 7.6), steel); back.position.set(3.7, 2.1, 0); g.add(back);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4.2, 0.3), steel); side.position.set(0, 2.1, s * 3.85); g.add(side); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.3, 7.8), steel); roof.position.y = 4.2; g.add(roof);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 0.5), glow); strip.position.y = 4.03; g.add(strip);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.12, 7.6), M(0x5a6270)); floor.position.y = 0.06; g.add(floor);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.8), trim); panel.position.set(3.5, 1.7, 2.6); g.add(panel);
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0x40ff90 })); btn.position.set(3.42, 1.9, 2.6); g.add(btn);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 3.0), glow); sign.position.set(3.6, 3.5, 0); g.add(sign);
    // frame + two sliding doors at the cab mouth (west side, facing the room)
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), trim); post.position.set(-3.9, 2.2, s * 4.0); g.add(post); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 8.5), trim); lintel.position.set(-3.9, 4.35, 0); g.add(lintel);
    for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.0, 3.9), M(0x6a7488)); d.position.set(-3.9, 2.0, s * 1.95); d.userData.base = d.position.clone(); d.position.z = s * 1.95 + s * 1.9; g.add(d); this.elevDoors.push(d); const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.6), glow); win.position.set(0, 0.8, -s * 0.9); d.add(win); }
    this.elevDoors.reverse();
    const pl = new THREE.PointLight(0x9ad0ff, 18, 14, 1.5); pl.position.set(0, 3.5, 0); g.add(pl);
  }

  buildSkyLandmarks(pid: PlanetId): THREE.Group {
    const g = new THREE.Group();
    const M = (c: number) => new THREE.MeshBasicMaterial({ color: c, fog: false });
    const T = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, side: THREE.DoubleSide, depthWrite: false });
    if (pid === 'earth') {
      // Twin Spanish Peaks in the distance with glowing broadcast beacon on West Spanish Peak
      const pk1 = new THREE.Mesh(new THREE.ConeGeometry(85, 135, 7), M(0x1f1930)); pk1.position.set(-140, 52, -240); g.add(pk1);
      const cap1 = new THREE.Mesh(new THREE.ConeGeometry(28, 42, 7), M(0x8890b8)); cap1.position.set(-140, 100, -240); g.add(cap1);
      const pk2 = new THREE.Mesh(new THREE.ConeGeometry(75, 105, 7), M(0x271f3b)); pk2.position.set(-30, 40, -260); g.add(pk2);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 26, 6), M(0x555570)); ant.position.set(-140, 128, -240); g.add(ant);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc050ff, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.position.set(-140, 141, -240); glow.scale.setScalar(55); g.add(glow);
    } else if (pid === 'moon') {
      const earth = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), M(0x3a7fe8)); earth.position.set(-110, 95, -210); g.add(earth);
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(28.6, 18, 12), T(0xffffff, 0.35)); cloud.position.copy(earth.position); g.add(cloud);
    } else if (pid === 'mars') {
      for (const [x, z, r] of [[-130, -200, 42], [110, -210, 34], [-20, -240, 55]]) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), T(0xffaa55, 0.38)); dome.position.set(x, -2, z); g.add(dome);
      }
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(45, 70, 55, 8), M(0x5e2b1b)); mesa.position.set(160, 22, -220); g.add(mesa);
    } else if (pid === 'jupiter') {
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(360, 360, 8, 24), T(0x7c4820, 0.65)); deck.position.set(0, -45, 0); g.add(deck);
      for (const [x, z] of [[-140, -180], [150, -170], [40, -230]]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(2, 8, 140, 6), M(0x4c3220)); sp.position.set(x, 30, z); g.add(sp); }
    } else if (pid === 'saturn') {
      const sat = new THREE.Mesh(new THREE.SphereGeometry(48, 24, 16), M(0xdcc27a)); sat.position.set(110, 105, -220); g.add(sat);
      const rg = new THREE.Mesh(new THREE.RingGeometry(64, 118, 48), T(0xe8d69a, 0.55)); rg.position.copy(sat.position); rg.rotation.set(1.2, 0.3, -0.2); g.add(rg);
    } else if (pid === 'uranus') {
      const rg = new THREE.Mesh(new THREE.RingGeometry(150, 175, 48), T(0x9be8f2, 0.38)); rg.position.set(0, 20, -160); rg.rotation.set(0.3, 0.1, 1.45); g.add(rg);
      const aur = new THREE.Mesh(new THREE.TorusGeometry(130, 14, 6, 36), T(0x40ffb0, 0.22)); aur.position.set(0, 115, -180); aur.rotation.x = 1.25; g.add(aur);
    } else if (pid === 'neptune') {
      const nep = new THREE.Mesh(new THREE.SphereGeometry(52, 24, 16), M(0x2a54c8)); nep.position.set(-100, 90, -220); g.add(nep);
      for (const x of [-160, -40, 130]) { const pl = new THREE.Mesh(new THREE.ConeGeometry(10, 90, 6), T(0x70e8ff, 0.32)); pl.position.set(x, 38, -210); g.add(pl); }
    } else if (pid === 'pluto') {
      const ch = new THREE.Mesh(new THREE.SphereGeometry(42, 20, 14), M(0x7c748a)); ch.position.set(95, 100, -210); g.add(ch);
      for (const [x, z, h] of [[-140, -190, 95], [-50, -230, 120], [160, -180, 85]]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(28, h, 5), M(0x3a2a50)); sp.position.set(x, h * 0.4, z); g.add(sp); }
    }
    return g;
  }

  devTeleportSecret() { const s = this.lv.secrets.find(x => !x.opening); if (s) { this.player.pos.set(s.cx - s.dx * 3, 0, s.cz - s.dy * 3); this.player.yaw = Math.atan2(-s.dx, -s.dy); } }
  devComplete() { this.finish(); }

  hudState(): HudState {
    const w = WEAPONS[this.cur]; const p = this.player; const id = w.id;
    let ammoText = w.ammo === 'inf' ? '∞' : this.dev.infAmmo ? '∞' : String(this.ammo[w.ammo] ?? 0); let ammoLabel = w.ammo === 'inf' ? `${this.revMag}/6` : w.ammo;
    if (id === 'revolver') ammoLabel = this.revReload >= 0 ? 'reloading' : `${this.revMag} / 6 · infinite`; if (id === 'powerline') ammoLabel = 'pellets'; 
    const boss = this.bossRef && this.bossRef.awake && this.bossRef.state !== 'dead' ? { name: this.bossRef.def.name, title: this.bossRef.def.blurb, hp: Math.max(0, this.bossRef.hp), max: this.bossRef.maxHp } : null;
    const stats = this.dev.stats && this.dev.enabled ? `${this.fps.toFixed(0)} fps · ${this.enemies.filter(e => e.awake && e.state !== 'dead').length} awake / ${this.enemies.length} · ${this.projs.length} proj · pos ${(p.pos.x / CELL).toFixed(0)},${(p.pos.z / CELL).toFixed(0)}` : '';
    return {
      hp: Math.ceil(p.hp), armor: Math.ceil(p.armor), weaponIdx: this.cur, ammoText, ammoLabel, owned: WEAPONS.map(x => this.owned.has(x.id)), ammos: this.ammo, maxAmmo: AMMO_MAX,
      pumps: this.plPumps, loaded: this.plLoaded, loadP: this.plLoadT >= 0 ? this.plLoadT / 5 : -1, revMag: this.revMag, kills: this.kills, totalKills: this.totalKills, secrets: this.secretsFound, totalSecrets: this.lv.totalSecrets, time: this.time,
      banner: this.banner ? { title: this.banner.title, text: this.banner.text } : null, msg: this.msgT > 0 ? this.message : '', hit: this.hit, hitHead: this.hitHead, hurt: this.hurt, pickup: this.pickupFlash, warp: this.warp, zoom: this.zoom, ads: this.ads, charge: this.charge,
      boss, mp: this.mpCfg ? { mode: this.mpCfg.mode, code: this.mpCfg.session.code, kills: this.localKills, deaths: this.localDeaths, peers: [{ name: this.mpCfg.session.name, color: '#' + this.mpCfg.session.color.toString(16).padStart(6, '0'), hp: Math.ceil(this.player.hp), kills: this.localKills, deaths: this.localDeaths, dead: this.player.dead }, ...[...this.remotes.values()].sort((a, b) => b.kills - a.kills).map(r => ({ name: r.name, color: '#' + r.color.toString(16).padStart(6, '0'), hp: Math.ceil(r.hp), kills: r.kills, deaths: r.deaths, dead: r.dead }))] } : null, stamina: this.player.stamina, exhausted: this.player.exhausted, sprinting: this.player.sprinting && this.player.onGround, fps: this.fps, dead: p.dead, slow: p.slowT > 0, levelName: this.lv.name, planet: this.planet.name, level: this.levelNum, devInfo: stats, portalOpen: this.portalOpen, vecCharge: this.vec.active ? this.vec.t / this.vec.dur : 0,
    };
  }
}
