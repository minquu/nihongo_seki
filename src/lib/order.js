/** 발표 순서: order[k] = k번째(0부터)로 발표하는 조 번호(0부터) */
export function makeOrder(groupCount) {
  const a = Array.from({ length: groupCount }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isValidOrder(order, groupCount) {
  return (
    Array.isArray(order) &&
    order.length === groupCount &&
    [...order].sort((a, b) => a - b).every((g, i) => g === i)
  );
}

/** 조 번호 → 몇 번째 발표인지(1부터). 순서가 없으면 null */
export function orderOf(order, groupIdx) {
  if (!order) return null;
  const k = order.indexOf(groupIdx);
  return k === -1 ? null : k + 1;
}

export function moveInOrder(order, from, to) {
  if (to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** 복사용 텍스트. t는 i18n 번역 함수 */
export function orderToText(order, roles = [], t) {
  const lines = order.map((g, k) =>
    t('text.orderLine', { k: k + 1, group: t('group', { n: g + 1 }), presenter: roles[g]?.presenter }),
  );
  return [t('text.orderTitle'), ...lines].join('\n');
}
