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
 * 여행 카드에 '여행장' 배지를 달 여행인가. (2026-09-21 한나 요청)
 *
 * 여행장이면서 **2인 이상**인 여행만 참이다.
 * ⚠️ 혼자 가는 여행(headcount 1)은 뺀다. 만든 사람이 곧 여행장이라
 *    전부 붙으면 표시가 아무것도 가르지 못한다.
 * ⚠️ 내 여행(MY-02) · 모임 탭 [여행] · 모임 상세(GROUP-02) · 개인 여행 상세가 같은
 *    카드(MyTripCard)를 쓴다. 모두 이 함수만 불러야 배지가 화면마다 갈리지 않는다.
 *    (앞의 둘은 lib/hooks/useMyTrips 를 함께 쓴다)
 */
export function isLeaderOfSharedTrip(
  trip: TripLeaderLike & { headcount: number },
  userId: string | null,
): boolean {
  return trip.headcount > 1 && isTripLeader(trip, userId);
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

export type LeaveBlockReason = "LEADER_ALONE" | "LAST_MEMBER" | "NOT_MEMBER";

export type LeaveDecision = {
  allowed: boolean;
  /** 여행장이고 남은 멤버가 있다. MEM-02 로 보내야 한다 */
  requiresDelegation: boolean;
  reason?: LeaveBlockReason;
};

/**
 * 나갈 수 있는가. (POL-MEM-003 · 004 + 마지막 1명 가드)
 *
 *   마지막 1명              나갈 수 없다 (LAST_MEMBER) → 초대 또는 취소로 안내
 *   여행장 + 넘길 사람 0     나갈 수 없다 (LEADER_ALONE) → 위와 같은 안내
 *   여행장 + 넘길 사람 ≥ 1   위임 후에만 (requiresDelegation)
 *   일반 멤버               바로 나간다
 *
 * ⚠️⚠️ **마지막 1명 가드가 가장 먼저다.** (2026-09-10 확정 · 09-14 여행 홈에도 적용)
 *    여행장 여부와 **무관하다.** 멤버가 0명인 여행이 남으면 취소도 결산도 할
 *    사람이 없는 유령 데이터가 된다. POL-MEM-003·004 와 충돌이 아니라 그
 *    아래에 깔리는 다른 층의 가드다. (다빈 판단)
 *
 * ⚠️ 여행장이 그냥 나가면 **여행장 없는 여행**이 남는다. 그러면 참여 요청을
 *    수락할 사람이 없어져 초대가 영영 막힌다. 실제로 오사카가 그렇게 됐다.
 *
 * ⚠️⚠️ 두 숫자를 구분한다.
 *      otherActiveCount   나 말고 남는 **가입 멤버** 수 → 여행이 비는가
 *      delegatableCount   그중 여행장이 될 수 있는 사람 수
 *    지금은 둘이 같다(가입 멤버면 여행장이 될 수 있다). 그래도 따로 받는 것은
 *    묻는 질문이 다르기 때문이다. 나중에 '여행장 될 수 없는 가입 멤버' 가
 *    생기면 여기만 고치면 된다.
 *
 * ⚠️ 미가입 동행자(user_id 가 null)는 **둘 다에서 뺀다.** 계정이 없어 여행장도
 *    될 수 없고, 그 사람만 남은 여행은 아무도 손댈 수 없다. (2026-09-14)
 */
export function canLeaveTrip(input: {
  trip: TripLeaderLike;
  userId: string | null;
  isActiveMember: boolean;
  /** 나를 뺀 ACTIVE **가입** 멤버 수. 미가입 동행자는 세지 않는다 */
  otherActiveCount: number;
  /** 그중 여행장이 될 수 있는 사람 수. 미가입 동행자는 세지 않는다 */
  delegatableCount: number;
}): LeaveDecision {
  if (!input.isActiveMember) {
    return { allowed: false, requiresDelegation: false, reason: "NOT_MEMBER" };
  }

  // 여행을 비우고 나갈 수는 없다. 여행장이든 아니든 마찬가지다
  if (input.otherActiveCount <= 0) {
    return {
      allowed: false,
      requiresDelegation: false,
      reason: isTripLeader(input.trip, input.userId) ? "LEADER_ALONE" : "LAST_MEMBER",
    };
  }

  if (!isTripLeader(input.trip, input.userId)) {
    return { allowed: true, requiresDelegation: false };
  }

  if (input.delegatableCount <= 0) {
    return { allowed: false, requiresDelegation: false, reason: "LEADER_ALONE" };
  }
  return { allowed: false, requiresDelegation: true };
}

/**
 * MEM-01 이 쓰는 화면 분기값으로 바꾼다.
 *
 * ⚠️ leaderAlone 과 lastMember 는 **막히는 이유가 다르다.** 앞은 넘겨줄 사람이
 *    없는 것이고 뒤는 남는 사람이 없는 것이다. 문구가 달라야 해서 나눈다.
 *    나갈 길(초대 또는 취소)은 같다.
 */
export function leaveModeOf(
  decision: LeaveDecision,
): "member" | "needsDelegate" | "leaderAlone" | "lastMember" {
  if (decision.requiresDelegation) return "needsDelegate";
  if (decision.reason === "LEADER_ALONE") return "leaderAlone";
  if (decision.reason === "LAST_MEMBER") return "lastMember";
  return "member";
}
