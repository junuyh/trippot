// ============================================================================
// 정산 리포트 금액 표기
//
// 영수증·명세서는 정확한 숫자가 있는 자리다. 축약하지 않는다. (TripReceiptCard 와 같은 원칙)
// ⚠️ 계산에는 쓰지 않는다. 표시 직전에만 부른다. 금액 연산은 정수 원 단위다.
// ============================================================================

/** 4,116,000원 */
export function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 부호를 앞에 붙인다. +176,000원 / −227,000원 / 0원 */
export function wonSigned(value: number): string {
  if (value === 0) return '0원';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString('ko-KR')}원`;
}
