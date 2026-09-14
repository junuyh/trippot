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
  /** 예정 인원 (trips.headcount). 예산 계산용이라 실제 참여 수와 다르다 */
  headcount: number;
  /**
   * 지금 참여 중인 ACTIVE 멤버 수. (docs/12 §3 active_member_count · 2026-09-13)
   * ⚠️ headcount 에 도달해도 링크는 유효하다. 요청은 보낼 수 있고 수락만 막힌다.
   */
  activeMemberCount: number;
  /** 초대한 사람(trip_invites.created_by)의 이름. 여행장이 아닐 수도 있다 */
  ownerDisplayName: string;
};

/**
 * 링크를 열 수 없는 이유. 서버 resolve_trip_invite 의 invite_state 와 같다.
 *
 * ⚠️ FULL 은 없다. (2026-09-13 · docs/12 §3) 인원이 차도 링크는 유효하고 요청도
 *    받는다 — 수락 단계에서만 막힌다. 링크 자체의 상태와 인원은 다른 축이다.
 * ⚠️ ALREADY_REJECTED 는 링크 상태가 아니라 **내 상태**(my_state = REJECTED)다.
 *    같은 화면으로 안내하려고 여기 두었을 뿐이다.
 */
export type InviteFailReason =
  | "EXPIRED"
  | "REVOKED"
  | "NOT_FOUND"
  | "ALREADY_REJECTED";

/**
 * 로그인한 내가 이 여행과 어떤 관계인가. 서버 resolve_trip_invite 의 my_state 그대로.
 *   NONE      아무 관계 없음        → 참여 요청 가능
 *   ACTIVE    이미 참여 중          → 요청 대신 안내
 *   LEFT      나갔던 여행           → 다시 참여 요청 가능
 *   PENDING   이미 요청해 대기 중   → INV-03
 *   REJECTED  이 invite 에서 거절됨 → 같은 링크로는 재요청 불가
 */
export type InviteMyState = "NONE" | "ACTIVE" | "LEFT" | "PENDING" | "REJECTED";

/**
 * /invite/[token] 라우트의 화면 상태. 서버 결과(invite_state · my_state)를 그대로
 * 담을 수 있는 모양이다. RPC 가 붙으면 resolve 결과 → 이 상태로 매핑만 한다.
 *
 * ⚠️ NOT_CONNECTED 는 **개발용 미리보기인데 preview-* 토큰이 아닐 때**다. 미리보기에는
 *    세션이 없어 RPC 를 부를 수 없고, 가짜 초대를 그리지도 않는다. (2026-09-14 · RPC 연결 후)
 */
export type InviteRouteState =
  | { kind: "LOADING" }
  | { kind: "NOT_CONNECTED" }
  | { kind: "ERROR" }
  | { kind: "EXPIRED" }
  | { kind: "REVOKED" }
  | { kind: "NOT_FOUND" }
  | { kind: "VALID"; preview: InvitePreview; myState: InviteMyState; myRequestId: string | null };

/**
 * INV-04 여행장이 보는 참여 요청 한 건. get_trip_join_requests 한 행을 화면 모양으로.
 *
 * ⚠️ needsNewGroup 은 **안내용 hint** 다. 수락하면 새 모임이 생길지 미리 알려주는 값이고,
 *    실제 판정(CASE A/B/C/D)은 승인 순간 서버가 락 안에서 다시 한다. 이 값으로 화면이
 *    결정을 확정하지 않는다. (docs/12 §6 · §7)
 */
export type JoinRequestItem = {
  requestId: string;
  userId: string;
  name: string;
  /** ISO timestamp. 화면이 KST 로 바꿔 보여준다 */
  requestedAt: string;
  /** 수락 시 새 모임이 만들어질 것으로 보이는가 (CASE C/D 예상). 안내용. */
  needsNewGroup: boolean;
};
