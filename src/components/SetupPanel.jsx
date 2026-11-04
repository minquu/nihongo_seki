import { useState } from 'react';
import { parseNames } from '../lib/groups.js';
import { isValidAssignment, makeAssignment, slotCount } from '../lib/seats.js';
import { formatDate, storage } from '../lib/storage.js';
import { isValidOrder } from '../lib/order.js';
import ResultModal from './ResultModal.jsx';

const OBSTACLE_LABELS = {
  pegs: '핀 (Plinko)',
  spinners: '회전 막대',
  bumpers: '범퍼',
  sliders: '이동 막대',
  ramps: '경사로',
};

const SAMPLE = ['김민수', '이서연', '박지훈', '최유나', '정하준', '강서윤', '조민재', '윤지아', '장도현', '임수아', '한예준', '오하린'];

function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={value === v ? 'active' : ''}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MiniStepper({ value, min, max, onChange, unit }) {
  return (
    <div className="stepper mini">
      <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b>{value}</b>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
      {unit && <em>{unit}</em>}
    </div>
  );
}

function RosterBar({ namesText, onLoad }) {
  const [rosters, setRosters] = useState(storage.loadRosters);
  const [selectedId, setSelectedId] = useState('');
  const lastUsed = storage.loadLastUsed();

  const update = (list) => {
    setRosters(list);
    storage.saveRosters(list);
  };

  const confirmReplace = () =>
    !namesText.trim() || confirm('지금 입력된 명단을 바꿀까요?');

  const load = (id) => {
    setSelectedId(id);
    const r = rosters.find((x) => x.id === id);
    if (r && r.namesText !== namesText && confirmReplace()) onLoad(r.namesText);
  };

  const save = () => {
    const current = rosters.find((x) => x.id === selectedId);
    const name = prompt('명단 이름을 입력하세요 (같은 이름이면 덮어씁니다)', current?.name ?? '');
    if (!name?.trim()) return;
    const existing = rosters.find((x) => x.name === name.trim());
    const entry = {
      id: existing?.id ?? String(Date.now()),
      name: name.trim(),
      namesText,
      updatedAt: Date.now(),
    };
    update([entry, ...rosters.filter((x) => x.id !== entry.id)]);
    setSelectedId(entry.id);
  };

  const remove = () => {
    const r = rosters.find((x) => x.id === selectedId);
    if (!r || !confirm(`"${r.name}" 명단을 삭제할까요?`)) return;
    update(rosters.filter((x) => x.id !== selectedId));
    setSelectedId('');
  };

  return (
    <div className="roster">
      {lastUsed && lastUsed.namesText !== namesText && (
        <div className="last-used">
          <span>
            지난번 사용한 명단 <b>{lastUsed.count}명</b>
            <small> · {formatDate(lastUsed.usedAt)}</small>
          </span>
          <button
            type="button"
            className="primary"
            onClick={() => confirmReplace() && onLoad(lastUsed.namesText)}
          >
            불러오기
          </button>
        </div>
      )}
      <div className="row gap">
        <select value={selectedId} onChange={(e) => load(e.target.value)}>
          <option value="">저장된 명단 선택…</option>
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({parseNames(r.namesText).length}명)
            </option>
          ))}
        </select>
        <button type="button" className="ghost" onClick={save} disabled={!namesText.trim()}>
          💾 명단 저장
        </button>
        {selectedId && (
          <button type="button" className="ghost danger" onClick={remove}>
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function SeatLayoutEditor({ settings, set, groupCount }) {
  const layout = settings.seatLayout;
  const slots = slotCount(layout);
  const setLayout = (next) => set({ seatLayout: next });

  return (
    <section className="card wide">
      <div className="card-title">
        <h2>자리 배치</h2>
        <label className="check-line">
          <input
            type="checkbox"
            checked={settings.seatEnabled}
            onChange={(e) => set({ seatEnabled: e.target.checked })}
          />
          레이스가 끝나면 팀별 자리 지정
        </label>
      </div>

      {settings.seatEnabled && (
        <div className="seat-setup">
          <div className="seat-editor">
            <div className="field">
              <span>분단별 팀 수 (앞 → 뒤로 배치)</span>
              {layout.map((n, i) => (
                <div key={i} className="bundan-row">
                  <span className="bundan-name">{i + 1}분단</span>
                  <MiniStepper
                    value={n}
                    min={1}
                    max={6}
                    unit="팀"
                    onChange={(v) => setLayout(layout.map((x, j) => (j === i ? v : x)))}
                  />
                </div>
              ))}
              <div className="row gap">
                <button
                  type="button"
                  className="ghost"
                  disabled={layout.length >= 6}
                  onClick={() => setLayout([...layout, 1])}
                >
                  + 분단 추가
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={layout.length <= 1}
                  onClick={() => setLayout(layout.slice(0, -1))}
                >
                  − 분단 삭제
                </button>
              </div>
            </div>

            <div className="field">
              <span>팀 → 자리 배정 방식</span>
              <Segmented
                value={settings.seatOrder}
                options={[
                  ['random', '🎲 랜덤'],
                  ['order', '1조부터 순서대로'],
                ]}
                onChange={(seatOrder) => set({ seatOrder })}
              />
            </div>

            {groupCount > 0 && groupCount !== slots && (
              <div className="mismatch">
                <span>
                  자리는 <b>{slots}팀</b>분인데 그룹은 <b>{groupCount}개</b>입니다.
                  {groupCount > slots ? ' 남는 조는 "자리 미배정"으로 표시됩니다.' : ' 빈 자리가 생깁니다.'}
                </span>
                <button type="button" className="ghost" onClick={() => set({ mode: 'count', value: slots })}>
                  그룹 수를 {slots}개로 맞추기
                </button>
              </div>
            )}
          </div>

          <div className="mini-classroom" aria-label="자리 배치 미리보기">
            <div className="blackboard small">칠판</div>
            <div className="bundans" style={{ gridTemplateColumns: `repeat(${layout.length}, 1fr)` }}>
              {layout.map((n, i) => (
                <div key={i} className="bundan">
                  <div className="bundan-label">{i + 1}분단</div>
                  {Array.from({ length: n }, (_, r) => (
                    <div key={r} className="mini-slot">
                      팀
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SetupPanel({ settings, setSettings, names, sizes, onStart }) {
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const setObstacle = (key, on) =>
    setSettings((s) => ({ ...s, obstacles: { ...s.obstacles, [key]: on } }));

  const [lastResult, setLastResult] = useState(storage.loadLastResult);
  const [showLast, setShowLast] = useState(false);

  const openLastResult = () => {
    const r = storage.loadLastResult();
    if (!r) return;
    if (r.layout && !isValidAssignment(r.assignment, r.groups.length, r.layout)) {
      r.assignment = makeAssignment(r.groups.length, r.layout, 'order');
    }
    setLastResult(r);
    setShowLast(true);
  };

  const anyObstacle = Object.values(settings.obstacles).some(Boolean);
  const canStart = names.length >= 2 && sizes.length >= 1 && anyObstacle;
  const value = Number(settings.value) || 1;

  return (
    <div className="setup">
      <header className="setup-header">
        <div>
          <h1>🎱 랜덤 조 편성 레이스</h1>
          <p>공이 떨어지는 순서대로 조가 정해집니다.</p>
        </div>
        {lastResult && (
          <button type="button" className="ghost" onClick={openLastResult}>
            📋 지난 결과 보기 <small className="muted">({formatDate(lastResult.savedAt)})</small>
          </button>
        )}
      </header>

      <div className="setup-grid">
        <section className="card">
          <div className="card-title">
            <h2>참가자</h2>
            <span className="badge">{names.length}명</span>
          </div>
          <RosterBar namesText={settings.namesText} onLoad={(namesText) => set({ namesText })} />
          <textarea
            className="names"
            value={settings.namesText}
            placeholder={'한 줄에 한 명씩 입력하세요\n(쉼표로 구분해도 됩니다)'}
            onChange={(e) => set({ namesText: e.target.value })}
          />
          <div className="row gap">
            <button type="button" className="ghost" onClick={() => set({ namesText: SAMPLE.join('\n') })}>
              예시 넣기
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => set({ namesText: names.slice().sort((a, b) => a.localeCompare(b, 'ko')).join('\n') })}
              disabled={names.length < 2}
            >
              가나다 정렬
            </button>
            <button type="button" className="ghost danger" onClick={() => set({ namesText: '' })}>
              비우기
            </button>
          </div>
          <small className="muted">입력한 명단은 이 브라우저에 자동 저장됩니다.</small>
        </section>

        <section className="card">
          <h2>설정</h2>

          <label className="field">
            <span>제목</span>
            <input type="text" value={settings.title} onChange={(e) => set({ title: e.target.value })} />
          </label>

          <div className="field">
            <span>그룹 나누는 방식</span>
            <Segmented
              value={settings.mode}
              options={[
                ['size', '그룹당 인원'],
                ['count', '그룹 수'],
              ]}
              onChange={(mode) => set({ mode })}
            />
          </div>

          <div className="field">
            <span>{settings.mode === 'size' ? '한 그룹 인원' : '그룹 개수'}</span>
            <div className="stepper">
              <button type="button" onClick={() => set({ value: Math.max(1, value - 1) })}>−</button>
              <input
                type="number"
                min={1}
                value={settings.value}
                onChange={(e) => set({ value: e.target.value })}
              />
              <button type="button" onClick={() => set({ value: value + 1 })}>+</button>
              <em>{settings.mode === 'size' ? '명' : '개 조'}</em>
            </div>
          </div>

          {settings.mode === 'size' && names.length % Math.max(1, value) !== 0 && names.length > value && (
            <div className="field">
              <span>남는 인원 처리</span>
              <Segmented
                value={settings.remainder}
                options={[
                  ['spread', '앞 조부터 한 명씩 추가'],
                  ['separate', '남은 인원끼리 한 조'],
                ]}
                onChange={(remainder) => set({ remainder })}
              />
            </div>
          )}

          <div className="preview">
            {sizes.length === 0 ? (
              <span className="muted">참가자를 2명 이상 입력하세요</span>
            ) : (
              sizes.map((n, i) => (
                <span key={i} className="chip">
                  {i + 1}조 <b>{n}명</b>
                </span>
              ))
            )}
          </div>

          <div className="field">
            <span>조별 역할 뽑기</span>
            <div className="checks">
              <label className={`check ${settings.pickPresenter ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.pickPresenter}
                  onChange={(e) => set({ pickPresenter: e.target.checked })}
                />
                📢 발표자
              </label>
              <label className={`check ${settings.pickMC ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.pickMC}
                  onChange={(e) => set({ pickMC: e.target.checked })}
                />
                🎙️ MC (회화 진행)
              </label>
            </div>
            {(settings.pickPresenter || settings.pickMC) && (
              <small className="muted">
                조 인원이 다 차면 그 조 안에서 랜덤으로 뽑습니다.
                {settings.pickPresenter && settings.pickMC && ' 발표자와 MC는 겹치지 않습니다.'}
              </small>
            )}
          </div>

          <div className="field">
            <span>발표 순서</span>
            <label className={`check ${settings.pickOrder ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }}>
              <input
                type="checkbox"
                checked={settings.pickOrder}
                onChange={(e) => set({ pickOrder: e.target.checked })}
              />
              🎤 조별 발표 순서 랜덤 지정
            </label>
            {settings.pickOrder && <small className="muted">모든 조가 정해진 뒤에 순서를 뽑습니다.</small>}
          </div>

          <div className="field">
            <span>맵 길이</span>
            <Segmented
              value={settings.mapLength}
              options={[
                ['short', '짧게'],
                ['normal', '보통'],
                ['long', '길게'],
              ]}
              onChange={(mapLength) => set({ mapLength })}
            />
          </div>

          <div className="field">
            <span>공 크기</span>
            <Segmented
              value={settings.ballSize}
              options={[
                ['auto', '자동'],
                ['small', '작게'],
                ['large', '크게'],
              ]}
              onChange={(ballSize) => set({ ballSize })}
            />
          </div>

          <div className="field">
            <span>기본 속도</span>
            <Segmented
              value={settings.speed}
              options={[
                [1, '1x'],
                [2, '2x'],
                [3, '3x'],
              ]}
              onChange={(speed) => set({ speed })}
            />
          </div>

          <div className="field">
            <span>장애물</span>
            <div className="checks">
              {Object.entries(OBSTACLE_LABELS).map(([key, label]) => (
                <label key={key} className={`check ${settings.obstacles[key] ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={settings.obstacles[key]}
                    onChange={(e) => setObstacle(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {!anyObstacle && <small className="warn">장애물을 하나 이상 선택하세요</small>}
          </div>

          <label className="check-line">
            <input
              type="checkbox"
              checked={settings.showNames}
              onChange={(e) => set({ showNames: e.target.checked })}
            />
            공 위에 이름 표시
          </label>
        </section>

        <SeatLayoutEditor settings={settings} set={set} groupCount={sizes.length} />
      </div>

      <div className="setup-footer">
        <button type="button" className="primary big" disabled={!canStart} onClick={onStart}>
          레이스 준비 →
        </button>
      </div>

      {showLast && lastResult && (
        <ResultModal
          title={lastResult.title}
          groups={lastResult.groups}
          layout={lastResult.layout}
          assignment={lastResult.assignment}
          roles={lastResult.roles ?? []}
          roleOptions={lastResult.roleOptions ?? { presenter: false, mc: false }}
          savedAt={lastResult.savedAt}
          onAssignmentChange={(assignment) => setLastResult((r) => ({ ...r, assignment }))}
          onRolesChange={(roles) => setLastResult((r) => ({ ...r, roles }))}
          order={isValidOrder(lastResult.order, lastResult.groups.length) ? lastResult.order : null}
          onOrderChange={(order) => setLastResult((r) => ({ ...r, order }))}
          onClose={() => setShowLast(false)}
        />
      )}
    </div>
  );
}
