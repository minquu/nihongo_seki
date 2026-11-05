import { splitName } from '../lib/names.js';

/**
 * 이름 + (있으면) 카타카나 읽기를 두 줄로 표시.
 * 화면 언어와 상관없이 한글 이름을 크게, 카타카나를 아래에 작게 보여 준다.
 *   강재혁
 *   カン・ジェヒョク
 */
export default function Name({ name, className = '' }) {
  const { main, reading } = splitName(name);
  return (
    <span className={`name ${className}`} title={name}>
      <span className="name-main">{main}</span>
      {reading && <span className="name-reading">{reading}</span>}
    </span>
  );
}
