import { useEffect, useRef, useState } from 'react';
import { PLANETS, MAP_ORDER } from '../game/data';
import type { PlanetId } from '../game/data';
import { MPSession } from '../game/net';
import type { MPGameCfg, MPMode, MPPeer } from '../game/net';
import { levelsAvailable } from '../game/save';
import type { SaveData } from '../game/save';
import { ARENAS } from '../game/arena';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export default function MultiplayerMenu({ save, onBack, onStart }: { save: SaveData; onBack: () => void; onStart: (cfg: MPGameCfg) => void }) {
  const [view, setView] = useState<'choose' | 'lobby'>('choose');
  const [mode, setMode] = useState<MPMode>('coop');
  const [name, setName] = useState(() => `Ptolemy-${Math.floor(100 + Math.random() * 900)}`);
  const [planet, setPlanet] = useState<PlanetId>('earth');
  const [level, setLevel] = useState(1);
  const [codeIn, setCodeIn] = useState('');
  const [session, setSession] = useState<MPSession | null>(null);
  const [peers, setPeers] = useState<MPPeer[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<MPSession | null>(null);
  const startedRef = useRef(false);

  const wire = (s: MPSession) => {
    sessionRef.current = s; setSession(s); setPeers(s.peers);
    s.onPeers = setPeers; s.onStatus = setStatus;
    s.onStart = cfg => { if (!startedRef.current) { startedRef.current = true; onStart({ session: s, mode: cfg.mode, planet: cfg.planet, level: cfg.level }); } };
  };
  useEffect(() => () => { if (!startedRef.current) sessionRef.current?.destroy(); }, []);

  const host = async () => {
    setBusy(true); setStatus('Contacting signalling broker…');
    try { const s = await MPSession.host(name.trim() || 'Host'); wire(s); setView('lobby'); setStatus('Hosting — share your room code.'); }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Could not host.'); }
    setBusy(false);
  };
  const join = async () => {
    if (codeIn.trim().length < 4) { setStatus('Enter the room code from your host.'); return; }
    setBusy(true); setStatus('Joining…');
    try { const s = await MPSession.join(name.trim() || 'Player', codeIn); wire(s); setView('lobby'); }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Could not join.'); }
    setBusy(false);
  };
  const leave = () => { sessionRef.current?.destroy(); sessionRef.current = null; setSession(null); setPeers([]); setView('choose'); setStatus(''); onBack(); };
  const start = () => {
    if (!session || session.role !== 'host') return;
    const lv = mode === 'arena' ? 0 : level;
    session.startGame({ mode, planet, level: lv });
    if (!startedRef.current) { startedRef.current = true; onStart({ session, mode, planet, level: lv }); }
  };
  const avail = levelsAvailable(save, planet);
  const inputCls = 'ui-in';
  const btn = 'ui-btn ui-clip-sm text-[11px]';
  return (
    <div className="ui-panel ui-clip w-[34rem] max-w-[94vw] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="font-tech text-sm tracking-[0.35em] text-cyan-100">MULTIPLAYER // LINK-UPLINK</div>
        <div className="h-1.5 w-16 bg-gradient-to-r from-cyan-400 to-red-500" />
      </div>
      <div className="mt-1 font-hud text-xs text-cyan-100/50">Peer-to-peer over WebRTC (PeerJS). No game server — after the handshake, traffic goes straight between your machines.</div>

      {view === 'choose' && (
        <div className="mt-4 space-y-3">
          <label className="block"><span className="font-tech text-[10px] tracking-[0.3em] text-cyan-200/70">CALLSIGN</span><input className={inputCls} value={name} maxLength={18} onChange={e => setName(e.target.value)} /></label>
          <div>
            <div className="font-tech text-[10px] tracking-[0.3em] text-cyan-200/70">MODE</div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([['coop', 'Co-op Campaign', 'Play the story levels together. Host runs the monsters.'], ['arena', 'Free-For-All Arena', 'Open planetary arena. Respawns, friendly fire, kill counter.']] as [MPMode, string, string][]).map(([m, t, d]) => (
                <button key={m} onClick={() => setMode(m)} className={`border p-3 text-left transition-all ${mode === m ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/15 bg-black/40 hover:border-cyan-300/40'}`} style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>
                  <div className="font-tech text-[11px] tracking-[0.2em] text-white">{t}</div><div className="mt-1 font-hud text-[11px] leading-snug text-white/55">{d}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="font-tech text-[10px] tracking-[0.3em] text-cyan-200/70">WORLD</span>
              <select className="ui-sel" value={planet} onChange={e => { setPlanet(e.target.value as PlanetId); setLevel(1); }}>{MAP_ORDER.map(id => <option key={id} value={id}>{PLANETS[id].name}</option>)}</select></label>
            {mode === 'coop'
              ? <label className="block"><span className="font-tech text-[10px] tracking-[0.3em] text-cyan-200/70">LEVEL</span>
                <select className="ui-sel" value={level} onChange={e => setLevel(+e.target.value)}>{Array.from({ length: avail }, (_, i) => <option key={i} value={i + 1}>{i + 1} — {PLANETS[planet].levelNames[i]}</option>)}</select></label>
              : <div><span className="font-tech text-[10px] tracking-[0.3em] text-cyan-200/70">DEDICATED ARENA</span><div className="border border-white/10 bg-black/40 px-3 py-2 font-hud text-sm text-white/80">{ARENAS[planet].name}</div></div>}
          </div>
          {mode === 'arena' && <div className="border-l-2 border-cyan-300/60 bg-black/40 px-3 py-2">
            <div className="font-tech text-[10px] tracking-[0.18em] text-cyan-100" style={{ color: PLANETS[planet].css }}>{ARENAS[planet].subtitle}</div>
            <div className="mt-1 font-hud text-sm leading-snug text-white/70">{ARENAS[planet].description}</div>
            <div className="mt-1 font-tech text-[9px] tracking-wider text-white/40">{ARENAS[planet].feature}</div>
          </div>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button disabled={busy} onClick={host} className={`${btn} ui-btn-cyan`}>◈ Host game</button>
            <div className="flex gap-1">
              <input className={`${inputCls} text-center font-tech tracking-[0.3em] uppercase`} placeholder="CODE" maxLength={6} value={codeIn} onChange={e => setCodeIn(e.target.value.toUpperCase())} />
              <button disabled={busy} onClick={join} className={`${btn} ui-btn-red shrink-0`}>Join ▸</button>
            </div>
          </div>
        </div>
      )}

      {view === 'lobby' && session && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between border border-white/10 bg-black/50 px-4 py-3">
            <div><div className="font-tech text-[9px] tracking-[0.35em] text-cyan-200/60">ROOM CODE</div>
              <div className="font-tech text-4xl tracking-[0.3em] text-white">{session.code}</div></div>
            <button onClick={() => { void navigator.clipboard?.writeText(session.code).catch(() => undefined); setStatus('Room code copied.'); }} className={`${btn}`}>Copy</button>
          </div>
          <div>
            <div className="font-tech text-[10px] tracking-[0.3em] text-cyan-200/70">SQUAD ({peers.length})</div>
            <div className="mt-1 space-y-1">
              {peers.map(p => <div key={p.id} className="flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1.5 font-hud text-sm text-white/85"><span className="h-2.5 w-2.5 rounded-full" style={{ background: hex(p.color), boxShadow: `0 0 8px ${hex(p.color)}` }} />{p.name}{p.isHost && <span className="ml-auto font-tech text-[9px] tracking-[0.25em] text-cyan-300">HOST</span>}{p.id === session.localId && <span className="ml-auto font-tech text-[9px] tracking-[0.25em] text-white/40">YOU</span>}</div>)}
            </div>
          </div>
          <div className="font-hud text-sm text-white/70">{mode === 'arena' ? `Free-for-All · ${ARENAS[planet].name}` : `Co-op Campaign · ${PLANETS[planet].name} · Level ${level}`}</div>
          {session.role === 'host'
            ? <button onClick={start} className={`${btn} ui-btn-cyan w-full py-3 text-center text-sm font-black`}>▶ Deploy squad</button>
            : <div className="border border-white/10 bg-black/40 px-3 py-2.5 text-center font-hud text-sm text-white/60">Waiting for the host to deploy…</div>}
        </div>
      )}

      {status && <div className="mt-3 border-l-2 border-cyan-300/70 bg-cyan-400/5 px-3 py-1.5 font-hud text-xs text-cyan-100/80">{status}</div>}
      <button onClick={leave} className="mt-4 font-tech text-[10px] tracking-[0.3em] text-white/45 uppercase hover:text-white">← Back</button>
    </div>
  );
}
