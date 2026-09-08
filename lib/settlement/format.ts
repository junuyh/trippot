// ============================================================================
// 정산 리포트 금액 표기
//
// 리포트는 "얼마나" 를 비교하는 자리라 자릿수가 아니라 크기가 읽혀야 한다.
// 4,116,000원 은 헤드라인 한 곳에만 쓰고, 나머지는 411.6만원 처럼 줄인다.
// 여덟 줄에 여섯 자리 숫자가 반복되면 눈이 먼저 지친다.
//
// ⚠️ 계산에는 쓰지 않는다. 표시 직전에만 부른다. 금액 연산은 정수 원 단위다.
// ============================================================================

/** 1,234,567 → "123.5만원", 60,000 → "6만원", 8,500 → "8,500원", 0 → "0원" */
export function manwon(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1).replace(/\.0$/, '')}억원`;
  if (abs >= 10_000) {
    const man = abs / 10_000;
    const text = man >= 100 ? Math.round(man).toString() : man.toFixed(1).replace(/\.0$/, '');
    return `${sign}${text}만원`;
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

/** 부호를 앞에 붙인다. +17.6만원 / −22.7만원 */
export function manwonSigned(value: number): string {
  if (value === 0) return '0원';
  return `${value > 0 ? '+' : '−'}${manwon(Math.abs(value))}`;
}

/** 4,116,000원 */
export function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}
