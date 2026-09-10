// ============================================================================
// 여행 멤버 판정 유틸 (INV / MEM)
//
// ⚠️ 왜 필요한가.
//    trip_members 에는 status 가 있는데(ACTIVE / INVITED / LEFT) 지금까지
//    이 값을 보는 곳이 home.ts 한 곳뿐이었다. 나가기 기능이 붙으면 LEFT 가
//    실제로 생기고, 그때 status 를 안 보는 조회는 **나간 사람을 계속 보여준다.**
//    조건을 파일마다 흩뿌리면 한 곳이 빠졌을 때 화면끼리 인원이 어긋난다.
//    여기 한 곳에서만 판정한다. (INV 스펙 §5 회귀 위험 1번)
//
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다. 조회는 queries/ 가 한다.
//
// ⚠️ INVITED 는 여기서 ACTIVE 로 치지 않는다. 아직 합류하지 않은 사람이다.
//    참고로 INVITED 는 현재 어느 코드도 쓰지 않는다. TRIP-01 에서 이름만
//    적어둔 동행자를 위해 남겨 둔 자리이고, **링크로 들어와 수락을 기다리는
//    사람은 여기 넣지 않는다.** 그쪽은 trip_join_requests 가 맡는다.
//    (거절 이력을 남길 자리가 trip_members 에는 없다 · POL-INV-015)
// ============================================================================
import { TRIP_MEMBER_STATUS } from "@/lib/constants/status";

/**
 * 판정에 필요한 최소 모양.
 *
 * Tables<'trip_members'> 를 그대로 받지 않는다. 화면이 쓰는 조회는 필요한
 * 칼럼만 select 하는 경우가 많고(home.ts 는 trip_id·status 만 가져온다),
 * 전체 행을 요구하면 그런 조회에서 못 쓴다.
 */
export type MemberStatusLike = { status: string };

/** 이 사람이 지금 이 여행에 참여 중인가 */
export function isActiveMember(member: MemberStatusLike): boolean {
  return member.status === TRIP_MEMBER_STATUS.ACTIVE;
}

/** 참여 중인 멤버만 남긴다 */
export function activeMembers<T extends MemberStatusLike>(rows: T[]): T[] {
  return rows.filter(isActiveMember);
}

/**
 * 참여 중인 멤버 수.
 *
 * ⚠️ trip.headcount 와 다른 값이다. headcount 는 **예산 계산용**이고
 *    실제 참여 인원과 별개로 유지한다. 수락해도 headcount 를 늘리지 않는다.
 *    (POL-INV-040 · 041) 화면 표기는 "N명 예정 · M명 참여 중" 이다.
 */
export function activeMemberCount(rows: MemberStatusLike[]): number {
  return rows.reduce((count, row) => (isActiveMember(row) ? count + 1 : count), 0);
}

/**
 * 아직 가입하지 않은 동행자인가.
 *
 * TRIP-01 에서 이름만 적어 둔 사람이다. user_id 가 비어 있다.
 * ⚠️ 알림 발송 대상에서 빼야 한다. 보낼 곳이 없다. (스펙 §6 notify)
 */
export function isUnregisteredCompanion(member: { user_id: string | null }): boolean {
  return member.user_id === null;
}

/**
 * 알림을 보낼 수 있는 멤버의 user_id 목록.
 *
 * 참여 중이면서 가입한 사람만 남긴다. 중복도 제거한다.
 */
export function notifiableUserIds(
  rows: (MemberStatusLike & { user_id: string | null })[],
): string[] {
  const ids = activeMembers(rows)
    .map((row) => row.user_id)
    .filter((id): id is string => id !== null);
  return Array.from(new Set(ids));
}

/**
 * "N명 예정 · M명 참여 중" 문구. (POL-INV-042)
 *
 * ⚠️ 두 수를 하나로 합치지 않는다. 예정 인원은 예산의 근거이고 참여 인원은
 *    지금 상태라, 합치면 예산이 왜 그 금액인지 설명할 수 없게 된다.
 */
export function headcountLabel(headcount: number, activeCount: number): string {
  return `${headcount}명 예정 · ${activeCount}명 참여 중`;
}

/**
 * 나 혼자만 참여 중인가. 초대 유도 문구를 붙일지 정한다. (POL-INV-043)
 *
 * ⚠️ "개인 여행으로 바꿀까요?" 를 묻지 않는다. 답을 정하지 않은 질문이다.
 */
export function isAloneInTrip(activeCount: number): boolean {
  return activeCount <= 1;
}
