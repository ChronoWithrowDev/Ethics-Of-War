import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PLANETS, MAP_ORDER, ENEMIES, BOSSES } from '../game/data';
import type { PlanetId } from '../game/data';
import { isUnlocked, completedCount, UNLOCK_REQ } from '../game/save';
import type { SaveData } from '../game/save';

// ---------- procedural planet textures (seamless 3D noise on a sphere)
const ih = (x: number, y: number, z: number, s: number) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; };
const sm = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function vn(x: number, y: number, z: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const c = (a: number, b: number, d: number) => ih(xi + a, yi + b, zi + d, s);
  return mix(mix(mix(c(0, 0, 0), c(1, 0, 0), xf), mix(c(0, 1, 0), c(1, 1, 0), xf), yf), mix(mix(c(0, 0, 1), c(1, 0, 1), xf), mix(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
function fbm(x: number, y: number, z: number, s: number, o = 4) { let a = 0, amp = 0.5, f = 1; for (let i = 0; i < o; i++) { a += amp * vn(x * f, y * f, z * f, s + i * 7); f *= 2; amp *= 0.5; } return a / 0.9375; }
type RGB = [number, number, number];
const lerpC = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function planetTexture(id: PlanetId): THREE.CanvasTexture {
  const W = 320, H = 160; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!; const img = g.createImageData(W, H);
  const craters: THREE.Vector3[] = []; if (id === 'moon') for (let i = 0; i < 38; i++) craters.push(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize());
  for (let py = 0; py < H; py++) {
    const lat = (0.5 - (py + 0.5) / H) * Math.PI; const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let px = 0; px < W; px++) {
      const lon = ((px + 0.5) / W) * Math.PI * 2; const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon); let c: RGB = [128, 128, 128]; const alat = Math.abs(sl);
      switch (id) {
        case 'earth': {
          const n = fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 3, 5); const land = n > 0.54;
          if (land) { const b = fbm(x * 5, y * 5, z * 5, 9, 3); c = lerpC([58, 128, 52], [150, 120, 78], clampN((b - 0.35) * 2.2)); if (alat > 0.62) c = lerpC(c, [235, 240, 245], clampN((alat - 0.62) * 5)); }
          else { c = lerpC([14, 46, 122], [40, 110, 190], clampN((n - 0.35) * 5)); if (alat > 0.86) c = [230, 238, 245]; }
          const cloud = fbm(x * 3.5 + 11, y * 5, z * 3.5, 21, 4); if (cloud > 0.57) c = lerpC(c, [255, 255, 255], clampN((cloud - 0.57) * 5)); break;
        }
        case 'moon': {
          const n = fbm(x * 4, y * 4, z * 4, 5, 5); let v = 132 + (n - 0.5) * 100;
          for (const cr of craters) { const d = Math.acos(Math.min(1, x * cr.x + y * cr.y + z * cr.z)); const r = 0.1 + (Math.abs(cr.x * 7) % 0.1); if (d < r) { v -= d > r * 0.8 ? -26 : 22 * (1 - d / r); } }
          c = [v, v, v * 1.03]; break;
        }
        case 'mars': { const n = fbm(x * 3, y * 3, z * 3, 7, 5); c = lerpC([186, 92, 52], [112, 52, 36], clampN((n - 0.4) * 2.5)); const d = fbm(x * 9, y * 9, z * 9, 13, 3); c = lerpC(c, [210, 140, 90], clampN((d - 0.55) * 2)); if (alat > 0.9) c = lerpC(c, [245, 240, 240], 0.9); break; }
        case 'jupiter': {
          const w = fbm(x * 2, y * 9, z * 2, 17, 4); const band = Math.sin(lat * 15 + w * 3.4) * 0.5 + 0.5; c = lerpC(band > 0.5 ? [236, 206, 168] : [178, 112, 70], band > 0.5 ? [250, 236, 214] : [138, 88, 58], fbm(x * 6, y * 20, z * 6, 3, 2));
          const dl = Math.atan2(z, x) - 0.6, dy = (lat + 0.32) * 3.2; const dd = (dl * dl) * 3 + dy * dy; if (dd < 0.22) c = lerpC(c, [196, 70, 40], clampN(1 - dd * 4.5)); break;
        }
        case 'saturn': { const w = fbm(x * 2, y * 8, z * 2, 19, 3); const band = Math.sin(lat * 22 + w * 2.2) * 0.5 + 0.5; c = lerpC([205, 180, 118], [238, 220, 160], band); break; }
        case 'uranus': { const band = Math.sin(lat * 10 + fbm(x * 2, y * 3, z * 2, 23, 3) * 2) * 0.5 + 0.5; c = lerpC([132, 214, 222], [168, 232, 236], band * 0.7); break; }
        case 'neptune': { const w = fbm(x * 2.5, y * 6, z * 2.5, 29, 4); c = lerpC([30, 58, 190], [70, 110, 240], w); const st = fbm(x * 4 + 5, y * 14, z * 4, 31, 3); if (st > 0.66) c = lerpC(c, [220, 235, 255], (st - 0.66) * 3); const dl = Math.atan2(z, x) - 2.2, dy = (lat + 0.25) * 3; if (dl * dl * 2 + dy * dy < 0.12) c = [16, 28, 110]; break; }
        case 'pluto': {
          const n = fbm(x * 3, y * 3, z * 3, 37, 5); c = lerpC([196, 168, 140], [120, 88, 66], clampN((n - 0.4) * 2.6));
          const hx = (Math.atan2(z, x) - 0.8) * 3.0, hy = (lat - 0.05) * 3.3 + 0.2; const hv = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * hy * hy * hy; if (hv < 0) c = lerpC(c, [238, 220, 204], 0.85); break;
        }
        default: break;
      }
      const k = (py * W + px) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const clampN = (v: number) => Math.max(0, Math.min(1, v));

interface PlanetObj { id: PlanetId; group: THREE.Group; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; glow: THREE.Mesh; hit: THREE.Mesh; r: number; hover: number; ring: THREE.Mesh; label: HTMLDivElement | null; base: THREE.Vector3 }
const LAYOUT: Record<PlanetId, { x: number; y: number; z: number; r: number }> = {
  earth: { x: -33, y: -1, z: 2, r: 2.6 }, moon: { x: -26, y: 4, z: 3, r: 1.0 }, mars: { x: -19, y: -1.5, z: 0, r: 2.0 }, jupiter: { x: -7, y: 1.5, z: -3, r: 5.4 },
  saturn: { x: 8.5, y: -1.5, z: 0, r: 3.5 }, uranus: { x: 20.5, y: 1.5, z: 0, r: 2.7 }, neptune: { x: 29.5, y: -1.2, z: 0, r: 2.6 }, pluto: { x: 37, y: 1.6, z: 2, r: 1.4 },
};

export default function StarMap({ save, onSelect, onBack }: { save: SaveData; onSelect: (id: PlanetId) => void; onBack: () => void }) {
  const mount = useRef<HTMLDivElement>(null); const [hover, setHover] = useState<PlanetId | null>(null); const hoverRef = useRef<PlanetId | null>(null); const [flash, setFlash] = useState('');
  const labels = useRef<Record<string, HTMLDivElement | null>>({}); const saveRef = useRef(save); saveRef.current = save; const selRef = useRef(onSelect); selRef.current = onSelect;

  useEffect(() => {
    const el = mount.current!; const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); el.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x01020a); const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }; resize(); const ro = new ResizeObserver(resize); ro.observe(el);
    // stars
    const sp = new Float32Array(2400 * 3), sc = new Float32Array(2400 * 3); for (let i = 0; i < 2400; i++) { const a = Math.random() * 6.283, b = Math.acos(Math.random() * 2 - 1), r = 180 + Math.random() * 60; sp[i * 3] = Math.sin(b) * Math.cos(a) * r; sp[i * 3 + 1] = Math.cos(b) * r * 0.6; sp[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r - 40; const t = 0.6 + Math.random() * 0.4; sc[i * 3] = t; sc[i * 3 + 1] = t; sc[i * 3 + 2] = Math.min(1, t + Math.random() * 0.3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })));
    // sun
    const sunPos = new THREE.Vector3(-58, 2, -8); const sunTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.2, 'rgba(255,220,120,0.9)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.25)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sun.position.copy(sunPos); sun.scale.setScalar(70); scene.add(sun);
    const dl = new THREE.DirectionalLight(0xfff0dc, 3.4); dl.position.copy(sunPos); scene.add(dl); scene.add(new THREE.AmbientLight(0x6070a0, 0.55));
    // orbit lines (arcs around the sun)
    const orbMat = new THREE.LineBasicMaterial({ color: 0x35508a, transparent: true, opacity: 0.35 });
    (['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as PlanetId[]).forEach(id => { const L = LAYOUT[id]; const R = Math.hypot(L.x - sunPos.x, L.z - sunPos.z); const pts: THREE.Vector3[] = []; for (let a = -0.5; a <= 0.5; a += 0.01) pts.push(new THREE.Vector3(sunPos.x + Math.cos(a) * R, L.y * 0.2, sunPos.z + Math.sin(a) * R + 0)); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbMat)); });
    // planets
    const glowMatFor = (c: THREE.Color) => new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { c: { value: c }, k: { value: 0.6 } }, vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }', fragmentShader: 'uniform vec3 c; uniform float k; varying vec3 n; varying vec3 v; void main(){ float f = pow(0.72 - dot(-n, v), 2.2); gl_FragColor = vec4(c, 1.0) * f * k * 2.4; }' });
    const objs: PlanetObj[] = []; const hitMeshes: THREE.Mesh[] = [];
    MAP_ORDER.forEach(id => {
      const L = LAYOUT[id]; const P = PLANETS[id]; const group = new THREE.Group(); group.position.set(L.x, L.y, L.z); scene.add(group);
      const tex = planetTexture(id); const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.05, roughness: 0.92, metalness: 0 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(L.r, 48, 32), mat); if (id === 'uranus') mesh.rotation.z = 1.5; if (id === 'saturn') mesh.rotation.z = 0.2; group.add(mesh);
      const col = new THREE.Color(P.css); const glow = new THREE.Mesh(new THREE.SphereGeometry(L.r * 1.22, 32, 24), glowMatFor(col)); group.add(glow);
      if (id === 'saturn' || id === 'uranus') {
        const inner = L.r * (id === 'saturn' ? 1.35 : 1.55), outer = L.r * (id === 'saturn' ? 2.35 : 1.68); const rg = new THREE.RingGeometry(inner, outer, 96, 1); const pos = rg.attributes.position, uv = rg.attributes.uv; const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
        const c = document.createElement('canvas'); c.width = 256; c.height = 4; const g = c.getContext('2d')!; for (let x = 0; x < 256; x++) { const a = id === 'saturn' ? (0.25 + 0.65 * Math.abs(Math.sin(x * 0.19) * Math.sin(x * 0.043 + 1))) * (x > 150 && x < 162 ? 0.1 : 1) : 0.22; g.fillStyle = id === 'saturn' ? `rgba(226,206,160,${a})` : `rgba(190,235,240,${a})`; g.fillRect(x, 0, 1, 4); }
        const ringMesh = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, side: THREE.DoubleSide, depthWrite: false })); ringMesh.rotation.x = id === 'saturn' ? Math.PI / 2 - 0.42 : 0.2; ringMesh.rotation.y = id === 'saturn' ? 0 : 0; if (id === 'uranus') ringMesh.rotation.z = 0; group.add(ringMesh);
        if (id === 'uranus') { ringMesh.rotation.set(Math.PI / 2 - 1.45, 0.3, 0.2); }
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(L.r * 1.55, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2.4; group.add(ring);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(L.r * 1.35, 1.8), 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.id = id; group.add(hit); hitMeshes.push(hit);
      objs.push({ id, group, mesh, mat, glow, hit, r: L.r, hover: 0, ring, label: null, base: new THREE.Vector3(L.x, L.y, L.z) });
    });
    // interaction
    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(9, 9);
    const onMove = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const onLeave = () => mouse.set(9, 9);
    const onClick = () => { const id = hoverRef.current; if (!id) return; if (isUnlocked(saveRef.current, id)) selRef.current(id); else { setFlash(`${PLANETS[id].name} is locked — ${PLANETS[id].unlock.toLowerCase()} first.`); window.setTimeout(() => setFlash(''), 2600); } };
    renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('pointerleave', onLeave); renderer.domElement.addEventListener('click', onClick);
    // loop
    const camPos = new THREE.Vector3(0, 9, 72), camLook = new THREE.Vector3(0, 0, 0); const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(); let raf = 0, last = performance.now(), t = 0; const v3 = new THREE.Vector3();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      ray.setFromCamera(mouse, camera); const hits = ray.intersectObjects(hitMeshes, false); const id = hits.length ? (hits[0].object.userData.id as PlanetId) : null;
      if (id !== hoverRef.current) { hoverRef.current = id; setHover(id); renderer.domElement.style.cursor = id ? 'pointer' : 'default'; }
      const moon = objs.find(o => o.id === 'moon')!, earth = objs.find(o => o.id === 'earth')!; const ma = t * 0.45; moon.group.position.set(earth.base.x + Math.cos(ma) * 5.2, earth.base.y + Math.sin(ma * 0.7) * 1.4 + 0.8, earth.base.z + Math.sin(ma) * 4.2 + 0.5);
      objs.forEach(o => {
        const un = isUnlocked(saveRef.current, o.id); o.hover += ((hoverRef.current === o.id ? 1 : 0) - o.hover) * Math.min(1, dt * 7);
        o.mesh.rotation.y += dt * (0.12 + (o.id === 'jupiter' ? 0.15 : 0)); const s = 1 + o.hover * 0.13; o.mesh.scale.setScalar(s); o.glow.scale.setScalar(s);
        o.mat.emissiveIntensity = 0.04 + o.hover * 0.55; o.mat.color.setScalar(un ? 1 : 0.32); (o.glow.material as THREE.ShaderMaterial).uniforms.k.value = (un ? 0.5 : 0.18) + o.hover * 1.1;
        (o.ring.material as THREE.MeshBasicMaterial).opacity = o.hover * 0.8; o.ring.rotation.z += dt * 0.8; o.ring.scale.setScalar(1 + o.hover * 0.08 + Math.sin(t * 4) * 0.02 * o.hover);
        const lab = labels.current[o.id]; if (lab) { v3.copy(o.group.position); v3.y -= o.r * 1.35 * s + 0.6; v3.project(camera); lab.style.transform = `translate(-50%, 0) translate(${(v3.x * 0.5 + 0.5) * el.clientWidth}px, ${(-v3.y * 0.5 + 0.5) * el.clientHeight}px)`; lab.style.opacity = v3.z < 1 ? '1' : '0'; }
      });
      // The camera NEVER chases a hovered planet — it stays parked on the whole system so the
      // planet under your cursor stays under your cursor. Hover feedback is scale + glow only.
      void hoverRef;
      tPos.set(Math.sin(t * 0.2) * 3, 9 + Math.sin(t * 0.3) * 0.6, 72); tLook.set(0, 0, 0);
      const k = 1 - Math.exp(-dt * 2.6); camPos.lerp(tPos, k); camLook.lerp(tLook, k); camera.position.copy(camPos); camera.lookAt(camLook);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('pointerleave', onLeave); renderer.domElement.removeEventListener('click', onClick); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, []);

  const P = hover ? PLANETS[hover] : null; const un = hover ? isUnlocked(save, hover) : false; const done = hover ? completedCount(save, hover) : 0;
  const natives = P ? ENEMIES.filter(e => (P.id === 'moon' ? true : e.intro[0] === P.tier)).map(e => e.name) : [];
  return (
    <div className="absolute inset-0 select-none">
      <div ref={mount} className="absolute inset-0" />
      {MAP_ORDER.map(id => (
        <div key={id} ref={el => { labels.current[id] = el; }} className="pointer-events-none absolute left-0 top-0 text-center will-change-transform" style={{ opacity: 0 }}>
          <div className={`font-tech text-[10px] tracking-[0.3em] uppercase transition-colors ${hover === id ? 'text-white' : 'text-cyan-200/70'}`}>{!isUnlocked(save, id) && '🔒 '}{PLANETS[id].name}</div>
          <div className="mx-auto mt-0.5 h-[2px] w-8 rounded" style={{ background: isUnlocked(save, id) ? PLANETS[id].css : '#445' }} />
        </div>
      ))}
      <div className="ui-hazard pointer-events-none absolute left-0 right-0 top-0 h-1.5" />
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-5 pt-6">
        <div>
          <div className="ui-label">Navigation // Solar theater</div>
          <div className="font-tech text-3xl font-black uppercase tracking-wider text-white" style={{ textShadow: '0 0 22px rgba(34,211,238,0.45)' }}>Star Map</div>
          <div className="mt-1 h-px w-64 bg-gradient-to-r from-cyan-300/80 via-red-500/50 to-transparent" />
          <div className="mt-1 max-w-sm font-hud text-sm text-cyan-100/60">Hover a world to scan it. Click to deploy. Worlds unlock in order — the Moon opens after Earth.</div>
        </div>
        <button onClick={onBack} className="ui-btn ui-clip-sm pointer-events-auto !py-1.5 text-[10px]">← Title</button>
      </div>
      {flash && <div className="ui-clip-sm pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 border border-red-400/60 bg-red-950/85 px-5 py-2 font-hud text-sm text-red-100">{flash}</div>}
      <div className={`pointer-events-none absolute bottom-6 right-6 top-28 w-[22rem] transition-all duration-300 ${P ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
        {P && (
          <div className="ui-panel ui-clip flex max-h-full flex-col overflow-hidden p-5 backdrop-blur-md" style={{ borderColor: P.css + '88', boxShadow: `0 0 40px ${P.css}33, inset 0 0 60px rgba(0,0,0,0.6)` }}>
            <div className="flex items-center justify-between">
              <div className="ui-label" style={{ color: P.css }}>{P.optional ? 'Optional challenge' : 'Campaign world'}</div>
              <div className={`ui-clip-sm px-2 py-0.5 font-tech text-[9px] uppercase tracking-widest ${un ? (done >= P.levels ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-200') : 'bg-red-500/20 text-red-300'}`}>{un ? (done >= P.levels ? 'Cleared' : 'Unlocked') : 'Locked'}</div>
            </div>
            <div className="font-tech mt-1 text-3xl font-black uppercase leading-none text-white">{P.name}</div>
            <div className="mt-1 font-hud text-sm text-white/60">{P.subtitle}</div>
            <div className="ui-bar mt-3"><div style={{ width: `${(done / P.levels) * 100}%`, background: P.css }} /></div>
            <div className="mt-1 flex justify-between font-tech text-[9px] uppercase tracking-wider text-white/50"><span>{done}/{P.levels} levels cleared</span><span>{P.levels} ops · boss finale</span></div>
            <div className="mt-3 space-y-3 overflow-y-auto pr-1 font-hud text-[15px] leading-relaxed text-white/80">
              <div><div className="ui-label !text-white/40">What it's like</div>{P.blurb}</div>
              <div><div className="ui-label !text-white/40">What's going on</div>{P.situation}</div>
              <div><div className="ui-label !text-white/40">Known threats</div><span className="text-white/60">{natives.slice(0, 8).join(' · ')}</span></div>
              {done >= P.levels && <div><div className="ui-label !text-white/40">Defeated</div>{P.id === 'earth' ? 'The Spanish Peak mastermind' : BOSSES[P.bossId].name}</div>}
            </div>
            <div className="mt-3 border-t border-white/10 pt-3 font-tech text-[10px] uppercase tracking-widest" style={{ color: un ? '#7dffb0' : '#ff8a8a' }}>
              {un ? '▶ Click to deploy' : `🔒 Requires: ${UNLOCK_REQ[P.id] ? 'Clear ' + PLANETS[UNLOCK_REQ[P.id]!].name : P.unlock}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
