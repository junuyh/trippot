// ============================================================================
// HOME-01 화면이 그리는 데이터 모양
// 기준 문서: docs/09_IA_v1.md §1, docs/03_요구사항정의서_v1.md REQ-HOME-001
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
//
// 국기·영문명·공항코드·국가 테마는 목적지에서 나오는 값이다.
// findDestinationByName / countryTheme 은 상수 조회지만 화면 파일에서 계산해 넘긴다.
// 준비 홈(TravelTicketCard)도 같은 방식이다.
// ============================================================================
import type { CountryTheme } from '@/lib/constants/countryTheme';
import type { TripOwnerType, TripStatus } from '@/lib/constants/status';

type HomeTripBase = {
  tripId: string;
  /** trips.destination 은 nullable 이다. 없으면 카드가 대체 문구를 쓴다. */
  destination: string | null;
  /** 티켓 상단 표기용 영문 도시명. 모르는 목적지면 destination 을 대문자로 쓴다. */
  destinationEn: string;
  /** 국기 이모지. 모르는 목적지면 🌍 */
  flag: string;
  /** 'YYYY-MM-DD'. trips.start_date 는 date 타입이라 시간대 변환이 없다. nullable. */
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  ownerType: TripOwnerType;
  /** 도착 공항 IATA 코드(CDG 등). 티켓 스텁과 경로에 쓴다. 모르는 목적지면 '—'. */
  airportCode: string;
  /** 모임 여행이면 모임명, 개인 여행이면 null. */
  groupName: string | null;
};

/** 1-1. 진행 중인 여행 (PLANNING / TRAVELING) */
export type OngoingTripCardData = HomeTripBase & {
  /** 목적지 국가 테마. 진행률·D-Day 배지 색이 여기서 온다. */
  theme: CountryTheme;
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

/**
 * 진행 중 여행이 없을 때의 빈 상태 종류. (docs/03 REQ-HOME-002)
 *
 * `first`  여행을 한 번도 만들지 않았다 — 무엇을 하는 서비스인지부터 알려준다
 * `return` 여행 기록은 있는데 지금 진행 중인 것만 없다 — 다음 여행을 권한다
 *
 * ⚠️ [검토 필요] 문서가 "최초/재방문을 구분한다"고만 하고 판정 기준을 정하지 않았다.
 *    여행 이력 유무로 정했다. 로컬 저장값이나 users.created_at 을 쓰는 방법도 있으나,
 *    이미 조회한 데이터로 판정되고 "재방문"보다 "여행을 해봤는가"가
 *    보여줄 문구를 고르는 데 더 맞는 기준이라고 봤다.
 */
export type HomeEmptyVariant = 'first' | 'return';
