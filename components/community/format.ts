// ============================================================================
// COMM-01 / COMM-02 표시용 포맷터
//
// published_at 은 timestamptz 다. 화면에는 KST 기준으로 보여준다. (CLAUDE.md 9장)
// ============================================================================
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

/** 오늘 / 어제 / N일 전 / 2026.05.20. 값이 없거나 잘못됐으면 null. */
export function formatPublished(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const at = parseISO(publishedAt);
  if (!isValid(at)) return null;

  const days = differenceInCalendarDays(new Date(), at);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return format(at, 'yyyy.MM.dd');
}
