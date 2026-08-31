// ============================================================================
// GROUP-01 / GROUP-02 화면이 그리는 데이터 모양
// 기준: docs/09_IA_v1.md §3-1 (모임명 · 멤버 · 진행 중인 여행 · 지난 여행 수)
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================

/** 카드 안에 한 줄로 들어가는 여행. */
export type GroupTripItem = {
  tripId: string;
  /** trips.destination 은 nullable 이다. 없으면 카드가 대체 문구를 쓴다. */
  destination: string | null;
  /** 'YYYY-MM-DD'. trips.start_date 는 date 타입이라 시간대 변환이 없다. nullable. */
  startDate: string | null;
  endDate: string | null;
};

/**
 * 3-1. 모임 목록 카드 한 장. (docs/09_IA_v1.md §3-1)
 *
 * ⚠️ 실제로 DB 에 있는 값만 둔다.
 *    groups 테이블에는 대표 이미지 컬럼이 없고 정책도 미확정이라 이미지 필드를 두지 않는다.
 */
export type GroupTravelCardData = {
  groupId: string;
  name: string;
  /**
   * groups.created_at.
   * ⚠️ 카드에 표시하지 않는다. '여행 생성일 순' 정렬에만 쓴다.
   */
  createdAt: string;
  /** group_members 중 ACTIVE 인원 수. 사용자가 직접 고치는 값이 아니다. */
  memberCount: number;
  /**
   * 진행 중인 여행 전체(PLANNING · TRAVELING).
   * 카드는 앞의 2건만 그리고 나머지는 '외 N건' 으로 접는다. 자르는 판단은 카드가 한다.
   */
  ongoingTrips: GroupTripItem[];
  /** 지난 여행 수(ENDED · SETTLED). */
  pastTripCount: number;
};
