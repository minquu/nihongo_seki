import { useState } from 'react';
import { slotPositions } from '../lib/seats.js';

const rowLabel = (row, n) => {
  if (n <= 1) return '';
  if (n === 2) return row === 0 ? '앞' : '뒤';
  return `앞에서 ${row + 1}번째`;
};

/**
 * 교실 자리 배치도. 팀 카드를 드래그하거나, 두 자리를 차례로 클릭하면 서로 바뀐다.
 */
export default function SeatMap({ layout, groups, assignment, onChange }) {
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
          <div className="slot-empty">빈 자리</div>
        ) : (
          <>
            <div className="team-name">
              {g + 1}조 <small>{groups[g].length}명</small>
            </div>
            <div className="desks">
              {groups[g].map((m) => (
                <div key={m.name} className="desk">
                  <span className="dot" style={{ background: m.color }} />
                  {m.name}
                </div>
              ))}
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
      <div className="blackboard">칠판 · 교탁</div>
      <div className="bundans" style={{ gridTemplateColumns: `repeat(${layout.length}, minmax(0, 1fr))` }}>
        {layout.map((_, col) => (
          <div key={col} className="bundan">
            <div className="bundan-label">{col + 1}분단</div>
            {positions.map((p, pos) =>
              p.col === col ? renderTeam(pos, rowLabel(p.row, layout[col])) : null,
            )}
          </div>
        ))}
      </div>
      {unseated.length > 0 && (
        <div className="unseated">
          <div className="bundan-label">자리 미배정 (자리로 끌어다 놓으세요)</div>
          <div className="unseated-list">{unseated.map(({ pos }) => renderTeam(pos, ''))}</div>
        </div>
      )}
      <p className="hint no-print">팀 카드를 드래그하거나, 두 자리를 차례로 클릭하면 자리가 바뀝니다.</p>
    </div>
  );
}
