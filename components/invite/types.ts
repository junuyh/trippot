// ============================================================================
// 초대 화면(INV-01 ~ INV-05)이 화면 파일에서 받는 데이터 모양.
//
// ⚠️ DB Row 를 그대로 쓰지 않는다. 화면이 필요한 것만 받는다.
//    특히 INV-02 는 **링크만 있으면 누구나 여는 화면**이라, 여기에 금액이나
//    멤버 목록 필드를 만들어 두면 나중에 누군가 채워 넣는다. (POL-INV-021)
//
// ⚠️ 이 폴더의 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md §9)
// ============================================================================

/** INV-01 초대 대상 후보 한 명 */
export type InviteCandidate = {
  userId: string;
  name: string;
  /** 이미 이 모임의 멤버인가. false 면 "모임 밖 · 새로 초대" 로 표시한다 */
  inGroup: boolean;
};

/**
 * INV-01 이 보여줄 모임 분기 안내.
 *
 * `none`        모임 밖 사람이 없다. 안내 없음
 * `joinGroup`   모임 밖 사람 있음 + 결산 이력 없음 → 기존 모임에 합류
 * `newGroup`    모임 밖 사람 있음 + 결산 이력 있음 → 새 모임이 만들어진다
 */
export type GroupBranch = "none" | "joinGroup" | "newGroup";

/**
 * INV-02 초대 확인 화면이 보여줄 전부.
 *
 * ⚠️⚠️ 이 타입에 금액 · 계좌 · 멤버 목록을 절대 넣지 않는다. ⚠️⚠️
 *       수락 전에는 여행지 · 일정 · 인원 · 초대한 사람 이름까지만이다.
 *       (POL-INV-020 · resolveInvite 의 preview 와 같은 4+1개)
 */
export type InvitePreview = {
  destination: string;
  /** ISO date (YYYY-MM-DD). 화면이 표시용으로 바꾼다 */
  startDate: string | null;
  endDate: string | null;
  headcount: number;
  ownerDisplayName: string;
};

/** 링크를 열 수 없는 이유. resolveInvite 의 reason 과 같은 값 */
export type InviteFailReason =
  | "EXPIRED"
  | "REVOKED"
  | "FULL"
  | "NOT_FOUND"
  | "ALREADY_REJECTED";

/** INV-04 여행장이 보는 참여 요청 한 건 */
export type JoinRequestItem = {
  requestId: string;
  userId: string;
  name: string;
  /** ISO timestamp. 화면이 KST 로 바꿔 보여준다 */
  requestedAt: string;
};
