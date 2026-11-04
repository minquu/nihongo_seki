import { splitName } from '../lib/names.js';

/** 이름 + (있으면) 카타카나 읽기를 아래 줄에 작게 표시 */
export default function Name({ name, className = '' }) {
  const { main, reading } = splitName(name);
  return (
    <span className={`name ${className}`} title={name}>
      <span className="name-main">{main}</span>
      {reading && <span className="name-reading">{reading}</span>}
    </span>
  );
}
