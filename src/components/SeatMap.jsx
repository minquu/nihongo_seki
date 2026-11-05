import { useState } from 'react';
import { slotPositions } from '../lib/seats.js';
import { rolesOf } from '../lib/roles.js';
import RoleBadges from './RoleBadge.jsx';
import Name from './Name.jsx';
import { orderOf } from '../lib/order.js';
import { useI18n } from '../i18n/index.jsx';

const rowLabel = (t, row, n) => {
  if (n <= 1) return '';
  if (n === 2) return row === 0 ? t('seat.front') : t('seat.back');
  return t('seat.nth', { n: row + 1 });
};

/**
 * 교실 자리 배치도. 팀 카드를 드래그하거나, 두 자리를 차례로 클릭하면 서로 바뀐다.
 */
export default function SeatMap({ layout, groups, assignment, onChange, roles = [], order = null }) {
  const { t } = useI18n();
  const [dragFrom, setDragFrom] = useState(null);
  const [selected, setSelected] = useState(null);
  const [over, setOver] = useState(null);

  const positions = slotPositions(layout);
  const slots = positions.length;

  const swap = (a, b) => {
    if (a == null || b == null || a === b) return;
    const next = [...assignment];
    [next[a], next[b]] = [next[b], next[a]];
    onChange(next);
  };

  const onClickSlot = (pos) => {
    if (selected == null) {
      if (assignment[pos] != null) setSelected(pos);
    } else {
      swap(selected, pos);
      setSelected(null);
    }
  };

  const slotProps = (pos) => ({
    draggable: assignment[pos] != null,
    onDragStart: (e) => {
      setDragFrom(pos);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      setDragFrom(null);
      setOver(null);
    },
    onDragOver: (e) => {
      e.preventDefault();
      setOver(pos);
    },
    onDragLeave: () => setOver((o) => (o === pos ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      swap(dragFrom, pos);
      setDragFrom(null);
      setOver(null);
      setSelected(null);
    },
    onClick: () => onClickSlot(pos),
  });

  const renderTeam = (pos, label) => {
    const g = assignment[pos];
    const cls = ['team-slot', g == null ? 'empty' : '', selected === pos ? 'selected' : '', over === pos ? 'over' : '', dragFrom === pos ? 'dragging' : '']
      .filter(Boolean)
      .join(' ');
    return (
      <div key={pos} className={cls} {...slotProps(pos)}>
        <div className="slot-label">{label}</div>
        {g == null ? (
          <div className="slot-empty">{t('seat.empty')}</div>
        ) : (
          <>
            <div className="team-name">
              {t('group', { n: g + 1 })} <small>{t('people', { n: groups[g].length })}</small>
              {orderOf(order, g) && <span className="order-badge">🎤 {t('order.nthPresent', { n: orderOf(order, g) })}</span>}
            </div>
            <div className="desks">
              {groups[g].map((m) => {
                const myRoles = rolesOf(m.name, roles[g]);
                return (
                  <div key={m.name} className={`desk ${myRoles.map((k) => `has-${k}`).join(' ')}`}>
                    <span className="dot" style={{ background: m.color }} />
                    <Name name={m.name} className="desk-name" />
                    <RoleBadges name={m.name} role={roles[g]} compact />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const unseated = assignment
    .map((g, pos) => ({ g, pos }))
    .slice(slots)
    .filter((x) => x.g != null);

  return (
    <div className="classroom">
      <div className="blackboard">{t('blackboard')}</div>
      <div className="bundans" style={{ gridTemplateColumns: `repeat(${layout.length}, minmax(0, 1fr))` }}>
        {layout.map((_, col) => (
          <div key={col} className="bundan">
            <div className="bundan-label">{t('column', { n: col + 1 })}</div>
            {positions.map((p, pos) =>
              p.col === col ? renderTeam(pos, rowLabel(t, p.row, layout[col])) : null,
            )}
          </div>
        ))}
      </div>
      {unseated.length > 0 && (
        <div className="unseated">
          <div className="bundan-label">{t('seat.unseated')}</div>
          <div className="unseated-list">{unseated.map(({ pos }) => renderTeam(pos, ''))}</div>
        </div>
      )}
      <p className="hint no-print">{t('seat.hint')}</p>
    </div>
  );
}
