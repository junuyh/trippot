// ============================================================================
// 여행장(Leader) 판정 — 순수 함수
//
// ⚠️ 여행장은 **trips.leader_user_id** 다. owner_user_id 가 아니다.
//    그 칸은 '개인 여행의 주인' 이고 모임 여행에서는 비워 두는 규칙이 걸려 있다.
//    (2026-09-10 L 회신 · 마이그레이션 20260910000001)
//
// ⚠️ owner 라는 말을 쓰지 않는다. 이미 세 뜻으로 쓰이고 있다.
//      trips.owner_user_id    개인 여행의 주인
//      group_members.role     모임장
//      여행장                  ← 이 파일
//
// ⚠️ trip_members 에 role 을 두지 않는다. 같은 사실이 두 곳에 있으면 위임할 때
//    한쪽만 바뀌어 여행장이 둘이거나 없는 상태가 생긴다.
//
// ⚠️ DB 도 네트워크도 타지 않는다. 조회는 lib/supabase/queries/tripMembers.ts 다.
// ============================================================================

/** 판정에 필요한 최소 모양. Trip 전체를 요구하지 않는다 */
export type TripLeaderLike = { leader_user_id: string | null };

/**
 * 이 사람이 여행장인가.
 *
 * ⚠️ leader_user_id 가 null 이면 **누구도 여행장이 아니다.** 마이그레이션 전에
 *    만들어진 여행이나 앱이 값을 안 채운 여행이 여기 해당한다.
 *    그때는 위임을 요구하지 않는다 — 요구하면 아무도 나갈 수 없게 된다.
 */
export function isTripLeader(trip: TripLeaderLike, userId: string | null): boolean {
  if (!userId || !trip.leader_user_id) return false;
  return trip.leader_user_id === userId;
}

/**
 * 초대 링크를 만들 수 있는가.
 *
 * ⚠️ **ACTIVE 멤버 누구나 할 수 있다.** (2026-09-10 확정)
 *    스펙 §2-1 권한표는 "여행장만" 으로 적혀 있는데 뒤집혔다.
 *    링크를 뿌리는 건 되돌릴 수 있고, 실제 관문은 수락이다.
 */
export function canInviteToTrip(isActiveMember: boolean): boolean {
  return isActiveMember;
}

/**
 * 참여 요청을 수락·거절할 수 있는가. **여행장만.**
 *
 * 초대와 달리 이건 사람을 실제로 들이는 행동이라 한 사람이 쥔다.
 */
export function canDecideJoinRequest(
  trip: TripLeaderLike,
  userId: string | null,
): boolean {
  return isTripLeader(trip, userId);
}

// ── 나가기 ──────────────────────────────────────────────────────────────────

export type LeaveBlockReason = "LEADER_ALONE" | "NOT_MEMBER";

export type LeaveDecision = {
  allowed: boolean;
  /** 여행장이고 남은 멤버가 있다. MEM-02 로 보내야 한다 */
  requiresDelegation: boolean;
  reason?: LeaveBlockReason;
};

/**
 * 나갈 수 있는가. (POL-MEM-003 · 004)
 *
 *   일반 멤버          바로 나간다
 *   여행장 + 멤버 ≥ 1   위임 후에만 (requiresDelegation)
 *   여행장 + 멤버 0     나갈 수 없다 (LEADER_ALONE) → 초대 또는 취소로 안내
 *
 * ⚠️ 여행장이 그냥 나가면 **여행장 없는 여행**이 남는다. 그러면 참여 요청을
 *    수락할 사람이 없어져 초대가 영영 막힌다.
 *
 * @param activeMemberCount 나를 **포함한** ACTIVE 멤버 수
 */
export function canLeaveTrip(input: {
  trip: TripLeaderLike;
  userId: string | null;
  isActiveMember: boolean;
  activeMemberCount: number;
}): LeaveDecision {
  if (!input.isActiveMember) {
    return { allowed: false, requiresDelegation: false, reason: "NOT_MEMBER" };
  }

  if (!isTripLeader(input.trip, input.userId)) {
    return { allowed: true, requiresDelegation: false };
  }

  // 나 말고 남는 사람이 있는가
  const othersCount = Math.max(0, input.activeMemberCount - 1);
  if (othersCount === 0) {
    return { allowed: false, requiresDelegation: false, reason: "LEADER_ALONE" };
  }
  return { allowed: false, requiresDelegation: true };
}

/** MEM-01 이 쓰는 화면 분기값으로 바꾼다 */
export function leaveModeOf(decision: LeaveDecision): "member" | "needsDelegate" | "leaderAlone" {
  if (decision.requiresDelegation) return "needsDelegate";
  if (decision.reason === "LEADER_ALONE") return "leaderAlone";
  return "member";
}
