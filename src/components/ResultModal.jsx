import { useEffect, useState } from 'react';
import { groupsToText } from '../lib/groups.js';
import { makeOrder, moveInOrder, orderOf, orderToText } from '../lib/order.js';
import { hasAnyRole, pickRoles, ROLE_INFO } from '../lib/roles.js';
import { makeAssignment, seatsToText } from '../lib/seats.js';
import { formatDate, storage } from '../lib/storage.js';
import RoleBadges from './RoleBadge.jsx';
import SeatMap from './SeatMap.jsx';

/**
 * 결과 창. assignment / roles / order는 부모가 들고 있어서 창을 닫았다 열어도 유지된다.
 * - layout이 없으면 자리 배치 탭이 없다
 * - order가 없으면 발표 순서 탭이 없다
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
  order = null,
  onOrderChange,
  savedAt,
  onClose,
  onRestart,
  onExit,
}) {
  const tabs = [
    layout && ['seats', '🪑 자리 배치'],
    order && ['order', '🎤 발표 순서'],
    ['groups', '👥 조 편성'],
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0][0]);
  const [copied, setCopied] = useState(false);
  const showRoles = hasAnyRole(roleOptions);

  // 결과를 저장해 두고 다음에 설정 화면에서 다시 볼 수 있게 한다
  useEffect(() => {
    storage.saveLastResult({
      title,
      groups,
      layout,
      assignment,
      roles,
      roleOptions,
      order,
      savedAt: savedAt ?? Date.now(),
    });
    // roleOptions는 매 렌더마다 새 객체라 값으로 비교
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, groups, layout, assignment, roles, order, savedAt, roleOptions.presenter, roleOptions.mc]);

  const rerollAll = () => onRolesChange?.(groups.map((g) => pickRoles(g, roleOptions)));
  const rerollOne = (i) => {
    const next = groups.map((_, j) => roles[j] ?? null);
    next[i] = pickRoles(groups[i], roleOptions);
    onRolesChange?.(next);
  };

  const copy = async () => {
    const parts = [groupsToText(title, groups, roles)];
    if (order) parts.push(orderToText(order, roles));
    if (layout) parts.push(seatsToText(layout, assignment));
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const orderBadge = (g) =>
    orderOf(order, g) && <span className="order-badge">🎤 {orderOf(order, g)}번째</span>;

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
          {tabs.length > 1 && (
            <div className="segmented tabs">
              {tabs.map(([key, label]) => (
                <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                  {label}
                </button>
              ))}
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

        {tab === 'seats' && (
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
              order={order}
            />
          </>
        )}

        {tab === 'order' && (
          <>
            <div className="row gap no-print seat-tools">
              <button type="button" className="ghost" onClick={() => onOrderChange?.(makeOrder(groups.length))}>
                🎲 발표 순서 다시 뽑기
              </button>
              <span className="muted small-text">↑↓ 버튼으로 직접 바꿀 수도 있어요</span>
            </div>
            <ol className="order-list">
              {order.map((g, k) => {
                const role = roles[g];
                return (
                  <li key={g} className="order-item" style={{ animationDelay: `${k * 0.12}s` }}>
                    <div className="order-num">{k + 1}</div>
                    <div className="order-body">
                      <div className="order-title">
                        <b>{g + 1}조</b>
                        {role?.presenter && (
                          <span className="role-badge presenter">📢 발표자 {role.presenter}</span>
                        )}
                        {role?.mc && <span className="role-badge mc">🎙️ MC {role.mc}</span>}
                      </div>
                      <div className="order-members">{groups[g].map((m) => m.name).join(' · ')}</div>
                    </div>
                    <div className="order-move no-print">
                      <button
                        type="button"
                        className="ghost"
                        disabled={k === 0}
                        onClick={() => onOrderChange?.(moveInOrder(order, k, k - 1))}
                        aria-label="앞으로"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={k === order.length - 1}
                        onClick={() => onOrderChange?.(moveInOrder(order, k, k + 1))}
                        aria-label="뒤로"
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {tab === 'groups' && (
          <div className="result-grid">
            {groups.map((members, i) => (
              <div key={i} className="result-group">
                <h3>
                  {i + 1}조 <small>{members.length}명</small>
                  {orderBadge(i)}
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
