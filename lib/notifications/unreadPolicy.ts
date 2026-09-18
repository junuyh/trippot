// ============================================================================
// 안 읽음 판정 — 알림 아이콘의 점 하나가 보는 **통합** 규칙 (2026-09-18)
//
//   알림센터 [전체] 에 안 읽은 줄이 하나라도 있으면 점이 켜진다. 출처는 둘이다.
//     DB   public.notifications  read_at is null
//     push 기기 보관함(pushInbox)  readAt === null   (예: 여행 중 지출 리마인드 D1 · 로컬 알림)
//   둘 중 하나라도 안 읽음이면 true. 둘 다 읽었으면 false.
//
// ⚠️ 의존성이 없는 순수 함수다 — 훅(unreadNotifications)과 검증 스크립트가 같이 쓴다.
// ⚠️ 새 DB 컬럼 · 서버 카운트를 만들지 않는다.
// ============================================================================

export type UnreadCandidate = { readAt: string | null };

/** 기기 보관 알림 중 안 읽은 것이 있는가. */
export function pushInboxHasUnread(rows: readonly UnreadCandidate[]): boolean {
  return rows.some((row) => row.readAt === null);
}

/** 통합 판정. dbUnreadCount 는 read_at is null 인 DB 행 수(존재만 보면 되므로 1 이상이면 충분). */
export function computeHasUnread(dbUnreadCount: number, pushRows: readonly UnreadCandidate[]): boolean {
  return dbUnreadCount > 0 || pushInboxHasUnread(pushRows);
}
