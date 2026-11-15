import * as THREE from 'three';

export interface AnimIn {
  t: number; recoil: number; cycle: number; reload: number; pumpAnim: number; pumps: number; loaded: boolean;
  spin: number; charge: number; firing: boolean; ammo: number; ammoFrac: number; shots: number; fan: boolean;
  mag: number; ads: number;
}
export interface WeaponModel { group: THREE.Group; muzzle: THREE.Object3D; update: (dt: number, a: AnimIn) => void; offset: [number, number, number] }

const M = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: e });
const G = (c: number, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const STEEL = 0x6a707a, DARK = 0x2a2d34, WOOD = 0x7a4a22, BRASS = 0xd0a838;
const SIC_DARK = 0x1b2029, SIC_PLATE = 0x333c4b, SIC_JOINT = 0x4e5b6e, SIC_GLOW = 0x28e8ff;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ss = (a: number, b: number, v: number) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function box(p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; p.add(o); return o;
}
/** cylinder along Z, front (rf) toward -Z */
function cyl(p: THREE.Object3D, r: number, len: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 10, rf = r): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rf, r, len, seg); g.rotateX(-Math.PI / 2);
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o;
}
function tor(p: THREE.Object3D, R: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 14): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.TorusGeometry(R, r, 6, seg), m); o.position.set(x, y, z); p.add(o); return o;
}
function sph(p: THREE.Object3D, r: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 8): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg - 2), m); o.position.set(x, y, z); p.add(o); return o;
}

/** Silicon Carbide humanoid chassis hand & forearm for Ptolemy (digital consciousness in a SiC shell) */
function hand(parent: THREE.Object3D, side: 1 | -1): THREE.Group {
  const h = new THREE.Group();
  const sic = M(SIC_DARK, 0x05080d), plate = M(SIC_PLATE), joint = M(SIC_JOINT), neon = G(SIC_GLOW);
  // slim ceramic palm (no more Minecraft slab!)
  box(h, 0.058, 0.04, 0.066, sic, 0, 0, 0.004);
  box(h, 0.05, 0.01, 0.056, plate, 0, 0.024, 0.0);            // dorsal armor plate
  box(h, 0.052, 0.008, 0.01, neon, 0, 0.012, -0.03);          // conduit seam
  // three articulated fingers: proximal + distal segments with ball-joint knuckles
  for (let f = 0; f < 3; f++) {
    const fx = (f - 1) * 0.019;
    const kn = sph(h, 0.0085, joint, fx, -0.004, -0.034, 6);
    void kn;
    const p1 = box(h, 0.013, 0.013, 0.03, plate, fx, -0.01, -0.046); p1.rotation.x = 0.5;
    const p2 = box(h, 0.011, 0.011, 0.026, sic, fx, -0.024, -0.058); p2.rotation.x = 1.0;
    box(h, 0.0115, 0.004, 0.006, neon, fx, -0.002, -0.036);
  }
  // articulated thumb
  const t1 = box(h, 0.014, 0.013, 0.03, plate, 0.036 * side, -0.002, -0.018); t1.rotation.set(0.3, -0.5 * side, 0);
  const t2 = box(h, 0.012, 0.011, 0.024, sic, 0.042 * side, -0.014, -0.034); t2.rotation.set(0.7, -0.4 * side, 0);
  // machined wrist collar + piston tendons
  box(h, 0.064, 0.052, 0.024, joint, 0, -0.002, 0.046);
  box(h, 0.066, 0.008, 0.008, neon, 0, 0.024, 0.046);
  for (let f = 0; f < 3; f++) cyl(h, 0.0035, 0.05, joint, (f - 1) * 0.018, 0.02, 0.02, 5);
  // tapered SiC forearm: segmented armor shells angled down & away from the sight picture
  const arm = new THREE.Group(); arm.position.set(0.004 * side, -0.055, 0.3); arm.rotation.set(0.34, -0.05 * side, 0);
  box(arm, 0.07, 0.062, 0.3, sic, 0, 0, 0.1);
  box(arm, 0.06, 0.014, 0.28, plate, 0, 0.036, 0.1);
  box(arm, 0.074, 0.05, 0.05, joint, 0, 0, -0.02);
  box(arm, 0.008, 0.01, 0.26, neon, -0.03 * side, 0.034, 0.1);
  box(arm, 0.076, 0.066, 0.26, sic, 0, -0.006, 0.42);
  box(arm, 0.064, 0.014, 0.24, plate, 0, 0.03, 0.42);
  h.add(arm);
  parent.add(h); return h;
}

let tpCrateTex: THREE.CanvasTexture | null = null;
function twinPeaksCrateTexture(): THREE.CanvasTexture {
  if (tpCrateTex) return tpCrateTex;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d')!;
  // Olive drab metal ammo crate
  g.fillStyle = '#3f4f32'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#252e1d'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  // Metal ribs
  g.fillStyle = '#2d3924'; g.fillRect(0, 22, 128, 5); g.fillRect(0, 102, 128, 5);
  // Twin Peaks emblem panel
  g.fillStyle = '#142038'; g.fillRect(14, 34, 100, 62);
  g.strokeStyle = '#e8c448'; g.lineWidth = 2; g.strokeRect(14, 34, 100, 62);
  // West & East Spanish Peaks silhouette
  g.fillStyle = '#5c4b42';
  g.beginPath(); g.moveTo(16, 94); g.lineTo(44, 42); g.lineTo(66, 74); g.lineTo(88, 48); g.lineTo(112, 94); g.closePath(); g.fill();
  // Snowcaps
  g.fillStyle = '#eef4ff';
  g.beginPath(); g.moveTo(44, 42); g.lineTo(36, 56); g.lineTo(44, 53); g.lineTo(52, 56); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(88, 48); g.lineTo(81, 60); g.lineTo(88, 58); g.lineTo(95, 60); g.closePath(); g.fill();
  // Stencil lettering
  g.fillStyle = '#f5d256'; g.font = 'bold 13px monospace'; g.textAlign = 'center';
  g.fillText('TWIN PEAKS', 64, 19);
  g.fillStyle = '#e8e0c0'; g.font = 'bold 10px monospace';
  g.fillText('7.62 MM · BELT', 64, 119);
  tpCrateTex = new THREE.CanvasTexture(cv); tpCrateTex.magFilter = THREE.NearestFilter; tpCrateTex.colorSpace = THREE.SRGBColorSpace;
  return tpCrateTex;
}

export function buildWeaponModel(id: string): WeaponModel {
  const g = new THREE.Group(); const root = new THREE.Group(); g.add(root);
  const muzzle = new THREE.Object3D(); root.add(muzzle);
  let update: WeaponModel['update'] = () => {}; let offset: [number, number, number] = [0.2, -0.2, -0.45];
  const steel = M(STEEL), dark = M(DARK), wood = M(WOOD), brass = M(BRASS, 0x201800);
  const R = hand(root, 1), Lh = hand(root, -1);

  switch (id) {
    case 'revolver': {
      box(root, 0.07, 0.1, 0.28, steel, 0, 0, -0.1); box(root, 0.05, 0.03, 0.22, dark, 0, 0.06, -0.12);
      const grip = box(root, 0.06, 0.17, 0.07, wood, 0, -0.12, 0.06, -0.35); box(grip, 0.064, 0.05, 0.05, G(0x30e0d0), 0, 0.02, 0);
      cyl(root, 0.025, 0.42, steel, 0, 0.03, -0.42); box(root, 0.02, 0.014, 0.4, dark, 0, 0.065, -0.42); box(root, 0.012, 0.03, 0.012, brass, 0, 0.075, -0.62);
      box(root, 0.02, 0.012, 0.1, brass, 0, -0.06, -0.02); tor(root, 0.04, 0.006, brass, 0, -0.09, 0.0, 8).rotation.x = Math.PI / 2;
      const drumPivot = new THREE.Group(); drumPivot.position.set(0.035, -0.02, -0.1); root.add(drumPivot);
      const drum = new THREE.Group(); drum.position.set(-0.035, 0.03, 0); drumPivot.add(drum);
      cyl(drum, 0.052, 0.13, dark, 0, 0, 0, 12);
      const shells: THREE.Group[] = [];
      const copper = M(0xc87438);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const cx = Math.cos(a) * 0.033, cy = Math.sin(a) * 0.033;
        cyl(drum, 0.013, 0.135, M(0x111111), cx, cy, 0, 6);
        const sg = new THREE.Group(); sg.position.set(cx, cy, 0); drum.add(sg);
        cyl(sg, 0.009, 0.11, brass, 0, 0, 0.015, 7);
        cyl(sg, 0.0115, 0.014, brass, 0, 0, 0.072, 7); // rim
        cyl(sg, 0.0085, 0.025, copper, 0, 0, -0.05, 6, 0.004); // bullet tip
        shells.push(sg);
      }
      // Ejected falling brass casings (separate from drum so they tumble down cleanly when cylinder swings out!)
      const dropGroup = new THREE.Group(); dropGroup.position.set(0.08, 0.01, -0.03); root.add(dropGroup);
      const fallingBrass = Array.from({ length: 6 }, (_, i) => {
        const b = new THREE.Group();
        cyl(b, 0.01, 0.095, brass, 0, 0, 0, 7);
        cyl(b, 0.012, 0.012, brass, 0, 0, 0.05, 7);
        b.visible = false;
        dropGroup.add(b);
        return { m: b, ox: ((i % 3) - 1) * 0.024, oy: (Math.floor(i / 3) - 0.5) * 0.024, vx: 0.12 + (i % 3) * 0.05, vz: 0.08 + (i % 2) * 0.06, rx: 10 + i * 3, rz: 8 - i * 2 };
      });
      const hammer = new THREE.Group(); hammer.position.set(0, 0.06, 0.04); root.add(hammer); box(hammer, 0.02, 0.055, 0.025, steel, 0, 0.025, 0.01);
      muzzle.position.set(0, 0.03, -0.64);
      let drumT = 0, wasReload = false, spentOnReload = 6;
      update = (dt, a) => {
        const rel = a.reload;
        if (rel >= 0 && !wasReload) spentOnReload = Math.max(1, 6 - a.mag);
        wasReload = rel >= 0;
        const swingOut = rel >= 0 ? ss(0.0, 0.16, rel) * (1 - ss(0.84, 0.98, rel)) : 0;
        const fanK = a.fan ? 1 : 0;
        root.rotation.x = a.recoil * 0.32 + swingOut * 0.38;
        root.position.z = a.recoil * 0.07;
        root.rotation.z = -0.58 * swingOut + (fanK ? Math.sin(a.t * 30) * 0.03 : 0);
        hammer.rotation.x = -0.95 * ss(0.15, 0.6, a.cycle) * (a.fan ? 0.4 : 1) + (fanK ? Math.sin(a.t * 40) * 0.3 : 0);
        drumT = lerp(drumT, a.shots * Math.PI / 3 + (rel >= 0 ? rel * 3 * Math.PI : 0), Math.min(1, dt * 18));
        drum.rotation.z = drumT;
        drumPivot.rotation.z = -1.25 * swingOut;
        drumPivot.position.x = 0.035 + 0.055 * swingOut;

        // Chamber shells + falling brass
        const reloadIn = rel >= 0 ? ss(0.60, 0.82, rel) : 1;
        shells.forEach((sg, i) => {
          const isSpent = i < spentOnReload;
          if (rel < 0) {
            sg.visible = true; sg.position.z = 0;
          } else if (isSpent) {
            if (rel < 0.22) { sg.visible = true; sg.position.z = ss(0.14, 0.22, rel) * 0.07; }
            else if (rel >= 0.60) { sg.visible = true; sg.position.z = (1 - reloadIn) * 0.14; }
            else sg.visible = false;
          } else {
            sg.visible = true; sg.position.z = 0;
          }
        });
        fallingBrass.forEach((fb, i) => {
          const active = rel >= 0.18 && rel < 0.65 && i < spentOnReload;
          fb.m.visible = active;
          if (active) {
            const ft = cl((rel - 0.18 - i * 0.018) / 0.42);
            fb.m.position.set(fb.ox + fb.vx * ft, fb.oy - 0.1 * ft - 1.35 * ft * ft, fb.vz * ft + 0.04);
            fb.m.rotation.set(ft * fb.rx, ft * 4, ft * fb.rz);
          }
        });

        R.position.set(0, -0.12, 0.1); R.rotation.set(-0.35, 0, 0);
        const fx = fanK ? Math.sin(a.t * 36) : 0;
        Lh.position.set(lerp(-0.045 + fx * 0.02, 0.13, swingOut), lerp(-0.18 + Math.abs(fx) * 0.12, -0.04, swingOut), lerp(0.14 - Math.abs(fx) * 0.12, -0.05, swingOut));
        Lh.rotation.set(-0.3, 0.3, 0.2);
      };
      offset = [0.2, -0.2, -0.5]; break;
    }
    case 'powerline': {
      // Daisy Powerline 880: sleek receiver, NO scope, clean front & rear iron sights, hinged under-lever pump!
      box(root, 0.068, 0.088, 0.32, M(0x1d2230), 0, 0.008, -0.04);
      box(root, 0.072, 0.01, 0.30, M(0x2d3548), 0, 0.054, -0.04);
      // Barrel & front shrouded sight
      cyl(root, 0.02, 0.82, M(0x283650), 0, 0.036, -0.59, 12);
      cyl(root, 0.015, 0.08, dark, 0, 0.036, -1.01, 8);
      // Compression tube below barrel
      const tubeMat = G(0x3aa0ff, 0.55); cyl(root, 0.025, 0.52, tubeMat, 0, -0.018, -0.45, 10);
      const bandMats = [0, 1, 2].map(() => G(0x2060a0)); bandMats.forEach((bm, i) => cyl(root, 0.031, 0.018, bm, 0, -0.018, -0.28 - i * 0.16, 10));
      cyl(root, 0.028, 0.035, brass, 0, -0.018, -0.71, 10); cyl(root, 0.028, 0.025, brass, 0, -0.018, -0.19, 10);
      // Rear V-notch iron sight (no scope!)
      const rearSight = new THREE.Group(); rearSight.position.set(0, 0.064, -0.14); root.add(rearSight);
      box(rearSight, 0.032, 0.008, 0.036, dark, 0, 0, 0);
      box(rearSight, 0.010, 0.020, 0.009, dark, -0.012, 0.012, -0.012);
      box(rearSight, 0.010, 0.020, 0.009, dark, 0.012, 0.012, -0.012);
      box(rearSight, 0.0045, 0.0045, 0.004, G(0xdff8ff), -0.011, 0.015, -0.006);
      box(rearSight, 0.0045, 0.0045, 0.004, G(0xdff8ff), 0.011, 0.015, -0.006);
      // Front ramp + bright orange/amber iron sight blade
      const frontSight = new THREE.Group(); frontSight.position.set(0, 0.056, -0.97); root.add(frontSight);
      box(frontSight, 0.016, 0.010, 0.04, dark, 0, 0, 0);
      box(frontSight, 0.006, 0.022, 0.016, dark, 0, 0.013, -0.005);
      box(frontSight, 0.0065, 0.011, 0.010, G(0xff7a22), 0, 0.023, -0.004); // glowing front post bead framed cleanly in rear notch!
      // Hinged Under-Lever Pump (pivots down from front barrel band)
      const leverPivot = new THREE.Group(); leverPivot.position.set(0, -0.032, -0.69); root.add(leverPivot);
      box(leverPivot, 0.066, 0.052, 0.42, wood, 0, -0.022, 0.24);
      for (let i = 0; i < 6; i++) box(leverPivot, 0.07, 0.054, 0.008, M(0x3a2410), 0, -0.022, 0.1 + i * 0.055);
      box(leverPivot, 0.022, 0.014, 0.34, steel, 0, 0.006, 0.20, 0.12); // steel pump linkage bar
      // Wood stock & grip
      const stock = box(root, 0.058, 0.12, 0.38, wood, 0, -0.05, 0.36, 0.08);
      box(stock, 0.061, 0.122, 0.03, M(0xd02828), 0, 0, -0.14);
      box(stock, 0.062, 0.122, 0.014, M(0xf0f0f0), 0, 0, -0.17);
      box(stock, 0.068, 0.13, 0.04, dark, 0, 0, 0.19);
      box(root, 0.048, 0.13, 0.06, wood, 0, -0.1, 0.12, -0.3);
      // Compact side-mounted pressure bar on left receiver (stays completely out of iron-sight view!)
      const pBars: THREE.Mesh[] = [];
      box(root, 0.008, 0.032, 0.15, dark, -0.036, 0.02, -0.05);
      for (let i = 0; i < 10; i++) pBars.push(box(root, 0.006, 0.018, 0.01, G(0x305060), -0.04, 0.02, -0.11 + i * 0.013));
      const led = G(0x44ff66); box(root, 0.01, 0.012, 0.016, led, -0.038, 0.042, -0.13);
      // Bolt + lead pellet
      const bolt = new THREE.Group(); bolt.position.set(0.042, 0.026, -0.04); root.add(bolt);
      box(bolt, 0.022, 0.028, 0.14, steel, -0.01, 0, 0);
      cyl(bolt, 0.007, 0.065, steel, 0.038, 0, 0.05, 6).rotation.y = Math.PI / 2;
      sph(bolt, 0.018, brass, 0.072, 0, 0.05, 8);
      const pellet = sph(root, 0.013, M(0x9a9aa4), 0, 0, 0, 8); pellet.visible = false;
      muzzle.position.set(0, 0.036, -1.06);
      const tmp = new THREE.Color();
      update = (_dt, a) => {
        const f = cl(a.pumps / 10);
        const swing = a.pumpAnim < 1 ? Math.sin(a.pumpAnim * Math.PI) : 0;
        // Hinged lever swings downward & forward (+rotation.x moves +Z toward -Y)
        leverPivot.rotation.x = swing * 1.15;
        tubeMat.opacity = 0.35 + f * 0.55; tubeMat.color.setHex(0x1a60c0).lerp(tmp.setHex(0xaaf0ff), f);
        bandMats.forEach((bm, i) => bm.color.setHex(0x182848).lerp(tmp.setHex(0x40d0ff), f > (i + 1) / 3.5 ? 1 : f * 0.5));
        pBars.forEach((pb, i) => {
          const lit = i < a.pumps;
          (pb.material as THREE.MeshBasicMaterial).color.setHex(lit ? (i < 2 ? 0xff9040 : i < 6 ? 0x40e8ff : 0x60ff80) : 0x202630);
        });
        led.color.setHex(a.loaded ? 0x44ff66 : 0xff3322);
        const rel = a.reload; const rk = rel >= 0 ? rel : 0; let boltPull = 0, handK = 0, pelK = -1;
        if (rel >= 0) { boltPull = ss(0, 0.08, rk) * (1 - ss(0.82, 0.92, rk)); handK = ss(0.05, 0.2, rk) * (1 - ss(0.78, 0.92, rk)); pelK = rk; }
        bolt.position.z = -0.04 + boltPull * 0.15;
        root.rotation.x = a.recoil * 0.24 + swing * 0.08 + (rel >= 0 ? 0.14 * Math.sin(rk * Math.PI) : 0);
        root.position.z = a.recoil * 0.11;
        root.rotation.z = rel >= 0 ? -0.22 * Math.sin(rk * Math.PI) : 0;
        R.position.set(0, -0.11, 0.12); R.rotation.set(-0.3, 0, 0);
        // Left hand tracks the swinging pump lever or reaches up to load pellet
        const leverAng = swing * 1.15;
        const armR = 0.31;
        const ly = -0.054 - Math.sin(leverAng) * armR;
        const lz = -0.69 + Math.cos(leverAng) * armR;
        Lh.position.set(lerp(0, 0.14, handK), lerp(ly - 0.02, -0.12, handK), lerp(lz, 0.02, handK));
        Lh.rotation.set(-0.15 - leverAng * 0.45 * (1 - handK), lerp(0, -0.5, handK), 0);
        if (pelK >= 0 && pelK > 0.12 && pelK < 0.8) {
          pellet.visible = true; const pk = ss(0.12, 0.35, pelK); const ins = ss(0.7, 0.8, pelK);
          pellet.position.set(lerp(0.14 * pk + 0.01, 0.045, ins), lerp(-0.1, 0.03, ins), lerp(0.0, -0.05, ins));
        } else pellet.visible = false;
      };
      offset = [0.2, -0.2, -0.38]; break;
    }
    case 'scatter': {
      box(root, 0.085, 0.1, 0.3, M(0x3a2a24), 0, 0, 0); box(root, 0.03, 0.02, 0.2, M(0xe87a3a, 0x201000), 0, 0.055, 0);
      cyl(root, 0.034, 0.62, steel, 0, 0.035, -0.46, 12); cyl(root, 0.022, 0.5, dark, 0, -0.025, -0.42, 10);
      const choke = cyl(root, 0.042, 0.035, G(0xff7a20), 0, 0.035, -0.77, 12);
      cyl(root, 0.025, 0.03, brass, 0, -0.025, -0.68, 8); box(root, 0.01, 0.025, 0.01, brass, 0, 0.08, -0.7);
      const forend = new THREE.Group(); root.add(forend); box(forend, 0.095, 0.075, 0.22, wood, 0, -0.045, 0); for (let i = 0; i < 4; i++) box(forend, 0.099, 0.077, 0.01, M(0x3a2410), 0, -0.045, -0.08 + i * 0.05);
      box(root, 0.06, 0.1, 0.3, wood, 0, -0.045, 0.27, 0.12); box(root, 0.05, 0.13, 0.06, wood, 0, -0.1, 0.1, -0.3);
      for (let i = 0; i < 4; i++) cyl(root, 0.011, 0.04, M(0xc82818), 0.05, 0.0, 0.1 + i * 0.045, 6).rotation.z = Math.PI / 2;
      const shell = cyl(root, 0.014, 0.05, M(0xc82818), 0.05, 0.03, 0, 6); shell.visible = false;
      muzzle.position.set(0, 0.035, -0.82);
      update = (_dt, a) => {
        const pk = ss(0.12, 0.45, a.cycle) * (1 - ss(0.5, 0.88, a.cycle)); const sl = a.cycle < 1 ? pk * 0.17 : 0;
        forend.position.set(0, 0, -0.38 + sl); root.rotation.x = a.recoil * 0.3 + pk * 0.04; root.position.z = a.recoil * 0.1; root.position.y = -pk * 0.01;
        (choke.material as THREE.MeshBasicMaterial).color.setHex(0xff7a20).lerp(new THREE.Color(0xffffcc), cl(a.recoil));
        R.position.set(0, -0.12, 0.1); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.1, -0.38 + sl); Lh.rotation.set(-0.1, 0, 0);
        shell.visible = a.cycle > 0.25 && a.cycle < 0.6; if (shell.visible) { const e = (a.cycle - 0.25) / 0.35; shell.position.set(0.06 + e * 0.12, 0.04 + Math.sin(e * Math.PI) * 0.1, 0.02 + e * 0.15); shell.rotation.set(e * 8, e * 5, 0); }
      };
      offset = [0.2, -0.2, -0.38]; break;
    }
    case 'chaingun': {
      // Main receiver + clean top cooling shroud (mountains removed from top!)
      box(root, 0.12, 0.12, 0.3, M(0x30343c), 0, 0, -0.04);
      box(root, 0.045, 0.02, 0.2, M(0xf0d060, 0x201800), 0, 0.07, -0.03);
      box(root, 0.09, 0.024, 0.22, dark, 0, 0.074, -0.05); // sleek carry rail / vent shroud
      for (let i = 0; i < 4; i++) box(root, 0.096, 0.012, 0.02, steel, 0, 0.088, -0.12 + i * 0.05);
      // 6 spinning barrels
      const bar = new THREE.Group(); bar.position.set(0, 0, -0.4); root.add(bar); const heat = M(0x555a64, 0x000000);
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; cyl(bar, 0.013, 0.56, heat, Math.cos(an) * 0.04, Math.sin(an) * 0.04, 0, 6); }
      for (const z of [-0.25, 0, 0.2]) tor(bar, 0.045, 0.012, steel, 0, 0, z, 10);
      cyl(root, 0.065, 0.04, brass, 0, 0, -0.5, 12); cyl(root, 0.05, 0.1, dark, 0, 0, -0.18, 10);
      // Side ammo box with Twin Peaks decal clearly visible on top & side!
      const crateMat = new THREE.MeshLambertMaterial({ map: twinPeaksCrateTexture(), flatShading: true });
      box(root, 0.115, 0.12, 0.16, crateMat, -0.112, -0.048, -0.02);
      box(root, 0.118, 0.018, 0.162, M(0xd8c040), -0.112, -0.095, -0.02);
      // Animated linked cartridge belt feeding from ammo crate up into breech
      const beltGroup = new THREE.Group(); root.add(beltGroup);
      const beltCount = 10;
      const copperTip = M(0xc87438);
      const beltRounds = Array.from({ length: beltCount }, () => {
        const rg = new THREE.Group();
        cyl(rg, 0.0065, 0.036, brass, 0, 0, 0, 6);
        cyl(rg, 0.006, 0.018, copperTip, 0, 0, -0.026, 6, 0.0015);
        box(rg, 0.015, 0.005, 0.012, dark, 0, 0.005, 0.004);
        beltGroup.add(rg);
        return rg;
      });
      box(root, 0.045, 0.12, 0.05, dark, 0, -0.1, 0.1, -0.2); box(root, 0.04, 0.1, 0.04, dark, 0, -0.1, -0.24); box(root, 0.06, 0.04, 0.24, dark, 0, -0.08, -0.1);
      muzzle.position.set(0, 0, -0.74); let ang = 0, beltPhase = 0;
      update = (dt, a) => {
        ang += (0.5 + a.spin * 30) * dt * (a.spin > 0.02 ? 1 : 0); bar.rotation.z = ang;
        const j = a.firing ? a.spin : 0; root.position.set((Math.random() - 0.5) * 0.006 * j, (Math.random() - 0.5) * 0.006 * j, a.recoil * 0.035 + j * 0.015); root.rotation.x = a.recoil * 0.08;
        heat.emissive.setRGB(a.spin * 0.7, a.spin * 0.18, 0);
        // Advance linked belt from side ammo box (-0.11, -0.01, -0.03) curving into receiver (-0.045, 0.015, -0.05)
        if (a.firing) beltPhase = (beltPhase + dt * (8 + a.spin * 16)) % 1;
        else if (a.spin > 0.15) beltPhase = (beltPhase + dt * a.spin * 2) % 1;
        beltRounds.forEach((rg, i) => {
          const u = ((i + beltPhase) / beltCount);
          // arc from crate mouth to receiver feed chute
          const bx = lerp(-0.115, -0.042, u);
          const by = lerp(-0.008, 0.018, u) + Math.sin(u * Math.PI) * 0.026 + (a.firing ? Math.sin(a.t * 45 + i) * 0.002 : 0);
          const bz = lerp(-0.01, -0.05, u);
          rg.position.set(bx, by, bz);
          rg.rotation.z = lerp(0.55, -0.2, u);
          rg.visible = a.ammo > 0;
        });
        R.position.set(0, -0.11, 0.1); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.14, -0.24); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.2, -0.2, -0.38]; break;
    }
    case 'rivet': {
      box(root, 0.1, 0.12, 0.32, M(0xe0801c), 0, 0, -0.02); for (let i = 0; i < 4; i++) box(root, 0.102, 0.122, 0.025, dark, 0, 0, -0.12 + i * 0.07);
      const hop = box(root, 0.074, 0.082, 0.21, G(0xffd8a0, 0.28), 0, 0.1, -0.05);
      // Randomly floating glowing particles inside the translucent hopper box that speed up on fire & decay smoothly
      const pCount = 18;
      const pGeo = new THREE.BoxGeometry(0.009, 0.009, 0.012);
      const hopperParts = Array.from({ length: pCount }, (_, i) => {
        const col = i % 3 === 0 ? 0xffdf70 : i % 3 === 1 ? 0xff9a28 : 0xff6218;
        const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: col }));
        hop.add(m);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const spd = 0.028 + Math.random() * 0.032;
        return {
          m,
          px: (Math.random() - 0.5) * 0.052,
          py: (Math.random() - 0.5) * 0.06,
          pz: (Math.random() - 0.5) * 0.17,
          vx: dir.x * spd, vy: dir.y * spd, vz: dir.z * spd,
        };
      });
      const tank = cyl(root, 0.04, 0.22, M(0x8a909a), 0, -0.08, -0.15, 10); tor(tank, 0.041, 0.006, brass, 0, 0, 0.0, 8);
      const pistons = [-1, 1].map(s => cyl(root, 0.014, 0.22, steel, s * 0.028, 0.025, -0.15, 8));
      [-1, 1].forEach(s => cyl(root, 0.018, 0.34, dark, s * 0.028, 0.025, -0.4, 8)); box(root, 0.1, 0.06, 0.06, dark, 0, 0.02, -0.6);
      [-1, 1].forEach(s => box(root, 0.01, 0.02, 0.012, G(0xff9020), s * 0.028, 0.02, -0.635));
      box(root, 0.05, 0.13, 0.06, dark, 0, -0.12, 0.1, -0.25); box(root, 0.04, 0.1, 0.04, dark, 0, -0.1, -0.28);
      muzzle.position.set(0, 0.02, -0.66);
      let agitation = 1;
      update = (dt, a) => {
        pistons.forEach((p, i) => { const act = (a.shots % 2 === i) ? a.recoil : 0; p.position.z = -0.15 + act * 0.07; });
        const shooting = a.firing || a.recoil > 0.12;
        agitation = lerp(agitation, shooting ? 9.5 : 1.0, Math.min(1, dt * (shooting ? 8 : 1.6)));
        const limX = 0.028, limY = 0.032, limZ = 0.09;
        hopperParts.forEach((hp, i) => {
          hp.m.visible = i / pCount < a.ammoFrac + 0.06 && a.ammo > 0;
          hp.px += hp.vx * agitation * dt; hp.py += hp.vy * agitation * dt; hp.pz += hp.vz * agitation * dt;
          if (hp.px > limX || hp.px < -limX) { hp.px = cl(hp.px, -limX, limX); hp.vx = -hp.vx + (Math.random() - 0.5) * 0.01; }
          if (hp.py > limY || hp.py < -limY) { hp.py = cl(hp.py, -limY, limY); hp.vy = -hp.vy + (Math.random() - 0.5) * 0.01; }
          if (hp.pz > limZ || hp.pz < -limZ) { hp.pz = cl(hp.pz, -limZ, limZ); hp.vz = -hp.vz + (Math.random() - 0.5) * 0.01; }
          hp.m.position.set(hp.px, hp.py, hp.pz);
          hp.m.rotation.x += dt * agitation * 1.8; hp.m.rotation.y += dt * agitation * 1.4;
        });
        root.position.z = a.recoil * 0.03; root.position.x = a.firing ? Math.sin(a.t * 60) * 0.002 : 0; root.rotation.x = a.recoil * 0.07; tank.rotation.z = a.t * 0.4;
        R.position.set(0, -0.12, 0.1); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.13, -0.28); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.2, -0.2, -0.38]; break;
    }
    case 'thumper': {
      const tube = new THREE.Group(); root.add(tube); cyl(tube, 0.058, 0.5, M(0x3a3e32), 0, 0.03, -0.33, 12); cyl(tube, 0.07, 0.05, brass, 0, 0.03, -0.6, 12); cyl(tube, 0.065, 0.02, dark, 0, 0.03, -0.35, 12);
      const coils: THREE.Mesh[] = []; for (let i = 0; i < 6; i++) coils.push(tor(tube, 0.065, 0.007, M(0xb0b0b8), 0, 0.03, -0.12 - i * 0.045, 8));
      box(root, 0.11, 0.13, 0.22, M(0x4a5040), 0, -0.01, 0.1); box(root, 0.04, 0.03, 0.14, M(0x7ad050, 0x103000), 0, 0.07, 0.1);
      const drum = new THREE.Group(); drum.position.set(0, -0.045, -0.05); drum.scale.setScalar(1.18); root.add(drum); cyl(drum, 0.085, 0.1, dark, 0, 0, 0, 12);
      const rearRing = tor(drum, 0.085, 0.012, brass, 0, 0, 0.07, 14); void rearRing;
      const drumRounds: THREE.Group[] = [];
      for (let i = 0; i < 6; i++) {
        const an = i / 6 * Math.PI * 2; const rg = new THREE.Group(); rg.position.set(Math.cos(an) * 0.054, Math.sin(an) * 0.054, 0); drum.add(rg);
        cyl(rg, 0.023, 0.15, M(0x2c3138), 0, 0, 0, 8);                                   // steel grenade body
        cyl(rg, 0.0245, 0.02, G(0x51ff62), 0, 0, -0.045, 8);                             // glowing green band
        cyl(rg, 0.0245, 0.016, G(0x51ff62), 0, 0, 0.028, 8);                             // second glow band
        sph(rg, 0.02, M(0x39543a), 0, 0, -0.082, 7);                                    // rounded nose
        cyl(rg, 0.021, 0.026, brass, 0, 0, 0.082, 8);                                    // brass base / primer — the BACK of the round, proud of the drum
        cyl(rg, 0.008, 0.01, G(0xd8ffe0), 0, 0, 0.098, 6);                              // primer cap dot
        drumRounds.push(rg);
      }
      const lamp = new THREE.Group(); lamp.position.set(0, 0.115, -0.16); root.add(lamp); cyl(lamp, 0.025, 0.05, dark, 0, 0, 0, 8); const bulb = sph(lamp, 0.022, G(0xffe08a), 0, 0.005, -0.03, 8);
      box(root, 0.012, 0.02, 0.014, M(0xe0e0e0), 0, 0.105, -0.58);
      box(root, 0.02, 0.02, 0.2, dark, 0.04, -0.06, 0.28, -0.1); box(root, 0.02, 0.02, 0.2, dark, -0.04, -0.06, 0.28, -0.1); box(root, 0.1, 0.1, 0.03, dark, 0, -0.04, 0.39);
      box(root, 0.05, 0.13, 0.06, dark, 0, -0.13, 0.12, -0.3); box(root, 0.045, 0.1, 0.045, dark, 0, -0.1, -0.24);
      muzzle.position.set(0, 0.03, -0.65); let dr = 0;
      update = (dt, a) => {
        dr = lerp(dr, a.shots * Math.PI / 3, Math.min(1, dt * 10)); drum.rotation.z = dr; drumRounds.forEach((r, i) => { r.visible = i < Math.min(6, a.ammo); }); tube.position.z = a.recoil * 0.1; coils.forEach((c, i) => { c.position.z = -0.12 - i * (0.045 - a.recoil * 0.025); });
        root.rotation.x = a.recoil * 0.4; root.position.z = a.recoil * 0.06; (bulb.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(a.t * 30) > 0.2 ? 0xffe08a : 0xffc050);
        R.position.set(0, -0.14, 0.13); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.13, -0.24); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.2, -0.21, -0.4]; break;
    }
    case 'arc': {
      box(root, 0.085, 0.1, 0.22, M(0x20262c), 0, -0.04, 0.06); box(root, 0.035, 0.025, 0.18, M(0x50e8ff, 0x104050), 0, 0.02, 0.06);
      const glass = G(0x50e8ff, 0.28); cyl(root, 0.04, 0.55, glass, 0, 0.03, -0.36, 12);
      const core = G(0xaaffff); cyl(root, 0.014, 0.62, core, 0, 0.03, -0.38, 6);
      const rings: THREE.Mesh[] = []; const copper = M(0xc87a3a, 0x201000); for (const z of [-0.14, -0.28, -0.42, -0.56]) rings.push(tor(root, 0.058, 0.011, copper, 0, 0.03, z, 12));
      const prongs: THREE.Vector3[] = [];
      for (let i = 0; i < 3; i++) {
        const an = i / 3 * Math.PI * 2 + 0.5;
        cyl(root, 0.012, 0.12, copper, Math.cos(an) * 0.055, 0.03 + Math.sin(an) * 0.055, -0.68, 6, 0.004);
        prongs.push(new THREE.Vector3(Math.cos(an) * 0.055, 0.03 + Math.sin(an) * 0.055, -0.74));
      }
      const cells: THREE.Mesh[] = []; for (let i = 0; i < 5; i++) cells.push(box(root, 0.03, 0.03, 0.025, G(0x50e8ff), 0.055, 0, i * 0.035, 0));
      box(root, 0.045, 0.12, 0.05, dark, 0, -0.12, 0.12, -0.2);
      const arcMat = new THREE.LineBasicMaterial({ color: 0xc8ffff }); const arcs = prongs.map(() => { const geo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, () => new THREE.Vector3())); const l = new THREE.Line(geo, arcMat); l.frustumCulled = false; root.add(l); return l; });
      muzzle.position.set(0, 0.03, -0.78); const tip = new THREE.Vector3(0, 0.03, -0.78);
      update = (dt, a) => {
        const f = a.firing ? 1 : 0; rings.forEach((r, i) => { r.rotation.z += dt * (1 + f * 12) * (i % 2 ? -1 : 1); r.scale.setScalar(1 + (f ? Math.sin(a.t * 40 + i) * 0.08 : 0)); });
        core.color.setHex(0x70e0ff).lerp(new THREE.Color(0xffffff), f * (0.5 + Math.sin(a.t * 50) * 0.5)); glass.opacity = 0.25 + f * 0.3;
        cells.forEach((c, i) => { c.visible = i / 5 < a.ammoFrac + 0.01; c.position.set(0.055, -0.02, 0.14 - i * 0.045); });
        arcs.forEach((l, k) => { l.visible = !!f; if (!f) return; const pos = l.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < 6; i++) { const t = i / 5; const sx = prongs[k].x * (1 - t) + tip.x * t, sy = prongs[k].y * (1 - t) + tip.y * t, sz = prongs[k].z * (1 - t) + tip.z * t; const j = i === 0 || i === 5 ? 0 : 0.022; pos.setXYZ(i, sx + (Math.random() - 0.5) * j, sy + (Math.random() - 0.5) * j, sz + (Math.random() - 0.5) * j); } pos.needsUpdate = true; });
        root.position.set((Math.random() - 0.5) * 0.004 * f, (Math.random() - 0.5) * 0.004 * f, 0); root.rotation.x = a.recoil * 0.05;
        R.position.set(0, -0.12, 0.12); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.1, -0.15); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.2, -0.2, -0.4]; break;
    }
    case 'rocket': {
      box(root, 0.13, 0.15, 0.24, M(0x3a3a42), 0, 0, 0.04); box(root, 0.05, 0.03, 0.16, M(0xff6a30, 0x301000), 0, 0.085, 0.04);
      const tubes = new THREE.Group(); tubes.position.set(0, 0.0, -0.36); root.add(tubes);
      const rk: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) { const an = i / 4 * Math.PI * 2 + Math.PI / 4; const x = Math.cos(an) * 0.058, y = Math.sin(an) * 0.058; cyl(tubes, 0.04, 0.62, M(0x50545e), x, y, 0, 10); cyl(tubes, 0.043, 0.03, brass, x, y, -0.3, 10); rk.push(cyl(tubes, 0.034, 0.08, M(i === 0 ? 0xfff2cc : 0xff6a20, 0x602000), x, y, -0.3, 8, 0.002)); cyl(tubes, 0.025, 0.02, M(0x101010), x, y, 0.31, 8); }
      cyl(tubes, 0.03, 0.5, dark, 0, 0, 0, 8); tor(tubes, 0.075, 0.013, steel, 0, 0, -0.1, 10); tor(tubes, 0.075, 0.013, steel, 0, 0, 0.14, 10);
      const sun = new THREE.Group(); sun.position.set(0.069, 0.01, 0.04); sun.rotation.y = Math.PI / 2; root.add(sun); cyl(sun, 0.035, 0.01, G(0xff9a30), 0, 0, 0, 12); for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; box(sun, 0.01, 0.03, 0.008, G(0xffd060), Math.cos(an) * 0.05, Math.sin(an) * 0.05, 0).rotation.z = an - Math.PI / 2; }
      // low iron post sight (no scope — this gun doesn't zoom)
      box(root, 0.012, 0.035, 0.012, dark, 0, 0.115, -0.16); box(root, 0.006, 0.012, 0.006, G(0xff5030), 0, 0.128, -0.16);
      // Quake-2-style reciprocating slide under the barrel cluster
      const slide = new THREE.Group(); slide.position.set(0, -0.105, -0.28); root.add(slide);
      box(slide, 0.1, 0.055, 0.34, M(0x484e5a), 0, 0, 0);
      for (let i = 0; i < 4; i++) box(slide, 0.104, 0.02, 0.03, dark, 0, -0.01, -0.12 + i * 0.08);
      box(slide, 0.11, 0.03, 0.06, brass, 0, 0.03, 0.14);
      box(root, 0.05, 0.14, 0.06, dark, 0, -0.13, 0.12, -0.25); box(root, 0.045, 0.11, 0.045, dark, 0, -0.11, -0.2);
      muzzle.position.set(0, 0, -0.72); let rot = 0;
      update = (dt, a) => {
        rot = lerp(rot, a.shots * Math.PI / 2, Math.min(1, dt * 14)); tubes.rotation.z = rot; sun.rotation.x += dt * 2;
        const sl = a.cycle < 1 ? Math.sin(cl(a.cycle / 0.6) * Math.PI) * 0.17 : 0; slide.position.z = -0.28 + sl; slide.position.y = -0.105 - sl * 0.12;
        root.rotation.x = a.recoil * 0.35; root.position.z = a.recoil * 0.1; root.position.y = -a.recoil * 0.02; rk.forEach(r => { r.scale.setScalar(1 + Math.sin(a.t * 8) * 0.04); });
        R.position.set(0, -0.14, 0.13); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.12, -0.2); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.2, -0.22, -0.42]; break;
    }
    case 'rail': {
      box(root, 0.1, 0.12, 0.3, M(0x2a3040), 0, 0, 0.06); box(root, 0.04, 0.02, 0.2, M(0x8aa8ff, 0x101830), 0, 0.07, 0.06);
      const rails = [-1, 1].map(s => box(root, 0.026, 0.045, 0.75, M(0x9aa4b8), s * 0.04, 0.02, -0.38)); const coreM = G(0xc0e0ff); cyl(root, 0.01, 0.62, coreM, 0, 0.02, -0.4, 6);
      const capM: THREE.MeshBasicMaterial[] = []; const caps: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) { const m = G(0x4070ff); capM.push(m); const c = tor(root, 0.058, 0.01, m, 0, 0.02, -0.14 - i * 0.12, 12); caps.push(c); }
      [-1, 1].forEach(s => cyl(root, 0.03, 0.2, M(0x3a4260), s * 0.07, -0.01, 0.04, 10)); const glowC = [-1, 1].map(s => cyl(root, 0.022, 0.1, G(0x4070ff), s * 0.07, -0.01, 0.0, 8));
      cyl(root, 0.014, 0.16, dark, 0, 0.1, 0.02, 8); sph(root, 0.014, G(0x80ffff), 0, 0.1, -0.07, 8);
      for (let i = 0; i < 4; i++) box(root, 0.11, 0.006, 0.06, steel, 0, i * 0.012 - 0.01, 0.22);
      box(root, 0.05, 0.13, 0.06, dark, 0, -0.12, 0.12, -0.25); box(root, 0.045, 0.1, 0.045, dark, 0, -0.1, -0.2);
      muzzle.position.set(0, 0.02, -0.78); const tc = new THREE.Color();
      update = (_dt, a) => {
        const c = cl(a.charge); rails.forEach((r, i) => { r.position.x = (i ? 1 : -1) * (0.04 + c * 0.012) + (c > 0 ? (Math.random() - 0.5) * 0.003 : 0); });
        capM.forEach((m, i) => m.color.setHex(0x1a2a60).lerp(tc.setHex(0xe0f0ff), c > i / 5 ? 1 : 0.1)); coreM.color.setHex(0x6080c0).lerp(tc.setHex(0xffffff), c);
        caps.forEach((cc, i) => { cc.position.z = -0.14 - i * (0.12 + c * 0.015) - a.recoil * 0.02 * i; cc.scale.setScalar(1 + a.recoil * 0.2); });
        glowC.forEach(gc => (gc.material as THREE.MeshBasicMaterial).color.setHex(0x3050c0).lerp(tc.setHex(0xaaccff), c));
        root.rotation.x = a.recoil * 0.3; root.position.z = a.recoil * 0.12 + c * 0.01; root.position.x = c > 0.05 ? (Math.random() - 0.5) * 0.004 * c : 0;
        R.position.set(0, -0.13, 0.13); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.11, -0.2); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.2, -0.2, -0.4]; break;
    }
    case 'vector': {
      const hull = M(0x23232f, 0x0a0a12); const hull2 = M(0x33334a); const mag = G(0xe060ff);
      // sleeker tapered hull: hexagonal prism, wider at the rear, rounded shoulder plates
      const bodyPrism = cyl(root, 0.085, 0.46, hull, 0, -0.01, -0.16, 6, 0.055); bodyPrism.scale.set(1.25, 0.82, 1); bodyPrism.rotation.z = Math.PI / 6;
      box(root, 0.15, 0.03, 0.3, hull2, 0, 0.075, -0.12);
      for (const sd of [-1, 1]) { const rail = box(root, 0.02, 0.07, 0.34, mag, sd * 0.095, -0.01, -0.2); rail.rotation.z = sd * 0.1; const fin = box(root, 0.012, 0.12, 0.2, hull2, sd * 0.1, -0.09, 0.08); fin.rotation.z = sd * 0.35; }
      const nose = cyl(root, 0.062, 0.1, hull2, 0, 0, -0.44, 12, 0.05); void nose;
      // ---- glass containment canister on top, singularity inside
      const can = new THREE.Group(); can.position.set(0, 0.155, -0.14); root.add(can);
      const glassMat = G(0xbfe8ff, 0.22); const glassTube = cyl(can, 0.052, 0.3, glassMat, 0, 0, 0, 14); void glassTube;
      for (const cz of [-0.15, 0.15]) tor(can, 0.054, 0.011, brass, 0, 0, cz, 14);
      box(root, 0.05, 0.05, 0.06, hull2, 0, 0.1, -0.26); box(root, 0.05, 0.05, 0.06, hull2, 0, 0.1, -0.02);
      const singCore = sph(can, 0.034, G(0x000000), 0, 0, 0, 12);
      const singGlow = sph(can, 0.052, G(0xd060ff, 0.4), 0, 0, 0, 10);
      const canRings = [tor(can, 0.042, 0.005, G(0xffffff), 0, 0, 0, 16), tor(can, 0.038, 0.005, mag, 0, 0, 0, 16)]; canRings[1].rotation.x = 1.2;
      // ---- five free-floating prongs (not attached to the chassis)
      const prongRing = new THREE.Group(); prongRing.position.set(0, 0, -0.52); root.add(prongRing);
      const prongTips: THREE.Vector3[] = []; const prongGroups: THREE.Group[] = [];
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * Math.PI * 2 + 0.3; const pg = new THREE.Group(); pg.position.set(Math.cos(an) * 0.085, Math.sin(an) * 0.085, 0); prongRing.add(pg);
        const pr = cyl(pg, 0.0035, 0.34, i % 2 ? mag : G(0xff90ff), 0, 0, -0.19, 6, 0.013); void pr;
        box(pg, 0.02, 0.02, 0.05, hull2, 0, 0, -0.01);
        prongGroups.push(pg); prongTips.push(new THREE.Vector3(Math.cos(an) * 0.085, Math.sin(an) * 0.085, -0.9));
      }
      const focal = sph(root, 0.02, G(0xffffff), 0, 0, -1.06, 8); focal.visible = false;
      const rayMat = new THREE.LineBasicMaterial({ color: 0xf3c8ff, transparent: true, opacity: 0.95 });
      const rays = prongTips.map(() => { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.06)]); const l = new THREE.Line(geo, rayMat); l.frustumCulled = false; l.visible = false; root.add(l); return l; });
      // grips, cells, rear spine
      box(root, 0.055, 0.14, 0.06, hull, 0, -0.15, 0.1, -0.25); box(root, 0.045, 0.1, 0.045, hull, 0, -0.11, -0.16);
      const cells: THREE.Mesh[] = []; for (let i = 0; i < 8; i++) cells.push(box(root, 0.013, 0.018, 0.018, G(0xe060ff), -0.06 + i * 0.017, 0.1, 0.1));
      muzzle.position.set(0, 0, -1.1); const tc = new THREE.Color();
      let openK = 0;
      update = (dt, a) => {
        const f = a.firing ? 1 : 0; openK = lerp(openK, f, Math.min(1, dt * 9));
        if (!f) prongRing.rotation.z += dt * 0.9;                       // slow idle rotation…
        // …which stops dead as the prongs splay open to fire
        prongGroups.forEach((pg, i) => { const an = (i / 5) * Math.PI * 2 + 0.3; const r = 0.085 + openK * 0.04; pg.position.set(Math.cos(an) * r, Math.sin(an) * r, 0); pg.rotation.set(Math.sin(an) * openK * 0.42, -Math.cos(an) * openK * 0.42, 0); });
        canRings[0].rotation.x += dt * (2 + f * 8); canRings[0].rotation.y += dt * 1.4; canRings[1].rotation.y -= dt * (1.6 + f * 6);
        const pulse = 1 + Math.sin(a.t * 6) * 0.08 + f * 0.45 * Math.sin(a.t * 40); singCore.scale.setScalar(pulse + f * 0.5); singGlow.scale.setScalar(1 + f * 0.8 + Math.sin(a.t * 9) * 0.1);
        (singGlow.material as THREE.MeshBasicMaterial).color.setHex(0xd060ff).lerp(tc.setHex(0xffffff), f * 0.5);
        focal.visible = f > 0; focal.scale.setScalar(0.6 + openK * (1 + Math.sin(a.t * 34) * 0.25));
        rays.forEach((l, i) => { l.visible = openK > 0.25; if (!l.visible) return; const an = (i / 5) * Math.PI * 2 + 0.3 + prongRing.rotation.z; const r = 0.085 + openK * 0.04; const tip = new THREE.Vector3(Math.cos(an) * r, Math.sin(an) * r, -0.9); const pos = l.geometry.attributes.position as THREE.BufferAttribute; pos.setXYZ(0, tip.x, tip.y, tip.z); pos.setXYZ(1, (Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008, -1.06); pos.needsUpdate = true; });
        cells.forEach((c, i) => { (c.material as THREE.MeshBasicMaterial).color.setHex(i < a.ammo ? 0xe060ff : 0x221830); });
        root.position.set((Math.random() - 0.5) * 0.012 * f, (Math.random() - 0.5) * 0.012 * f, a.recoil * 0.1 + f * 0.04); root.rotation.x = a.recoil * 0.2;
        R.position.set(0, -0.15, 0.12); R.rotation.set(-0.3, 0, 0); Lh.position.set(0, -0.12, -0.18); Lh.rotation.set(-0.1, 0, 0);
      };
      offset = [0.16, -0.23, -0.52]; break;
    }
    default: break;
  }
  g.userData.id = id;
  return { group: g, muzzle, update, offset };
}
