import { useCallback, useEffect, useRef, useState } from 'react';
import { Race, WORLD_W } from '../lib/race.js';
import GroupBoard from './GroupBoard.jsx';
import ResultModal from './ResultModal.jsx';
import { makeAssignment } from '../lib/seats.js';
import { hasAnyRole, pickRoles } from '../lib/roles.js';
import { makeOrder } from '../lib/order.js';
import { LangSwitch, translate, useI18n } from '../i18n/index.jsx';

const emptyGroups = (sizes) => sizes.map(() => []);

export default function RaceView({ names, sizes, settings, title, lang, setLang, onExit, onRestart }) {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const raceRef = useRef(null);
  const assignRef = useRef({ idx: 0, groups: emptyGroups(sizes), roles: [] });
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
  const [roles, setRoles] = useState([]); // roles[조] = { presenter, mc }
  const roleOptions = { presenter: settings.pickPresenter, mc: settings.pickMC };
  const [order, setOrder] = useState(null); // 발표 순서 (조 번호 배열)

  /** toast = { groupIdx, role } — 문구는 렌더링 시 현재 언어로 만든다 */
  const showToast = useCallback((data) => {
    const long = Boolean(data.role?.presenter || data.role?.mc);
    setToast({ ...data, long, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), long ? 2600 : 1600);
  }, []);

  // 레이스(맵) 생성
  useEffect(() => {
    assignRef.current = { idx: 0, groups: emptyGroups(sizes), roles: [] };
    setRoles([]);
    const opts = { presenter: settings.pickPresenter, mc: settings.pickMC };

    const onFinish = (ball, rank) => {
      const a = assignRef.current;
      const idx = a.idx;
      a.groups[idx].push({ name: ball.name, color: ball.color, rank });
      if (a.groups[idx].length >= sizes[idx]) {
        // 조가 완성되는 순간 그 조의 발표자 / MC를 뽑는다
        let role = null;
        if (hasAnyRole(opts)) {
          role = pickRoles(a.groups[idx], opts);
          a.roles[idx] = role;
          setRoles([...a.roles]);
        }
        // 문구는 렌더링할 때 현재 언어로 만든다 (데이터만 넘김)
        showToast({ groupIdx: idx, role });
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
        // 모든 조가 확정된 뒤에 발표 순서를 랜덤으로 정한다
        if (settings.pickOrder) setOrder(makeOrder(sizes.length));
        // 마지막 조의 역할 발표 토스트를 볼 수 있도록 조금 기다렸다 결과 창을 연다
        setTimeout(() => setShowResult(true), hasAnyRole(opts) ? 2200 : 1000);
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

  // 캔버스 안 "N등 / N位" 문구를 언어에 맞춘다
  useEffect(() => {
    const race = raceRef.current;
    if (!race) return;
    race.rankText = (rank, name) => translate(lang, 'canvas.rank', { rank, name });
  }, [lang, mapSeed]);

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
    if ((phase === 'running' || phase === 'paused') && !confirm(t('race.confirmExit'))) return;
    onExit();
  };

  const toastRole = toast?.role;
  const toastSub = toastRole
    ? [
        toastRole.presenter && t('toast.presenter', { name: toastRole.presenter }),
        toastRole.mc && t('toast.mc', { name: toastRole.mc }),
      ]
        .filter(Boolean)
        .join('  ·  ')
    : null;

  return (
    <div className="race">
      <header className="race-bar">
        <h1>{title}</h1>
        <div className="race-status">
          {t('race.arrived')} <b>{arrived}</b> / {names.length}
          {phase !== 'done' && phase !== 'ready' && (
            <span className="now">
              → <b>{t('group', { n: current + 1 })}</b> {t('race.assigning')}
            </span>
          )}
        </div>
        <div className="controls">
          {phase === 'ready' && (
            <>
              <button type="button" className="ghost" onClick={() => setMapSeed((s) => s + 1)}>
                {t('race.remap')}
              </button>
              <button type="button" className="primary" onClick={start}>
                {t('race.start')}
              </button>
            </>
          )}
          {(phase === 'running' || phase === 'paused') && (
            <button type="button" className="primary" onClick={togglePause}>
              {phase === 'running' ? t('race.pause') : t('race.resume')}
            </button>
          )}
          {phase === 'done' && (
            <button type="button" className="primary" onClick={() => setShowResult(true)}>
              {t('race.showResult')}
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
            {['leader', 'last', 'free'].map((v) => (
              <button key={v} type="button" className={camMode === v ? 'active' : ''} onClick={() => setCamMode(v)}>
                {t(`cam.${v}`)}
              </button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={onRestart}>
            {t('race.restart')}
          </button>
          <button type="button" className="ghost" onClick={exit}>
            {t('race.settings')}
          </button>
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
      </header>

      <main className="race-main">
        <div className="stage" ref={wrapRef}>
          <canvas ref={canvasRef} onClick={onCanvasClick} />
          {phase === 'ready' && (
            <div className="stage-overlay">
              <button type="button" className="primary big" onClick={start}>
                {t('race.start')}
              </button>
              <p>{t('race.hint')}</p>
            </div>
          )}
          {phase === 'paused' && <div className="paused-label">{t('race.paused')}</div>}
          {toast && (
            <div key={toast.id} className={`toast ${toast.long ? 'long' : ''}`}>
              {t('toast.groupDone', { group: t('group', { n: toast.groupIdx + 1 }) })}
              {toastSub && <div className="toast-sub">{toastSub}</div>}
            </div>
          )}
        </div>
        <GroupBoard groups={groups} sizes={sizes} current={current} done={phase === 'done'} roles={roles} />
      </main>

      {showResult && (
        <ResultModal
          title={title}
          groups={groups}
          layout={layout}
          assignment={assignment}
          onAssignmentChange={setAssignment}
          roles={roles}
          roleOptions={roleOptions}
          onRolesChange={setRoles}
          order={order}
          onOrderChange={setOrder}
          onClose={() => setShowResult(false)}
          onRestart={onRestart}
          onExit={onExit}
        />
      )}
    </div>
  );
}
