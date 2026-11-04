import { ROLE_INFO, rolesOf } from '../lib/roles.js';

/** 이름 옆에 붙는 발표자 / MC 표시 */
export default function RoleBadges({ name, role, compact = false }) {
  return rolesOf(name, role).map((k) => (
    <span key={k} className={`role-badge ${k}`} title={ROLE_INFO[k].label}>
      {ROLE_INFO[k].icon}
      {!compact && ` ${ROLE_INFO[k].short}`}
    </span>
  ));
}
