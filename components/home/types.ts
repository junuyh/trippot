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
  /**
   * 카드 배너에 까는 랜드마크 사진 URL. (2026-09-03)
   *
   * 목록에 없는 목적지(직접 입력)면 null 이다.
   * ⚠️ 원격 URL 이라 로드에 실패할 수 있다. null 이든 실패든 카드는 그대로
   *    읽혀야 한다. 대체 화면은 DestinationBanner 가 그린다.
   */
  photoUrl: string | null;
  /** 사진이 없을 때 그릴 랜드마크 실루엣을 고르는 값. 모르는 목적지면 null. */
  countryKo: string | null;
  /**
   * 목적지 국가 테마. 진행률·D-Day 배지 색과 사진 대체 화면 배경이 여기서 온다.
   *
   * 2026-09-03 OngoingTripCardData 에서 여기로 올렸다. 지난 여행 목록도
   * 사진 대체 화면을 그리게 되면서 종료된 여행에도 필요해졌다.
   */
  theme: CountryTheme;
};

/** 1-1. 진행 중인 여행 (PLANNING / TRAVELING) */
export type OngoingTripCardData = HomeTripBase & {
  /** trips.headcount. 카드에 'N명' 으로 쓴다. */
  headcount: number;
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

// ============================================================================
// 대표 홈 대시보드 (2026-09-02 개편)
//
// 대표 홈은 "여러 여행 중 지금 무슨 일이 일어나고 있는가" 를 본다.
// 카테고리별 예산 같은 여행 상세(TRIP-HOME-01)의 정보를 반복하지 않는다.
//
// 아래 타입은 모두 **이미 계산이 끝난 값**이다.
// 컴포넌트가 금액을 계산하거나 라우트를 만들지 않는다. (CLAUDE.md 9장)
// ============================================================================

/** 출발이 가장 가까운 여행 하나. 메인 카드가 쓴다. */
export type NextTripCardData = OngoingTripCardData & {
  /** 참여 인원(ACTIVE 멤버 수). 모르면 null 이고 카드가 인원을 그리지 않는다. */
  memberCount: number | null;
};

/**
 * '지금 챙겨야 할 것' 한 줄.
 *
 * 문장을 세 조각으로 나눠서 받는다. 가운데 조각만 색을 입혀 강조하기 때문이다.
 * 컴포넌트가 금액을 계산하거나 문장을 조립하지 않는다.
 */
export type HomeActionItem = {
  /** 눌렀을 때 어디로 갈지 화면 파일이 이 값으로 찾는다. */
  id: string;
  icon: string;
  /** 아이콘 뒤 동그라미 색. */
  tint: string;
  /** 강조 앞 글자. */
  textBefore: string;
  /** 색으로 강조할 조각. 없으면 null. */
  highlight: string | null;
  /** 강조 뒤 글자. */
  textAfter: string;
  /** 어느 여행 이야기인지. 아랫줄에 작게 붙는다. */
  subtitle: string;
};

/** 여행자금 현황의 여행 한 줄. 도넛 조각 하나이자 범례 한 줄이다. */
export type HomeFundTripBar = {
  tripId: string;
  destination: string | null;
  /** 목표를 정하지 않았으면 null. */
  ratePercent: number | null;
  /** 이 여행에 준비된 금액. 도넛 조각 크기다. */
  currentAmount: number;
  /** 조각·점 색. 목적지 국가 테마의 primary. */
  color: string;
};

export type HomeFundSummaryData = {
  currentTotal: number;
  monthlyDeposit: number;
  /** 도넛 한가운데 숫자. 목표가 하나도 없으면 null. */
  overallRatePercent: number | null;
  trips: HomeFundTripBar[];
};

/** 지난 여행 인사이트 한 건. 확정된 결산이 없으면 화면이 null 을 넘긴다. */
export type HomePastInsightData = {
  tripId: string;
  destination: string | null;
  categoryLabel: string;
  emoji: string;
  /** 계획보다 더 쓴 금액. 원 단위 정수. */
  overAmount: number;
};
