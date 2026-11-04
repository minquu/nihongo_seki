// 브라우저 localStorage에 저장 (브라우저를 닫아도 유지됨)
const PREFIX = 'nihongo-random-seki:';
const KEYS = {
  settings: `${PREFIX}settings`,
  rosters: `${PREFIX}rosters`,
  lastUsed: `${PREFIX}lastUsed`,
  lastResult: `${PREFIX}lastResult`,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간 부족 등은 무시 */
  }
}

export const storage = {
  loadSettings: () => read(KEYS.settings, null),
  saveSettings: (s) => write(KEYS.settings, s),

  /** [{ id, name, namesText, updatedAt }] */
  loadRosters: () => read(KEYS.rosters, []),
  saveRosters: (list) => write(KEYS.rosters, list),

  /** 마지막으로 레이스에 사용한 명단 { namesText, count, usedAt } */
  loadLastUsed: () => read(KEYS.lastUsed, null),
  saveLastUsed: (v) => write(KEYS.lastUsed, v),

  /** 마지막 결과 { title, groups, layout, assignment, savedAt } */
  loadLastResult: () => read(KEYS.lastResult, null),
  saveLastResult: (v) => write(KEYS.lastResult, v),
};

export const formatDate = (ts) =>
  new Date(ts).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
