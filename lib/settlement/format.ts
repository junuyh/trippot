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

/**
 * 그래프 라벨용 짧은 표기. 1,234,567 → "123만", 168,000 → "16.8만", 8,500 → "8.5천"
 * ⚠️ 표·거래 내역에는 쓰지 않는다. 거기는 원 단위 그대로다.
 */
export function manShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(abs / 100_000_000).toFixed(1).replace(/\.0$/, '')}억`;
  if (abs >= 10_000) {
    const man = abs / 10_000;
    return `${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, '')}만`;
  }
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}천`;
  return `${abs}`;
}
