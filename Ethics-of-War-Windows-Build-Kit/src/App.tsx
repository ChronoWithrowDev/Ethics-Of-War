import { useCallback, useEffect, useState } from 'react';
import StarMap from './ui/StarMap';
import GameView from './ui/GameView';
import { TitleScreen, Briefing, Complete, FsButton } from './ui/Screens';
import { loadSave, writeSave, defaultSave } from './game/save';
import type { SaveData } from './game/save';
import { PLANETS } from './game/data';
import type { PlanetId } from './game/data';
import type { Inventory, LevelStats } from './game/engine';
import { audio } from './game/audio';
import type { MPGameCfg } from './game/net';

type Screen = 'title' | 'map' | 'briefing' | 'play' | 'complete';

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const [screen, setScreen] = useState<Screen>('title');
  const [planet, setPlanet] = useState<PlanetId>('earth');
  const [level, setLevel] = useState(1);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<LevelStats | null>(null);
  const [mp, setMp] = useState<MPGameCfg | null>(null);

  useEffect(() => { writeSave(save); audio.setVolumes(save.settings.volume, save.settings.music); }, [save]);

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => { /* not allowed in this context */ });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'KeyF' && !e.repeat && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleFs(); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [toggleFs]);

  const patchSettings = (p: Partial<SaveData['settings']>) => setSave(s => ({ ...s, settings: { ...s.settings, ...p } }));
  const onComplete = (stats: LevelStats, inv: Inventory) => {
    setSave(s => ({ ...s, inv, completed: { ...s.completed, [planet]: Math.max(s.completed[planet] || 0, level) } }));
    setResult(stats); setScreen('complete');
  };
  const start = (p: PlanetId, l: number) => { setPlanet(p); setLevel(l); setRun(r => r + 1); setScreen('play'); };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {screen === 'title' && <TitleScreen save={save} onPlay={() => { audio.init(); setMp(null); setScreen('map'); }} onSettings={patchSettings} onDev={b => setSave(s => ({ ...s, dev: b }))} onReset={() => setSave(defaultSave())} onMPStart={cfg => { setMp(cfg); setPlanet(cfg.planet); setLevel(cfg.level); setRun(r => r + 1); setScreen('play'); }} />}
      {screen === 'map' && <StarMap save={save} onSelect={id => { setPlanet(id); setScreen('briefing'); }} onBack={() => setScreen('title')} />}
      {screen === 'briefing' && <Briefing planetId={planet} save={save} onStart={l => start(planet, l)} onBack={() => setScreen('map')} />}
      {screen === 'play' && (
        <GameView key={`${planet}-${level}-${run}-${mp?.session.code || 'sp'}`} planet={planet} level={level} save={save} onComplete={onComplete} onExit={() => setScreen('map')} onRetry={() => setRun(r => r + 1)}
          onJump={(p, l) => start(p, l)} toggleFullscreen={toggleFs} onSettings={patchSettings} mp={mp} onMpExit={() => { mp?.session.destroy(); setMp(null); setScreen('title'); }} />
      )}
      {screen === 'complete' && result && (
        <Complete planetId={planet} level={level} stats={result} onMap={() => setScreen('map')}
          onNext={() => { if (level < PLANETS[planet].levels) start(planet, level + 1); else setScreen('map'); }} />
      )}
      {screen !== 'play' && <FsButton onClick={toggleFs} />}
    </div>
  );
}
