/**
 * "강재혁（カン・ジェヒョク）" → { main: '강재혁', reading: 'カン・ジェヒョク' }
 * 전각（）/ 반각() 괄호 모두 지원.
 * 중복 이름 표시 " (2)"는 읽기로 보지 않고 main 뒤에 붙인다.
 */
export function splitName(name) {
  const dup = /\s\((\d+)\)$/.exec(name);
  const base = dup ? name.slice(0, dup.index) : name;
  const suffix = dup ? ` (${dup[1]})` : '';
  const m = /^(.+?)\s*[（(]([^（）()]+)[）)]\s*$/.exec(base);
  if (!m) return { main: name, reading: '' };
  return { main: m[1] + suffix, reading: m[2].trim() };
}
