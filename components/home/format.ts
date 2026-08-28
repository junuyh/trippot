// ============================================================================
// HOME-01 카드 표시용 포맷터
//
// - 금액은 정수 원 단위다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
// - 날짜는 date-fns 로 다룬다. start_date / end_date 는 date 타입이라
//   UTC→KST 변환 대상이 아니다. (CLAUDE.md 9장)
// - 값이 없거나 잘못된 날짜여도 throw 하지 않고 대체 문자열을 돌려준다.
// ============================================================================
import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';

const EMPTY = '—';

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** 12,000원. 값이 없으면 '—'. */
export function formatAmount(value: number | null): string {
  if (value === null) return EMPTY;
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 2026.09.10 ~ 09.14. 해가 다르면 뒤쪽도 연도까지 쓴다. */
export function formatDateRange(startDate: string | null, endDate: string | null): string {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return EMPTY;

  const sameYear = start.getFullYear() === end.getFullYear();
  return `${format(start, 'yyyy.MM.dd')} ~ ${format(end, sameYear ? 'MM.dd' : 'yyyy.MM.dd')}`;
}

/** 출발일 기준 D-7 / D-DAY / D+3. 잘못된 날짜면 null. */
export function formatDDay(startDate: string | null): string | null {
  const start = toDate(startDate);
  if (!start) return null;

  const diff = differenceInCalendarDays(start, startOfDay(new Date()));
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${-diff}`;
}

/**
 * 준비율(%). 현재 여행자금 / 목표 여행비.
 *
 * 소수점을 만들지 않으려고 정수 퍼센트로만 계산한다.
 * 목표가 0이거나 값이 없으면 null 이고, 카드는 준비율 영역을 그리지 않는다.
 * 100을 넘을 수 있다 — 목표보다 많이 모은 상태를 감추지 않는다.
 */
export function calcReadyRatePercent(
  currentAmount: number | null,
  targetAmount: number | null,
): number | null {
  if (currentAmount === null || targetAmount === null || targetAmount <= 0) return null;
  return Math.floor((currentAmount * 100) / targetAmount);
}
