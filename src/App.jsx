import { useEffect, useMemo, useState } from 'react';
import SetupPanel from './components/SetupPanel.jsx';
import RaceView from './components/RaceView.jsx';
import { computeGroupSizes, parseNames } from './lib/groups.js';
import { DEFAULT_LAYOUT } from './lib/seats.js';
import { storage } from './lib/storage.js';

export const DEFAULT_SETTINGS = {
  title: '일본어 수업 조 편성',
  namesText: '',
  mode: 'size', // 'size' = 그룹당 인원, 'count' = 그룹 수
  value: 4,
  remainder: 'spread', // 'spread' | 'separate'
  mapLength: 'normal',
  ballSize: 'auto',
  speed: 1,
  showNames: true,
  obstacles: { pegs: true, spinners: true, bumpers: true, sliders: true, ramps: true },
  seatEnabled: true,
  seatLayout: DEFAULT_LAYOUT, // 분단별 팀 수 (1분단 2팀, 2분단 1팀, 3분단 2팀)
  seatOrder: 'random', // 'random' | 'order'
  pickPresenter: true, // 조마다 발표자 뽑기
  pickMC: true, // 조마다 회화 진행 MC 뽑기 (발표자와 겹치지 않음)
  pickOrder: true, // 모든 조가 정해진 뒤 발표 순서 랜덤 지정
};

function loadSettings() {
  const saved = storage.loadSettings();
  if (!saved) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    obstacles: { ...DEFAULT_SETTINGS.obstacles, ...saved.obstacles },
    seatLayout: Array.isArray(saved.seatLayout) && saved.seatLayout.length ? saved.seatLayout : DEFAULT_LAYOUT,
  };
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [screen, setScreen] = useState('setup');
  const [raceKey, setRaceKey] = useState(0);

  useEffect(() => {
    storage.saveSettings(settings);
  }, [settings]);

  const names = useMemo(() => parseNames(settings.namesText), [settings.namesText]);
  const sizes = useMemo(
    () => computeGroupSizes(names.length, settings.mode, settings.value, settings.remainder),
    [names.length, settings.mode, settings.value, settings.remainder],
  );

  if (screen === 'setup') {
    return (
      <SetupPanel
        settings={settings}
        setSettings={setSettings}
        names={names}
        sizes={sizes}
        onStart={() => {
          storage.saveLastUsed({ namesText: settings.namesText, count: names.length, usedAt: Date.now() });
          setRaceKey((k) => k + 1);
          setScreen('race');
        }}
      />
    );
  }

  return (
    <RaceView
      key={raceKey}
      names={names}
      sizes={sizes}
      settings={settings}
      onExit={() => setScreen('setup')}
      onRestart={() => setRaceKey((k) => k + 1)}
    />
  );
}
