// ============================================================================
// 멤버 화면(함께하는 사람 · MEM-01 · MEM-02)이 받는 데이터 모양.
//
// ⚠️ components/groups/types.ts 의 GroupMemberItem 과 다른 타입이다.
//    그쪽은 **모임** 멤버이고 isOwner 가 모임장을 뜻한다.
//    여기는 **여행** 멤버이고 isTripLeader 가 여행장을 뜻한다.
//
// ⚠️ 이 프로젝트에서 'owner' 는 이미 세 가지 뜻으로 쓰인다.
//      trips.owner_user_id      개인 여행의 주인
//      group_members.role       모임장
//      (예전 표기) 여행장
//    그래서 여행장은 코드에서 **Leader** 로만 쓴다. DB 칼럼도 leader_user_id 다.
//    (2026-09-10 · owner 표기와 어긋나 혼동이 생겨 통일)
//
// ⚠️ 예외 하나 — 알림 종류 `OWNER_DELEGATED` 는 그대로 둔다. DB CHECK 값이고
//    docs · lib/constants/status.ts 와 글자까지 같아야 한다. (#73 확정본)
// ============================================================================

/** 함께하는 사람 목록의 한 명 */
export type TripMemberItem = {
  memberId: string;
  /** 아직 가입하지 않은 동행자는 null. 알림을 보낼 수 없다 */
  userId: string | null;
  name: string;
  /**
   * 이 여행을 만든 사람인가. **trips.leader_user_id** 로 판정한다.
   *
   * ⚠️ trips.owner_user_id 가 아니다. 그 칸은 '개인 여행의 주인' 이라 뜻이
   *    다르고, 모임 여행에서는 일부러 비워 둔다. 거기에 여행장을 넣으면 앱이
   *    모임 여행을 개인 여행으로 착각한다. (2026-09-10 L 회신)
   *
   * ⚠️ leader_user_id 는 nullable 이다. 아직 마이그레이션 전이거나 값이
   *    없으면 false 로 넘겨 배지를 그리지 않는다.
   */
  isTripLeader: boolean;
};

/**
 * 나가기가 가능한지. lib/trip/tripLeader.ts 의 canLeaveTrip() 결과와 같은 모양.
 *
 * `member`        일반 멤버. 바로 나갈 수 있다
 * `needsDelegate` 여행장인데 남은 멤버가 있다. 위임 후에만 나갈 수 있다
 * `leaderAlone`    여행장인데 혼자다. 나갈 수 없다. 초대 또는 취소로 안내
 */
export type LeaveMode = "member" | "needsDelegate" | "leaderAlone";
