import { ROLE_INFO, rolesOf } from '../lib/roles.js';
import { useI18n } from '../i18n/index.jsx';

/** 이름 옆에 붙는 발표자 / MC 표시 */
export default function RoleBadges({ name, role, compact = false }) {
  const { t } = useI18n();
  return rolesOf(name, role).map((k) => (
    <span key={k} className={`role-badge ${k}`} title={t(ROLE_INFO[k].labelKey)}>
      {ROLE_INFO[k].icon}
      {!compact && ` ${t(ROLE_INFO[k].shortKey)}`}
    </span>
  ));
}
