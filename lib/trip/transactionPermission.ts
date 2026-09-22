// ============================================================================
// 거래를 고칠 수 있는 사람인가 — 판정 한 곳
//
// ⚠️ 왜 생겼나 (2026-09-22 테스트)
//    모임 여행에서 다른 참여자가 손으로 적은 거래를 열어 '확인 완료' 를 누르면
//    "저장하지 못했어요" 가 떴다. RLS(20260921000001)가 "기록자는 비었거나 나"
//    를 UPDATE 에도 걸기 때문이다. RLS 를 풀지 않고 **앱이 같은 규칙을 먼저
//    보여 준다** — 남이 적은 거래는 읽기 전용으로 그리고, 고치는 버튼을 숨긴다.
//
// 규칙
//    내가 적은 거래                 created_by_user_id === 내 userId   → 고칠 수 있다
//    적은 사람이 없는 거래           created_by_user_id null            → 고칠 수 있다
//      (계좌에서 들어온 거래 · 기록자 칸이 생기기 전의 옛 기록)
//    다른 참여자가 적은 거래                                             → 읽기 전용
//
// ⚠️ 화면·시트·카드 여러 곳이 같은 판정을 쓴다. 각자 비교식을 적으면 한 곳이
//    빠져 같은 버그가 두 번 난다. (CLAUDE.md 7장) 여기만 부른다.
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다.
// ============================================================================

/** 판정에 필요한 칸만 받는다. Transaction 전체를 요구하지 않는다 */
export type TransactionAuthorship = {
  created_by_user_id: string | null;
};

/**
 * 이 거래를 고칠 수 있는가. 기록자가 없거나 나 자신이면 참.
 *
 * ⚠️ userId 가 없으면(로그인 정보를 아직 못 읽음) 기록자 있는 거래는 전부
 *    읽기 전용이다. 잠깐 버튼이 안 보이는 쪽이, 눌렀다가 실패하는 쪽보다 낫다.
 */
export function canEditTransaction(
  transaction: TransactionAuthorship | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!transaction) return false;
  if (transaction.created_by_user_id === null) return true;
  return !!userId && transaction.created_by_user_id === userId;
}

/**
 * 읽기 전용일 때 시트·상세 아래에 적는 한 줄.
 * 기록자 이름을 모르면(나간 사람 등) 이름 없이 말한다.
 */
export function readOnlyTransactionNote(authorName: string | null | undefined): string {
  return authorName
    ? `${authorName} 님이 적은 거래예요. 적은 사람만 고칠 수 있어요.`
    : "다른 참여자가 적은 거래예요. 적은 사람만 고칠 수 있어요.";
}
