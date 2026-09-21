// ============================================================================
// 지난 여행에서 새 여행 만들기로 들어가는 경로
//
// '같은 멤버로 다시 여행 만들기' 는 동행 구성이 이미 정해진 상태에서 누른다.
// 지난 여행이 모임 여행이면 그 모임이고, 개인 여행이면 혼자다. 그래서 TRIP-01 을
// 열되 그 선택을 **미리 골라 둔 채로** 연다.
//
// ⚠️ TRIP-01 을 건너뛰지 않는다. (2026-09-21)
//    이 화면은 동행만 고르는 곳이 아니라 '지난 여행 데이터를 반영할까요?' 를
//    묻는 곳이기도 하다. 종료된 여행에서 넘어오는 이 경로야말로 과거 데이터가
//    확실히 있는 사용자라 그 질문이 가장 필요하다. 건너뛰면 질문이 사라지고
//    past_data_apply_selected(가설 5) 도 이 경로에서 통째로 빠진다.
//    고르는 수고를 더는 게 목적이지 화면을 없애는 게 목적이 아니다.
// ============================================================================
import { COMPANION_TYPE, ENTRY_POINT } from '@/lib/constants/status';

/**
 * '같은 멤버로 다시 여행 만들기' 가 가는 곳.
 *
 * 지난 여행의 group_id 하나로 갈린다. 모임 여행이면 그 모임을, 개인 여행이면
 * '혼자 가요' 를 미리 고른 채로 TRIP-01 을 연다. 미리 고를 뿐 잠그지 않는다 —
 * 사용자가 다른 모임이나 다른 방식으로 바꿀 수 있다. (owner.tsx 주석)
 */
export function buildRecreateTripHref(groupId: string | null | undefined): string {
  const base = `/trips/new/owner?entryPoint=${ENTRY_POINT.PAST_TRIP}`;
  return groupId
    ? `${base}&preselectedGroupId=${encodeURIComponent(groupId)}`
    : `${base}&preselectedCompanion=${COMPANION_TYPE.PERSONAL}`;
}
