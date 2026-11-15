import { useState } from 'react';
import { PLANETS, WEAPONS, CAMPAIGN, BOSSES } from '../game/data';
import type { PlanetId } from '../game/data';
import { levelsAvailable, completedCount } from '../game/save';
import TitleBackdrop from './TitleBackdrop';
import MultiplayerMenu from './MultiplayerMenu';
import type { MPGameCfg } from '../game/net';
import type { SaveData } from '../game/save';
import type { LevelStats } from '../game/engine';

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function FsButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} title="Fullscreen (F)" className="ui-btn ui-clip-sm absolute right-4 bottom-4 z-40 !py-1.5 !px-3 text-[10px]">⛶ Fullscreen · F</button>;
}

export function TitleScreen({ save, onPlay, onSettings, onDev, onReset, onMPStart }: { save: SaveData; onPlay: () => void; onSettings: (p: Partial<SaveData['settings']>) => void; onDev: (b: boolean) => void; onReset: () => void; onMPStart: (cfg: MPGameCfg) => void }) {
  const [panel, setPanel] = useState<'main' | 'settings' | 'multi'>('main'); const [confirm, setConfirm] = useState(false);
  const started = Object.keys(save.completed).length > 0;
  const s = save.settings;
  const techBtn = 'font-tech uppercase tracking-[0.28em] border px-5 py-3 text-left transition-all duration-150 hover:translate-x-1';
  const clip = { clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' } as const;
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <TitleBackdrop />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(2,6,10,0.88) 0%, rgba(2,6,10,0.55) 42%, rgba(2,6,10,0.05) 75%), linear-gradient(0deg, rgba(0,0,0,0.75), transparent 45%, rgba(0,0,0,0.35))' }} />
      <div className="scan pointer-events-none absolute inset-0 opacity-60" />
      {/* hazard strip */}
      <div className="absolute left-0 right-0 top-0 h-1.5" style={{ background: 'repeating-linear-gradient(45deg, #e8b23a 0 14px, #0a0d12 14px 28px)' }} />
      <div className={`relative z-10 flex h-full flex-col px-6 md:px-14 ${panel === 'multi' ? 'justify-start overflow-y-auto pb-16 pt-8' : 'justify-center py-8'}`}>
        <div className="font-tech text-[10px] tracking-[0.55em] text-cyan-300/80">WALSENBURG PROTOCOL // SOLAR THEATER // SiC-9 CHASSIS</div>
        {panel === 'multi'
          ? <h1 className="font-tech mt-2 text-3xl font-black uppercase tracking-[0.12em] text-white md:text-4xl" style={{ textShadow: '0 0 24px rgba(56,189,248,0.35)' }}>Ethics <span className="text-orange-300">of War</span></h1>
          : <h1 className="font-tech mt-3 text-7xl font-black uppercase leading-[0.9] text-white md:text-8xl" style={{ textShadow: '0 0 34px rgba(56,189,248,0.35), 0 4px 0 rgba(0,0,0,0.8)' }}>
            Ethics<br /><span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 bg-clip-text text-transparent">of War</span>
          </h1>}
        <div className="mt-2 h-px w-[30rem] max-w-full bg-gradient-to-r from-cyan-300 via-red-500 to-transparent" />
        {panel !== 'multi' && <p className="mt-3 max-w-xl font-hud text-base text-white/70">One digital mind in an armored Silicon Carbide shell. Coal mines, billionaire Mars, storm-forges, ring-crystal, sideways ice, drowned choirs — and a very long walk home.</p>}

        {panel === 'main' && (
          <div className="mt-8 flex w-80 max-w-[90vw] flex-col gap-2">
            <button onClick={onPlay} style={clip} className={`${techBtn} border-cyan-300/80 bg-cyan-400/15 text-base text-cyan-50 hover:bg-cyan-300/35`}>{started ? '▶ Continue campaign' : '▶ Start campaign'}</button>
            <button onClick={() => setPanel('multi')} style={clip} className={`${techBtn} border-red-400/70 bg-red-500/10 text-sm text-red-100 hover:bg-red-400/30`}>◈ Multiplayer</button>
            <button onClick={() => setPanel('settings')} style={clip} className={`${techBtn} border-white/25 bg-black/50 text-sm text-white/85 hover:bg-white/15`}>Systems / settings</button>
            <label style={clip} className="flex cursor-pointer items-center justify-between border border-lime-400/30 bg-black/50 px-5 py-2.5 font-tech text-[11px] uppercase tracking-[0.28em] text-lime-200 hover:bg-lime-400/10"><span>Dev mode</span><input type="checkbox" className="h-4 w-4 accent-lime-400" checked={save.dev} onChange={e => onDev(e.target.checked)} /></label>
            {started && (confirm ? <div className="flex gap-2"><button onClick={() => { onReset(); setConfirm(false); }} className="flex-1 border border-red-400 bg-red-500/30 py-1.5 font-tech text-[10px] uppercase text-red-100">Really reset</button><button onClick={() => setConfirm(false)} className="flex-1 border border-white/20 py-1.5 font-tech text-[10px] uppercase text-white/70">Cancel</button></div> : <button onClick={() => setConfirm(true)} className="text-left font-tech text-[10px] uppercase tracking-[0.3em] text-white/35 hover:text-red-300">Reset progress</button>)}
          </div>
        )}
        {panel === 'settings' && (
          <div className="mt-6 w-[28rem] max-w-full space-y-3 border border-white/20 bg-black/70 p-5 font-hud text-sm text-white/80 backdrop-blur" style={clip}>
            {([['Mouse sensitivity', 'sens', 0.2, 3, 0.05], ['Field of view', 'fov', 60, 110, 1], ['Volume', 'volume', 0, 1, 0.05], ['Music', 'music', 0, 1, 0.05]] as const).map(([lab, k, mn, mx, st]) => (
              <label key={k} className="flex items-center gap-3"><span className="w-36">{lab}</span><input type="range" className="flex-1 accent-cyan-300" min={mn} max={mx} step={st} value={s[k]} onChange={e => onSettings({ [k]: +e.target.value })} /><span className="w-10 text-right text-cyan-200">{st === 1 ? s[k] : s[k].toFixed(2)}</span></label>
            ))}
            <div className="flex items-center gap-3"><span className="w-36">Difficulty</span><div className="flex flex-1 gap-1">{['Easy', 'Normal', 'Brutal'].map((n, i) => <button key={n} onClick={() => onSettings({ difficulty: i as 0 | 1 | 2 })} className={`flex-1 border py-1 font-tech text-[10px] uppercase ${s.difficulty === i ? 'border-cyan-300 bg-cyan-400/25 text-cyan-100' : 'border-white/20 text-white/60'}`}>{n}</button>)}</div></div>
            <button onClick={() => setPanel('main')} className="w-full border border-white/25 py-2 font-tech text-[10px] uppercase tracking-[0.3em] hover:bg-white/10">← Back</button>
          </div>
        )}
        {panel === 'multi' && <div className="mt-4"><MultiplayerMenu save={save} onBack={() => setPanel('main')} onStart={onMPStart} /></div>}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-6 z-10 font-tech text-[9px] tracking-[0.4em] text-white/35 md:left-14">AEOLUS LANDING · JUPITER SKYFORGES // ORBITAL FEED</div>
    </div>
  );
}

export function Briefing({ planetId, save, onStart, onBack }: { planetId: PlanetId; save: SaveData; onStart: (level: number) => void; onBack: () => void }) {
  const P = PLANETS[planetId]; const avail = levelsAvailable(save, planetId); const done = completedCount(save, planetId); const [sel, setSel] = useState(Math.min(done + 1, avail, P.levels));
  const boss = BOSSES[P.bossId];
  const envOf = (i: number) => P.levelEnvs[i] || 'mixed';
  const envTag: Record<string, string> = { indoor: 'INTERIOR', mixed: 'SURFACE', outdoor: 'OPEN TERRAIN', skybridge: 'SKYBRIDGE' };
  return (
    <div className="ui-grid absolute inset-0 overflow-y-auto" style={{ background: `radial-gradient(ellipse at top left, ${P.css}2e, transparent 55%), #04070c` }}>
      <div className="ui-hazard absolute left-0 right-0 top-0 h-1.5" />
      <div className="scan pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-6xl p-6 pt-8">
        <button onClick={onBack} className="ui-btn ui-clip-sm !py-1.5 text-[10px]">← Star map</button>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div><div className="ui-label" style={{ color: P.css }}>{P.subtitle}</div><h2 className="font-tech text-6xl font-black uppercase leading-none text-white" style={{ textShadow: `0 0 30px ${P.css}66` }}>{P.name}</h2></div>
          <div className="ui-panel ui-clip-sm px-4 py-2 text-right font-hud text-sm text-white/70"><span className="ui-label block">Theater status</span>{done}/{P.levels} cleared · Boss: {done >= P.levels ? (P.id === 'earth' ? 'A Colorado politician' : boss.name) : 'UNKNOWN'}</div>
        </div>
        <div className="mt-2 h-px w-full bg-gradient-to-r from-cyan-300/70 via-red-500/50 to-transparent" />
        <p className="mt-4 max-w-3xl font-hud text-lg leading-relaxed text-white/80">{P.intro}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_23rem]">
          <div>
            <div className="ui-label mb-2">Select operation</div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: P.levels }, (_, i) => {
                const n = i + 1; const ok = n <= avail; const cleared = n <= done; const isBoss = n === P.levels;
                return <button key={n} disabled={!ok} onClick={() => setSel(n)} className={`ui-clip-sm relative h-[5.6rem] border p-2 text-left transition ${sel === n ? 'border-cyan-300 bg-cyan-400/15' : ok ? 'border-white/20 bg-black/50 hover:border-cyan-300/50 hover:bg-white/5' : 'border-white/5 bg-black/30 opacity-40'}`} style={sel === n ? { boxShadow: `0 0 18px ${P.css}55` } : undefined}>
                  <div className="flex items-center justify-between"><span className="font-tech text-2xl font-black text-white">{String(n).padStart(2, '0')}</span><span className="font-tech text-[10px] text-cyan-200">{cleared ? '✓' : ok ? '' : '🔒'}{isBoss && ' BOSS'}</span></div>
                  <div className="mt-0.5 line-clamp-2 font-hud text-[12px] leading-tight text-white/70">{P.levelNames[i]}</div>
                  <div className="absolute bottom-1 right-2 font-tech text-[7px] tracking-[0.2em] text-white/30">{envTag[envOf(i)]}</div>
                </button>;
              })}
            </div>
          </div>
          <div className="ui-panel ui-clip p-5">
            <div className="ui-label">Operation {String(sel).padStart(2, '0')}{sel === P.levels ? ' · BOSS' : ''} · {envTag[envOf(sel - 1)]}</div>
            <div className="font-tech text-2xl font-black uppercase text-white">{P.levelNames[sel - 1]}</div>
            <div className="mt-2 min-h-[3.5rem] font-hud text-[15px] leading-relaxed text-white/75">{P.beats[sel] || (sel === P.levels ? 'Everything you have fought through leads here.' : `Press deeper into ${P.name}. More hostiles, deeper rooms, tougher company.`)}</div>
            <div className="ui-label mt-3">Arsenal</div>
            <div className="mt-1 flex flex-wrap gap-1">{WEAPONS.map(w => { const own = save.inv.owned.includes(w.id); return <span key={w.id} className="border px-1.5 py-0.5 font-tech text-[9px] tracking-wider" style={{ borderColor: own ? w.css : 'rgba(255,255,255,0.1)', color: own ? w.css : 'rgba(255,255,255,0.25)' }}>{w.slot === 10 ? 0 : w.slot} {own ? w.name : '???'}</span>; })}</div>
            <button onClick={() => onStart(sel)} className="ui-btn ui-btn-cyan ui-clip mt-4 w-full py-3 text-center text-sm font-black">▶ Deploy</button>
            <div className="mt-2 text-center font-hud text-xs text-white/40">Some walls aren't what they seem. Press E.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Complete({ planetId, level, stats, onNext, onMap }: { planetId: PlanetId; level: number; stats: LevelStats; onNext: () => void; onMap: () => void }) {
  const P = PLANETS[planetId]; const last = level >= P.levels; const final = planetId === 'pluto' && last; const idx = CAMPAIGN.indexOf(planetId); const nextP = idx >= 0 && idx < CAMPAIGN.length - 1 ? PLANETS[CAMPAIGN[idx + 1]] : null;
  const rows: [string, string][] = [['Kills', `${stats.kills} / ${stats.totalKills}`], ['Secrets', `${stats.secrets} / ${stats.totalSecrets}`], ['Time', fmt(stats.time)]];
  return (
    <div className="ui-grid absolute inset-0 flex items-center justify-center overflow-y-auto" style={{ background: `radial-gradient(circle at center, ${P.css}2a, #03040a 70%)` }}>
      <div className="ui-hazard absolute left-0 right-0 top-0 h-1.5" />
      <div className="ui-panel ui-clip m-4 w-[38rem] max-w-full p-8 text-center">
        <div className="ui-label" style={{ color: P.css }}>{P.name} · Operation {String(level).padStart(2, '0')} · Debrief</div>
        <div className="font-tech mt-1 text-5xl font-black uppercase text-white" style={{ textShadow: `0 0 28px ${P.css}66` }}>{final ? 'The End' : last ? `${P.name} liberated` : 'Objective complete'}</div>
        <div className="mt-1 font-hud text-white/60">{P.levelNames[level - 1]}</div>
        <div className="mt-6 grid grid-cols-3 gap-3">{rows.map(([a, b]) => <div key={a} className="ui-clip-sm border border-white/15 bg-black/50 p-3"><div className="ui-label">{a}</div><div className="font-tech text-2xl font-black text-amber-200">{b}</div></div>)}</div>
        {last && <p className="mt-6 font-hud text-[15px] leading-relaxed text-white/80">{P.outro}</p>}
        {last && !final && <div className="ui-label mt-3 !text-emerald-300">{nextP ? `${nextP.name} unlocked${planetId === 'earth' ? ' · Moon gauntlet unlocked' : ''}` : ''}</div>}
        {final && <div className="ui-label mt-3 !text-fuchsia-300">Thanks for playing, Ptolemy. The Moon gauntlet awaits if you dare.</div>}
        <div className="mt-8 flex gap-3">
          {!last && <button onClick={onNext} className="ui-btn ui-btn-cyan ui-clip flex-1 py-3 text-center text-sm font-black">Next operation ▶</button>}
          <button onClick={onMap} className={`ui-btn ui-clip flex-1 py-3 text-center text-sm ${last ? 'ui-btn-cyan font-black' : ''}`}>Star map</button>
        </div>
      </div>
    </div>
  );
}
