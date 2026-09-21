// ============================================================================
// 지출 리마인드 알림 id 규칙 — 순수 함수 (2026-09-21)
//
// spendReminder 는 로컬 알림 identifier 를 `spend-reminder:{tripId}:{n}` 으로 잡는다(그 파일 머리 주석).
// 기기 보관함(pushInbox)과 알림 상세는 이 규칙으로 "지출 리마인드인가 · 어느 여행인가" 를 안다.
// ⚠️ 제목(`파리 D2 · …`)을 파싱하지 않는다. 여행지 이름으로 여행을 찾지 않는다. id 의 tripId 만 믿는다.
// ⚠️ spendReminder.ts 는 import 만으로 알림 핸들러를 등록하는 부수효과가 있어, 보관함 쪽에서는 이 파일만 쓴다.
// ============================================================================

export const SPEND_REMINDER_ID_PREFIX = 'spend-reminder:';

/** `spend-reminder:{tripId}:{n}` → tripId. 규칙에 맞지 않으면 null. */
export function parseSpendReminderTripId(identifier: string | null | undefined): string | null {
  if (!identifier || !identifier.startsWith(SPEND_REMINDER_ID_PREFIX)) return null;
  const rest = identifier.slice(SPEND_REMINDER_ID_PREFIX.length);
  const sep = rest.lastIndexOf(':');
  if (sep <= 0) return null;
  const tripId = rest.slice(0, sep);
  return tripId.length > 0 ? tripId : null;
}

/** 이 보관 알림이 지출 리마인드인가. */
export function isSpendReminderId(identifier: string | null | undefined): boolean {
  return parseSpendReminderTripId(identifier) !== null;
}
