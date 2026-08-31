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

/** 3-2. 모임 상세의 멤버 한 명. (docs/09_IA_v1.md §3-2) */
export type GroupMemberItem = {
  memberId: string;
  name: string;
  /** true 면 '모임장' 배지를 붙인다. group_members.role 이 OWNER 인 사람. */
  isOwner: boolean;
};

/**
 * 3-2. 모임 상세의 연결 계좌 한 건.
 *
 * ⚠️ 은행명과 잔액은 MVP 에서 표시하지 않는다.
 *    institution_code 를 은행명으로 바꾸는 매핑이 프로젝트에 없고,
 *    잔액 표시 정책도 정해지지 않았다.
 *    masked_account_number 는 DB 에 이미 마스킹된 값이라 그대로 쓴다. (NFR-002)
 */
export type GroupAccountItem = {
  accountId: string;
  maskedAccountNumber: string | null;
};

/** 3-2. 모임 상세 화면 전체. (docs/09_IA_v1.md §3-2) */
export type GroupDetailData = {
  groupId: string;
  name: string;
  /** groups.created_at. 기본정보에 '만든 날' 로 표시한다. */
  createdAt: string;
  /**
   * ACTIVE 멤버 수.
   * ⚠️ members.length 와 다를 수 있다. getGroupMemberCount() 를 쓴다 —
   *    GROUP-01 카드와 같은 기준을 유지하기 위해서다. (후속 확인 사항)
   */
  memberCount: number;
  members: GroupMemberItem[];
  accounts: GroupAccountItem[];
  /** 진행 중(PLANNING · TRAVELING). 전체 표시한다. */
  ongoingTrips: GroupTripItem[];
  /** 지난 여행(ENDED · SETTLED). 전체 표시한다. */
  pastTrips: GroupTripItem[];
};
