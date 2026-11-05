import { createContext, useContext } from 'react';
import ko, { SAMPLE_NAMES_KO } from './ko.js';
import ja, { SAMPLE_NAMES_JA } from './ja.js';

export const LANGS = {
  ko: { label: '한국어', dict: ko, locale: 'ko-KR', sample: SAMPLE_NAMES_KO },
  ja: { label: '日本語', dict: ja, locale: 'ja-JP', sample: SAMPLE_NAMES_JA },
};

export const detectLang = () =>
  typeof navigator !== 'undefined' && navigator.language?.startsWith('ja') ? 'ja' : 'ko';

/** 번역. 해당 언어에 키가 없으면 한국어 → 키 이름 순으로 대체한다. */
export function translate(lang, key, params) {
  const dict = LANGS[lang]?.dict ?? ko;
  const v = dict[key] ?? ko[key] ?? key;
  return typeof v === 'function' ? v(params ?? {}) : v;
}

export const makeT = (lang) => (key, params) => translate(lang, key, params);

/** 제목이 비었거나 어느 언어의 기본 제목 그대로면, 현재 언어의 기본 제목으로 보여 준다 */
export function displayTitle(title, lang) {
  const t = (title ?? '').trim();
  const isDefault = !t || Object.values(LANGS).some(({ dict }) => dict.defaultTitle === t);
  return isDefault ? translate(lang, 'defaultTitle') : title;
}

const I18nContext = createContext({ lang: 'ko', t: makeT('ko'), locale: 'ko-KR' });

export function I18nProvider({ lang, children }) {
  const value = { lang, t: makeT(lang), locale: LANGS[lang]?.locale ?? 'ko-KR' };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/** 언어 전환 버튼 (한국어 | 日本語) */
export function LangSwitch({ lang, onChange }) {
  return (
    <div className="segmented small lang-switch" role="group" aria-label={translate(lang, 'lang.label')}>
      {Object.entries(LANGS).map(([key, { label }]) => (
        <button
          key={key}
          type="button"
          lang={key}
          className={lang === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
