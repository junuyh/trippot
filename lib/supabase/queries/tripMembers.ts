// ============================================================================
// 여행 멤버 DB Query — 조회 · 나가기 · 여행장 위임
//
// ⚠️ INV 스펙 §6 은 lib/trip/members.ts 에 두라고 하지만 CLAUDE.md §7 이
//    "모든 DB Query 는 queries/ 안에" 로 정해 두었고 그쪽이 우선한다. (§0)
//    판정은 lib/trip/tripLeader.ts · lib/trip/members.ts(순수 유틸) 다.
//
// ⚠️⚠️ 나가기·위임은 **서버 함수(RPC)** 를 거친다. (보안 점검 필수 6 · 2026-09-16)
//    앱이 trip_members.status · trips.leader_user_id 를 직접 고치지 않는다.
//    "본인만" · "여행장만" · "마지막 1명" 판정을 서버가 한다.
//    마이그레이션 20260916000004 · 계약서 .handoff/필수6-RPC계약서.md
//
// ⚠️ 그래서 **userId 를 인자로 받지 않는다.** 서버가 auth.uid() 로 정한다.
//    받아 두면 "남을 대신 내보낼 수 있다" 는 착각을 주는데 서버는 그 값을
//    보지도 않는다. 조용히 무시되는 인자를 남기지 않는다.
//
// ⚠️ 여러 표를 잇달아 바꾸는 순서 문제도 서버로 넘어갔다. RPC 하나가 한
//    트랜잭션이라 중간에 끊기지 않는다. (supabase-js 에는 트랜잭션이 없다)
// ============================================================================
import { TRIP_MEMBER_STATUS } from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { AfterLeaveOutcome } from '@/lib/supabase/queries/tripCancel';
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
 * 서버(`leave_trip`)가 검사한다 — 본인 여부 · ACTIVE · 마지막 1명 · 여행장 여부.
 * 여행장이면 `NEEDS_DELEGATION` 으로 거절한다. delegateAndLeave 로만 나간다.
 *
 * ⚠️ 거래·납부 기록을 지우지 않는다. status 를 LEFT 로 바꾸고 left_at 만 찍는다.
 *    지우면 남은 사람들의 정산 근거가 사라진다.
 *
 * ⚠️ 모임 이탈까지 **같은 호출 안에서** 처리된다. 이 앱에서 모임을 나가는
 *    통로가 나가기 시트뿐이라 둘을 떼면 모임에 갇히는 사람이 생긴다.
 *
 * ⚠️ 취소 재판정도 서버가 이어서 한다. 따로 부르지 않는다 — 반환값이 그 결과다.
 *    (예전에는 화면이 recheckAfterMemberLeft 를 이어서 불렀고, 빠뜨리면 이미
 *     전원이 동의했는데도 요청이 대기로 남았다)
 *
 * @returns 나간 뒤 취소 요청이 어떻게 됐는지. 화면이 MEM-03 갈래를 정하는 데 쓴다
 */
export async function leaveTrip(input: {
  tripId: string;
  /** 모임에서도 나갈지. 개인 여행이면 false 를 넘긴다 */
  alsoLeaveGroup: boolean;
}): Promise<AfterLeaveOutcome> {
  const { data, error } = await supabase.rpc('leave_trip', {
    p_trip_id: input.tripId,
    p_also_leave_group: input.alsoLeaveGroup,
  });
  if (error) throw error;
  return (data ?? 'NONE') as AfterLeaveOutcome;
}

/**
 * 여행장을 넘긴다. (POL-INV-004 · 005)
 *
 * 서버(`delegate_trip_leader`)가 검사한다 — 호출자가 현재 여행장인지,
 * 넘길 대상이 이 여행의 ACTIVE 가입 멤버인지.
 *
 * ⚠️ **되돌릴 수 없다.** 화면이 그 사실을 미리 알린다.
 * ⚠️ 이미 그 사람이 여행장이면 아무것도 하지 않는다 (멱등).
 */
export async function delegateTripLeader(
  tripId: string,
  toUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('delegate_trip_leader', {
    p_trip_id: tripId,
    p_to_user_id: toUserId,
  });
  if (error) throw error;

  // TODO: notify OWNER_DELEGATED → 새 여행장
}

/**
 * 여행장을 넘기고 나간다. MEM-02 의 실제 동작.
 *
 * ⚠️ 위임 먼저, 나가기 나중 — **서버가 한 함수 안에서** 한다.
 *    예전에는 앱이 두 번 불렀고, 나가기가 먼저 돌면 그 사이 여행장 없는 여행이
 *    생겼다. 실제로 오사카 여행이 그렇게 돼서 참여 요청을 수락할 사람이 없어졌다.
 *
 * ⚠️ fromUserId 를 받지 않는다. 넘기는 사람은 언제나 호출자 본인이다.
 */
export async function delegateAndLeave(input: {
  tripId: string;
  toUserId: string;
  alsoLeaveGroup: boolean;
}): Promise<AfterLeaveOutcome> {
  const { data, error } = await supabase.rpc('delegate_and_leave', {
    p_trip_id: input.tripId,
    p_to_user_id: input.toUserId,
    p_also_leave_group: input.alsoLeaveGroup,
  });
  if (error) throw error;

  // TODO: notify OWNER_DELEGATED → 새 여행장 · MEMBER_LEFT → 남은 멤버
  return (data ?? 'NONE') as AfterLeaveOutcome;
}
