/** 줄바꿈 또는 쉼표로 구분된 이름 목록을 파싱한다. 중복 이름은 (2), (3)… 을 붙여 구분한다. */
export function parseNames(text) {
  const raw = text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Map();
  return raw.map((name) => {
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    return count > 1 ? `${name} (${count})` : name;
  });
}

/**
 * 그룹별 인원 배열을 계산한다.
 * - mode 'size'  : value = 그룹당 인원
 *     remainder 'spread'   → 남는 인원을 앞 조부터 한 명씩 추가
 *     remainder 'separate' → 남는 인원끼리 마지막 조
 * - mode 'count' : value = 그룹 수 (최대한 고르게)
 */
export function computeGroupSizes(total, mode, value, remainder = 'spread') {
  if (total <= 0) return [];
  const v = Math.max(1, Math.floor(Number(value)) || 1);

  if (mode === 'count') {
    const k = Math.min(v, total);
    const base = Math.floor(total / k);
    const extra = total % k;
    return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  }

  const size = Math.min(v, total);
  const full = Math.floor(total / size);
  const rest = total % size;
  const sizes = Array(full).fill(size);
  if (rest === 0) return sizes;
  if (remainder === 'separate') return [...sizes, rest];
  for (let i = 0; i < rest; i++) sizes[i % full]++;
  return sizes;
}

export function groupsToText(title, groups, roles = []) {
  const lines = groups.map((members, i) => {
    const role = roles[i];
    const names = members.map((m) => {
      const tags = [];
      if (role?.presenter === m.name) tags.push('발표자');
      if (role?.mc === m.name) tags.push('MC');
      return tags.length ? `${m.name}(${tags.join(', ')})` : m.name;
    });
    return `${i + 1}조 (${members.length}명): ${names.join(', ')}`;
  });
  return [title, '', ...lines].join('\n');
}
