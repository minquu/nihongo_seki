import { useState } from 'react';
import { parseNames } from '../lib/groups.js';
import { isValidAssignment, makeAssignment, slotCount } from '../lib/seats.js';
import { formatDate, storage } from '../lib/storage.js';
import { isValidOrder } from '../lib/order.js';
import { displayTitle, LANGS, LangSwitch, useI18n } from '../i18n/index.jsx';
import ResultModal from './ResultModal.jsx';

const OBSTACLE_KEYS = ['pegs', 'spinners', 'bumpers', 'sliders', 'ramps'];

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
  const { t, locale } = useI18n();
  const [rosters, setRosters] = useState(storage.loadRosters);
  const [selectedId, setSelectedId] = useState('');
  const lastUsed = storage.loadLastUsed();

  const update = (list) => {
    setRosters(list);
    storage.saveRosters(list);
  };

  const confirmReplace = () => !namesText.trim() || confirm(t('roster.confirmReplace'));

  const load = (id) => {
    setSelectedId(id);
    const r = rosters.find((x) => x.id === id);
    if (r && r.namesText !== namesText && confirmReplace()) onLoad(r.namesText);
  };

  const save = () => {
    const current = rosters.find((x) => x.id === selectedId);
    const name = prompt(t('roster.promptName'), current?.name ?? '');
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
    if (!r || !confirm(t('roster.confirmDelete', { name: r.name }))) return;
    update(rosters.filter((x) => x.id !== selectedId));
    setSelectedId('');
  };

  return (
    <div className="roster">
      {lastUsed && lastUsed.namesText !== namesText && (
        <div className="last-used">
          <span>
            {t('roster.lastUsed')} <b>{t('people', { n: lastUsed.count })}</b>
            <small> · {formatDate(lastUsed.usedAt, locale)}</small>
          </span>
          <button
            type="button"
            className="primary"
            onClick={() => confirmReplace() && onLoad(lastUsed.namesText)}
          >
            {t('roster.load')}
          </button>
        </div>
      )}
      <div className="row gap">
        <select value={selectedId} onChange={(e) => load(e.target.value)}>
          <option value="">{t('roster.select')}</option>
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({t('people', { n: parseNames(r.namesText).length })})
            </option>
          ))}
        </select>
        <button type="button" className="ghost" onClick={save} disabled={!namesText.trim()}>
          {t('roster.save')}
        </button>
        {selectedId && (
          <button type="button" className="ghost danger" onClick={remove}>
            {t('roster.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

function SeatLayoutEditor({ settings, set, groupCount }) {
  const { t } = useI18n();
  const layout = settings.seatLayout;
  const slots = slotCount(layout);
  const setLayout = (next) => set({ seatLayout: next });

  return (
    <section className="card wide">
      <div className="card-title">
        <h2>{t('seat.title')}</h2>
        <label className="check-line">
          <input
            type="checkbox"
            checked={settings.seatEnabled}
            onChange={(e) => set({ seatEnabled: e.target.checked })}
          />
          {t('seat.enable')}
        </label>
      </div>

      {settings.seatEnabled && (
        <div className="seat-setup">
          <div className="seat-editor">
            <div className="field">
              <span>{t('seat.perColumn')}</span>
              {layout.map((n, i) => (
                <div key={i} className="bundan-row">
                  <span className="bundan-name">{t('column', { n: i + 1 })}</span>
                  <MiniStepper
                    value={n}
                    min={1}
                    max={6}
                    unit={t('unit.teams')}
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
                  {t('seat.addColumn')}
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={layout.length <= 1}
                  onClick={() => setLayout(layout.slice(0, -1))}
                >
                  {t('seat.removeColumn')}
                </button>
              </div>
            </div>

            <div className="field">
              <span>{t('seat.method')}</span>
              <Segmented
                value={settings.seatOrder}
                options={[
                  ['random', t('seat.random')],
                  ['order', t('seat.inOrder')],
                ]}
                onChange={(seatOrder) => set({ seatOrder })}
              />
            </div>

            {groupCount > 0 && groupCount !== slots && (
              <div className="mismatch">
                <span>
                  {t('seat.mismatch', { slots, groups: groupCount })}{' '}
                  {groupCount > slots ? t('seat.mismatchMore') : t('seat.mismatchLess')}
                </span>
                <button type="button" className="ghost" onClick={() => set({ mode: 'count', value: slots })}>
                  {t('seat.fit', { n: slots })}
                </button>
              </div>
            )}
          </div>

          <div className="mini-classroom" aria-label={t('seat.preview')}>
            <div className="blackboard small">{t('blackboard.short')}</div>
            <div className="bundans" style={{ gridTemplateColumns: `repeat(${layout.length}, minmax(0, 1fr))` }}>
              {layout.map((n, i) => (
                <div key={i} className="bundan">
                  <div className="bundan-label">{t('column', { n: i + 1 })}</div>
                  {Array.from({ length: n }, (_, r) => (
                    <div key={r} className="mini-slot">
                      {t('seat.team')}
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

export default function SetupPanel({ settings, setSettings, names, sizes, title, lang, setLang, onStart }) {
  const { t, locale } = useI18n();
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
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <div className="setup-header-actions">
          <LangSwitch lang={lang} onChange={setLang} />
          {lastResult && (
            <button type="button" className="ghost" onClick={openLastResult}>
              {t('lastResult.open')}{' '}
              <small className="muted">({formatDate(lastResult.savedAt, locale)})</small>
            </button>
          )}
        </div>
      </header>

      <div className="setup-grid">
        <section className="card">
          <div className="card-title">
            <h2>{t('participants')}</h2>
            <span className="badge">{t('people', { n: names.length })}</span>
          </div>
          <RosterBar namesText={settings.namesText} onLoad={(namesText) => set({ namesText })} />
          <textarea
            className="names"
            value={settings.namesText}
            placeholder={t('names.placeholder')}
            onChange={(e) => set({ namesText: e.target.value })}
          />
          <div className="row gap">
            <button
              type="button"
              className="ghost"
              onClick={() => set({ namesText: LANGS[lang].sample.join('\n') })}
            >
              {t('names.sample')}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                set({ namesText: names.slice().sort((a, b) => a.localeCompare(b, lang)).join('\n') })
              }
              disabled={names.length < 2}
            >
              {t('names.sort')}
            </button>
            <button type="button" className="ghost danger" onClick={() => set({ namesText: '' })}>
              {t('names.clear')}
            </button>
          </div>
          <small className="muted">{t('names.autosave')}</small>
        </section>

        <section className="card">
          <h2>{t('settings')}</h2>

          <label className="field">
            <span>{t('settings.title')}</span>
            <input
              type="text"
              value={title === t('defaultTitle') ? '' : title}
              placeholder={t('defaultTitle')}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>

          <div className="field">
            <span>{t('mode.label')}</span>
            <Segmented
              value={settings.mode}
              options={[
                ['size', t('mode.size')],
                ['count', t('mode.count')],
              ]}
              onChange={(mode) => set({ mode })}
            />
          </div>

          <div className="field">
            <span>{settings.mode === 'size' ? t('value.size') : t('value.count')}</span>
            <div className="stepper">
              <button type="button" onClick={() => set({ value: Math.max(1, value - 1) })}>−</button>
              <input
                type="number"
                min={1}
                value={settings.value}
                onChange={(e) => set({ value: e.target.value })}
              />
              <button type="button" onClick={() => set({ value: value + 1 })}>+</button>
              <em>{settings.mode === 'size' ? t('unit.people') : t('unit.groups')}</em>
            </div>
          </div>

          {settings.mode === 'size' && names.length % Math.max(1, value) !== 0 && names.length > value && (
            <div className="field">
              <span>{t('remainder.label')}</span>
              <Segmented
                value={settings.remainder}
                options={[
                  ['spread', t('remainder.spread')],
                  ['separate', t('remainder.separate')],
                ]}
                onChange={(remainder) => set({ remainder })}
              />
            </div>
          )}

          <div className="preview">
            {sizes.length === 0 ? (
              <span className="muted">{t('preview.empty')}</span>
            ) : (
              sizes.map((n, i) => (
                <span key={i} className="chip">
                  {t('group', { n: i + 1 })} <b>{t('people', { n })}</b>
                </span>
              ))
            )}
          </div>

          <div className="field">
            <span>{t('roles.label')}</span>
            <div className="checks">
              <label className={`check ${settings.pickPresenter ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.pickPresenter}
                  onChange={(e) => set({ pickPresenter: e.target.checked })}
                />
                {t('roles.presenterSetting')}
              </label>
              <label className={`check ${settings.pickMC ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.pickMC}
                  onChange={(e) => set({ pickMC: e.target.checked })}
                />
                {t('roles.mcSetting')}
              </label>
            </div>
            {(settings.pickPresenter || settings.pickMC) && (
              <small className="muted">
                {t('roles.hint')}
                {settings.pickPresenter && settings.pickMC && ` ${t('roles.hintNoOverlap')}`}
              </small>
            )}
          </div>

          <div className="field">
            <span>{t('order.label')}</span>
            <label className={`check ${settings.pickOrder ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }}>
              <input
                type="checkbox"
                checked={settings.pickOrder}
                onChange={(e) => set({ pickOrder: e.target.checked })}
              />
              {t('order.setting')}
            </label>
            {settings.pickOrder && <small className="muted">{t('order.hint')}</small>}
          </div>

          <div className="field">
            <span>{t('map.label')}</span>
            <Segmented
              value={settings.mapLength}
              options={[
                ['short', t('map.short')],
                ['normal', t('map.normal')],
                ['long', t('map.long')],
              ]}
              onChange={(mapLength) => set({ mapLength })}
            />
          </div>

          <div className="field">
            <span>{t('ball.label')}</span>
            <Segmented
              value={settings.ballSize}
              options={[
                ['auto', t('ball.auto')],
                ['small', t('ball.small')],
                ['large', t('ball.large')],
              ]}
              onChange={(ballSize) => set({ ballSize })}
            />
          </div>

          <div className="field">
            <span>{t('speed.label')}</span>
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
            <span>{t('obstacles.label')}</span>
            <div className="checks">
              {OBSTACLE_KEYS.map((key) => (
                <label key={key} className={`check ${settings.obstacles[key] ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={settings.obstacles[key]}
                    onChange={(e) => setObstacle(key, e.target.checked)}
                  />
                  {t(`obstacles.${key}`)}
                </label>
              ))}
            </div>
            {!anyObstacle && <small className="warn">{t('obstacles.none')}</small>}
          </div>

          <label className="check-line">
            <input
              type="checkbox"
              checked={settings.showNames}
              onChange={(e) => set({ showNames: e.target.checked })}
            />
            {t('showNames')}
          </label>
        </section>

        <SeatLayoutEditor settings={settings} set={set} groupCount={sizes.length} />
      </div>

      <div className="setup-footer">
        <button type="button" className="primary big" disabled={!canStart} onClick={onStart}>
          {t('ready')}
        </button>
      </div>

      {showLast && lastResult && (
        <ResultModal
          title={displayTitle(lastResult.title, lang)}
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
