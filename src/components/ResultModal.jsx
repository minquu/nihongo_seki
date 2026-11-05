import { useEffect, useState } from 'react';
import { groupsToText } from '../lib/groups.js';
import { makeOrder, moveInOrder, orderOf, orderToText } from '../lib/order.js';
import { hasAnyRole, pickRoles, ROLE_INFO } from '../lib/roles.js';
import { makeAssignment, seatsToText } from '../lib/seats.js';
import { formatDate, storage } from '../lib/storage.js';
import { useI18n } from '../i18n/index.jsx';
import RoleBadges from './RoleBadge.jsx';
import Name from './Name.jsx';
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
  const { t, locale } = useI18n();
  const tabs = [layout && 'seats', order && 'order', 'groups'].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]);
  const [copied, setCopied] = useState(false);
  const showRoles = hasAnyRole(roleOptions);
  const groupName = (g) => t('group', { n: g + 1 });

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
    const parts = [groupsToText(title, groups, roles, t)];
    if (order) parts.push(orderToText(order, roles, t));
    if (layout) parts.push(seatsToText(layout, assignment, t));
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(t('copyFail'));
    }
  };

  const orderBadge = (g) =>
    orderOf(order, g) && <span className="order-badge">🎤 {t('order.nth', { n: orderOf(order, g) })}</span>;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🎉 {title}</h2>
          {savedAt && (
            <span className="muted small-text">{t('result.savedAt', { date: formatDate(savedAt, locale) })}</span>
          )}
          <button type="button" className="ghost close no-print" onClick={onClose} aria-label={t('close')}>
            ✕
          </button>
        </div>

        <div className="row gap no-print modal-tools">
          {tabs.length > 1 && (
            <div className="segmented tabs">
              {tabs.map((key) => (
                <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                  {t(`tab.${key}`)}
                </button>
              ))}
            </div>
          )}
          {showRoles && (
            <>
              <span className="role-legend">
                {['presenter', 'mc']
                  .filter((k) => roleOptions[k])
                  .map((k) => (
                    <span key={k} className={`role-badge ${k}`}>
                      {ROLE_INFO[k].icon} {t(ROLE_INFO[k].labelKey)}
                    </span>
                  ))}
              </span>
              <button type="button" className="ghost" onClick={rerollAll}>
                {t('roles.reroll')}
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
                {t('seat.reshuffle')}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onAssignmentChange(makeAssignment(groups.length, layout, 'order'))}
              >
                {t('seat.inOrder')}
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
                {t('order.reroll')}
              </button>
              <span className="muted small-text">{t('order.manual')}</span>
            </div>
            <ol className="order-list">
              {order.map((g, k) => {
                const role = roles[g];
                return (
                  <li key={g} className="order-item" style={{ animationDelay: `${k * 0.12}s` }}>
                    <div className="order-num">{k + 1}</div>
                    <div className="order-body">
                      <div className="order-title">
                        <b>{groupName(g)}</b>
                        {role?.presenter && (
                          <span className="role-badge presenter">
                            {t('toast.presenter', { name: role.presenter })}
                          </span>
                        )}
                        {role?.mc && <span className="role-badge mc">{t('toast.mc', { name: role.mc })}</span>}
                      </div>
                      <div className="order-members">
                        {groups[g].map((m) => m.name).join(t('text.nameSep'))}
                      </div>
                    </div>
                    <div className="order-move no-print">
                      <button
                        type="button"
                        className="ghost"
                        disabled={k === 0}
                        onClick={() => onOrderChange?.(moveInOrder(order, k, k - 1))}
                        aria-label={t('order.up')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={k === order.length - 1}
                        onClick={() => onOrderChange?.(moveInOrder(order, k, k + 1))}
                        aria-label={t('order.down')}
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
                  {groupName(i)} <small>{t('people', { n: members.length })}</small>
                  {orderBadge(i)}
                  {showRoles && (
                    <button
                      type="button"
                      className="ghost reroll no-print"
                      title={t('roles.rerollOne')}
                      aria-label={t('roles.rerollOne')}
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
                      <Name name={m.name} className="member-name" />
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
            {copied ? t('copied') : t('copy')}
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            {t('print')}
          </button>
          {onExit && (
            <button type="button" className="ghost" onClick={onExit}>
              {t('changeSettings')}
            </button>
          )}
          {onRestart && (
            <button type="button" className="primary" onClick={onRestart}>
              {t('again')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
