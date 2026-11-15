import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { generateLevel, buildLevelMesh, CELL } from '../game/level';
import { PLANETS } from '../game/data';
import { glowTexture } from '../game/textures';

/** Title panorama: a slow orbit above the floating antigravity platform fields of Aeolus Landing, Jupiter. */
export default function TitleBackdrop() {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mount.current; if (!el) return;
    const planet = PLANETS.jupiter;
    const lv = generateLevel('jupiter', 1, 4242, ['revolver']);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(planet.theme.sky);
    scene.fog = new THREE.Fog(planet.theme.fog, 40, 260);
    scene.add(buildLevelMesh(lv, planet));
    scene.add(new THREE.AmbientLight(0xffe6c0, Math.PI * 0.85));
    const dl = new THREE.DirectionalLight(0xffd9a0, Math.PI * 0.9); dl.position.set(-80, 90, 60); scene.add(dl);
    // storm sun + lightning flashes
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe0a0, fog: false, depthWrite: false, transparent: true, opacity: 0.9 })); sun.scale.setScalar(140); scene.add(sun);
    const flashLight = new THREE.PointLight(0xdde8ff, 0, 400, 1.2); scene.add(flashLight);
    // cloud deck particles drifting below the platforms
    const cloudN = 260; const cp = new Float32Array(cloudN * 3);
    const cx0 = (lv.W * CELL) / 2, cz0 = (lv.H * CELL) / 2;
    for (let i = 0; i < cloudN; i++) { cp[i * 3] = cx0 + (Math.random() - 0.5) * 900; cp[i * 3 + 1] = lv.minFloorY - 22 - Math.random() * 30; cp[i * 3 + 2] = cz0 + (Math.random() - 0.5) * 900; }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    const clouds = new THREE.Points(cg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xc08a50, size: 55, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(clouds);

    // orbit target: the centre of the platform field
    const plats = lv.rooms.filter(r => r.kind === 'platform' && r.x1 >= r.x0);
    const focus = new THREE.Vector3();
    if (plats.length) { plats.forEach(r => focus.add(new THREE.Vector3((r.cx + 0.5) * CELL, r.fy, (r.cy + 0.5) * CELL))); focus.multiplyScalar(1 / plats.length); }
    else focus.set(lv.exit.x, lv.exit.y, lv.exit.z);
    let span = 40; plats.forEach(r => { span = Math.max(span, Math.abs((r.cx + 0.5) * CELL - focus.x) + 20); });
    const radius = Math.min(150, span * 1.05 + 30);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
    const resize = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);
    let raf = 0; let ang = Math.random() * 6.283; let last = performance.now(); let nextFlash = 2 + Math.random() * 5; let flashT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ang += dt * 0.055; // ~2 minutes per full revolution
      const h = focus.y + 26 + Math.sin(now * 0.00022) * 5;
      camera.position.set(focus.x + Math.cos(ang) * radius, h, focus.z + Math.sin(ang) * radius);
      camera.lookAt(focus.x, focus.y - 2, focus.z);
      sun.position.set(camera.position.x - 400, h + 90, camera.position.z - 500);
      clouds.rotation.y += dt * 0.004;
      nextFlash -= dt; if (nextFlash <= 0) { flashT = 0.25; nextFlash = 3 + Math.random() * 7; flashLight.position.set(focus.x + (Math.random() - 0.5) * 300, focus.y + 60, focus.z + (Math.random() - 0.5) * 300); }
      if (flashT > 0) { flashT -= dt; flashLight.intensity = Math.max(0, flashT) * 60 * (Math.random() < 0.5 ? 1 : 0.4); } else flashLight.intensity = 0;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, []);
  return <div ref={mount} className="absolute inset-0" aria-hidden="true" />;
}
