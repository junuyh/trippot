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

/**
 * 신규 사용자 홈의 '추천 여행지' 카드 한 장. (2026-09-09 개편)
 *
 * 여행이 하나도 없는 사람에게는 보여줄 여행이 없다. 대신 "어디 가지?" 에
 * 답이 될 만한 후보를 보여준다.
 *
 * ⚠️ **금액을 넣지 않는다.** 항공료 기준값(Destination.baseline)이 있지만
 *    쓰지 않는다. 홈이 "얼마 있지?" 에 답하기 시작하면 계좌관리 앱이 된다.
 *    (2026-09-03 팀 리뷰 · CLAUDE.md 2장 · HomeView 주석)
 *    금액은 여행을 만든 뒤 예산 화면에서 본다.
 *    시안에는 '추천 예산 ₩850,000~' 이 있었으나 같은 이유로 넣지 않고,
 *    그 자리에 추천 기간과 여행기 수를 뒀다. (2026-09-09 사용자 확인)
 *
 * ⚠️ **사진에서 보딩패스로 바꿨다.** (2026-09-09)
 *    준비 중인 여행 카드(NextTripBanner)와 같은 물건으로 보여야 한다.
 *    첫 여행을 만든 순간 이 카드 자리에 그 카드가 오는데, 둘이 다르게 생기면
 *    화면이 통째로 바뀐 것처럼 보인다. 그래서 사진 배너를 버리고
 *    같은 흰 카드 · 같은 항로 줄 · 같은 랜드마크 선그림을 쓴다.
 *
 * ⚠️ badge 는 **실제로 아는 값에서만 나온다.** 지금은 커뮤니티 글이 가장 많은
 *    여행지 한 곳이 '인기' 를 단다. 아무 근거 없이 '인기' 를 붙이지 않는다.
 *
 * 상수 조회(destinationEditorial · countryTheme)는 화면 파일이 하고 결과만 넘긴다.
 * 다른 홈 카드 데이터와 같은 방식이다.
 */
export type DestinationSuggestion = {
  /** 목적지 코드. 목록 key 다. */
  code: string;
  /** 도시 한글명. 영문명 아래 작게 쓴다. */
  nameKo: string;
  /** 카드에서 가장 큰 글자. 티켓 표기와 같은 영문 도시명이다. */
  nameEn: string;
  countryKo: string;
  /** 도착 공항 IATA 코드. 항로 줄 오른쪽 끝이다. */
  airportCode: string;
  /** 국기 이모지. ⚠️ 윈도우에는 국기 글꼴이 없어 'JP' 처럼 글자로 보인다. */
  flag: string;
  /** 사람이 쓴 두 줄 소개. (lib/constants/destinationEditorial) */
  blurb: string;
  /** 사람이 정한 추천 기간. '3박 4일'. */
  nights: string;
  /** 이 여행지의 커뮤니티 글 수. 없으면 0 이다. */
  postCount: number;
  /** 오른쪽 위 배지 문구. 근거가 없으면 null 이고 배지를 그리지 않는다. */
  badge: string | null;
  /** 국가 테마. 배지·랜드마크 선그림 색이 여기서 온다. */
  theme: CountryTheme;
};

/**
 * 신규 사용자 홈의 '여행자들은 이렇게 다녀왔어요' 태그 한 장. (2026-09-09)
 *
 * 추천 여행지가 "여기로 가보세요" 라면, 이건 "다른 사람은 여기 다녀왔대요" 다.
 * 그래서 누르면 여행 만들기가 아니라 **커뮤니티의 그 여행지 글** 로 간다.
 *
 * ⚠️ 지난 여행 카드(LuggageTagCard)와 같은 러기지 태그다. 다녀온 이야기를
 *    가리키는 물건이라 떼어 낸 수하물 태그가 맞다.
 *
 * ⚠️ **글이 실제로 있는 여행지만 넣는다.** 글이 없는 여행지를 넣으면 눌렀을 때
 *    빈 목록이 나온다. 목록은 커뮤니티 글 수(getPostDestinations)에서 만든다.
 */
export type DiscoverDestination = {
  code: string;
  /** 커뮤니티 필터에 넘길 값. trips.destination 과 같은 한글 도시명이다. */
  nameKo: string;
  nameEn: string;
  countryKo: string;
  airportCode: string;
  /**
   * 사람이 정한 추천 기간. '3박 4일'. (lib/constants/destinationEditorial)
   *
   * ⚠️ 지난 여행 태그는 이 자리(STAY)에 **실제 여행 기간**을 찍는다.
   *    여기는 여행이 아니라 여행지라 실제 기간이 없다. 추천 기간을 쓴다.
   */
  nights: string;
  /** 이 여행지의 커뮤니티 글 수. 1 이상만 목록에 들어온다. */
  postCount: number;
  theme: CountryTheme;
};
