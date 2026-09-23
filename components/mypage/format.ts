// ============================================================================
// MY 표시용 포맷터
//
// created_at 은 timestamptz 다. 화면에는 KST 기준으로 보여준다. (CLAUDE.md 9장)
// components/community/format.ts 와 같은 규칙이다.
// ============================================================================
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

/** 오늘 / 어제 / N일 전 / 2026.05.20. 값이 잘못됐으면 null. */
export function formatNotifiedAt(createdAt: string): string | null {
  const at = parseISO(createdAt);
  if (!isValid(at)) return null;

  const days = differenceInCalendarDays(new Date(), at);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return format(at, 'yyyy.MM.dd');
}

/**
 * 알림 목록용. 위 날짜 표현 뒤에 시각을 붙인다. 예) `오늘 14:05` · `2026.05.20 07:11`
 *
 * ⚠️ 시각 포맷은 **알림 상세와 같은 `HH:mm`** 이다. (components/mypage/NotificationDetailView)
 *    목록과 상세가 다른 시간 규칙을 갖지 않도록 여기서만 이어 붙인다.
 * ⚠️ formatNotifiedAt 을 고치지 않는다. 그 함수는 내 글 · 내 댓글 목록도 함께 쓴다.
 *    (2026-09-23 유저테스트 직전 · 알림 목록에만 시각을 더한다)
 */
export function formatNotifiedAtWithTime(createdAt: string): string | null {
  const day = formatNotifiedAt(createdAt);
  if (day === null) return null;
  const at = parseISO(createdAt);
  return `${day} ${format(at, 'HH:mm')}`;
}
