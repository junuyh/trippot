// ============================================================================
// 여행 멤버 DB Query — 조회 · 나가기 · 여행장 위임
//
// ⚠️ INV 스펙 §6 은 lib/trip/members.ts 에 두라고 하지만 CLAUDE.md §7 이
//    "모든 DB Query 는 queries/ 안에" 로 정해 두었고 그쪽이 우선한다. (§0)
//    판정은 lib/trip/tripLeader.ts · lib/trip/members.ts(순수 유틸) 다.
//
// ⚠️⚠️ supabase-js 에는 트랜잭션이 없다. 나가기는 표 두 개를 잇달아 바꾸고,
//    위임은 거기에 trips 까지 더한다. 각 함수에 순서와 실패 시 남는 상태를 적었다.
// ============================================================================
import {
  GROUP_MEMBER_STATUS,
  TRIP_MEMBER_STATUS,
} from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export type TripMemberRow = Tables<'trip_members'>;

export type TripMemberWithName = TripMemberRow & {
  /** users.name. 미가입 동행자는 display_name 을 쓴다 */
  name: string;
};

/**
 * 이 여행에서 내가 나간 사람(LEFT)인가. (POL-MEM · 2026-09-14 확정)
 *
 * 여행 홈의 접근 가드가 쓴다. "나간 여행은 목록 이력으로만 보이고 여행 홈·상세에는
 * 들어갈 수 없다" — 카드 탭뿐 아니라 딥링크·뒤로가기로 와도 막아야 해서 화면이 직접 묻는다.
 *
 * ⚠️ ACTIVE 행이 하나라도 있으면 false 다. LEFT 행만 있을 때만 true.
 *    (trip_members 는 unique 가 없어 같은 사람의 행이 여럿일 수 있다)
 * ⚠️ 행이 없으면(참여한 적 없음) false — "나간 사람" 이 아니다. 미참여 접근 범위는 별도 정책.
 * ⚠️ 읽기만 한다. 실패하면 던진다 — 화면이 false 로 두면 나간 여행이 열리므로 삼키지 않는다.
 */
export async function hasLeftTrip(tripId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('status')
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return false;
  if (rows.some((row) => row.status === TRIP_MEMBER_STATUS.ACTIVE)) return false;
  return rows.some((row) => row.status === TRIP_MEMBER_STATUS.LEFT);
}

/**
 * 참여 중인 멤버. 나간 사람(LEFT)과 아직 안 온 사람(INVITED)은 뺀다.
 *
 * ⚠️ user_id 가 null 인 미가입 동행자도 **포함한다.** 인원 수에 들어가고
 *    화면에도 보여야 한다. 다만 알림 대상에서는 빠진다.
 */
export async function listActiveTripMembers(
  tripId: string,
): Promise<TripMemberWithName[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*, users(name)')
    .eq('trip_id', tripId)
    .eq('status', TRIP_MEMBER_STATUS.ACTIVE)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const { users, ...member } = row as TripMemberRow & { users: { name: string } | null };
    return { ...member, name: users?.name ?? member.display_name ?? '이름 없음' };
  });
}

/**
 * 여행에서 나간다. (POL-MEM-001 · 002 · 005)
 *
 * ⚠️ **거래·납부 기록을 지우지 않는다.** status 를 LEFT 로 바꾸고 left_at 만
 *    찍는다. 지우면 남은 사람들의 정산 근거가 사라진다.
 *
 * ⚠️ 순서 — 여행 먼저, 모임 나중.
 *    여행에서 못 나갔는데 모임에서만 빠지면, 여행 화면에는 그대로 있으면서
 *    다음 여행 초대만 못 받는 이상한 상태가 된다. 반대 순서면 여행에서만
 *    빠진 상태로 남아 사용자가 다시 시도하면 된다.
 *
 * ⚠️ 여행장 판정은 **호출부가 먼저 한다.** (canLeaveTrip) 여기서 또 하면
 *    판정이 두 곳에 생긴다.
 */
export async function leaveTrip(input: {
  tripId: string;
  userId: string;
  /** 모임에서도 나갈지. 개인 여행이면 false 를 넘긴다 */
  alsoLeaveGroup: boolean;
  /** 모임 여행일 때의 모임 id. alsoLeaveGroup 이 true 면 필요하다 */
  groupId: string | null;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('trip_members')
    .update({ status: TRIP_MEMBER_STATUS.LEFT, left_at: now })
    .eq('trip_id', input.tripId)
    .eq('user_id', input.userId)
    /**
     * ⚠️ ACTIVE 행만 바꾼다. trip_members 에는 unique (trip_id, user_id) 가
     *    없어서 같은 사람 행이 여러 개일 수 있다. 조건을 빼면 예전에 나갔던
     *    행의 left_at 까지 지금 시각으로 덮어써 "언제 나갔는지" 가 어긋난다.
     * ⚠️ 멱등성도 여기서 나온다 — 이미 나간 사람이 다시 불러도 아무 일이 없다.
     */
    .eq('status', TRIP_MEMBER_STATUS.ACTIVE);
  if (error) throw error;

  if (input.alsoLeaveGroup && input.groupId) {
    const { error: groupError } = await supabase
      .from('group_members')
      // ⚠️ group_members 에는 left_at 이 없다. status 만 바꾼다.
      //    (trip_members 에만 20260910000001 이 left_at 을 넣었다)
      .update({ status: GROUP_MEMBER_STATUS.LEFT })
      .eq('group_id', input.groupId)
      .eq('user_id', input.userId);
    // 여행에서는 이미 나갔다. 모임 이탈이 실패해도 그건 되돌리지 않는다.
    // 되돌리면 "나갔다" 는 사용자 인식과 어긋난다. 모임은 다시 시도하면 된다.
    if (groupError) throw groupError;
  }

  // TODO: notify MEMBER_LEFT → 남은 멤버 (모임 이탈 여부는 담지 않는다 · POL-MEM-007)
}

/**
 * 여행장을 넘긴다. (POL-INV-004 · 005)
 *
 * ⚠️ **되돌릴 수 없다.** 화면이 그 사실을 미리 알린다.
 *
 * ⚠️ trips.leader_user_id 한 곳만 바꾼다. trip_members 에 role 이 없어서
 *    맞출 곳이 하나뿐이다. 이게 role 을 안 만든 이유다.
 *
 * ⚠️ 멱등 — 이미 그 사람이 여행장이면 아무것도 하지 않는다.
 */
export async function delegateTripLeader(
  tripId: string,
  toUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({ leader_user_id: toUserId })
    .eq('id', tripId);
  if (error) throw error;

  // TODO: notify OWNER_DELEGATED → 새 여행장
}

/**
 * 여행장을 넘기고 나간다. MEM-02 의 실제 동작.
 *
 * ⚠️ 순서 — **위임 먼저, 나가기 나중.**
 *    나가기가 먼저면 그 사이 여행장 없는 여행이 생긴다. 위임이 실패하면
 *    나가지 않은 상태로 남아 사용자가 다시 시도할 수 있다.
 */
export async function delegateAndLeave(input: {
  tripId: string;
  fromUserId: string;
  toUserId: string;
  alsoLeaveGroup: boolean;
  groupId: string | null;
}): Promise<void> {
  await delegateTripLeader(input.tripId, input.toUserId);
  await leaveTrip({
    tripId: input.tripId,
    userId: input.fromUserId,
    alsoLeaveGroup: input.alsoLeaveGroup,
    groupId: input.groupId,
  });
}
