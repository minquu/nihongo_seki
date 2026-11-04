import { useEffect, useState } from 'react';
import { groupsToText } from '../lib/groups.js';
import { hasAnyRole, pickRoles, ROLE_INFO } from '../lib/roles.js';
import { makeAssignment, seatsToText } from '../lib/seats.js';
import { formatDate, storage } from '../lib/storage.js';
import RoleBadges from './RoleBadge.jsx';
import SeatMap from './SeatMap.jsx';

/**
 * 결과 창. assignment / roles는 부모가 들고 있어서 창을 닫았다 열어도 유지된다.
 * layout이 없으면(자리 배치 미사용) 조 편성 탭만 보인다.
 */
export default function ResultModal({
  title,
  groups,
  layout,
  assignment,
  onAssignmentChange,
  roles = [],
  roleOptions = { presenter: false, mc: false },
  onRolesChange,
  savedAt,
  onClose,
  onRestart,
  onExit,
}) {
  const [tab, setTab] = useState(layout ? 'seats' : 'groups');
  const [copied, setCopied] = useState(false);
  const showRoles = hasAnyRole(roleOptions);

  // 결과(자리 배치, 역할 포함)를 저장해 두고 다음에 설정 화면에서 다시 볼 수 있게 한다
  useEffect(() => {
    storage.saveLastResult({
      title,
      groups,
      layout,
      assignment,
      roles,
      roleOptions,
      savedAt: savedAt ?? Date.now(),
    });
    // roleOptions는 매 렌더마다 새 객체라 값으로 비교
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, groups, layout, assignment, roles, savedAt, roleOptions.presenter, roleOptions.mc]);

  const rerollAll = () => onRolesChange?.(groups.map((g) => pickRoles(g, roleOptions)));
  const rerollOne = (i) => {
    const next = groups.map((_, j) => roles[j] ?? null);
    next[i] = pickRoles(groups[i], roleOptions);
    onRolesChange?.(next);
  };

  const copy = async () => {
    const text = [groupsToText(title, groups, roles), layout ? `\n${seatsToText(layout, assignment)}` : ''].join(
      '',
    );
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

        <div className="row gap no-print modal-tools">
          {layout && (
            <div className="segmented tabs">
              <button type="button" className={tab === 'seats' ? 'active' : ''} onClick={() => setTab('seats')}>
                🪑 자리 배치
              </button>
              <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
                👥 조 편성
              </button>
            </div>
          )}
          {showRoles && (
            <>
              <span className="role-legend">
                {roleOptions.presenter && (
                  <span className="role-badge presenter">
                    {ROLE_INFO.presenter.icon} {ROLE_INFO.presenter.label}
                  </span>
                )}
                {roleOptions.mc && (
                  <span className="role-badge mc">
                    {ROLE_INFO.mc.icon} {ROLE_INFO.mc.label}
                  </span>
                )}
              </span>
              <button type="button" className="ghost" onClick={rerollAll}>
                🎲 역할 다시 뽑기
              </button>
            </>
          )}
        </div>

        {tab === 'groups' || !layout ? (
          <div className="result-grid">
            {groups.map((members, i) => (
              <div key={i} className="result-group">
                <h3>
                  {i + 1}조 <small>{members.length}명</small>
                  {showRoles && (
                    <button
                      type="button"
                      className="ghost reroll no-print"
                      title="이 조의 역할 다시 뽑기"
                      onClick={() => rerollOne(i)}
                    >
                      🎲
                    </button>
                  )}
                </h3>
                <ul>
                  {members.map((m) => (
                    <li key={m.name}>
                      <span className="dot" style={{ background: m.color }} />
                      <span className="member-name">{m.name}</span>
                      <RoleBadges name={m.name} role={roles[i]} />
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
                🎲 자리 랜덤 재배치
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onAssignmentChange(makeAssignment(groups.length, layout, 'order'))}
              >
                1조부터 순서대로
              </button>
            </div>
            <SeatMap
              layout={layout}
              groups={groups}
              assignment={assignment}
              onChange={onAssignmentChange}
              roles={roles}
            />
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
