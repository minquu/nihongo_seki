// 표시 문구는 i18n 사전의 role.presenter / role.presenterShort / role.mc / role.mcShort
export const ROLE_INFO = {
  presenter: { icon: '📢', labelKey: 'role.presenter', shortKey: 'role.presenterShort' },
  mc: { icon: '🎙️', labelKey: 'role.mc', shortKey: 'role.mcShort' },
};

/**
 * 한 조에서 발표자와 MC를 랜덤으로 뽑는다. 두 역할은 같은 사람이 맡지 않는다.
 * 조 인원이 1명뿐이면 발표자만 정한다(발표자를 안 뽑는 설정이면 MC만).
 * @returns {{ presenter: string|null, mc: string|null }}
 */
export function pickRoles(members, { presenter = true, mc = true } = {}) {
  const pool = members.map((m) => m.name);
  const take = () => (pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : null);
  const p = presenter ? take() : null;
  const m = mc ? take() : null;
  return { presenter: p, mc: m };
}

/** 이름 → 맡은 역할 키 배열 */
export function rolesOf(name, role) {
  if (!role) return [];
  return ['presenter', 'mc'].filter((k) => role[k] === name);
}

export function hasAnyRole(options) {
  return Boolean(options?.presenter || options?.mc);
}
