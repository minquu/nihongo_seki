import { useEffect, useRef } from 'react';
import RoleBadges from './RoleBadge.jsx';
import Name from './Name.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function GroupBoard({ groups, sizes, current, done, roles = [] }) {
  const { t } = useI18n();
  const currentRef = useRef(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  return (
    <aside className="board">
      {sizes.map((size, i) => {
        const members = groups[i] || [];
        const full = members.length >= size;
        const status = full ? 'full' : i === current && !done ? 'current' : 'waiting';
        return (
          <div key={i} ref={i === current ? currentRef : null} className={`group ${status}`}>
            <div className="group-head">
              <strong>{t('group', { n: i + 1 })}</strong>
              <span className="count">
                {members.length}/{size}
              </span>
              <span className="status">{t(`board.${status}`)}</span>
            </div>
            <ol className="members">
              {members.map((m) => (
                <li key={m.name} className="member">
                  <span className="rank">{m.rank}</span>
                  <span className="dot" style={{ background: m.color }} />
                  <Name name={m.name} className="member-name" />
                  <RoleBadges name={m.name} role={roles[i]} />
                </li>
              ))}
              {Array.from({ length: Math.max(0, size - members.length) }, (_, k) => (
                <li key={`empty-${k}`} className="member empty" />
              ))}
            </ol>
          </div>
        );
      })}
    </aside>
  );
}
