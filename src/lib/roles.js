// 표시 문구는 i18n 사전의 role.presenter / role.presenterShort / role.mc / role.mcShort
export const ROLE_INFO = {
  presenter: { icon: '📢', labelKey: 'role.presenter', shortKey: 'role.presenterShort' },
  mc: { icon: '🎙️', labelKey: 'role.mc', shortKey: 'role.mcShort' },
};

/**
 * 한 조에서 발표자와 MC를 랜덤으로 뽑는다. 두 역할은 같은 사람이 맡지 않는다.
 * 조 인원이 1명뿐이면 발표자만 정한다(발표자를 안 뽑는 설정이면 MC만).
 *
 * 다시 뽑기용 옵션:
 * - prev: 직전 역할 { presenter, mc } → 이 사람들은 가능한 한 다시 뽑지 않는다
 * - used: 이번에 이미 역할을 맡았던 이름들 → 아직 안 맡은 사람을 먼저 뽑는다
 * 사람이 모자라면 조건을 하나씩 풀어서 뽑는다(직전과 같은 역할만은 최대한 피함).
 * @returns {{ presenter: string|null, mc: string|null }}
 */
export function pickRoles(members, { presenter = true, mc = true } = {}, { prev = null, used = [] } = {}) {
  const pool = members.map((m) => m.name);
  const prevNames = new Set([prev?.presenter, prev?.mc].filter(Boolean));
  const usedNames = new Set(used);

  const take = (key) => {
    const tiers = [
      (n) => !prevNames.has(n) && !usedNames.has(n), // 아직 한 번도 안 맡은 사람
      (n) => !prevNames.has(n), // 직전 역할자만 아니면 됨
      (n) => n !== prev?.[key], // 최소한 같은 역할 연속은 피함
      () => true,
    ];
    for (const ok of tiers) {
      const cands = pool.filter(ok);
      if (cands.length) {
        const name = cands[Math.floor(Math.random() * cands.length)];
        pool.splice(pool.indexOf(name), 1);
        return name;
      }
    }
    return null;
  };

  const p = presenter ? take('presenter') : null;
  const m = mc ? take('mc') : null;
  return { presenter: p, mc: m };
}

/**
 * 다시 뽑기 후 "이미 맡았던 사람" 목록을 갱신한다.
 * 조원 전원이 한 번씩 맡았으면 이번 역할자만 남기고 새로 돌기 시작한다.
 */
export function nextUsed(members, used = [], prev = null, next = null) {
  const names = [...used, prev?.presenter, prev?.mc, next?.presenter, next?.mc].filter(Boolean);
  const set = new Set(names);
  if (members.every((m) => set.has(m.name))) {
    return [next?.presenter, next?.mc].filter(Boolean);
  }
  return [...set];
}

/** 이름 → 맡은 역할 키 배열 */
export function rolesOf(name, role) {
  if (!role) return [];
  return ['presenter', 'mc'].filter((k) => role[k] === name);
}

export function hasAnyRole(options) {
  return Boolean(options?.presenter || options?.mc);
}
