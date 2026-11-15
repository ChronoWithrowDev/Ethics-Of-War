import * as THREE from 'three';
import type { Look } from './data';

export interface CState { t: number; move: number; attack: number; flash: number; dead: number; seed: number }
export interface CreatureModel { group: THREE.Group; update: (dt: number, s: CState) => void; dispose: () => void }

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; }
const gbox = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const gsph = (r: number, s = 10) => geo(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, s - 3));
const gcone = (r: number, h: number, s = 6) => geo(`c${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const gdod = (r: number) => geo(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0));
const gico = (r: number) => geo(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0));
const goct = (r: number) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const gtor = (R: number, r: number) => geo(`t${R},${r}`, () => new THREE.TorusGeometry(R, r, 6, 18));
const gcyl = (r1: number, r2: number, h: number, s = 8) => geo(`y${r1},${r2},${h},${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));

const NATURAL: Record<string, number> = { biped: 2.25, beast: 1.2, crawler: 0.6, floater: 1.0, golem: 2.5 };
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ss = (a: number, b: number, v: number) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export function buildCreature(look: Look, height: number, ranged: boolean): CreatureModel {
  const group = new THREE.Group(); const rig = new THREE.Group(); group.add(rig);
  const body = new THREE.MeshLambertMaterial({ color: look.color, flatShading: true });
  const accent = new THREE.MeshLambertMaterial({ color: look.accent, flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ color: look.glow });
  const mats = [body, accent, glow]; const extraMats: THREE.Material[] = [];
  const add = (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o; };
  const has = (e: string) => look.extras.includes(e);
  const nat = NATURAL[look.kind]; rig.scale.setScalar(height / nat);
  const b = look.bulk ?? 1; const wb = Math.sqrt(b);
  let kindUpdate: (dt: number, s: CState) => void = () => {};
  const glowM = (c: number, o = 0.5) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }); extraMats.push(m); return m; };
  const auraOrbs: THREE.Object3D[] = []; let auraMesh: THREE.Mesh | null = null; let centerY = nat / 2; let capeRef: THREE.Mesh | null = null;

  if (look.kind === 'biped') {
    centerY = 1.1;
    const legs = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.17 * wb, 0.95, 0); rig.add(g); add(g, gbox(0.2 * wb, 0.95, 0.22 * wb), body, 0, -0.475, 0); add(g, gbox(0.23 * wb, 0.12, 0.36 * wb), accent, 0, -0.9, 0.07); return g; });
    const torso = new THREE.Group(); torso.position.y = 0.95; rig.add(torso);
    add(torso, gbox(0.62 * b, 0.78, 0.38 * wb), body, 0, 0.42, 0); add(torso, gbox(0.5 * b, 0.4, 0.06), accent, 0, 0.5, 0.2 * wb);
    add(torso, gbox(0.66 * b, 0.12, 0.4 * wb), accent, 0, 0.06, 0);
    const head = new THREE.Group(); head.position.set(0, 0.85, 0); torso.add(head); add(head, gbox(0.34, 0.34, 0.34), body, 0, 0.2, 0);
    const helmet = has('helmet');
    if (helmet) { add(head, gbox(0.4, 0.2, 0.4), accent, 0, 0.3, 0); add(head, gbox(0.34, 0.09, 0.03), glow, 0, 0.2, 0.18); add(head, gbox(0.06, 0.2, 0.3), accent, 0, 0.42, 0); }
    else { add(head, gbox(0.075, 0.05, 0.03), glow, -0.08, 0.22, 0.175); add(head, gbox(0.075, 0.05, 0.03), glow, 0.08, 0.22, 0.175); }
    if (has('hollow')) { add(torso, gbox(0.22, 0.26, 0.05), glow, 0, 0.5, 0.2 * wb + 0.01); add(torso, gbox(0.64 * b, 0.08, 0.4 * wb), accent, 0, 0.7, 0); }
    if (has('hat')) { add(head, gcyl(0.34, 0.34, 0.03, 10), accent, 0, 0.4, 0); add(head, gcyl(0.17, 0.2, 0.2, 10), accent, 0, 0.5, 0); add(head, gcyl(0.2, 0.2, 0.04, 10), body, 0, 0.44, 0); }
    if (has('hair')) { add(head, gbox(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: 0xd8d8e0, flatShading: true }), 0, 0.4, -0.03); add(head, gbox(0.3, 0.1, 0.12), new THREE.MeshLambertMaterial({ color: 0xe8e8f0, flatShading: true }), 0, 0.47, 0.1); }
    if (has('crown')) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(head, gcone(0.045, 0.2, 4), new THREE.MeshBasicMaterial({ color: look.glow }), Math.cos(a) * 0.17, 0.5, Math.sin(a) * 0.17); }
    if (has('tie')) { add(torso, gbox(0.2, 0.55, 0.03), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 0, 0.45, 0.2 * wb + 0.01); add(torso, gbox(0.07, 0.42, 0.03), accent, 0, 0.42, 0.2 * wb + 0.03); }
    if (has('spikes')) for (let i = 0; i < 4; i++) add(torso, gcone(0.06, 0.25, 4), accent, (i - 1.5) * 0.14, 0.78, -0.2).rotation.x = -0.5;
    if (has('cape')) capeRef = add(torso, gbox(0.7 * b, 1.35, 0.04), accent, 0, 0.1, -0.24 * wb);
    if (has('jets')) for (const s of [-1, 1]) { const j = add(torso, gcone(0.1, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xff9a30 }), s * 0.22, 0.2, -0.38); j.rotation.x = Math.PI; }
    if (has('ice')) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const c = add(torso, gcone(0.08, 0.4 + i * 0.12, 5), new THREE.MeshLambertMaterial({ color: look.glow, flatShading: true, emissive: look.glow, emissiveIntensity: 0.4 }), s * (0.36 * b + 0.08 + i * 0.07), 0.9 + i * 0.1, 0); c.rotation.z = -s * (0.4 + i * 0.4); }
    const arms = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(s * (0.38 * b + 0.12), 0.72, 0); torso.add(g);
      add(g, gbox(0.17 * wb, 0.78, 0.17 * wb), body, 0, -0.36, 0); add(g, gbox(0.2 * wb, 0.17, 0.2 * wb), accent, 0, -0.8, 0);
      if (has('shoulders')) { add(g, gbox(0.3 * wb, 0.16, 0.3 * wb), accent, 0, 0.1, 0); if (look.scale > 1.5) add(g, gcone(0.06, 0.2, 4), accent, 0, 0.26, 0); }
      if (has('cannon') && s === 1) { const c = add(g, gcyl(0.11, 0.09, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0x2a2d34, flatShading: true }), 0, -0.85, 0.3); c.rotation.x = Math.PI / 2; add(g, gcyl(0.07, 0.07, 0.03, 8), glow, 0, -0.85, 0.66).rotation.x = Math.PI / 2; }
      return g;
    });
    // ---- per-planet silhouettes so humanoids stop reading as recolors
    const propMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47, flatShading: true }); const woodMat = new THREE.MeshLambertMaterial({ color: 0x6a4526, flatShading: true }); extraMats.push(propMat, woodMat);
    if (has('flannel')) { for (let i = 0; i < 3; i++) add(torso, gbox(0.1, 0.62, 0.02), i % 2 ? body : accent, (i - 1) * 0.17, 0.45, 0.21 * wb); add(torso, gbox(0.52 * b, 0.08, 0.02), accent, 0, 0.3, 0.21 * wb); }
    if (has('coat')) { const skirt = add(torso, gcyl(0.34 * wb, 0.46 * wb, 0.6, 8), body, 0, -0.12, 0); skirt.scale.z = 0.72; }
    if (has('armor')) { add(torso, gbox(0.56 * b, 0.5, 0.08), accent, 0, 0.48, 0.2 * wb); add(torso, gbox(0.2, 0.2, 0.04), glow, 0, 0.5, 0.25 * wb); }
    if (has('hazsuit')) { add(torso, gbox(0.4, 0.5, 0.34), accent, 0, 0.42, -0.3); for (const sx of [-1, 1]) add(torso, gcyl(0.09, 0.09, 0.42, 7), body, sx * 0.13, 0.48, -0.34); add(torso, gbox(0.24, 0.14, 0.03), glow, 0, 0.55, 0.21 * wb); }
    if (has('scarf')) { const sc = add(head, gtor(0.2, 0.055), accent, 0, 0.02, 0); sc.rotation.x = Math.PI / 2; add(torso, gbox(0.12, 0.4, 0.03), accent, 0.1, 0.62, 0.2 * wb); }
    if (has('robe')) { const skirt = add(torso, gcyl(0.36 * wb, 0.55 * wb, 0.75, 8), accent, 0, -0.16, 0); skirt.scale.z = 0.78; }
    if (has('cloak')) capeRef = add(torso, gbox(0.6 * b, 1.1, 0.04), accent, 0, 0.2, -0.23 * wb);
    if (has('cryotank')) { for (const sx of [-1, 1]) add(torso, gcyl(0.1, 0.1, 0.5, 7), accent, sx * 0.15, 0.5, -0.32); const tube = add(torso, gtor(0.3, 0.03), body, 0, 0.72, -0.3); tube.rotation.y = 0.4; }
    if (has('diver')) { const helm = add(head, gsph(0.27, 10), new THREE.MeshLambertMaterial({ color: look.accent, flatShading: true, transparent: true, opacity: 0.55 }), 0, 0.22, 0.02); extraMats.push(helm.material as THREE.Material); for (const sx of [-1, 1]) add(torso, gcyl(0.09, 0.09, 0.44, 7), accent, sx * 0.14, 0.5, -0.33); }
    if (has('crystalarm')) for (const s2 of [-1, 1]) { add(arms[s2 < 0 ? 0 : 1], gcone(0.07, 0.34, 5), new THREE.MeshBasicMaterial({ color: look.glow }), s2 * 0.05, -0.45, 0.05).rotation.z = -s2 * 0.5; add(arms[s2 < 0 ? 0 : 1], gcone(0.05, 0.24, 5), new THREE.MeshBasicMaterial({ color: look.glow }), s2 * 0.09, -0.7, 0.02).rotation.z = -s2 * 0.9; }
    // ---- signature held weapons (they swing / aim with the attack animation)
    const PROP_KINDS = ['pitchfork', 'revolverprop', 'rifle', 'longrifle', 'carbine', 'wrench', 'iceaxe', 'shardstaff', 'harpoon', 'scythe', 'spear'];
    const propKind = PROP_KINDS.find(pp => has(pp)) || '';
    const prop = new THREE.Group(); prop.position.set(0, -0.82, 0.06); arms[1].add(prop);
    const shaft = (len: number, mat: THREE.Material = woodMat) => { const c = add(prop, gcyl(0.022, 0.026, len, 6), mat, 0, 0, len / 2); c.rotation.x = Math.PI / 2; return c; };
    const gunProp = (len: number, stock = 0.22) => { add(prop, gbox(0.05, 0.08, len * 0.55), propMat, 0, 0.01, len * 0.28); const br = add(prop, gcyl(0.016, 0.016, len * 0.6, 6), propMat, 0, 0.04, len * 0.62); br.rotation.x = Math.PI / 2; add(prop, gbox(0.045, 0.1, stock), woodMat, 0, -0.03, -0.05); add(prop, gbox(0.02, 0.05, 0.02), glow, 0, 0.09, len * 0.85); };
    if (propKind === 'pitchfork') { shaft(1.25); add(prop, gbox(0.3, 0.03, 0.05), propMat, 0, 0, 1.25); for (const px of [-0.12, 0, 0.12]) { const pr = add(prop, gcone(0.016, 0.22, 4), propMat, px, 0, 1.38); pr.rotation.x = Math.PI / 2; } }
    else if (propKind === 'revolverprop') gunProp(0.42, 0.1);
    else if (propKind === 'rifle') gunProp(0.95);
    else if (propKind === 'longrifle') gunProp(1.3, 0.3);
    else if (propKind === 'carbine') gunProp(0.8, 0.18);
    else if (propKind === 'wrench') { shaft(0.5, propMat); add(prop, gbox(0.16, 0.16, 0.07), propMat, 0, 0.03, 0.55); add(prop, gbox(0.07, 0.08, 0.08), glow, 0, 0.03, 0.56); }
    else if (propKind === 'iceaxe') { shaft(0.62, propMat); const pick = add(prop, gcone(0.035, 0.42, 5), new THREE.MeshBasicMaterial({ color: look.glow }), 0, 0.1, 0.62); pick.rotation.z = 1.9; add(prop, gbox(0.05, 0.12, 0.05), propMat, 0, 0, 0.62); }
    else if (propKind === 'shardstaff') { shaft(1.35, propMat); add(prop, goct(0.11), new THREE.MeshBasicMaterial({ color: look.glow }), 0, 0, 1.45); add(prop, gtor(0.16, 0.018), accent, 0, 0, 1.45); }
    else if (propKind === 'harpoon') { shaft(1.3); const tip = add(prop, gcone(0.035, 0.3, 5), propMat, 0, 0, 1.42); tip.rotation.x = Math.PI / 2; const barb = add(prop, gcone(0.025, 0.14, 4), propMat, 0.05, 0, 1.3); barb.rotation.z = -0.8; }
    else if (propKind === 'scythe') { shaft(1.35); const blade = add(prop, gbox(0.03, 0.14, 0.8), propMat, 0, 0.16, 1.55); blade.rotation.y = 0.25; add(prop, gbox(0.035, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: look.glow }), 0, 0.2, 1.85); }
    else if (propKind === 'spear') { shaft(1.45, propMat); const tip = add(prop, gcone(0.045, 0.34, 5), new THREE.MeshBasicMaterial({ color: look.glow }), 0, 0, 1.6); tip.rotation.x = Math.PI / 2; }
    prop.visible = !!propKind;
    kindUpdate = (_dt, s) => {
      const w = Math.sin(s.t * (6 + s.move * 4)) * 0.75 * s.move; legs[0].rotation.x = w; legs[1].rotation.x = -w;
      const idle = Math.sin(s.t * 2 + s.seed) * 0.03; torso.rotation.z = Math.sin(s.t * (6 + s.move * 4)) * 0.04 * s.move; torso.position.y = 0.95 + Math.abs(Math.sin(s.t * (6 + s.move * 4))) * 0.03 * s.move + idle * 0.3;
      let aL = -w * 0.8, aR = w * 0.8; const att = s.attack; let twR = -0.08, twL = 0.08, torsoYaw = 0;
      if (att >= 0) {
        if (ranged) { const e = ss(0, 0.2, att) * (1 - ss(0.8, 1, att)); aR = -1.45 * e + aR * (1 - e); aL = -0.9 * e + aL * (1 - e); if (att > 0.5 && att < 0.6) aR -= 0.2; head.rotation.x = -0.1 * e; if (propKind === 'longrifle') { aL = -1.2 * e; twR = -0.04; } if (propKind === 'carbine') aR = -1.25 * e; }
        else {
          const up = ss(0, 0.45, att), dn = ss(0.45, 0.62, att), back = ss(0.75, 1, att); const strike = dn * (1 - back);
          const a = -2.6 * up + 3.6 * strike; aR = a; aL = a * 0.9; torso.rotation.x = 0.35 * strike;
          if (propKind === 'pitchfork' || propKind === 'harpoon' || propKind === 'spear') { aR = aL = -0.4 - 1.25 * strike; torso.rotation.x = 0.42 * strike; torsoYaw = 0; } // two-handed thrust
          else if (propKind === 'wrench' || propKind === 'iceaxe') { aR = -2.9 * up + 3.4 * strike; twR = -0.55 * strike; torsoYaw = 0.35 * strike; torso.rotation.x = 0.3 * strike; } // diagonal chop
          else if (propKind === 'scythe') { aR = -1.1 - 0.5 * strike; aL = -0.7 - 0.5 * strike; twR = -1.5 * strike + 0.5 * up; twL = -1.1 * strike; torsoYaw = -0.85 * strike + 0.3 * up; torso.rotation.x = 0.12 * strike; } // wide reaping sweep
          else if (propKind === 'shardstaff') { aR = -2.2 * up + 2.4 * strike; aL = -1.4 * up + 1.4 * strike; torsoYaw = -0.3 * strike; }
        }
      } else { torso.rotation.x = 0; if (propKind === 'scythe') { twR = -0.5; twL = 0.35; } if (propKind === 'shardstaff' || propKind === 'spear') { aR = -0.35; aL = -0.15; } }
      torso.rotation.y = torsoYaw;
      arms[0].rotation.x = aL; arms[1].rotation.x = aR; arms[0].rotation.z = twL; arms[1].rotation.z = twR;
      prop.rotation.x = propKind === 'pitchfork' || propKind === 'harpoon' || propKind === 'spear' ? -0.12 : 0;
      if (capeRef) capeRef.rotation.x = 0.15 + Math.sin(s.t * 3) * 0.05 + s.move * 0.25;
      if (s.dead >= 0) { const d = ss(0, 1, s.dead); rig.rotation.x = -d * 1.55; rig.position.y = -d * 0.05; arms[0].rotation.x = -1 * d; arms[1].rotation.x = -1.5 * d; legs[0].rotation.x = d * 0.3; legs[1].rotation.x = -d * 0.2; } else { rig.rotation.x = 0; rig.position.y = 0; }
    };
  } else if (look.kind === 'beast') {
    centerY = 0.62;
    const bd = new THREE.Group(); rig.add(bd);
    add(bd, gbox(0.55, 0.5, 1.1), body, 0, 0.66, 0); add(bd, gbox(0.45, 0.2, 0.7), accent, 0, 0.5, 0.05); add(bd, gbox(0.58, 0.3, 0.5), body, 0, 0.8, 0.22);
    const head = new THREE.Group(); head.position.set(0, 0.85, 0.65); bd.add(head);
    add(head, gbox(0.34, 0.32, 0.4), body, 0, 0, 0.05); add(head, gbox(0.2, 0.16, 0.24), accent, 0, -0.07, 0.3);
    add(head, gbox(0.07, 0.06, 0.03), glow, -0.1, 0.07, 0.26); add(head, gbox(0.07, 0.06, 0.03), glow, 0.1, 0.07, 0.26);
    if (has('antlers')) for (const s of [-1, 1]) { const a = add(head, gcyl(0.02, 0.03, 0.4, 5), accent, s * 0.12, 0.3, -0.02); a.rotation.z = -s * 0.35; const b2 = add(head, gcyl(0.015, 0.02, 0.22, 5), accent, s * 0.22, 0.4, 0.04); b2.rotation.z = -s * 0.9; b2.rotation.x = 0.4; }
    if (has('ears')) for (const s of [-1, 1]) { const e = add(head, gbox(0.06, 0.38, 0.05), body, s * 0.1, 0.33, -0.12); e.rotation.x = -0.4; e.rotation.z = -s * 0.15; }
    if (has('horns')) for (const s of [-1, 1]) { const h = add(head, gcone(0.07, 0.5, 5), accent, s * 0.2, 0.18, 0.06); h.rotation.z = -s * 1.1; h.rotation.x = -0.3; }
    if (has('spikes')) for (let i = 0; i < 5; i++) add(bd, gcone(0.05, 0.28, 4), accent, 0, 1.0, -0.45 + i * 0.22);
    const tail = new THREE.Group(); tail.position.set(0, 0.8, -0.55); bd.add(tail); add(tail, gbox(0.1, 0.1, 0.45), body, 0, 0, -0.2); if (has('ears')) add(tail, gsph(0.09, 8), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }), 0, 0, -0.45);
    const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const g = new THREE.Group(); g.position.set(sx * 0.21, 0.5, sz * 0.4); bd.add(g); add(g, gbox(0.15, 0.5, 0.15), body, 0, -0.25, 0); add(g, gbox(0.17, 0.08, 0.22), accent, 0, -0.48, 0.04); return g; });
    kindUpdate = (_dt, s) => {
      const f = 9 + s.move * 4; const sw = Math.sin(s.t * f) * 0.9 * s.move; legs[0].rotation.x = sw; legs[1].rotation.x = -sw; legs[2].rotation.x = -sw; legs[3].rotation.x = sw;
      bd.position.y = Math.abs(Math.sin(s.t * f)) * 0.07 * s.move; head.rotation.x = Math.sin(s.t * 2 + s.seed) * 0.06; tail.rotation.y = Math.sin(s.t * 5 + s.seed) * 0.4;
      if (s.attack >= 0) { const c = ss(0, 0.35, s.attack) * (1 - ss(0.5, 0.9, s.attack)); bd.rotation.x = -0.45 * c + 0.1; head.rotation.x = 0.5 * Math.sin(s.attack * Math.PI); legs[0].rotation.x = legs[1].rotation.x = -1.0 * ss(0.4, 0.6, s.attack); legs[2].rotation.x = legs[3].rotation.x = 0.9 * ss(0.4, 0.6, s.attack); } else bd.rotation.x = 0;
      if (s.dead >= 0) { const d = ss(0, 1, s.dead); rig.rotation.z = d * 1.5; rig.position.y = d * 0.3; legs.forEach((l, i) => { l.rotation.x = d * (i % 2 ? 0.8 : -0.6); }); } else { rig.rotation.z = 0; rig.position.y = 0; }
    };
  } else if (look.kind === 'crawler') {
    centerY = 0.3;
    add(rig, gsph(0.28, 9), body, 0, 0.32, 0.0).scale.set(1, 0.7, 1.1); const ab = add(rig, gsph(0.3, 9), accent, 0, 0.38, -0.4); ab.scale.set(0.9, 0.8, 1.2); add(rig, gsph(0.04, 6), glow, 0, 0.5, -0.38);
    const head = add(rig, gsph(0.17, 8), body, 0, 0.3, 0.32);
    [[-0.07, 0.35, 0.46], [0.07, 0.35, 0.46], [-0.11, 0.3, 0.44], [0.11, 0.3, 0.44]].forEach(([x, y, z]) => add(rig, gsph(0.032, 6), glow, x, y, z));
    for (const s of [-1, 1]) add(rig, gcone(0.025, 0.14, 4), accent, s * 0.06, 0.2, 0.48).rotation.x = Math.PI;
    const legs: { g: THREE.Group; up: THREE.Mesh; ph: number }[] = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); g.position.set(s * 0.2, 0.3, -0.2 + i * 0.17); g.rotation.y = s * (Math.PI / 2) + (i - 1.5) * 0.28 * -s; rig.add(g);
      const up = add(g, gbox(0.05, 0.05, 0.4), accent, 0, 0.1, 0.17); up.rotation.x = -0.55; const lo = add(g, gbox(0.04, 0.04, 0.45), body, 0, 0, 0.43); lo.position.set(0, 0.005, 0.43); lo.rotation.x = 1.15;
      legs.push({ g, up, ph: (i % 2 + (s > 0 ? 1 : 0)) * Math.PI });
    }
    kindUpdate = (_dt, s) => {
      const f = 16; legs.forEach(l => { const w = Math.sin(s.t * f + l.ph); l.g.rotation.y += 0; l.up.rotation.x = -0.55 - Math.max(0, w) * 0.5 * s.move + (s.move < 0.1 ? Math.sin(s.t * 2 + l.ph) * 0.05 : 0); l.g.rotation.z = w * 0.25 * s.move; });
      rig.position.y = Math.abs(Math.sin(s.t * f)) * 0.03 * s.move; head.position.z = 0.32 + (s.attack >= 0 ? Math.sin(s.attack * Math.PI) * 0.15 : 0);
      if (s.dead >= 0) { const d = ss(0, 1, s.dead); rig.rotation.z = d * Math.PI; rig.position.y = 0.55 * d; legs.forEach(l => { l.up.rotation.x = -0.55 - d * 1.2; }); } else rig.rotation.z = 0;
    };
  } else if (look.kind === 'floater') {
    centerY = 0.5;
    const bd = new THREE.Group(); bd.position.y = 0.5; rig.add(bd);
    const sp = add(bd, gsph(0.42, 12), body, 0, 0, 0); if (has('spots')) { sp.scale.set(1.2, 1.1, 1.2); for (let i = 0; i < 7; i++) { const a = i * 2.4; add(bd, gsph(0.09, 6), accent, Math.cos(a) * 0.46, Math.sin(i * 1.7) * 0.3, Math.sin(a) * 0.46); } }
    add(bd, gsph(0.2, 10), glow, 0, 0.03, 0.3); add(bd, gsph(0.08, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, 0.03, 0.46);
    add(bd, gcone(0.06, 0.2, 4), accent, 0, 0.45, 0);
    const wings: THREE.Mesh[] = [];
    if (has('fins')) for (const s of [-1, 1]) { const w = add(bd, gbox(0.5, 0.04, 0.26), accent, s * 0.55, 0.05, 0); wings.push(w); add(w, gbox(0.04, 0.05, 0.1), glow, s * 0.22, 0, 0.0); }
    const tent: THREE.Group[][] = [];
    if (has('tentacles')) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const chain: THREE.Group[] = []; let parent: THREE.Object3D = bd; let py = -0.3; const bp = new THREE.Group(); bp.position.set(Math.cos(a) * 0.22, py, Math.sin(a) * 0.22); bd.add(bp); parent = bp; for (let k = 0; k < 4; k++) { const seg = new THREE.Group(); seg.position.y = k === 0 ? 0 : -0.2; parent.add(seg); add(seg, gcone(0.06 - k * 0.012, 0.22, 5), k % 2 ? accent : body, 0, -0.1, 0).rotation.x = Math.PI; chain.push(seg); parent = seg; } tent.push(chain); }
    const ringsM: THREE.Mesh[] = []; if (has('rings')) { const r1 = add(bd, gtor(0.62, 0.025), glow, 0, 0, 0); const r2 = add(bd, gtor(0.52, 0.02), accent, 0, 0, 0); r2.rotation.x = Math.PI / 2; ringsM.push(r1, r2); }
    kindUpdate = (_dt, s) => {
      bd.position.y = 0.5 + Math.sin(s.t * 2.2 + s.seed) * 0.06; bd.rotation.z = Math.sin(s.t * 1.3 + s.seed) * 0.08 + s.move * 0.1;
      wings.forEach((w, i) => { w.rotation.z = Math.sin(s.t * 12) * 0.35 * (i ? -1 : 1); });
      tent.forEach((ch, i) => ch.forEach((seg, k) => { seg.rotation.x = Math.sin(s.t * 3 + i + k * 0.8) * 0.3; seg.rotation.z = Math.cos(s.t * 2.5 + i * 1.3 + k * 0.7) * 0.3; }));
      ringsM.forEach((r, i) => { r.rotation.y += 0.04 * (i ? -1 : 1); r.rotation.x += i ? 0.03 : 0.02; });
      const sc = s.attack >= 0 ? 1 + Math.sin(s.attack * Math.PI) * 0.18 : 1; bd.scale.setScalar(sc);
      if (s.dead >= 0) { const d = ss(0, 1, s.dead); rig.rotation.z = d * 2.5; rig.position.y = -d * 0.35; bd.scale.setScalar(1 - d * 0.5); } else { rig.rotation.z = 0; rig.position.y = 0; }
    };
  } else { // golem
    centerY = 1.25;
    const chunks: { m: THREE.Mesh; base: THREE.Vector3; dir: THREE.Vector3; ph: number }[] = [];
    const mk = (g: THREE.BufferGeometry, mt: THREE.Material, x: number, y: number, z: number) => { const m = add(rig, g, mt, x, y, z); chunks.push({ m, base: new THREE.Vector3(x, y, z), dir: new THREE.Vector3(x, 0.2, z).normalize(), ph: Math.random() * 6 }); return m; };
    const crystal = new THREE.MeshLambertMaterial({ color: look.glow, flatShading: true, emissive: look.glow, emissiveIntensity: 0.8 });
    extraMats.push(crystal);
    mk(gdod(0.42), body, 0, 1.35, 0); const core = add(rig, goct(0.26), crystal, 0, 1.38, 0.28); mk(gico(0.26), body, 0, 2.0, 0);
    add(rig, gbox(0.1, 0.06, 0.04), glow, 0.0, 2.04, 0.24);
    mk(gdod(0.24), accent, -0.62, 1.7, 0); mk(gdod(0.24), accent, 0.62, 1.7, 0);
    const armL = [mk(gico(0.2), body, -0.68, 1.15, 0.05), mk(gdod(0.26), accent, -0.7, 0.65, 0.1)];
    const armR = [mk(gico(0.2), body, 0.68, 1.15, 0.05), mk(gdod(0.26), accent, 0.7, 0.65, 0.1)];
    const legL = [mk(gdod(0.25), body, -0.27, 0.72, 0), mk(gico(0.22), accent, -0.27, 0.25, 0.05)];
    const legR = [mk(gdod(0.25), body, 0.27, 0.72, 0), mk(gico(0.22), accent, 0.27, 0.25, 0.05)];
    if (has('ring')) { const r = add(rig, gtor(1.5, 0.07), new THREE.MeshLambertMaterial({ color: look.accent, flatShading: true, emissive: look.glow, emissiveIntensity: 0.4 }), 0, 1.4, 0); r.rotation.x = Math.PI / 2.4; chunks.push({ m: r, base: new THREE.Vector3(0, 1.4, 0), dir: new THREE.Vector3(0, 1, 0), ph: 0 }); }
    kindUpdate = (_dt, s) => {
      const w = Math.sin(s.t * 5) * s.move;
      chunks.forEach((c, i) => { const d = s.dead >= 0 ? ss(0, 1, s.dead) : 0; c.m.position.set(c.base.x + c.dir.x * d * 0.9, c.base.y + Math.sin(s.t * 1.8 + c.ph) * 0.05 - d * (c.base.y - 0.2), c.base.z + c.dir.z * d * 0.9); c.m.rotation.y += 0.01 * (i % 2 ? 1 : -1); });
      armL[1].position.z = 0.1 + w * 0.25; armR[1].position.z = 0.1 - w * 0.25; legL[1].position.z = 0.05 - w * 0.3; legR[1].position.z = 0.05 + w * 0.3;
      if (s.attack >= 0 && s.dead < 0) { const up = ss(0, 0.45, s.attack), dn = ss(0.45, 0.6, s.attack); armL[1].position.y = 0.65 + 1.0 * up - 1.2 * dn; armR[1].position.y = 0.65 + 1.0 * up - 1.2 * dn; armL[1].position.z = 0.1 + dn * 0.9; armR[1].position.z = 0.1 + dn * 0.9; armL[0].position.y = armR[0].position.y = 1.15 + 0.5 * up - 0.4 * dn; }
      core.scale.setScalar(1 + Math.sin(s.t * 4) * 0.12); core.rotation.y += 0.05; core.rotation.x += 0.03;
      rig.rotation.y = 0;
    };
  }

  if (has('aura')) {
    auraMesh = add(rig, gsph(nat * 0.55, 14), glowM(look.glow, 0.1), 0, centerY, 0);
    for (let i = 0; i < 4; i++) auraOrbs.push(add(rig, gsph(0.1 * nat / 2.2, 6), new THREE.MeshBasicMaterial({ color: look.glow }), 0, centerY, 0));
  }
  const baseUpdate = kindUpdate;
  const update = (dt: number, s: CState) => {
    baseUpdate(dt, s);
    if (auraMesh) { const k = s.dead >= 0 ? 1 - s.dead : 1; auraMesh.scale.setScalar((1 + Math.sin(s.t * 3) * 0.05) * k); auraOrbs.forEach((o, i) => { const a = s.t * 1.6 + i * Math.PI / 2; o.position.set(Math.cos(a) * nat * 0.5, centerY + Math.sin(s.t * 2 + i) * nat * 0.15, Math.sin(a) * nat * 0.5); o.visible = s.dead < 0; }); }
    const f = s.flash; body.emissive.setScalar(f * 0.85); accent.emissive.setScalar(f * 0.85);
  };
  return { group, update, dispose: () => { mats.forEach(m => m.dispose()); extraMats.forEach(m => m.dispose()); } };
}
