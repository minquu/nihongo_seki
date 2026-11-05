export const DEFAULT_LAYOUT = [2, 1, 2]; // 분단별 팀 수

export const slotCount = (layout) => layout.reduce((a, b) => a + b, 0);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 자리 배정 배열을 만든다. assignment[자리번호] = 조 번호(0부터) | null
 * 자리번호는 1분단 앞→뒤, 2분단 앞→뒤 … 순서.
 * 조가 자리보다 많으면 남는 조는 배열 뒤쪽(자리 미배정)에 들어간다.
 */
export function makeAssignment(groupCount, layout, order = 'order') {
  const slots = slotCount(layout);
  const total = Math.max(slots, groupCount);
  const ids = Array.from({ length: total }, (_, i) => (i < groupCount ? i : null));
  return order === 'random' ? shuffle(ids) : ids;
}

export function isValidAssignment(assignment, groupCount, layout) {
  if (!Array.isArray(assignment)) return false;
  if (assignment.length !== Math.max(slotCount(layout), groupCount)) return false;
  const ids = assignment.filter((g) => g != null).sort((a, b) => a - b);
  return ids.length === groupCount && ids.every((g, i) => g === i);
}

/** 자리번호 → { col, row } */
export function slotPositions(layout) {
  const out = [];
  layout.forEach((n, col) => {
    for (let row = 0; row < n; row++) out.push({ col, row });
  });
  return out;
}

/** 복사용 텍스트. t는 i18n 번역 함수 */
export function seatsToText(layout, assignment, t) {
  const pos = slotPositions(layout);
  const groupName = (g) => t('group', { n: g + 1 });
  const lines = layout.map((n, col) => {
    const teams = pos
      .map((p, i) => ({ ...p, g: assignment[i] }))
      .filter((p) => p.col === col)
      .map((p) => (p.g == null ? t('text.emptySeat') : groupName(p.g)));
    return t('text.seatLine', { col: t('column', { n: col + 1 }), teams: teams.join(' → ') });
  });
  const unseated = assignment.slice(pos.length).filter((g) => g != null);
  if (unseated.length) {
    lines.push(t('text.unseated', { teams: unseated.map(groupName).join(t('text.nameSep')) }));
  }
  return [t('text.seatTitle'), ...lines].join('\n');
}
