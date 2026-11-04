import { useEffect, useState } from 'react';
import { groupsToText } from '../lib/groups.js';
import { makeAssignment, seatsToText } from '../lib/seats.js';
import { formatDate, storage } from '../lib/storage.js';
import SeatMap from './SeatMap.jsx';

/**
 * 결과 창. assignment는 부모가 들고 있어서 창을 닫았다 열어도 자리 배치가 유지된다.
 * layout이 없으면(자리 배치 미사용) 조 편성 탭만 보인다.
 */
export default function ResultModal({
  title,
  groups,
  layout,
  assignment,
  onAssignmentChange,
  savedAt,
  onClose,
  onRestart,
  onExit,
}) {
  const [tab, setTab] = useState(layout ? 'seats' : 'groups');
  const [copied, setCopied] = useState(false);

  // 결과(자리 배치 포함)를 저장해 두고 다음에 설정 화면에서 다시 볼 수 있게 한다
  useEffect(() => {
    storage.saveLastResult({ title, groups, layout, assignment, savedAt: savedAt ?? Date.now() });
  }, [title, groups, layout, assignment, savedAt]);

  const copy = async () => {
    const text = [groupsToText(title, groups), layout ? `\n${seatsToText(layout, assignment)}` : '']
      .join('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🎉 {title}</h2>
          {savedAt && <span className="muted small-text">{formatDate(savedAt)} 결과</span>}
          <button type="button" className="ghost close no-print" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {layout && (
          <div className="segmented tabs no-print">
            <button type="button" className={tab === 'seats' ? 'active' : ''} onClick={() => setTab('seats')}>
              🪑 자리 배치
            </button>
            <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
              👥 조 편성
            </button>
          </div>
        )}

        {tab === 'groups' || !layout ? (
          <div className="result-grid">
            {groups.map((members, i) => (
              <div key={i} className="result-group">
                <h3>
                  {i + 1}조 <small>{members.length}명</small>
                </h3>
                <ul>
                  {members.map((m) => (
                    <li key={m.name}>
                      <span className="dot" style={{ background: m.color }} />
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="row gap no-print seat-tools">
              <button
                type="button"
                className="ghost"
                onClick={() => onAssignmentChange(makeAssignment(groups.length, layout, 'random'))}
              >
                🎲 랜덤 재배치
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onAssignmentChange(makeAssignment(groups.length, layout, 'order'))}
              >
                1조부터 순서대로
              </button>
            </div>
            <SeatMap layout={layout} groups={groups} assignment={assignment} onChange={onAssignmentChange} />
          </>
        )}

        <div className="row gap end no-print">
          <button type="button" className="ghost" onClick={copy}>
            {copied ? '복사됨 ✓' : '결과 복사'}
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            🖨 인쇄
          </button>
          {onExit && (
            <button type="button" className="ghost" onClick={onExit}>
              설정 변경
            </button>
          )}
          {onRestart && (
            <button type="button" className="primary" onClick={onRestart}>
              다시 하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
