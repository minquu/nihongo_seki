import { useCallback, useEffect, useRef, useState } from 'react';
import { Race, WORLD_W } from '../lib/race.js';
import GroupBoard from './GroupBoard.jsx';
import ResultModal from './ResultModal.jsx';
import { makeAssignment } from '../lib/seats.js';

const emptyGroups = (sizes) => sizes.map(() => []);

export default function RaceView({ names, sizes, settings, onExit, onRestart }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const raceRef = useRef(null);
  const assignRef = useRef({ idx: 0, groups: emptyGroups(sizes) });
  const toastTimer = useRef(null);

  const [mapSeed, setMapSeed] = useState(0);
  const [phase, setPhase] = useState('ready'); // ready | running | paused | done
  const [speed, setSpeed] = useState(settings.speed);
  const [camMode, setCamMode] = useState('leader');
  const [groups, setGroups] = useState(() => emptyGroups(sizes));
  const [current, setCurrent] = useState(0);
  const [arrived, setArrived] = useState(0);
  const [toast, setToast] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const layout = settings.seatEnabled ? settings.seatLayout : null;

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  // 레이스(맵) 생성
  useEffect(() => {
    assignRef.current = { idx: 0, groups: emptyGroups(sizes) };

    const onFinish = (ball, rank) => {
      const a = assignRef.current;
      const idx = a.idx;
      a.groups[idx].push({ name: ball.name, color: ball.color, rank });
      if (a.groups[idx].length >= sizes[idx]) {
        showToast(`${idx + 1}조 완성!`);
        if (idx < sizes.length - 1) a.idx = idx + 1;
      }
      setGroups(a.groups.map((g) => [...g]));
      setCurrent(a.idx);
      setArrived(rank);
      if (rank === names.length) {
        setPhase('done');
        if (settings.seatEnabled) {
          setAssignment(makeAssignment(sizes.length, settings.seatLayout, settings.seatOrder));
        }
        setTimeout(() => setShowResult(true), 1000);
      }
    };

    const race = new Race({
      names,
      mapLength: settings.mapLength,
      obstacles: settings.obstacles,
      ballSize: settings.ballSize,
      onFinish,
    });
    raceRef.current = race;
    return () => race.destroy();
  }, [mapSeed, names, sizes, settings, showToast]);

  // 렌더 루프 + 캔버스 크기
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = wrap;
      canvas.width = Math.round(clientWidth * dpr);
      canvas.height = Math.round(clientHeight * dpr);
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf;
    const loop = () => {
      const race = raceRef.current;
      if (race) {
        race.update();
        race.draw(ctx, canvas.width / dpr, canvas.height / dpr, dpr, {
          showNames: settings.showNames,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [settings.showNames]);

  // React 상태 → 레이스 객체 동기화
  useEffect(() => {
    const race = raceRef.current;
    if (!race) return;
    race.speed = speed;
    race.paused = phase === 'paused';
    race.camMode = camMode;
  }, [speed, phase, camMode, mapSeed]);

  const start = useCallback(() => {
    raceRef.current?.start();
    setPhase('running');
    if (camMode === 'free') setCamMode('leader');
  }, [camMode]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'running' ? 'paused' : p === 'paused' ? 'running' : p));
  }, []);

  // 스페이스바: 시작 / 일시정지
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target.tagName === 'INPUT') return;
      e.preventDefault();
      if (phase === 'ready') start();
      else togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start, togglePause]);

  // 휠 스크롤로 맵 둘러보기
  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const race = raceRef.current;
      if (!race) return;
      race.scrollBy(e.deltaY / (canvas.clientWidth / WORLD_W));
      setCamMode('free');
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const onCanvasClick = (e) => {
    const race = raceRef.current;
    const canvas = canvasRef.current;
    if (!race) return;
    const rect = canvas.getBoundingClientRect();
    const viewH = canvas.clientHeight / (canvas.clientWidth / WORLD_W);
    if (race.minimapJump(e.clientX - rect.left, e.clientY - rect.top, viewH)) setCamMode('free');
  };

  const exit = () => {
    if ((phase === 'running' || phase === 'paused') && !confirm('진행 중인 레이스를 그만두고 설정으로 돌아갈까요?')) return;
    onExit();
  };

  return (
    <div className="race">
      <header className="race-bar">
        <h1>{settings.title}</h1>
        <div className="race-status">
          도착 <b>{arrived}</b> / {names.length}
          {phase !== 'done' && phase !== 'ready' && (
            <span className="now">
              → <b>{current + 1}조</b> 배정 중
            </span>
          )}
        </div>
        <div className="controls">
          {phase === 'ready' && (
            <>
              <button type="button" className="ghost" onClick={() => setMapSeed((s) => s + 1)}>
                🔀 맵 다시 만들기
              </button>
              <button type="button" className="primary" onClick={start}>
                ▶ 시작
              </button>
            </>
          )}
          {(phase === 'running' || phase === 'paused') && (
            <button type="button" className="primary" onClick={togglePause}>
              {phase === 'running' ? '⏸ 일시정지' : '▶ 계속'}
            </button>
          )}
          {phase === 'done' && (
            <button type="button" className="primary" onClick={() => setShowResult(true)}>
              결과 보기
            </button>
          )}
          <div className="segmented small">
            {[1, 2, 4].map((v) => (
              <button key={v} type="button" className={speed === v ? 'active' : ''} onClick={() => setSpeed(v)}>
                {v}x
              </button>
            ))}
          </div>
          <div className="segmented small">
            {[
              ['leader', '선두'],
              ['last', '꼴찌'],
              ['free', '자유'],
            ].map(([v, label]) => (
              <button key={v} type="button" className={camMode === v ? 'active' : ''} onClick={() => setCamMode(v)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={onRestart}>
            ↺ 처음부터
          </button>
          <button type="button" className="ghost" onClick={exit}>
            ⚙ 설정
          </button>
        </div>
      </header>

      <main className="race-main">
        <div className="stage" ref={wrapRef}>
          <canvas ref={canvasRef} onClick={onCanvasClick} />
          {phase === 'ready' && (
            <div className="stage-overlay">
              <button type="button" className="primary big" onClick={start}>
                ▶ 시작
              </button>
              <p>스페이스바로도 시작할 수 있어요 · 휠/미니맵으로 맵 미리보기</p>
            </div>
          )}
          {phase === 'paused' && <div className="paused-label">일시정지</div>}
          {toast && <div className="toast">{toast}</div>}
        </div>
        <GroupBoard groups={groups} sizes={sizes} current={current} done={phase === 'done'} />
      </main>

      {showResult && (
        <ResultModal
          title={settings.title}
          groups={groups}
          layout={layout}
          assignment={assignment}
          onAssignmentChange={setAssignment}
          onClose={() => setShowResult(false)}
          onRestart={onRestart}
          onExit={onExit}
        />
      )}
    </div>
  );
}
