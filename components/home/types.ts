// ============================================================================
// HOME-01 화면이 그리는 데이터 모양
// 기준 문서: docs/09_IA_v1.md §1, docs/03_요구사항정의서_v1.md REQ-HOME-001
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import type { TripOwnerType, TripStatus } from '@/lib/constants/status';

type HomeTripBase = {
  tripId: string;
  /** trips.destination 은 nullable 이다. 없으면 카드가 대체 문구를 쓴다. */
  destination: string | null;
  /** 'YYYY-MM-DD'. trips.start_date 는 date 타입이라 시간대 변환이 없다. nullable. */
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  ownerType: TripOwnerType;
  /** 모임 여행이면 모임명, 개인 여행이면 null. */
  groupName: string | null;
};

/** 1-1. 진행 중인 여행 (PLANNING / TRAVELING) */
export type OngoingTripCardData = HomeTripBase & {
  /** trip_budgets.target_amount. 아직 조회하지 못했으면 null. */
  targetAmount: number | null;
  /** fund_sources.current_amount. 단일 소스 기준이라 절대 합산하지 않는다. (CLAUDE.md 3장) */
  currentAmount: number | null;
};

/** 1-2. 종료된 여행 (ENDED / SETTLED) */
export type EndedTripCardData = HomeTripBase & {
  /**
   * 최종 여행비. 아직 조회하지 못했으면 null.
   *
   * ⚠️ ENDED(결산 전)에는 settlements 행이 없어서 무엇을 보여줄지 문서에 정의가 없다.
   *    확정 전까지 null 로 넘기고 카드는 '결산 전' 으로 표시한다.
   */
  finalAmount: number | null;
};

/** 1-3. 모임 바로가기 */
export type HomeGroupItem = {
  groupId: string;
  name: string;
};
