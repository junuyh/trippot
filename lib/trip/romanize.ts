// ============================================================================
// 한글 이름 → 로마자 (국어의 로마자 표기법, 음절 단위)
//
// 여행 기록 스토리 이미지에서 멤버 이름을 영문으로 쓸 때 쓴다.
// "지수" → "Jisu", "서연" → "Seoyeon", "다빈" → "Dabin"
//
// ⚠️ 이름은 사람마다 영문 표기가 다르다(이 → Lee / Yi, 박 → Park / Bak).
//    그래서 이 결과는 **기본값**이고, 사용자가 직접 입력으로 고칠 수 있어야 한다.
//    여권 표기를 맞추는 용도가 아니다.
//
// ⚠️ 음절 사이의 음운 변화(연음·자음동화)는 반영하지 않는다. 이름 두세 글자에서는
//    음절 단위 표기가 통용된다(정부 표준 이름 표기도 음절 단위를 허용한다).
//
// 한글이 아닌 글자(영문·숫자·공백)는 그대로 둔다.
// ============================================================================

const CHO = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];
const JUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi',
  'yu', 'eu', 'ui', 'i',
];
/** 받침. 음절 끝소리라 g→k, d→t, b→p 로 쓴다 */
const JONG = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't',
  'ng', 't', 't', 'k', 't', 'p', 't',
];

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 한 단어(이름)를 로마자로. 첫 글자만 대문자 */
export function romanizeName(name: string): string {
  let out = '';
  for (const char of name) {
    const code = char.charCodeAt(0);
    if (code < HANGUL_START || code > HANGUL_END) {
      out += char;
      continue;
    }
    const index = code - HANGUL_START;
    const cho = Math.floor(index / 588);
    const jung = Math.floor((index % 588) / 28);
    const jong = index % 28;
    out += CHO[cho] + JUNG[jung] + JONG[jong];
  }
  if (!out) return name;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
