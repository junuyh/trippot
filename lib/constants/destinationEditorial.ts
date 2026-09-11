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
  /** 묵는 밤 수. 여행비 가이드 계산에 쓴다. (lib/destination/budgetGuide) */
  stayNights: number;
  /** 여행지 상세의 소개 문단. blurb 보다 길다. 두세 문장. */
  intro: string;
  /** 추천 여행 시기. '봄, 가을'. */
  season: string;
  /** 여행 스타일 두세 개. '도시·미식·쇼핑' 처럼 가운뎃점으로 잇는다. */
  styles: string;
  /** '이런 분들께 추천해요' 항목. 3~4개. */
  recommendedFor: readonly string[];
};

export const DESTINATION_EDITORIAL: Record<DestinationCode, DestinationEditorial> = {
  [DESTINATION_CODE.TOKYO]: {
    blurb: '가까운 거리에 볼거리가 가득한,\n언제 가도 실패 없는 도시',
    nights: '3박 4일',
    days: '3~4일',
    stayNights: 3,
    intro:
      '거대한 도시 안에 오래된 골목과 최신 유행이 함께 있는 도쿄. 볼거리와 먹거리가 워낙 많아 일정을 어떻게 짜도 아쉬움이 남는, 일본을 처음 가는 사람에게도 여러 번 간 사람에게도 좋은 도시.',
    season: '봄, 가을',
    styles: '도시 · 쇼핑 · 미식',
    recommendedFor: [
      '처음 가는 일본 여행을 고민 중인 분',
      '쇼핑과 도시 구경을 좋아하는 분',
      '짧은 일정으로 알차게 다녀오고 싶은 분',
      '애니메이션·서브컬처에 관심 있는 분',
    ],
  },
  [DESTINATION_CODE.OSAKA]: {
    blurb: '맛있는 음식과 활기찬 거리가\n함께하는, 언제나 설레는 여행지',
    nights: '3박 4일',
    days: '3~4일',
    stayNights: 3,
    intro:
      '전통과 현대가 공존하는, 언제나 활기찬 도시 오사카. 맛있는 음식과 다채로운 볼거리로 누구나 즐길 수 있는 일본의 대표 여행지.',
    season: '봄, 가을',
    styles: '도시 · 미식 · 쇼핑',
    recommendedFor: [
      '맛있는 음식을 즐기는 미식 여행자',
      '쇼핑과 트렌디한 도시 여행을 좋아하는 분',
      '가족, 친구, 연인과 함께하는 여행을 계획 중인 분',
      '짧은 일정으로도 알차게 다녀오고 싶은 분',
    ],
  },
  [DESTINATION_CODE.FUKUOKA]: {
    blurb: '비행 두 시간이면 닿는,\n주말에도 다녀올 수 있는 도시',
    nights: '2박 3일',
    days: '2~3일',
    stayNights: 2,
    intro:
      '비행 두 시간이면 닿는 가장 가까운 일본. 공항에서 도심까지 지하철로 십여 분이라, 금요일 저녁에 떠나 일요일에 돌아오는 주말 여행이 가능한 도시.',
    season: '봄, 가을',
    styles: '미식 · 온천 · 도시',
    recommendedFor: [
      '주말을 이용해 짧게 다녀오고 싶은 분',
      '포장마차와 라멘을 좋아하는 분',
      '온천을 곁들이고 싶은 분',
      '첫 해외여행을 준비하는 분',
    ],
  },
  [DESTINATION_CODE.SHANGHAI]: {
    blurb: '옛 거리와 마천루가 나란히 선,\n걷는 재미가 있는 도시',
    nights: '3박 4일',
    days: '3~4일',
    stayNights: 3,
    intro:
      '옛 조계지의 유럽식 건물과 황푸강 건너 마천루가 마주 보는 도시. 걸어서 둘러보는 재미가 크고, 근교로 수향마을까지 다녀올 수 있다.',
    season: '봄, 가을',
    styles: '도시 · 야경 · 미식',
    recommendedFor: [
      '도시 산책과 건축 구경을 좋아하는 분',
      '야경을 중요하게 보는 분',
      '근교 소도시까지 함께 보고 싶은 분',
    ],
  },
  [DESTINATION_CODE.TAIPEI]: {
    blurb: '야시장부터 감성적인 골목 카페까지,\n먹거리와 도심 여행을 함께 즐기기 좋은 곳',
    nights: '3박 4일',
    days: '3~4일',
    stayNights: 3,
    intro:
      '야시장부터 감성적인 골목 카페까지, 먹거리와 도심 여행을 함께 즐기기 좋은 도시. 비행 시간이 짧고 물가도 부담이 적어 첫 해외여행으로 자주 꼽힌다.',
    season: '가을, 겨울',
    styles: '미식 · 도시 · 근교',
    recommendedFor: [
      '야시장과 길거리 음식을 좋아하는 분',
      '카페와 골목 산책을 즐기는 분',
      '가까운 곳으로 부담 없이 떠나고 싶은 분',
      '온천과 근교 여행을 곁들이고 싶은 분',
    ],
  },
  [DESTINATION_CODE.HONG_KONG]: {
    blurb: '밤이 되면 더 화려해지는,\n야경과 미식의 도시',
    nights: '3박 4일',
    days: '3~4일',
    stayNights: 3,
    intro:
      '해가 지면 더 화려해지는 도시. 빅토리아 피크의 야경과 딤섬, 좁은 골목의 간판들이 한데 있어 짧은 일정에도 볼거리가 끊이지 않는다.',
    season: '가을, 겨울',
    styles: '야경 · 미식 · 쇼핑',
    recommendedFor: [
      '야경을 좋아하는 분',
      '딤섬과 홍콩 음식을 즐기는 분',
      '짧고 강렬한 도시 여행을 원하는 분',
    ],
  },
  [DESTINATION_CODE.PARIS]: {
    blurb: '미술관과 골목 산책으로\n하루가 짧아지는 도시',
    nights: '5박 6일',
    days: '5~6일',
    stayNights: 5,
    intro:
      '미술관과 골목 산책만으로 하루가 짧아지는 도시. 유명한 곳을 모두 보려 하기보다 동네를 정해 천천히 걷는 편이 기억에 오래 남는다.',
    season: '봄, 가을',
    styles: '예술 · 도시 · 산책',
    recommendedFor: [
      '미술관과 전시를 좋아하는 분',
      '유럽 여행이 처음인 분',
      '한 도시에 머물며 천천히 보고 싶은 분',
      '사진 찍기를 즐기는 분',
    ],
  },
  [DESTINATION_CODE.NICE]: {
    blurb: '지중해 햇살과 해변 산책이\n기다리는 남프랑스의 휴양지',
    nights: '4박 5일',
    days: '4~5일',
    stayNights: 4,
    intro:
      '지중해 햇살과 해변 산책이 기다리는 남프랑스의 휴양지. 도시 여행에 지쳤을 때 며칠 쉬어 가기 좋고, 근교 마을로 당일치기가 쉽다.',
    season: '봄, 여름',
    styles: '휴양 · 해변 · 근교',
    recommendedFor: [
      '바다를 보며 쉬고 싶은 분',
      '유럽에서 느긋한 일정을 원하는 분',
      '근교 소도시를 함께 보고 싶은 분',
    ],
  },
  [DESTINATION_CODE.ROME]: {
    blurb: '도시 전체가 유적인,\n천천히 걸어야 보이는 곳',
    nights: '4박 5일',
    days: '4~5일',
    stayNights: 4,
    intro:
      '길을 걷다 유적을 만나는 도시. 유명한 곳이 모여 있어 이동이 짧고, 저녁에는 광장마다 사람이 모여 도시 전체가 밝다.',
    season: '봄, 가을',
    styles: '역사 · 도시 · 미식',
    recommendedFor: [
      '역사와 유적에 관심 있는 분',
      '걸어서 둘러보는 여행을 좋아하는 분',
      '이탈리아 음식을 즐기는 분',
    ],
  },
  [DESTINATION_CODE.MILAN]: {
    blurb: '패션과 디자인의 도시,\n근교 여행의 출발점',
    nights: '3박 4일',
    days: '3~4일',
    stayNights: 3,
    intro:
      '패션과 디자인의 도시이자 북부 이탈리아 여행의 출발점. 도심은 하루면 충분히 보고, 남은 날은 기차로 호수와 근교 도시를 다녀올 수 있다.',
    season: '봄, 가을',
    styles: '쇼핑 · 디자인 · 근교',
    recommendedFor: [
      '쇼핑과 패션에 관심 있는 분',
      '근교 도시까지 함께 돌고 싶은 분',
      '유럽 일정의 시작점을 찾는 분',
    ],
  },
  [DESTINATION_CODE.VENICE]: {
    blurb: '골목마다 물길이 흐르는,\n한 번은 봐야 할 풍경',
    nights: '2박 3일',
    days: '2~3일',
    stayNights: 2,
    intro:
      '골목마다 물길이 흐르는, 한 번은 봐야 할 풍경의 도시. 크지 않아 이틀이면 충분하고, 사람이 빠지는 이른 아침과 저녁이 가장 좋다.',
    season: '봄, 가을',
    styles: '풍경 · 산책 · 사진',
    recommendedFor: [
      '다른 곳에 없는 풍경을 보고 싶은 분',
      '짧게 들러 가는 일정을 짜는 분',
      '사진 찍기를 즐기는 분',
    ],
  },
  [DESTINATION_CODE.CEBU]: {
    blurb: '바다와 리조트에서\n아무것도 하지 않아도 되는 곳',
    nights: '4박 5일',
    days: '4~5일',
    stayNights: 4,
    intro:
      '바다와 리조트에서 아무것도 하지 않아도 되는 곳. 액티비티를 원하면 섬 투어와 물놀이가, 쉬고 싶으면 리조트 안에서 하루가 다 간다.',
    season: '겨울, 봄',
    styles: '휴양 · 해양 액티비티 · 리조트',
    recommendedFor: [
      '바다에서 푹 쉬고 싶은 분',
      '스노클링·아일랜드 호핑을 해보고 싶은 분',
      '아이와 함께 가는 가족 여행',
      '비용 부담을 줄이고 싶은 분',
    ],
  },
  [DESTINATION_CODE.DA_NANG]: {
    blurb: '해변과 옛 도시가 가까운,\n느긋하게 쉬다 오는 휴양지',
    nights: '4박 5일',
    days: '4~5일',
    stayNights: 4,
    intro:
      '해변과 옛 도시가 가까워 쉬는 날과 구경하는 날을 나눠 쓰기 좋은 곳. 호이안 야경까지 묶으면 일정이 알차진다.',
    season: '봄, 여름',
    styles: '휴양 · 미식 · 근교',
    recommendedFor: [
      '리조트에서 쉬며 관광도 하고 싶은 분',
      '베트남 음식을 좋아하는 분',
      '가성비 좋은 휴양지를 찾는 분',
      '가족 여행을 계획 중인 분',
    ],
  },
};

/** 목적지 코드로 소개를 찾는다. 없는 코드면 undefined 다. */
export function destinationEditorial(
  code: DestinationCode | string | null | undefined,
): DestinationEditorial | undefined {
  if (!code) return undefined;
  return DESTINATION_EDITORIAL[code as DestinationCode];
}
