import * as THREE from 'three';
import type { Game, Enemy } from './engine';
import { audio } from './audio';
import { CELL } from './level';

const rand = Math.random;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const turn = (e: Enemy, target: number, rate: number, dt: number) => { e.yaw += clamp(angDiff(e.yaw, target), -rate * dt, rate * dt); };

import { T_VOID } from './level';

function move(g: Game, e: Enemy, dx: number, dz: number, speed: number, dt: number, accel = 10) {
  const k = Math.min(1, accel * dt); e.vel.x += (dx * speed - e.vel.x) * k; e.vel.z += (dz * speed - e.vel.z) * k;
  const ox = e.pos.x, oz = e.pos.z;
  let nx = e.pos.x + (e.vel.x + e.kb.x) * dt, nz = e.pos.z + (e.vel.z + e.kb.z) * dt;
  // Ground enemies avoid walking off skybridge ledges on their own (unless blasted by knockback!)
  if (!e.def.flying && e.kb.lengthSq() < 4 && g.tileWorld(nx, nz) === T_VOID) {
    if (g.tileWorld(nx, oz) !== T_VOID) nz = oz;
    else if (g.tileWorld(ox, nz) !== T_VOID) nx = ox;
    else { nx = ox; nz = oz; e.vel.set(0, 0, 0); }
  }
  e.pos.x = nx; e.pos.z = nz; e.kb.multiplyScalar(Math.max(0, 1 - 4 * dt));
  g.resolve(e.pos, e.def.radius, e.def.flying ? e.pos.y : e.pos.y);
  e.moved = Math.hypot(e.pos.x - ox, e.pos.z - oz) / Math.max(dt, 1e-4); e.moveAmt = Math.hypot(e.vel.x, e.vel.z) / Math.max(0.1, e.def.speed);
}
function steer(g: Game, e: Enemy, dx: number, dz: number, dist: number): [number, number] {
  if (e.los) return [dx / dist, dz / dist]; return g.flowDir(e.pos.x, e.pos.z) ?? [dx / dist, dz / dist];
}
function hover(g: Game, e: Enemy, dt: number) {
  const d = e.def; const p = g.player; const fl = g.floorAt(e.pos.x, e.pos.z); const tgt = clamp(Math.max(p.pos.y, fl) + (d.hover ?? 2) - d.height / 2 + Math.sin(e.t * 1.5 + e.seed) * 0.35, fl + 0.2, g.ceilAt(e.pos.x, e.pos.z) - d.height - 0.2);
  e.pos.y += (tgt - e.pos.y) * Math.min(1, dt * 2.5);
}

export function updateEnemy(g: Game, e: Enemy, dt: number) {
  const p = g.player; const d = e.def;
  e.t += dt; e.atkCD -= dt; e.painT -= dt; e.flash = Math.max(0, e.flash - dt * 5); e.blinkCD -= dt; e.modeT -= dt; e.losT -= dt; e.tauntT -= dt; e.summonCD -= dt;
  const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z; const dist = Math.max(0.001, Math.hypot(dx, dz)); const dy = p.pos.y - e.pos.y;
  if (e.losT <= 0) { e.losT = 0.12 + rand() * 0.1; e.los = dist < 70 && g.hasLOS(e.pos.x, e.pos.y + d.height * 0.8, e.pos.z, p.pos.x, p.pos.y + 1.6, p.pos.z); }
  if (!e.awake) {
    const pr = g.lv.roomOf[Math.floor(p.pos.z / CELL) * g.lv.W + Math.floor(p.pos.x / CELL)];
    if (e.isBoss ? (pr === e.room && e.room >= 0) || (e.los && dist < 40) : (e.los && dist < 34) || (g.noiseT > 0 && dist < 38)) { g.wakeEnemy(e); if (!e.isBoss) g.alertNear(e); }
    else { e.moveAmt = 0; if (d.flying) hover(g, e, dt); return; }
  }
  if (p.dead) { move(g, e, 0, 0, 0, dt, 6); if (d.flying) hover(g, e, dt); return; }
  if (e.isBoss) { bossAI(g, e, dt, dx, dz, dist, dy); return; }
  if (d.flying) hover(g, e, dt);
  else if (e.mode !== 'leap') {
    const gh = g.groundAt(e.pos.x, e.pos.z, e.pos.y);
    if (gh <= -900) { e.pos.y -= 18 * dt; if (e.pos.y < g.lv.minFloorY - 12) g.killEnemy(e); return; }
    e.pos.y = gh;
  }
  switch (d.ai) {
    case 'melee': melee(g, e, dt, dx, dz, dist, dy); break;
    case 'leaper': leaper(g, e, dt, dx, dz, dist, dy); break;
    case 'charger': charger(g, e, dt, dx, dz, dist, dy); break;
    case 'exploder': exploder(g, e, dt, dx, dz, dist, dy); break;
    default: shooter(g, e, dt, dx, dz, dist); break;
  }
  if (d.blink && e.blinkCD <= 0 && e.state !== 'dead' && dist > 6 && e.mode === 'walk') { g.blinkEnemy(e); e.blinkCD = 3 + rand() * 3; }
}

function melee(g: Game, e: Enemy, dt: number, dx: number, dz: number, dist: number, dy: number) {
  const d = e.def;
  if (e.mode === 'swing') {
    e.atkT = clamp(1 - e.modeT / 0.6, 0, 1); move(g, e, 0, 0, 0, dt, 14); turn(e, Math.atan2(dx, dz), 8, dt);
    if (!e.atkDone && e.atkT >= 0.5) { e.atkDone = true; if (dist < d.range + 1.0 && Math.abs(dy) < 2.2) { g.damagePlayer(d.dmg, e.pos); audio.play('swing', 0.6); } }
    if (e.modeT <= 0) { e.mode = 'walk'; e.atkT = -1; } return;
  }
  if (e.painT > 0) { move(g, e, 0, 0, 0, dt, 18); return; }
  const [sx, sz] = steer(g, e, dx, dz, dist); move(g, e, sx, sz, d.speed, dt); turn(e, e.los || dist < 8 ? Math.atan2(dx, dz) : Math.atan2(sx, sz), 7, dt);
  if (e.los && dist < d.range && e.atkCD <= 0) { e.mode = 'swing'; e.modeT = 0.6; e.atkDone = false; e.atkCD = d.rate + 0.3; e.atkT = 0; }
}

function shooter(g: Game, e: Enemy, dt: number, dx: number, dz: number, dist: number) {
  const d = e.def; const nx = dx / dist, nz = dz / dist;
  if (e.mode === 'windup') {
    e.atkT = clamp(1 - e.modeT / 0.45, 0, 1); turn(e, Math.atan2(dx, dz), 10, dt); move(g, e, -nz * e.strafe * 0.3, nx * e.strafe * 0.3, d.speed, dt, 8);
    if (!e.atkDone && e.atkT >= 0.5) { e.atkDone = true; g.enemyShoot(e); }
    if (e.modeT <= 0) { e.mode = 'walk'; e.atkT = -1; } return;
  }
  if (e.painT > 0) { move(g, e, 0, 0, 0, dt, 18); return; }
  e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe = rand() < 0.5 ? -1 : 1; e.strafeT = 1.2 + rand() * 2; }
  let ox: number, oz: number;
  if (e.los && dist < d.range) {
    const ideal = d.range * 0.5; let radial = 0; if (dist < ideal * 0.6) radial = -1; else if (dist > ideal * 1.3) radial = 0.7;
    ox = nx * radial - nz * e.strafe * 0.8; oz = nz * radial + nx * e.strafe * 0.8; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    if (e.atkCD <= 0) { e.mode = 'windup'; e.modeT = 0.45; e.atkDone = false; e.atkCD = d.rate * (0.8 + rand() * 0.5); e.atkT = 0; }
  } else [ox, oz] = steer(g, e, dx, dz, dist);
  move(g, e, ox, oz, d.speed, dt); turn(e, e.los ? Math.atan2(dx, dz) : Math.atan2(ox, oz), 6, dt);
}

function leaper(g: Game, e: Enemy, dt: number, dx: number, dz: number, dist: number, _dy: number) {
  const d = e.def; const p = g.player;
  if (e.mode === 'leap') {
    e.vy -= 26 * dt; e.pos.y += e.vy * dt; e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; if (g.resolve(e.pos, d.radius, e.pos.y)) { e.vel.x *= 0.3; e.vel.z *= 0.3; }
    if (!e.hitOnce && dist < d.radius + 0.8 && Math.abs(p.pos.y + 0.9 - (e.pos.y + d.height / 2)) < 1.5) { e.hitOnce = true; g.damagePlayer(d.dmg, e.pos); audio.play('swing', 0.6); p.vel.x += e.vel.x * 0.25; p.vel.z += e.vel.z * 0.25; }
    const fl = g.groundAt(e.pos.x, e.pos.z, e.pos.y);
    if (fl <= -900 && e.pos.y < g.lv.minFloorY - 12) { g.killEnemy(e); return; }
    if (fl > -900 && e.pos.y <= fl && e.vy < 0) { e.pos.y = fl; e.vy = 0; e.mode = 'walk'; e.atkCD = d.rate; e.vel.set(0, 0, 0); e.atkT = -1; } else e.atkT = 0.5;
    e.moveAmt = 0.4; return;
  }
  const gh = g.groundAt(e.pos.x, e.pos.z, e.pos.y); if (gh > -900) e.pos.y = gh;
  if (e.mode === 'windup') {
    e.atkT = clamp(1 - e.modeT / 0.3, 0, 1) * 0.35; turn(e, Math.atan2(dx, dz), 14, dt); move(g, e, 0, 0, 0, dt, 20);
    if (e.modeT <= 0) { const sp = clamp(dist * 1.5 + 4, 8, 17); const l = dist; e.vel.set((dx / l) * sp, 0, (dz / l) * sp); e.vy = 6 + dist * 0.2; e.mode = 'leap'; e.hitOnce = false; audio.play('roar', 0.3); }
    return;
  }
  if (e.painT > 0) { move(g, e, 0, 0, 0, dt, 18); return; }
  const [sx, sz] = steer(g, e, dx, dz, dist); move(g, e, sx, sz, d.speed, dt, 14); turn(e, e.los ? Math.atan2(dx, dz) : Math.atan2(sx, sz), 9, dt);
  if (e.los && dist > 2 && dist < d.range && e.atkCD <= 0) { e.mode = 'windup'; e.modeT = 0.3; }
  else if (e.los && dist <= 2 && e.atkCD <= 0) { e.mode = 'windup'; e.modeT = 0.2; }
}

function charger(g: Game, e: Enemy, dt: number, dx: number, dz: number, dist: number, dy: number) {
  const d = e.def; const p = g.player;
  switch (e.mode) {
    case 'cwind': {
      e.atkT = clamp(1 - e.modeT / 0.8, 0, 1) * 0.45; move(g, e, 0, 0, 0, dt, 20); turn(e, Math.atan2(dx, dz), 8, dt);
      if (e.modeT <= 0) { e.mode = 'charge'; e.modeT = 1.5; e.dirX = dx / dist; e.dirZ = dz / dist; e.hitOnce = false; e.atkT = 0.6; audio.play('roar', 0.8); }
      return;
    }
    case 'charge': {
      move(g, e, e.dirX, e.dirZ, d.speed * 3.4, dt, 30); e.yaw = Math.atan2(e.dirX, e.dirZ); e.atkT = 0.6;
      if (!e.hitOnce && dist < d.radius + 0.9 && Math.abs(dy) < 2.5) { e.hitOnce = true; g.damagePlayer(d.dmg, e.pos); p.vel.x += e.dirX * 20; p.vel.z += e.dirZ * 20; p.vel.y = 6; p.onGround = false; g.shake = 0.8; }
      if (e.modeT < 1.3 && e.moved < d.speed * 3.4 * 0.3) { e.mode = 'stun'; e.modeT = 1.1; g.shake = Math.max(g.shake, 0.5); g.particles.burst(new THREE.Vector3(e.pos.x + e.dirX * d.radius, 1, e.pos.z + e.dirZ * d.radius), 14, 0x998877, 6, 0.6, 0.2, 10); audio.play('explode', 0.3); }
      else if (e.modeT <= 0) { e.mode = 'stun'; e.modeT = 0.8; }
      return;
    }
    case 'stun': e.atkT = -1; move(g, e, 0, 0, 0, dt, 8); if (e.modeT <= 0) { e.mode = 'walk'; e.atkCD = d.rate; } return;
    case 'swing': {
      e.atkT = clamp(1 - e.modeT / 0.6, 0, 1); move(g, e, 0, 0, 0, dt, 14); turn(e, Math.atan2(dx, dz), 8, dt);
      if (!e.atkDone && e.atkT >= 0.5) { e.atkDone = true; if (dist < d.radius + 1.8 && Math.abs(dy) < 2.5) { g.damagePlayer(d.dmg * 0.6, e.pos); p.vel.x += (dx / dist) * 10; p.vel.z += (dz / dist) * 10; } }
      if (e.modeT <= 0) { e.mode = 'walk'; e.atkT = -1; } return;
    }
    default: break;
  }
  if (e.painT > 0) { move(g, e, 0, 0, 0, dt, 18); return; }
  const [sx, sz] = steer(g, e, dx, dz, dist); move(g, e, sx, sz, d.speed, dt); turn(e, e.los ? Math.atan2(dx, dz) : Math.atan2(sx, sz), 5, dt);
  if (e.los && dist < d.radius + 1.4 && e.atkCD <= 0) { e.mode = 'swing'; e.modeT = 0.6; e.atkDone = false; e.atkCD = 1; }
  else if (e.los && dist < d.range && dist > 6 && e.atkCD <= 0) { e.mode = 'cwind'; e.modeT = 0.8; e.atkCD = d.rate; audio.play('roar', 0.7); }
}

function exploder(g: Game, e: Enemy, dt: number, dx: number, dz: number, dist: number, dy: number) {
  const d = e.def; const [sx, sz] = steer(g, e, dx, dz, dist); move(g, e, sx, sz, d.speed * (e.los ? 1.2 : 1), dt, 6); turn(e, Math.atan2(dx, dz), 5, dt);
  e.atkT = dist < 7 ? clamp(1 - dist / 7, 0, 1) : -1;
  if (dist < 3 + d.radius && Math.abs(dy) < 3.6 && e.los) g.killEnemy(e);
}

// ---------------------------------------------------------------- bosses
function bossAI(g: Game, e: Enemy, dt: number, dx: number, dz: number, dist: number, dy: number) {
  const d = e.def; const p = g.player; const hpf = e.hp / e.maxHp; e.phase = hpf > 0.66 ? 1 : hpf > 0.33 ? 2 : 3;
  if (d.flying) hover(g, e, dt); else { const gh = g.groundAt(e.pos.x, e.pos.z, e.pos.y); if (gh > -900) e.pos.y = gh; }
  if (e.tauntT <= 0) { e.tauntT = 16 + rand() * 8; g.bossTaunt(e); }
  if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { g.enemyShoot(e, 1.15); e.burst--; e.burstT = 0.16; } }
  const nx = dx / dist, nz = dz / dist; const spd = d.speed * (1 + 0.15 * e.phase);
  switch (e.mode) {
    case 'windup': {
      e.atkT = clamp(1 - e.modeT / 0.7, 0, 1); turn(e, Math.atan2(dx, dz), 8, dt); move(g, e, 0, 0, 0, dt, 8);
      if (!e.atkDone && e.atkT >= 0.6) { e.atkDone = true; bossPattern(g, e); }
      if (e.modeT <= 0) { e.mode = 'walk'; e.atkT = -1; e.atkCD = Math.max(0.8, 2.4 - 0.4 * e.phase) + rand() * 0.6; } return;
    }
    case 'cwind': { e.atkT = clamp(1 - e.modeT / 0.7, 0, 1) * 0.45; move(g, e, 0, 0, 0, dt, 12); turn(e, Math.atan2(dx, dz), 8, dt); if (e.modeT <= 0) { e.mode = 'charge'; e.modeT = 1.1; e.dirX = nx; e.dirZ = nz; e.hitOnce = false; audio.play('roar', 1); } return; }
    case 'charge': {
      move(g, e, e.dirX, e.dirZ, 15, dt, 25); e.yaw = Math.atan2(e.dirX, e.dirZ); e.atkT = 0.6;
      if (!e.hitOnce && dist < d.radius + 1 && Math.abs(dy) < 3) { e.hitOnce = true; g.damagePlayer(d.dmg * 1.5, e.pos); p.vel.x += e.dirX * 22; p.vel.z += e.dirZ * 22; p.vel.y = 7; p.onGround = false; g.shake = 1; }
      if (e.modeT <= 0 || (e.modeT < 0.9 && e.moved < 4)) { e.mode = 'stun'; e.modeT = 0.7; g.shake = Math.max(g.shake, 0.6); } return;
    }
    case 'stun': e.atkT = -1; move(g, e, 0, 0, 0, dt, 8); if (e.modeT <= 0) { e.mode = 'walk'; e.atkCD = 1.2; } return;
    default: break;
  }
  e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe = rand() < 0.5 ? -1 : 1; e.strafeT = 1.5 + rand() * 2; }
  let ox: number, oz: number;
  if (e.los) { const radial = dist < 11 ? -1 : dist > 22 ? 1 : 0; ox = nx * radial - nz * e.strafe * 0.7; oz = nz * radial + nx * e.strafe * 0.7; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l; } else [ox, oz] = steer(g, e, dx, dz, dist);
  move(g, e, ox, oz, spd, dt); turn(e, Math.atan2(dx, dz), 5, dt);
  if (e.atkCD <= 0 && e.los) {
    const alive = g.enemies.filter(o => o.summoned && o.state !== 'dead').length;
    const w: [string, number][] = [['fan', 3], ['burst', 3], ['ring', e.phase >= 2 ? 2.2 : 0.6], ['summon', e.summonCD <= 0 && alive < 6 ? 3.2 : 0], ['charge', !d.flying && dist > 8 ? (e.phase >= 2 ? 2.4 : 1) : 0]];
    let t = rand() * w.reduce((s, x) => s + x[1], 0); let pick = 'fan'; for (const [k, v] of w) { t -= v; if (t <= 0) { pick = k; break; } }
    e.pattern = pick; if (pick === 'charge') { e.mode = 'cwind'; e.modeT = 0.7; } else { e.mode = 'windup'; e.modeT = 0.7; e.atkDone = false; e.atkT = 0; }
  }
}
function bossPattern(g: Game, e: Enemy) {
  const d = e.def; const p = g.player; const pd = d.proj!; const o = new THREE.Vector3(e.pos.x, e.pos.y + d.height * 0.7, e.pos.z);
  const dir = new THREE.Vector3(p.pos.x - o.x, p.pos.y + 1.1 - o.y, p.pos.z - o.z).normalize();
  switch (e.pattern) {
    case 'fan': { const n = 5 + 2 * e.phase; for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.14; const c = Math.cos(a), s = Math.sin(a); const dd = new THREE.Vector3(dir.x * c - dir.z * s, dir.y, dir.x * s + dir.z * c).normalize(); g.fireProj(o, dd, pd, d.dmg, true); } audio.play('enemyBig', 0.8); break; }
    case 'ring': { const n = 14 + 4 * e.phase; const off = rand() * 6.28; for (let i = 0; i < n; i++) { const a = off + (i / n) * 6.283; g.fireProj(new THREE.Vector3(e.pos.x, e.pos.y + 1.2, e.pos.z), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), { ...pd, speed: 13, size: 0.24 }, d.dmg * 0.9, true); } audio.play('enemyBig', 1); break; }
    case 'burst': e.burst = 3 + e.phase; e.burstT = 0; break;
    case 'summon': g.bossSummon(e); e.summonCD = 13; break;
    default: break;
  }
}
