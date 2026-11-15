import * as THREE from 'three';

// Chunky 64x64 procedural textures (Quake-style: nearest filtering). Drawn in light greys so vertex colours tint them.
const cache = new Map<string, THREE.CanvasTexture>();

function mulberry(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeTexture(style: string): THREE.CanvasTexture {
  const hit = cache.get(style); if (hit) return hit;
  const S = 64; const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!; const r = mulberry(style.length * 977 + style.charCodeAt(0) * 31);
  const rect = (x: number, y: number, w: number, h: number, v: number) => { g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; g.fillRect(x, y, w, h); };
  const grain = (base: number, amt: number, size = 1) => { for (let y = 0; y < S; y += size) for (let x = 0; x < S; x += size) rect(x, y, size, size, base + (r() - 0.5) * amt); };

  switch (style) {
    case 'brick': {
      grain(215, 28, 1);
      for (let row = 0; row < 8; row++) {
        const y = row * 8; rect(0, y, S, 1, 120);
        const off = row % 2 ? 8 : 0;
        for (let x = off; x < S + 16; x += 16) rect(x % S, y, 1, 8, 120);
        for (let x = 0; x < S; x += 16) { const sh = r() * 30 - 15; for (let yy = 1; yy < 8; yy++) for (let xx = 1; xx < 16; xx++) if (r() < 0.25) rect((x + off + xx) % S, y + yy, 1, 1, 200 + sh + r() * 30); }
      }
      break;
    }
    case 'panel': {
      grain(200, 20, 1); rect(0, 0, S, 2, 120); rect(0, 0, 2, S, 120); rect(S - 2, 0, 2, S, 255); rect(0, S - 2, S, 2, 255);
      rect(31, 0, 2, S, 140); rect(0, 31, S, 2, 140);
      for (const [x, y] of [[5, 5], [57, 5], [5, 57], [57, 57], [27, 27], [36, 36], [27, 36], [36, 27]]) { rect(x, y, 3, 3, 250); rect(x + 1, y + 1, 2, 2, 120); }
      for (let i = 0; i < 6; i++) rect(8 + i * 4, 40, 2, 12, 150);
      break;
    }
    case 'rock': {
      grain(170, 50, 2); for (let i = 0; i < 90; i++) { const x = r() * S, y = r() * S, w = 2 + r() * 8, h = 2 + r() * 5, v = 120 + r() * 120; rect(x, y, w, h, v); }
      for (let i = 0; i < 400; i++) rect(r() * S, r() * S, 1, 1, 100 + r() * 150);
      break;
    }
    case 'ice': {
      grain(235, 24, 2); for (let i = 0; i < 12; i++) { let x = r() * S, y = r() * S; for (let k = 0; k < 14; k++) { rect(x, y, 2, 2, 150); x += (r() - 0.4) * 5; y += (r() - 0.5) * 4; } }
      for (let i = 0; i < 80; i++) rect(r() * S, r() * S, 1, 1, 255);
      break;
    }
    case 'tile': {
      grain(205, 22, 1); for (let i = 0; i <= S; i += 16) { rect(i, 0, 1, S, 110); rect(0, i, S, 1, 110); }
      for (let t = 0; t < 16; t++) { const tx = (t % 4) * 16 + 1, ty = Math.floor(t / 4) * 16 + 1, sh = r() * 36 - 18; rect(tx, ty, 14, 1, 240 + sh); rect(tx, ty, 1, 14, 240 + sh); }
      break;
    }
    case 'grate': {
      grain(150, 25, 1); for (let i = 0; i < S; i += 8) { rect(i, 0, 3, S, 235); rect(0, i, S, 3, 235); rect(i + 3, 0, 5, S, 70); }
      for (let i = 0; i < S; i += 8) rect(0, i + 3, S, 5, 60);
      for (let i = 0; i < S; i += 8) for (let j = 0; j < S; j += 8) rect(i, j, 3, 3, 250);
      break;
    }
    case 'dirt': {
      grain(190, 60, 2); for (let i = 0; i < 200; i++) rect(r() * S, r() * S, 1 + r() * 2, 1, 120 + r() * 120);
      for (let i = 0; i < 18; i++) rect(r() * S, r() * S, 3 + r() * 3, 2 + r() * 2, 235);
      break;
    }
    case 'door': {
      grain(190, 18, 1); rect(0, 0, S, 3, 110); rect(0, S - 3, S, 3, 110); rect(0, 0, 3, S, 110); rect(S - 3, 0, 3, S, 110);
      for (let i = -S; i < S; i += 16) for (let k = 0; k < 8; k++) { g.fillStyle = 'rgb(255,255,255)'; g.fillRect(i + k * 2 + 8 + (k % 2) * 0, 52 + k, 8, 1); }
      for (let y = 8; y < 44; y += 6) rect(10, y, 44, 2, 130);
      rect(28, 10, 8, 34, 90);
      break;
    }
    case 'crate': {
      grain(200, 25, 1); rect(0, 0, S, 4, 110); rect(0, S - 4, S, 4, 110); rect(0, 0, 4, S, 110); rect(S - 4, 0, 4, S, 110);
      for (let i = 4; i < S - 4; i++) { rect(i, i, 2, 2, 120); rect(S - i, i, 2, 2, 120); }
      break;
    }
    default: grain(200, 30, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  cache.set(style, tex); return tex;
}

let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}

export { mulberry };
