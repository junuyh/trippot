// ============================================================================
// 모임 화면 표시용 포맷터
//
// - 날짜는 date-fns 로 다룬다. (CLAUDE.md 9장) 새 라이브러리를 추가하지 않는다.
// - 값이 없거나 잘못된 날짜여도 throw 하지 않고 대체 문자열을 돌려준다.
//
// ⚠️ formatDateRange 는 components/home/format.ts 와 같은 규칙이다.
//    components/home/ 은 HOME-01 전용 폴더라 가져다 쓰지 않고 따로 둔다.
//    (CLAUDE.md 9장 — 공유가 필요해지면 components/ui/ 로 올릴지 사람에게 확인한다)
// ============================================================================
import { format, isValid, parseISO } from 'date-fns';

import { TRIP_STATUS, TRIP_STATUS_LABEL } from '@/lib/constants/status';

const EMPTY = '—';

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** 2026.09.10 ~ 09.14. 해가 다르면 뒤쪽도 연도까지 쓴다. */
export function formatDateRange(startDate: string | null, endDate: string | null): string {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return EMPTY;

  const sameYear = start.getFullYear() === end.getFullYear();
  return `${format(start, 'yyyy.MM.dd')} ~ ${format(end, sameYear ? 'MM.dd' : 'yyyy.MM.dd')}`;
}

/**
 * 모임 생성일. '2026.05.14'
 *
 * ⚠️ 현재 GROUP-01 카드는 생성일을 표시하지 않는다(IA §3-1 에 없다).
 *    정렬에는 created_at 원본을 쓰므로 이 함수는 지금 호출되는 곳이 없다.
 *    GROUP-02 '모임 기본정보' 에서 쓸 것으로 보고 남겨둔다.
 */
export function formatCreatedDate(createdAt: string | null): string {
  if (!createdAt) return EMPTY;
  const parsed = parseISO(createdAt);
  return isValid(parsed) ? format(parsed, 'yyyy.MM.dd') : EMPTY;
}

/**
 * 인원. '4명'
 *
 * ⚠️ 이 값은 group_members 에서 센 결과다. 사용자가 직접 입력하는 값이 아니다.
 *    인원을 바꾸려면 모임원을 추가/삭제해야 하고 그 결과가 여기 반영된다.
 */
export function formatMemberCount(memberCount: number): string {
  return `${memberCount}명`;
}

/**
 * GROUP 계좌 UI 전용 여행 상태 이름.
 *
 * 사용자에게는 세 가지로만 보인다.
 *   PLANNING          준비 중
 *   TRAVELING         여행 중
 *   ENDED · SETTLED   지난 여행
 *
 * ⚠️ DB status 나 공통 TRIP_STATUS_LABEL 을 고치지 않는다. 그쪽은 `종료` ·
 *    `결산 완료` 로 나뉘어 있고 다른 화면이 그 이름을 쓰고 있다. 여기서만
 *    쓰는 **표시용 파생 라벨**이다. (2026-09-09 확정)
 *
 * ⚠️ 다른 화면에 이 함수를 쓰지 않는다. GROUP 계좌 영역 전용이다.
 */
export function toGroupTripStatusLabel(status: string): string {
  if (status === TRIP_STATUS.PLANNING) return TRIP_STATUS_LABEL.PLANNING;
  if (status === TRIP_STATUS.TRAVELING) return TRIP_STATUS_LABEL.TRAVELING;
  return '지난 여행';
}

/**
 * 이 상태가 '지금 쓰고 있는 여행' 인가.
 *
 * 준비 중·여행 중이면 true. GROUP 메인에 어떤 계좌를 보여줄지와
 * `N개 여행에서 사용 중` 의 N 을 세는 기준이 모두 이것이다.
 */
export function isActiveTripStatus(status: string): boolean {
  return status === TRIP_STATUS.PLANNING || status === TRIP_STATUS.TRAVELING;
}
