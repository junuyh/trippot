// ============================================================================
// 목적지 소개 문구 — 사람이 쓴 것 (2026-09-09)
//
// 신규 사용자 홈의 '추천 여행지' 카드에 얹는 한 줄 소개와 추천 기간이다.
//
// ⚠️ **이 값은 측정된 데이터가 아니라 큐레이션이다.** 사람이 골라 쓴 문구다.
//    lib/constants/destinationHeroPhoto.ts 의 사진을 사람이 고른 것과 같다.
//    "평균 체류일 4.2일" 처럼 데이터인 척하는 값을 만들지 않는다.
//    (components/home/NextTripBanner "모르는 값을 그럴듯하게 지어내지 않는다")
//
// ⚠️ 금액을 두지 않는다. 목적지 상수에 항공료 기준값이 있지만 홈에서 꺼내지
//    않는다. 홈이 "얼마 있지?" 에 답하기 시작하면 계좌관리 앱이 된다.
//    (2026-09-03 팀 리뷰 · CLAUDE.md 2장 · components/home/types.ts)
//    금액은 여행을 만든 뒤 예산 화면에서 본다.
//
// ⚠️ 추천 기간도 큐레이션이다. 비행 시간과 도시 크기를 보고 사람이 정했다.
//    사용자가 이 기간으로 여행을 만들도록 강제하지 않는다. 참고값이다.
//
// Record 라서 목적지가 늘면 여기 누락이 컴파일 에러로 잡힌다.
// ============================================================================

import { DESTINATION_CODE, type DestinationCode } from './destinations';

export type DestinationEditorial = {
  /**
   * 카드에 얹는 소개. **두 줄로 쓴다.**
   * 줄바꿈을 문구 안에 넣어 어디서 끊을지 사람이 정한다.
   * 자동 줄바꿈에 맡기면 '언제나 설레는 여행 / 지' 처럼 어색하게 끊긴다.
   */
  blurb: string;
  /**
   * 추천 기간 — **러기지 태그의 STAY 칸용**. '3박 4일'.
   * 지난 여행 태그가 실제 여행 기간을 같은 표기로 찍기 때문에 형식을 맞춘다.
   */
  nights: string;
  /**
   * 추천 기간 — **추천 여행지 카드용**. '3~4일'.
   *
   * ⚠️ nights 와 같은 값을 다르게 적은 것이다. 한 칸에서만 쓰면 될 것을 두 번
   *    적는 이유는, 두 카드가 이 값을 **다른 뜻으로** 쓰기 때문이다.
   *    러기지 태그의 STAY 는 '얼마나 머물렀나' 를 적는 칸이라 지난 여행과 같은
   *    '3박 4일' 이라야 하고, 추천 여행지 카드는 '며칠쯤 잡으면 되나' 를 권하는
   *    자리라 '3~4일' 이 자연스럽다. 한쪽 표기를 다른 쪽에 밀어 넣으면
   *    둘 중 하나가 어색해진다.
   */
  days: string;
};

export const DESTINATION_EDITORIAL: Record<DestinationCode, DestinationEditorial> = {
  [DESTINATION_CODE.TOKYO]: {
    blurb: '가까운 거리에 볼거리가 가득한,\n언제 가도 실패 없는 도시',
    nights: '3박 4일',
    days: '3~4일',
  },
  [DESTINATION_CODE.OSAKA]: {
    blurb: '맛있는 음식과 활기찬 거리가\n함께하는, 언제나 설레는 여행지',
    nights: '3박 4일',
    days: '3~4일',
  },
  [DESTINATION_CODE.FUKUOKA]: {
    blurb: '비행 두 시간이면 닿는,\n주말에도 다녀올 수 있는 도시',
    nights: '2박 3일',
    days: '2~3일',
  },
  [DESTINATION_CODE.SHANGHAI]: {
    blurb: '옛 거리와 마천루가 나란히 선,\n걷는 재미가 있는 도시',
    nights: '3박 4일',
    days: '3~4일',
  },
  [DESTINATION_CODE.TAIPEI]: {
    blurb: '야시장부터 감성적인 골목 카페까지,\n먹거리와 도심 여행을 함께 즐기기 좋은 곳',
    nights: '3박 4일',
    days: '3~4일',
  },
  [DESTINATION_CODE.HONG_KONG]: {
    blurb: '밤이 되면 더 화려해지는,\n야경과 미식의 도시',
    nights: '3박 4일',
    days: '3~4일',
  },
  [DESTINATION_CODE.PARIS]: {
    blurb: '미술관과 골목 산책으로\n하루가 짧아지는 도시',
    nights: '5박 6일',
    days: '5~6일',
  },
  [DESTINATION_CODE.NICE]: {
    blurb: '지중해 햇살과 해변 산책이\n기다리는 남프랑스의 휴양지',
    nights: '4박 5일',
    days: '4~5일',
  },
  [DESTINATION_CODE.ROME]: {
    blurb: '도시 전체가 유적인,\n천천히 걸어야 보이는 곳',
    nights: '4박 5일',
    days: '4~5일',
  },
  [DESTINATION_CODE.MILAN]: {
    blurb: '패션과 디자인의 도시,\n근교 여행의 출발점',
    nights: '3박 4일',
    days: '3~4일',
  },
  [DESTINATION_CODE.VENICE]: {
    blurb: '골목마다 물길이 흐르는,\n한 번은 봐야 할 풍경',
    nights: '2박 3일',
    days: '2~3일',
  },
  [DESTINATION_CODE.CEBU]: {
    blurb: '바다와 리조트에서\n아무것도 하지 않아도 되는 곳',
    nights: '4박 5일',
    days: '4~5일',
  },
  [DESTINATION_CODE.DA_NANG]: {
    blurb: '해변과 옛 도시가 가까운,\n느긋하게 쉬다 오는 휴양지',
    nights: '4박 5일',
    days: '4~5일',
  },
};

/** 목적지 코드로 소개를 찾는다. 없는 코드면 undefined 다. */
export function destinationEditorial(
  code: DestinationCode | string | null | undefined,
): DestinationEditorial | undefined {
  if (!code) return undefined;
  return DESTINATION_EDITORIAL[code as DestinationCode];
}
