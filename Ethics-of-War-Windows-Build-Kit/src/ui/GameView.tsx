import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import type { HudState, Inventory, LevelStats } from '../game/engine';
import { PLANETS, WEAPONS, ENEMIES, AMMO_LABEL, CAMPAIGN } from '../game/data';
import type { PlanetId } from '../game/data';
import { topUp } from '../game/save';
import { ARENAS } from '../game/arena';
import type { MPGameCfg } from '../game/net';
import type { SaveData } from '../game/save';

interface Props {
  planet: PlanetId; level: number; save: SaveData; onComplete: (s: LevelStats, inv: Inventory) => void; onExit: () => void; onRetry: () => void;
  onJump: (p: PlanetId, l: number) => void; toggleFullscreen: () => void; onSettings: (patch: Partial<SaveData['settings']>) => void; mp?: MPGameCfg | null; onMpExit?: () => void;
}
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function GameView(p: Props) {
  const mount = useRef<HTMLDivElement>(null); const mapRef = useRef<HTMLCanvasElement>(null); const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null); const [paused, setPaused] = useState(true); const [dead, setDead] = useState(false); const [started, setStarted] = useState(false);
  const propsRef = useRef(p); propsRef.current = p;

  useEffect(() => {
    const inv = topUp(propsRef.current.save.inv);
    const g = new Game(mount.current!, { planet: p.planet, level: p.level, inv, settings: propsRef.current.save.settings, dev: propsRef.current.save.dev,
      cb: { onHud: setHud, onComplete: (s, i) => propsRef.current.onComplete(s, i), onDead: () => { setDead(true); setPaused(true); }, onPause: () => setPaused(true) }, mp: propsRef.current.mp || null });
    g.minimap = mapRef.current; gameRef.current = g; if (propsRef.current.save.dev) (window as unknown as { __game?: Game }).__game = g; // dev-mode console access
    const t = window.setTimeout(() => { g.resume(true); setPaused(false); setStarted(true); }, 60);
    return () => { clearTimeout(t); g.dispose(); gameRef.current = null; };
  }, [p.planet, p.level]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote' && propsRef.current.save.dev) { e.preventDefault(); const g = gameRef.current; if (!g || dead) return; if (g.paused) { g.resume(); setPaused(false); setStarted(true); } else { g.setPaused(true); setPaused(true); } }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [dead]);

  const resume = () => { const g = gameRef.current; if (!g || dead) return; g.resume(); setPaused(false); setStarted(true); };
  const PL = PLANETS[p.planet]; const filter = hud && hud.warp > 0.05 ? `hue-rotate(${hud.warp * 70}deg) saturate(${1 + hud.warp * 0.8}) contrast(${1 + hud.warp * 0.15})` : undefined;
  const set = (patch: Partial<SaveData['settings']>) => { const g = gameRef.current; if (g) Object.assign(g.settings, patch); p.onSettings(patch); };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div ref={mount} className="absolute inset-0" style={{ filter }} />
      <canvas ref={mapRef} width={160} height={160} className="ui-clip-sm pointer-events-none absolute left-4 top-4 border border-cyan-300/30" style={{ visibility: hud ? 'visible' : 'hidden' }} />
      {hud && <Hud h={hud} dev={p.save.dev} />}
      {hud && hud.hurt > 0.01 && <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 35%, rgba(220,0,0,${Math.min(0.75, hud.hurt * 0.75)}) 100%)` }} />}
      {hud && hud.pickup > 0.01 && <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(255,220,100,${hud.pickup * 0.18})` }} />}
      {hud && hud.warp > 0.02 && <div className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ background: `radial-gradient(circle at center, rgba(255,255,255,${hud.warp * 0.12}) 0%, rgba(190,60,255,${hud.warp * 0.35}) 55%, rgba(30,0,60,${hud.warp * 0.6}) 100%)` }} />}
      {hud && hud.slow && <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 120px rgba(120,220,255,0.45)' }} />}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ opacity: hud && hud.sprinting ? 1 : 0, boxShadow: 'inset 0 0 140px rgba(255,255,255,0.10)' }} />

      {paused && !dead && (
        <div className="ui-grid absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="ui-hazard absolute left-0 right-0 top-0 h-1.5" />
          <div className="flex max-h-full w-full max-w-5xl gap-6 overflow-y-auto p-6">
            <div className="ui-panel ui-clip flex-1 p-6">
              <div className="ui-label" style={{ color: PL.css }}>{p.mp?.mode === 'arena' ? `${PL.name} · Free-for-all · Room ${p.mp.session.code}` : `${PL.name} · Operation ${String(p.level).padStart(2, '0')}/${PL.levels}${p.mp ? ` · Co-op · Room ${p.mp.session.code}` : ''}`}</div>
              <div className="font-tech text-3xl font-black uppercase text-white">{p.mp?.mode === 'arena' ? ARENAS[p.planet].name : PL.levelNames[p.level - 1]}</div>
              <div className="mt-1 h-px w-full bg-gradient-to-r from-cyan-300/70 via-red-500/50 to-transparent" />
              <button onClick={resume} className="ui-btn ui-btn-cyan ui-clip mt-4 w-full py-3 text-center text-base font-black">{started ? '▶ Resume' : '▶ Click to Start'}</button>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 font-hud text-[14px] text-white/75">
                {[['WASD', 'Move'], ['Mouse', 'Look'], ['LMB', 'Fire'], ['RMB', 'Alt-fire / Iron sights'], ['Space', 'Jump'], ['Shift', 'Sprint (stamina)'], ['E', 'Use (secret walls!)'], ['R', 'Reload / Load & Pump'], ['1 – 0', 'Weapons'], ['Q / Wheel', 'Last / cycle weapon'], ['F', 'Fullscreen'], ['Esc', 'Pause']].map(([a, b]) => <div key={a} className="flex justify-between border-b border-white/5 py-0.5"><span className="font-tech text-[10px] tracking-[0.2em] text-cyan-200">{a}</span><span>{b}</span></div>)}
              </div>
              <div className="mt-4 space-y-2 font-hud text-[14px] text-white/75">
                <Slider label="Mouse sensitivity" v={p.save.settings.sens} min={0.2} max={3} step={0.05} on={v => set({ sens: v })} />
                <Slider label="Field of view" v={p.save.settings.fov} min={60} max={110} step={1} on={v => set({ fov: v })} />
                <Slider label="Volume" v={p.save.settings.volume} min={0} max={1} step={0.05} on={v => { set({ volume: v }); import('../game/audio').then(m => m.audio.setVolumes(v, p.save.settings.music)); }} />
                <Slider label="Music" v={p.save.settings.music} min={0} max={1} step={0.05} on={v => { set({ music: v }); import('../game/audio').then(m => m.audio.setVolumes(p.save.settings.volume, v)); }} />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={p.toggleFullscreen} className="ui-btn ui-clip-sm flex-1 text-center text-[10px]">⛶ Fullscreen (F)</button>
                {!p.mp && <button onClick={p.onRetry} className="ui-btn ui-clip-sm flex-1 text-center text-[10px]">↻ Restart</button>}
                <button onClick={p.mp ? (p.onMpExit || p.onExit) : p.onExit} className="ui-btn ui-btn-red ui-clip-sm flex-1 text-center text-[10px]">{p.mp ? '✕ Leave match' : '✕ Star map'}</button>
              </div>
            </div>
            {p.save.dev && gameRef.current && <DevPanel game={gameRef.current} onJump={p.onJump} />}
          </div>
        </div>
      )}
      {dead && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-sm" style={{ background: 'radial-gradient(circle at center, rgba(120,0,0,0.55), rgba(20,0,0,0.9))' }}>
          <div className="ui-hazard absolute left-0 right-0 top-0 h-1.5" />
          <div className="ui-label !text-red-300/80">Chassis integrity // critical failure</div>
          <div className="font-tech text-6xl font-black uppercase tracking-[0.2em] text-red-100 md:text-7xl" style={{ textShadow: '0 0 40px rgba(255,0,0,0.75)' }}>KIA</div>
          <div className="mt-2 font-hud text-base text-red-200/75">{PL.name} won't clear itself, Ptolemy.</div>
          <div className="mt-8 flex gap-3">
            <button onClick={p.onRetry} className="ui-btn ui-btn-red ui-clip px-8 py-3 text-sm font-black">↻ Reboot chassis</button>
            <button onClick={p.onExit} className="ui-btn ui-clip px-8 py-3 text-sm">Star map</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return <label className="flex items-center gap-3"><span className="w-40 shrink-0">{label}</span><input type="range" className="ui-range flex-1" min={min} max={max} step={step} value={v} onChange={e => on(+e.target.value)} /><span className="w-10 text-right font-tech text-[11px] text-cyan-200">{Number.isInteger(step) ? v : v.toFixed(2)}</span></label>;
}

// ---------------------------------------------------------------- HUD
function Hud({ h, dev }: { h: HudState; dev: boolean }) {
  const w = WEAPONS[h.weaponIdx]; const hpCol = h.hp > 60 ? '#7dff9a' : h.hp > 30 ? '#ffd24a' : '#ff5a4a';
  return (
    <div className="pointer-events-none absolute inset-0 text-white">
      {/* top-left: operation info under the minimap */}
      <div className="absolute left-4 top-[180px]">
        <div className="ui-hud ui-clip-sm w-40 px-2 py-1.5 font-hud text-[12px] leading-tight text-white/80">
          <div className="font-tech text-[9px] tracking-[0.25em] text-cyan-200">{h.mp?.mode === 'arena' ? `${h.planet} · Arena` : `${h.planet} · OP ${String(h.level).padStart(2, '0')}`}</div>
          <div className="truncate">{h.levelName}</div>
          <div className="mt-1 flex justify-between text-white/60"><span>{h.mp?.mode === 'arena' ? `Frags ${h.mp.kills}` : `Kills ${h.kills}/${h.totalKills}`}</span><span>{fmt(h.time)}</span></div>
          {h.mp?.mode !== 'arena' && <div className="text-white/60">Secrets {h.secrets}/{h.totalSecrets}</div>}
        </div>
      </div>
      {/* boss */}
      {h.boss && (
        <div className="absolute left-1/2 top-4 w-[34rem] max-w-[60vw] -translate-x-1/2 text-center">
          <div className="font-tech text-lg font-black uppercase tracking-[0.2em] text-red-100" style={{ textShadow: '0 0 10px rgba(255,0,0,0.9)' }}>{h.boss.name}</div>
          <div className="font-tech text-[9px] uppercase tracking-[0.3em] text-red-200/60">{h.boss.title}</div>
          <div className="ui-bar mt-1 !h-3 !border-red-300/60 !bg-black/60"><div className="bg-gradient-to-r from-red-700 to-red-400" style={{ width: `${(h.boss.hp / h.boss.max) * 100}%` }} /></div>
        </div>
      )}
      {/* banner */}
      {h.banner && (
        <div className="absolute left-1/2 top-[22%] w-[44rem] max-w-[80vw] -translate-x-1/2 text-center">
          <div className="font-tech text-2xl font-black uppercase tracking-[0.3em] text-white" style={{ textShadow: '0 0 14px rgba(34,211,238,0.5)' }}>{h.banner.title}</div>
          <div className="mx-auto mt-1 h-px w-72 bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
          <div className="mt-1 font-hud text-base text-amber-100/90 drop-shadow">{h.banner.text}</div>
        </div>
      )}
      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ opacity: 1 - h.ads * 0.88 }}>
        <div className="h-1 w-1 rounded-full bg-white/90 shadow-[0_0_4px_#000]" />
        {[[-10, 0], [10, 0], [0, -10], [0, 10]].map(([x, y], i) => <div key={i} className="absolute bg-white/70" style={{ width: x ? 6 : 2, height: y ? 6 : 2, left: x * 1 - (x ? 3 : 1) + 2, top: y * 1 - (y ? 3 : 1) + 2 }} />)}
        {h.hit > 0.02 && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], i) => <div key={i} className="absolute h-[2px] w-3" style={{ background: h.hitHead ? '#ffd24a' : '#ff5a4a', opacity: h.hit, left: x * 9 - 6 + 2, top: y * 9 - 1 + 2, transform: `rotate(${x * y > 0 ? 45 : -45}deg)` }} />)}
      </div>
      {h.zoom && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 22%, rgba(0,0,0,0.92) 24%)' }} />}
      {h.msg && <div className="ui-clip-sm absolute left-1/2 top-[62%] -translate-x-1/2 border border-cyan-300/25 bg-black/60 px-4 py-1 font-hud text-[15px] text-amber-100">{h.msg}</div>}
      {/* bottom left: stamina + vitals */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
        <div className="ui-hud ui-clip-sm px-2 py-1">
          <div className="flex justify-between font-tech text-[8px] uppercase tracking-widest" style={{ color: h.exhausted ? '#ff8a7a' : 'rgba(165,243,252,0.7)' }}><span>{h.exhausted ? 'Winded' : 'Stamina'}</span>{h.sprinting && <span className="text-emerald-200">Sprinting</span>}</div>
          <div className="ui-bar mt-0.5 w-full"><div className="transition-[background-color] duration-200" style={{ width: `${h.stamina * 100}%`, background: h.exhausted ? '#ff5a4a' : h.stamina < 0.35 ? '#ffd24a' : '#6ee7b7' }} /></div>
        </div>
        <div className="flex items-end gap-3">
          <div className="ui-hud ui-clip-sm px-4 py-2"><div className="ui-label">Health</div><div className="font-tech text-5xl font-black leading-none" style={{ color: hpCol, textShadow: `0 0 14px ${hpCol}66` }}>{h.hp}</div><div className="ui-bar mt-1 w-28"><div style={{ width: `${h.hp}%`, background: hpCol }} /></div></div>
          <div className="ui-hud ui-clip-sm px-4 py-2"><div className="ui-label">Armor</div><div className="font-tech text-4xl font-black leading-none text-cyan-300">{h.armor}</div><div className="ui-bar mt-1 w-24"><div className="bg-cyan-400" style={{ width: `${h.armor}%` }} /></div></div>
        </div>
      </div>
      {/* bottom center: weapon slots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
        {WEAPONS.map((x, i) => {
          const own = h.owned[i]; const cur = i === h.weaponIdx; const am = x.ammo === 'inf' ? '∞' : String(h.ammos[x.ammo] ?? 0);
          return <div key={x.id} className="ui-clip-sm relative flex h-12 w-14 flex-col items-center justify-center border text-center transition-all" style={{ borderColor: cur ? x.css : own ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)', background: cur ? x.css + '2e' : 'rgba(5,9,15,0.6)', transform: cur ? 'translateY(-6px) scale(1.08)' : undefined, opacity: own ? 1 : 0.35, boxShadow: cur ? `0 0 14px ${x.css}88` : undefined }}>
            <div className="font-tech text-[9px] font-bold" style={{ color: own ? x.css : '#777' }}>{x.slot === 10 ? 0 : x.slot}</div><div className="font-hud text-[12px] leading-none text-white/90">{own ? am : '—'}</div>
          </div>;
        })}
      </div>
      {/* bottom right: weapon */}
      <div className="ui-hud ui-clip absolute bottom-4 right-4 w-72 px-4 py-2 text-right">
        <div className="ui-label" style={{ color: w.css }}>{w.name}</div>
        <div className="font-tech text-5xl font-black leading-none text-amber-200">{h.ammoText}</div>
        <div className="font-tech text-[9px] uppercase tracking-widest text-white/50">{w.id === 'revolver' ? h.ammoLabel : AMMO_LABEL[w.ammo]}</div>
        {w.id === 'powerline' && (
          <div className="mt-2 text-left">
            <div className="flex justify-between font-tech text-[8px] uppercase tracking-widest"><span className="text-white/60">Pressure</span><span style={{ color: h.pumps >= 3 ? '#9dffb0' : '#ff9a8a' }}>{h.pumps * 10}% power{h.pumps < 3 ? ' (min 3)' : ''}</span></div>
            <div className="mt-1 flex gap-[3px]">{Array.from({ length: 10 }, (_, i) => <div key={i} className="h-3 flex-1" style={{ background: i < h.pumps ? (i < 2 ? '#888' : `hsl(${130 - (i - 2) * 16},90%,55%)`) : 'rgba(255,255,255,0.12)', outline: i === 2 ? '1px solid rgba(255,255,255,0.5)' : undefined }} />)}</div>
            <div className="mt-2 font-tech text-[8px] uppercase tracking-widest">{h.loadP >= 0 ? <><span className="text-amber-200">Loading pellet… {Math.round(h.loadP * 100)}%</span><div className="ui-bar mt-1"><div className="bg-amber-300" style={{ width: `${h.loadP * 100}%` }} /></div></> : h.loaded ? <span className="text-emerald-300">● Pellet loaded — R to pump</span> : <span className="text-red-300">○ Chamber empty — R to load</span>}</div>
            <div className="mt-1 font-hud text-[11px] text-white/40">R load & pump · RMB iron sights · LMB fire</div>
          </div>
        )}
        {w.id === 'revolver' && <div className="mt-1 flex justify-end gap-1">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-2.5 w-2.5 rounded-full border border-amber-200/60" style={{ background: i < h.revMag ? '#ffd24a' : 'transparent' }} />)}</div>}
        {w.id === 'rail' && <div className="ui-bar mt-2"><div className="bg-cyan-300" style={{ width: `${h.charge * 100}%` }} /></div>}
        {w.id === 'vector' && h.vecCharge > 0 && <div className="ui-bar mt-2"><div className="bg-fuchsia-400" style={{ width: `${(1 - h.vecCharge) * 100}%` }} /></div>}
      </div>
      {h.mp && (
        <div className="ui-hud ui-clip-sm absolute right-4 top-4 w-52 px-3 py-2">
          <div className="flex justify-between font-tech text-[8px] tracking-[0.25em] text-cyan-200"><span>{h.mp.mode === 'arena' ? 'FREE-FOR-ALL' : 'CO-OP'}</span><span>ROOM {h.mp.code}</span></div>
          <div className="mt-1 space-y-0.5">
            {h.mp.peers.map((pp, i) => <div key={i} className="flex items-center gap-1.5 font-hud text-[13px] text-white/85"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pp.color }} /><span className="min-w-0 flex-1 truncate">{pp.name}{pp.dead ? ' ✝' : ''}</span><span className="text-white/45">{pp.hp}hp</span><span className="font-bold text-amber-200">{pp.kills}K</span><span className="text-white/40">{pp.deaths}D</span></div>)}
          </div>
        </div>
      )}
      {dev && h.devInfo && <div className={`ui-hud ui-clip-sm absolute right-4 px-3 py-1 font-hud text-[12px] text-lime-300 ${h.mp ? 'top-28' : 'top-4'}`}>DEV · {h.devInfo} · ` tools</div>}
      {!h.portalOpen && h.mp?.mode !== 'arena' && <div className="absolute right-4 top-12 font-tech text-[9px] uppercase tracking-widest text-red-300/80">Exit sealed — defeat the boss</div>}
    </div>
  );
}

// ---------------------------------------------------------------- dev panel
function DevPanel({ game, onJump }: { game: Game; onJump: (p: PlanetId, l: number) => void }) {
  const [, force] = useState(0); const d = game.dev; const rerender = () => force(n => n + 1);
  const [enemy, setEnemy] = useState(ENEMIES[0].id); const [pl, setPl] = useState<PlanetId>('earth'); const [lv, setLv] = useState(1);
  const Tog = ({ k, label }: { k: 'god' | 'infAmmo' | 'noclip' | 'stats'; label: string }) => <label className="flex cursor-pointer items-center gap-2 py-0.5"><input type="checkbox" className="accent-lime-400" checked={d[k]} onChange={e => { d[k] = e.target.checked; rerender(); }} />{label}</label>;
  const Btn = ({ on, children }: { on: () => void; children: React.ReactNode }) => <button onClick={() => { on(); rerender(); }} className="ui-clip-sm border border-lime-400/40 bg-lime-400/10 px-2 py-1 text-left font-tech text-[9px] tracking-[0.15em] uppercase hover:bg-lime-400/25">{children}</button>;
  return (
    <div className="ui-panel ui-clip w-72 shrink-0 p-4 font-hud text-[14px] text-lime-100" style={{ borderColor: 'rgba(163,230,53,0.5)' }}>
      <div className="font-tech mb-2 text-sm font-black uppercase tracking-[0.3em] text-lime-300">⚙ Dev mode</div>
      <Tog k="god" label="God mode" /><Tog k="infAmmo" label="Infinite ammo" /><Tog k="noclip" label="Noclip (fly) — Space/Shift" /><Tog k="stats" label="Stats overlay" />
      <label className="flex cursor-pointer items-center gap-2 py-0.5"><input type="checkbox" className="accent-fuchsia-400" checked={d.reveal} onChange={e => { game.devReveal(e.target.checked); rerender(); }} />Reveal secrets / map / enemies</label>
      <div className="mt-2">Speed ×{d.speed.toFixed(1)}<input type="range" className="w-full accent-lime-400" min={0.5} max={4} step={0.1} value={d.speed} onChange={e => { d.speed = +e.target.value; rerender(); }} /></div>
      <div>Time scale ×{d.timeScale.toFixed(2)}<input type="range" className="w-full accent-lime-400" min={0.1} max={2} step={0.05} value={d.timeScale} onChange={e => { d.timeScale = +e.target.value; rerender(); }} /></div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Btn on={() => game.devGiveAll()}>Give all guns</Btn><Btn on={() => game.devHeal()}>Heal + armor</Btn><Btn on={() => game.devKillAll()}>Kill all</Btn><Btn on={() => game.devGoExit()}>Go to exit</Btn>
        <Btn on={() => game.devTeleportSecret()}>To a secret</Btn><Btn on={() => game.devComplete()}>Complete level</Btn>
      </div>
      <div className="ui-label mt-3 !text-lime-300/80">Spawn enemy</div>
      <div className="flex gap-1"><select className="ui-sel min-w-0 flex-1 !py-1" value={enemy} onChange={e => setEnemy(e.target.value)}>{ENEMIES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><Btn on={() => game.devSpawn(enemy)}>Spawn</Btn></div>
      <div className="ui-label mt-3 !text-lime-300/80">Jump to level</div>
      <div className="flex gap-1">
        <select className="ui-sel min-w-0 flex-1 !py-1" value={pl} onChange={e => { setPl(e.target.value as PlanetId); setLv(1); }}>{[...CAMPAIGN, 'moon' as PlanetId].map(id => <option key={id} value={id}>{PLANETS[id].name}</option>)}</select>
        <select className="ui-sel !w-16 !py-1" value={lv} onChange={e => setLv(+e.target.value)}>{Array.from({ length: PLANETS[pl].levels }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        <Btn on={() => onJump(pl, lv)}>Go</Btn>
      </div>
      <div className="mt-3 text-[11px] leading-snug text-lime-200/50">Press ` (backtick) in-game to open this panel. Dev mode also unlocks every planet & level on the map.</div>
    </div>
  );
}
