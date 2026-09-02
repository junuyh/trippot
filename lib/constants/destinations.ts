// ============================================================================
// 목적지 기준 데이터 (MVP 12개)
//
// 여행지 입력은 목록 선택이다. 자유 텍스트로 받으면 목적지별 물가를 반영할 수
// 없어 추천이 뭉뚱그려진다. TripPot 의 핵심은 '근거 있는 예산'이므로
// 목적지가 추천의 1차 기준이 된다.
//
// ⚠️ MVP 한정으로 DB 가 아니라 코드 상수다.
//    실서비스에서는 destinations / destination_baselines 테이블로 옮긴다.
//    지금 마이그레이션을 추가하면 타입 재생성과 팀원 pull 이 연쇄된다.
//
// ⚠️ 여기 값은 전부 travel_style = 'standard' 기준이다.
//    스타일 배수(budget / comfort)는 이 파일에 두지 않는다.
//    데이터와 로직을 섞으면 배수만 바꾸고 싶을 때 이 파일을 건드리게 된다.
//
// ⚠️ 금액은 전부 원 단위 정수다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
//    currency 는 KRW 고정이다. 환율 변환은 [Future].
//
// 산출 단위
//   airfarePerPerson   1인 왕복 총액        → × 인원
//   lodgingPerNight    1인 1박              → × 인원 × 박수
//   perPersonPerDay    1인 1일 (나머지 6개) → × 인원 × 일수
//
//   숙소만 '박' 기준인 이유: 3박 4일 여행에서 일수로 계산하면 숙박이 4박치로
//   잡힌다. 사용자가 바로 알아채는 오류이고, 결산에서 숙박이 매번 -25% 로
//   나와 개인화 데이터가 오염된다.
// ============================================================================

// ============================================================================
// 왜 상수로 하드코딩했는가 — 로드맵
//
// 이 프로젝트의 최종 목표는 AI 가 실시간으로 시세를 검색해 예산안을 잡는 것이다.
// 아래 값은 그 목표를 포기한 게 아니라 1단계다.
//
//   MVP (2026-08-31)  규칙 기반. 아래 12개 목적지 기준 데이터.
//                     UT 에서 "이 금액이 현실적인가" 를 먼저 검증한다.
//                     검색을 붙이기 전에 기준선이 맞는지부터 확인해야 한다.
//
//   v2 (2026-09-07~)  항공만 AI 웹 검색 + 가드레일.
//                     검색 결과가 아래 기준값 대비 ±30% 를 벗어나면 기준값을 쓴다.
//                     화면에 '실시간 시세' 와 '기준 추정' 을 구분해 표시한다.
//                     → 그래서 조회 결과에 source 필드가 있다.
//
//   실서비스           전 카테고리 검색 기반 (항공·숙박·관광패스 등).
//                     기준 데이터는 DB 테이블로 옮기고 가드레일 기준선으로만 남는다.
//
// 항공을 먼저 하는 이유: 총액에서 비중이 가장 크고(25~30%) 시기별 변동도 가장 커서
// 검색을 붙였을 때 효과가 가장 잘 드러난다. 하나로 검색 품질을 판단한 뒤 넓힌다.
//
// 공식 금융·여행사 API 제휴는 사업자 자격이 필요해 이 프로젝트 범위 밖이다.
// 웹 검색 기반으로 간다.
//
// ⚠️ 그래서 기준 데이터를 **함수로 감싸서** 조회한다. getDestinationBaseline() /
//    getRegionBaseline() 을 쓰고 DESTINATIONS 를 직접 뒤지지 않는다.
//    검색 기반으로 교체할 때 호출부를 고치지 않기 위해서다.
// ============================================================================

import type { CategoryCode, TravelStyle } from './status';

/**
 * 기준 금액을 마지막으로 갱신한 날짜.
 * NFR-004(추천은 추정치임을 표시)에 따라 화면에 "YYYY년 M월 기준"으로 노출한다.
 * 금액을 하나라도 고치면 이 날짜도 함께 고친다.
 */
export const BASELINE_UPDATED_AT = '2026-08-28';

/** 목록에 없는 목적지를 지역 평균으로 추천할 때 화면에 그대로 표시하는 문구. (NFR-004) */
export const BASELINE_ESTIMATE_NOTICE = '기준 데이터가 없어 지역 평균으로 추천합니다';

// ── 지역 ───────────────────────────────────────────────────────────────────
// region 은 '목록에 없는 목적지'의 평균값 산출 단위다.
// 국가 단위로 쪼개면 표본이 1개인 지역이 늘어나 평균의 의미가 없어진다.

export const REGION = {
  ASIA: 'asia',
  SOUTHEAST_ASIA: 'southeast_asia',
  EUROPE: 'europe',
} as const;
export type RegionCode = (typeof REGION)[keyof typeof REGION];

/**
 * 화면의 지역 선택 순서이기도 하다. 정의 순서대로 그려진다.
 *
 * ⚠️ 일본과 중화권을 'asia' 하나로 합쳤다. (2026-08-28)
 *    물가 차이만 보면 나누는 편이 정확하지만, 사용자에게 '일본' 과 '아시아' 가
 *    나란히 놓이면 일본은 아시아가 아닌 것처럼 읽힌다.
 *    목적지별 기준 금액은 도시 단위로 따로 갖고 있으므로, 지역을 합쳐도
 *    목록에 있는 12개의 추천 정확도는 그대로다.
 *    지역 평균은 '목록에 없는 목적지' 에만 쓰인다.
 */
export const REGION_LABEL: Record<RegionCode, string> = {
  asia: '아시아',
  southeast_asia: '동남아시아',
  europe: '유럽',
};

// ── 목적지 코드 ────────────────────────────────────────────────────────────

export const DESTINATION_CODE = {
  TOKYO: 'tokyo',
  OSAKA: 'osaka',
  FUKUOKA: 'fukuoka',
  HONG_KONG: 'hong_kong',
  SHANGHAI: 'shanghai',
  TAIPEI: 'taipei',
  PARIS: 'paris',
  NICE: 'nice',
  ROME: 'rome',
  MILAN: 'milan',
  VENICE: 'venice',
  CEBU: 'cebu',
} as const;
export type DestinationCode = (typeof DESTINATION_CODE)[keyof typeof DESTINATION_CODE];

// ── 기준 금액 타입 ─────────────────────────────────────────────────────────

/**
 * 항공·숙소를 뺀 6개 카테고리. 1인 1일 기준이다.
 * Record 라서 CATEGORY_CODE 에 카테고리가 추가되면 여기 누락이 컴파일 에러로 잡힌다.
 */
export type PerPersonPerDayBaseline = Record<
  Exclude<CategoryCode, 'AIRFARE' | 'LODGING'>,
  number
>;

export type DestinationBaseline = {
  /** 1인 왕복 총액 (인천 출발 이코노미) */
  airfarePerPerson: number;
  /** 1인 1박 (2인 1실 기준 1인 분담액) */
  lodgingPerNight: number;
  perPersonPerDay: PerPersonPerDayBaseline;
};

export type Destination = {
  code: DestinationCode;
  /** 화면 표시명이자 trips.destination(text) 에 저장하는 값 */
  nameKo: string;
  countryKo: string;
  region: RegionCode;
  /** 영문 도시명. 티켓의 TO 표기와 배경 워터마크에 쓴다 */
  nameEn: string;
  /** 국기 이모지. 준비 홈 티켓에 표시한다 */
  flag: string;
  /** 도착 공항 IATA 코드. 보딩패스 표시용이다 */
  airportCode: string;
  baseline: DestinationBaseline;
};

// ============================================================================
// 목적지별 기준 금액
//
// 추정 근거 — 공통 전제
//   · 인천 출발, 성수기·비수기를 섞은 연중 평균, 이코노미 왕복
//   · 숙소는 3~4성급 2인 1실을 인원수로 나눈 1인 분담액
//   · 식비는 1일 3식 + 카페 1회
//   · 보험은 여행자보험 1인 1일 환산액 (실제로는 일수 비례 상품이다)
//   · 예비비는 나머지 합계의 5% 안팎을 1인 1일로 환산한 값
//
// ⚠️ 도쿄 값은 supabase/seed.sql 의 도쿄 여행(4인·3박4일)
//    recommended_amount 4,000,000 을 카테고리 단위까지 정확히 재현한다.
//    시드가 진실이므로 도쿄 값을 바꾸려면 시드를 먼저 확인한다.
// ============================================================================

export const DESTINATIONS: readonly Destination[] = [
  // ── 일본 ─────────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.TOKYO,
    nameKo: '도쿄',
    countryKo: '일본',
    nameEn: 'TOKYO',
    flag: '🇯🇵',
    airportCode: 'NRT',
    region: REGION.ASIA,
    baseline: {
      // 275,000 × 4인 = 1,100,000 (시드 AIRFARE 와 일치)
      // 근거: 인천-나리타/하네다 왕복 25~30만원대
      airfarePerPerson: 275_000,
      // 80,000 × 4인 × 3박 = 960,000 (시드 LODGING 과 일치)
      // 근거: 신주쿠·시부야권 3~4성급 2인 1실 1박 16만원 → 1인 8만원
      lodgingPerNight: 80_000,
      perPersonPerDay: {
        // 45,000 × 4인 × 4일 = 720,000 (시드 FOOD 와 일치)
        // 근거: 라멘·정식 1,500엔대 2회 + 저녁 3,000엔대 1회 + 카페
        FOOD: 45_000,
        // 20,000 × 16 = 320,000 (시드 TRANSPORT 와 일치)
        // 근거: 도쿄메트로 1일권 + JR 단거리. 공항철도는 별도로 큰 편
        TRANSPORT: 20_000,
        // 25,000 × 16 = 400,000 (시드 ACTIVITY 와 일치)
        // 근거: 디즈니랜드 1일권 약 8만원을 4일에 분산 + 소액 관람료
        ACTIVITY: 25_000,
        // 15,000 × 16 = 240,000 (시드 SHOPPING 과 일치)
        // 근거: 드럭스토어·기념품 중심. 면세 한도 소진형 쇼핑은 아님
        SHOPPING: 15_000,
        // 3,750 × 16 = 60,000 (시드 INSURANCE 와 일치)
        // 근거: 일본 4일 여행자보험 1인 약 15,000원 ÷ 4일
        INSURANCE: 3_750,
        // 12,500 × 16 = 200,000 (시드 CONTINGENCY 와 일치)
        // 근거: 항공·숙소 제외 합계의 약 5%
        CONTINGENCY: 12_500,
      },
    },
  },
  {
    code: DESTINATION_CODE.OSAKA,
    nameKo: '오사카',
    countryKo: '일본',
    nameEn: 'OSAKA',
    flag: '🇯🇵',
    airportCode: 'KIX',
    region: REGION.ASIA,
    baseline: {
      // 인천-간사이는 도쿄보다 소폭 저렴하다
      airfarePerPerson: 260_000,
      // 난바·우메다권 숙소가 도쿄보다 10% 가량 싸다
      lodgingPerNight: 72_000,
      perPersonPerDay: {
        // 도쿄 대비 외식 단가가 낮다 (쿠시카츠·타코야키 등 저단가 비중)
        FOOD: 42_000,
        // 도시 규모가 작아 이동거리가 짧다
        TRANSPORT: 18_000,
        // USJ 1일권이 디즈니랜드와 비슷한 단가다
        ACTIVITY: 25_000,
        SHOPPING: 15_000,
        // 일본 공통 (도쿄와 동일 상품 기준)
        INSURANCE: 3_750,
        CONTINGENCY: 12_000,
      },
    },
  },
  {
    code: DESTINATION_CODE.FUKUOKA,
    nameKo: '후쿠오카',
    countryKo: '일본',
    nameEn: 'FUKUOKA',
    flag: '🇯🇵',
    airportCode: 'FUK',
    region: REGION.ASIA,
    baseline: {
      // 일본 노선 중 가장 가깝다 (비행 약 1시간 10분). LCC 비중이 높다
      airfarePerPerson: 220_000,
      // 하카타·텐진권 비즈니스호텔 중심
      lodgingPerNight: 65_000,
      perPersonPerDay: {
        // 포장마차·모츠나베 등 단가가 낮다
        FOOD: 38_000,
        // 시내가 좁아 지하철 2~3정거장 생활권
        TRANSPORT: 15_000,
        // 대형 테마파크가 없어 관람·온천 중심
        ACTIVITY: 20_000,
        SHOPPING: 13_000,
        INSURANCE: 3_750,
        CONTINGENCY: 11_000,
      },
    },
  },

  // ── 중국 ─────────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.SHANGHAI,
    nameKo: '상하이',
    countryKo: '중국',
    nameEn: 'SHANGHAI',
    flag: '🇨🇳',
    airportCode: 'PVG',
    region: REGION.ASIA,
    baseline: {
      // 비행 약 2시간. 홍콩보다 가깝다
      airfarePerPerson: 320_000,
      // 푸시(황푸강 서안) 4성급 기준
      lodgingPerNight: 70_000,
      perPersonPerDay: {
        // 로컬 식당 단가가 낮다. 관광지 식당과 편차가 크다
        FOOD: 38_000,
        // 지하철 요금이 매우 낮다 (1회 3~6위안)
        TRANSPORT: 15_000,
        // 디즈니랜드가 있으나 그 외 관람료가 낮다
        ACTIVITY: 22_000,
        SHOPPING: 15_000,
        INSURANCE: 4_000,
        CONTINGENCY: 11_000,
      },
    },
  },

  // ── 대만 ─────────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.TAIPEI,
    nameKo: '타이베이',
    countryKo: '대만',
    nameEn: 'TAIPEI',
    flag: '🇹🇼',
    airportCode: 'TPE',
    region: REGION.ASIA,
    baseline: {
      // 비행 약 2시간 30분. 중화권에서 항공비 대비 물가가 가장 낮다
      airfarePerPerson: 330_000,
      // 시먼딩·중산권 3성급
      lodgingPerNight: 60_000,
      perPersonPerDay: {
        // 야시장 중심이라 1식 단가가 낮다
        FOOD: 35_000,
        // MRT 요금이 낮고 시내가 조밀하다
        TRANSPORT: 13_000,
        // 예류·지우펀 근교 투어, 타이베이101
        ACTIVITY: 20_000,
        SHOPPING: 14_000,
        INSURANCE: 4_000,
        CONTINGENCY: 10_000,
      },
    },
  },

  // ── 홍콩 ─────────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.HONG_KONG,
    nameKo: '홍콩',
    countryKo: '홍콩',
    nameEn: 'HONG KONG',
    flag: '🇭🇰',
    airportCode: 'HKG',
    region: REGION.ASIA,
    baseline: {
      // 비행 약 3시간 40분. 일본보다 한 단계 비싸다
      airfarePerPerson: 380_000,
      // 아시아권 최고 수준 숙박비. 같은 등급이 도쿄보다 25% 비싸다
      lodgingPerNight: 100_000,
      perPersonPerDay: {
        // 딤섬·차찬텡은 저렴하지만 저녁 외식 단가가 높다
        FOOD: 50_000,
        // MTR 단가는 낮으나 공항고속·트램·페리가 더해진다
        TRANSPORT: 18_000,
        // 디즈니랜드·오션파크·피크트램
        ACTIVITY: 28_000,
        // 면세 지역이라 쇼핑 지출 비중이 높다
        SHOPPING: 20_000,
        INSURANCE: 4_000,
        CONTINGENCY: 14_000,
      },
    },
  },

  // ── 프랑스 ───────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.PARIS,
    nameKo: '파리',
    countryKo: '프랑스',
    nameEn: 'PARIS',
    flag: '🇫🇷',
    airportCode: 'CDG',
    region: REGION.EUROPE,
    baseline: {
      // 직항 약 12~14시간. 아시아 노선의 4~5배다
      airfarePerPerson: 1_250_000,
      // 시내 3성급 2인 1실 1박 24만원 → 1인 12만원
      lodgingPerNight: 120_000,
      perPersonPerDay: {
        // 카페·비스트로 기준. 자릿세·팁 문화가 단가를 올린다
        FOOD: 60_000,
        // 메트로 회수권 + 공항 RER
        TRANSPORT: 20_000,
        // 루브르·오르세·베르사유 등 유료 관람이 많다
        ACTIVITY: 35_000,
        // 백화점·브랜드 쇼핑 비중이 아시아보다 높다
        SHOPPING: 25_000,
        // 유럽 장기 일정 기준. 의료비가 높아 보장금액이 올라간다
        INSURANCE: 6_000,
        CONTINGENCY: 18_000,
      },
    },
  },
  {
    code: DESTINATION_CODE.NICE,
    nameKo: '니스',
    countryKo: '프랑스',
    nameEn: 'NICE',
    flag: '🇫🇷',
    airportCode: 'NCE',
    region: REGION.EUROPE,
    baseline: {
      // 직항이 없어 경유가 기본이다. 파리보다 비싸다
      airfarePerPerson: 1_350_000,
      // 해안 리조트지만 파리 시내보다는 저렴하다
      lodgingPerNight: 115_000,
      perPersonPerDay: {
        FOOD: 55_000,
        // 도시가 작고 해안선을 따라 걷는 동선이 많다
        TRANSPORT: 15_000,
        // 해변·근교(모나코·칸) 중심이라 유료 관람이 적다
        ACTIVITY: 30_000,
        SHOPPING: 18_000,
        INSURANCE: 6_000,
        CONTINGENCY: 17_000,
      },
    },
  },

  // ── 이탈리아 ─────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.ROME,
    nameKo: '로마',
    countryKo: '이탈리아',
    nameEn: 'ROME',
    flag: '🇮🇹',
    airportCode: 'FCO',
    region: REGION.EUROPE,
    baseline: {
      // 직항 약 12시간 30분
      airfarePerPerson: 1_200_000,
      // 파리보다 같은 등급이 10~15% 저렴하다
      lodgingPerNight: 105_000,
      perPersonPerDay: {
        FOOD: 52_000,
        // 시내 관광지가 도보권에 몰려 있다
        TRANSPORT: 16_000,
        // 콜로세움·바티칸 등 예약 필수 유료 관람이 많다
        ACTIVITY: 33_000,
        SHOPPING: 20_000,
        INSURANCE: 6_000,
        CONTINGENCY: 17_000,
      },
    },
  },
  {
    code: DESTINATION_CODE.MILAN,
    nameKo: '밀라노',
    countryKo: '이탈리아',
    nameEn: 'MILAN',
    flag: '🇮🇹',
    airportCode: 'MXP',
    region: REGION.EUROPE,
    baseline: {
      airfarePerPerson: 1_250_000,
      // 비즈니스 도시라 로마보다 숙박비가 높다
      lodgingPerNight: 115_000,
      perPersonPerDay: {
        FOOD: 55_000,
        TRANSPORT: 16_000,
        // 두오모 외에는 유료 관람이 적다
        ACTIVITY: 28_000,
        // 12곳 중 최고. 아울렛·패션 쇼핑이 방문 목적인 경우가 많다
        SHOPPING: 30_000,
        INSURANCE: 6_000,
        CONTINGENCY: 17_000,
      },
    },
  },
  {
    code: DESTINATION_CODE.VENICE,
    nameKo: '베니스',
    countryKo: '이탈리아',
    nameEn: 'VENICE',
    flag: '🇮🇹',
    airportCode: 'VCE',
    region: REGION.EUROPE,
    baseline: {
      // 직항이 없어 경유가 기본이다
      airfarePerPerson: 1_300_000,
      // 12곳 중 최고. 섬 안 숙소는 공급이 제한적이라 단가가 높다
      lodgingPerNight: 125_000,
      perPersonPerDay: {
        // 관광지 물가가 이탈리아 평균보다 높다
        FOOD: 58_000,
        // 12곳 중 최고. 수상버스 1회권 약 12,000원, 1일 2회 이상 탄다
        TRANSPORT: 22_000,
        // 곤돌라·본섬 투어·부라노 이동
        ACTIVITY: 32_000,
        SHOPPING: 18_000,
        INSURANCE: 6_000,
        CONTINGENCY: 18_000,
      },
    },
  },

  // ── 필리핀 ───────────────────────────────────────────────────────────────
  {
    code: DESTINATION_CODE.CEBU,
    nameKo: '세부',
    countryKo: '필리핀',
    nameEn: 'CEBU',
    flag: '🇵🇭',
    airportCode: 'CEB',
    region: REGION.SOUTHEAST_ASIA,
    baseline: {
      // 비행 약 4시간 30분. 일본보다 비싸고 유럽의 1/3 수준이다
      airfarePerPerson: 450_000,
      // 리조트 숙박 비중이 높아 동남아 평균보다 높다
      lodgingPerNight: 65_000,
      perPersonPerDay: {
        // 12곳 중 최저. 리조트 밖 로컬 식당 단가가 매우 낮다
        FOOD: 30_000,
        // 12곳 중 최저. 대중교통보다 그랩·리조트 셔틀 중심이다
        TRANSPORT: 12_000,
        // 12곳 중 최고. 호핑투어·다이빙·자마린 등 유료 액티비티가 방문 목적이다
        ACTIVITY: 35_000,
        // 12곳 중 최저. 살 것이 많지 않다
        SHOPPING: 10_000,
        // 동남아는 의료·수상레저 특약으로 보험료가 일본보다 높다
        INSURANCE: 4_500,
        CONTINGENCY: 11_000,
      },
    },
  },
] as const;

// ============================================================================
// 지역 평균 — 목록에 없는 목적지용
//
// 사용자가 직접 입력한 목적지는 기준 데이터가 없다. 이때 지역 평균으로 추천하고
// 화면에 BASELINE_ESTIMATE_NOTICE 를 반드시 표시한다. (NFR-004)
//
// 값은 소속 목적지의 산술평균을 반올림한 것이다.
// 다만 표본이 한쪽으로 치우친 항목은 지역 일반값으로 낮췄다. 아래 주석 참조.
// ============================================================================

export const REGION_BASELINE: Record<RegionCode, DestinationBaseline> = {
  // 도쿄·오사카·후쿠오카·홍콩·상하이·타이베이 6개 평균 (1,000원 단위 반올림)
  asia: {
    airfarePerPerson: 300_000,
    lodgingPerNight: 75_000,
    perPersonPerDay: {
      FOOD: 41_000,
      TRANSPORT: 17_000,
      ACTIVITY: 23_000,
      SHOPPING: 15_000,
      INSURANCE: 3_900,
      CONTINGENCY: 12_000,
    },
  },
  // ⚠️ 목록에 세부 하나뿐이라 산술평균이 곧 세부 값이다.
  //    세부는 리조트·액티비티 편중이 심해 그대로 쓰면 지역 평균이 왜곡된다.
  //    숙소·액티비티는 동남아 일반 도시 수준으로 낮췄다.
  //    (시드의 다낭 여행이 이 경로로 추천된다)
  southeast_asia: {
    airfarePerPerson: 450_000,
    lodgingPerNight: 60_000,
    perPersonPerDay: {
      FOOD: 30_000,
      TRANSPORT: 12_000,
      ACTIVITY: 25_000,
      SHOPPING: 12_000,
      INSURANCE: 4_500,
      CONTINGENCY: 11_000,
    },
  },
  // 파리·니스·로마·밀라노·베니스 평균
  europe: {
    airfarePerPerson: 1_270_000,
    lodgingPerNight: 116_000,
    perPersonPerDay: {
      FOOD: 56_000,
      TRANSPORT: 18_000,
      ACTIVITY: 32_000,
      SHOPPING: 22_000,
      INSURANCE: 6_000,
      CONTINGENCY: 17_000,
    },
  },
};

/**
 * 지역조차 판단할 수 없을 때의 기본값.
 * 직접 입력 목적지의 지역을 추정하는 로직이 실패해도 추천이 비지 않게 한다.
 *
 * ⚠️ 직접 입력 목적지의 region 은 **추정하지 않는다.**
 *    TRIP-02 에서 목적지를 직접 입력할 때 국가/지역을 함께 선택받는다. (2026-08-28 확정)
 *    '다낭' → southeast_asia 같은 문자열 매칭 테이블은 만들지 않는다.
 *    유지 비용이 크고 오탐이 난다. 사용자가 한 번 더 고르는 편이 정확하고 구현도 단순하다.
 *    이 상수는 그 선택마저 비어 있을 때의 최종 방어선이다.
 */
export const DEFAULT_REGION: RegionCode = REGION.ASIA;

// ============================================================================
// 화면·조회 보조
// ============================================================================

export type DestinationCountryGroup = {
  countryKo: string;
  region: RegionCode;
  destinations: readonly Destination[];
};

/**
 * 국가별로 묶은 목록. 목적지 선택 화면은 이 순서 그대로 보여준다.
 * DESTINATIONS 의 등장 순서를 유지한다.
 */
export const DESTINATIONS_BY_COUNTRY: readonly DestinationCountryGroup[] =
  DESTINATIONS.reduce<DestinationCountryGroup[]>((groups, destination) => {
    const group = groups.find((g) => g.countryKo === destination.countryKo);
    if (group) {
      (group.destinations as Destination[]).push(destination);
    } else {
      groups.push({
        countryKo: destination.countryKo,
        region: destination.region,
        destinations: [destination],
      });
    }
    return groups;
  }, []);

export const DESTINATION_BY_CODE: Record<DestinationCode, Destination> =
  DESTINATIONS.reduce(
    (map, destination) => {
      map[destination.code] = destination;
      return map;
    },
    {} as Record<DestinationCode, Destination>,
  );

/**
 * 한글 목적지명으로 기준 데이터를 찾는다.
 *
 * trips.destination 은 text 칼럼이라 code 가 아니라 '도쿄' 같은 이름이 저장된다.
 * 목록에 없으면 undefined 다. 그 경우 REGION_BASELINE 으로 넘어가고
 * 화면에 BASELINE_ESTIMATE_NOTICE 를 표시해야 한다.
 */
export function findDestinationByName(nameKo: string | null | undefined): Destination | undefined {
  if (!nameKo) return undefined;
  const trimmed = nameKo.trim();
  return DESTINATIONS.find((destination) => destination.nameKo === trimmed);
}

// ============================================================================
// 기준 데이터 조회
//
// 화면·추천 로직은 DESTINATIONS / REGION_BASELINE 을 직접 뒤지지 않고
// 아래 함수만 쓴다. v2 에서 항공을 AI 검색으로 바꿀 때 이 함수 안만 고치면 되고
// 호출부는 그대로 둔다. (상단 로드맵 참조)
// ============================================================================

/**
 * 기준 금액이 어디서 왔는가.
 *
 * 'baseline'  이 파일의 상수 (추정치)
 * 'realtime'  AI 웹 검색으로 얻은 실시간 시세  [v2]
 *
 * 화면은 이 값으로 '실시간 시세' 와 '기준 추정' 을 구분해 표시한다. (NFR-004)
 * MVP 에서는 항상 'baseline' 이다.
 */
export type BaselineSource = 'baseline' | 'realtime';

/**
 * 조회 옵션. **MVP 에서는 전부 무시한다.**
 *
 * 지금 필요 없는 값을 미리 받아두는 이유는, v2 에서 검색 기반으로 바꿀 때
 * 시그니처가 바뀌면 호출부를 전부 고쳐야 하기 때문이다.
 * 검색에는 이 값들이 전부 필요하다 — 날짜로 성수기·요일을 판단하고,
 * 인원으로 객실 수를 잡고, 스타일로 숙소 등급과 좌석 등급을 정한다.
 *
 * ⚠️ travelStyle 을 받지만 **배수를 적용하지는 않는다.**
 *    반환값은 항상 standard 기준이다. 배수는 lib/constants/budgetMultiplier.ts
 *    의 applyStyleMultiplier() 로 호출부에서 적용한다. 여기서도 곱하면 이중 적용된다.
 *    v2 에서는 검색 조건(어떤 등급을 검색할지)으로만 쓴다.
 */
export type BaselineLookupOptions = {
  /** 여행 시작일 (YYYY-MM-DD) — [v2] 성수기·요일 판단 */
  startDate?: string | null;
  /** 여행 종료일 (YYYY-MM-DD) — [v2] 체류 기간 */
  endDate?: string | null;
  /** 인원 — [v2] 객실 수·항공 좌석 수 */
  headcount?: number | null;
  /** 여행 스타일 — [v2] 검색할 숙소·좌석 등급. 배수 적용에는 쓰지 않는다 */
  travelStyle?: TravelStyle | null;
};

export type BaselineLookupResult = {
  source: BaselineSource;
  /** 목록에 있는 목적지일 때만 채워진다. 지역 평균이면 undefined 다 */
  destination?: Destination;
  region: RegionCode;
  /** true 면 목적지 기준 데이터가 없어 지역 평균을 쓴 것이다 */
  isRegionAverage: boolean;
  baseline: DestinationBaseline;
  /** 기준 시점. 화면에 "YYYY년 M월 기준"으로 표시한다 (NFR-004) */
  updatedAt: string;
  /** 지역 평균일 때만 문구가 들어간다. null 이 아니면 화면에 그대로 표시한다 */
  notice: string | null;
};

/**
 * 목록에 있는 목적지의 기준 금액을 가져온다.
 *
 * 반환값은 standard 기준이다. 스타일 배수는 호출부에서 적용한다.
 * options 는 MVP 에서 무시된다. (BaselineLookupOptions 주석 참조)
 */
export function getDestinationBaseline(
  destinationCode: DestinationCode,
  options?: BaselineLookupOptions,
): BaselineLookupResult {
  // [v2] options 로 항공 실시간 시세를 검색하고, 기준값 대비 ±30% 를 벗어나면
  //      기준값을 쓴다. source 를 'realtime' 으로 바꾸는 것도 그 안에서 한다.
  void options;

  const destination = DESTINATION_BY_CODE[destinationCode];
  return {
    source: 'baseline',
    destination,
    region: destination.region,
    isRegionAverage: false,
    baseline: destination.baseline,
    updatedAt: BASELINE_UPDATED_AT,
    notice: null,
  };
}

/**
 * 목록에 없는 목적지(사용자 직접 입력)의 기준 금액을 지역 평균으로 가져온다.
 *
 * notice 가 항상 채워져 나온다. 화면은 이 문구를 **반드시 표시한다.** (NFR-004)
 * region 은 TRIP-02 에서 사용자가 직접 고른 값을 넘긴다. (DEFAULT_REGION 주석 참조)
 */
export function getRegionBaseline(
  region: RegionCode,
  options?: BaselineLookupOptions,
): BaselineLookupResult {
  void options;

  return {
    source: 'baseline',
    region,
    isRegionAverage: true,
    baseline: REGION_BASELINE[region],
    updatedAt: BASELINE_UPDATED_AT,
    notice: BASELINE_ESTIMATE_NOTICE,
  };
}

// ============================================================================
// 추천 근거 — 화면에 그대로 보여주는 문구
//
// ⚠️ 이 프로젝트의 핵심은 '근거 있는 예산'이다.
//    금액만 보여주면 사용자는 그 숫자를 믿을 근거가 없고, 고칠 기준도 없다.
//    위 기준 금액을 정할 때 쓴 근거를 주석에만 두지 않고 데이터로 올린다.
//
// ⚠️ 실제 항공사·호텔의 개별 가격을 지어내지 않는다.
//    "대한항공 32만원" 처럼 쓰면 화면에는 그럴듯하지만 사실이 아닌 값을
//    사실처럼 보여주게 된다. 추정 근거는 근거로만 적는다. (NFR-004)
//
//    실제 항목("○○항공 왕복 31만원")은 사용자가 BUDGET-02 에서
//    budget_plan_items 로 직접 넣는다. 그게 계획을 실제로 채우는 자리다.
//
// [v2] AI 검색이 붙으면 이 문구가 실시간 시세 근거로 대체된다.
//      화면의 자리는 그대로 두고 내용만 바뀐다. (상단 로드맵)
// ============================================================================

export type DestinationBasis = Record<CategoryCode, string>;

/** 지역 평균을 쓸 때(목록에 없는 목적지)의 근거. */
export const REGION_BASIS: Record<RegionCode, DestinationBasis> = {
  asia: {
    AIRFARE: '아시아 주요 도시 왕복 평균이에요. 인천 출발 이코노미 기준.',
    LODGING: '3~4성급 2인 1실을 인원수로 나눈 1인 1박 평균이에요.',
    FOOD: '1일 3식과 카페 1회를 더한 평균이에요.',
    TRANSPORT: '지하철·버스 위주로 하루 이동하는 기준이에요.',
    ACTIVITY: '유료 관람 1~2곳을 하루 기준으로 나눈 값이에요.',
    SHOPPING: '기념품과 생활용품 중심으로 잡았어요.',
    INSURANCE: '여행자보험 1인 1일 환산액이에요. 일수에 비례해요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 5% 안팎을 예비비로 잡았어요.',
  },
  southeast_asia: {
    AIRFARE: '동남아 주요 도시 왕복 평균이에요. 비행 4~5시간 기준.',
    LODGING: '리조트가 아닌 일반 3~4성급 1인 1박 평균이에요.',
    FOOD: '로컬 식당 위주라 외식 단가가 낮아요.',
    TRANSPORT: '그랩·툭툭 등 차량 이동 위주로 잡았어요.',
    ACTIVITY: '투어·액티비티가 여행 목적인 경우가 많아 넉넉히 잡았어요.',
    SHOPPING: '기념품 중심이에요. 살 것이 많지 않아요.',
    INSURANCE: '의료·수상레저 특약이 붙어 일본보다 높아요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 5% 안팎을 예비비로 잡았어요.',
  },
  europe: {
    AIRFARE: '유럽 주요 도시 왕복 평균이에요. 직항 12~14시간 기준.',
    LODGING: '시내 3성급 2인 1실을 인원수로 나눈 1인 1박 평균이에요.',
    FOOD: '카페·비스트로 기준이에요. 자릿세와 팁이 단가를 올려요.',
    TRANSPORT: '메트로 회수권과 공항철도를 더한 기준이에요.',
    ACTIVITY: '미술관·유적 등 유료 관람이 많아 높게 잡았어요.',
    SHOPPING: '브랜드·백화점 쇼핑 비중이 아시아보다 높아요.',
    INSURANCE: '의료비가 높아 보장금액이 올라가요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 5% 안팎을 예비비로 잡았어요.',
  },
};

/**
 * 목적지별 근거. 위 기준 금액을 정할 때 쓴 조사 내용이다.
 * 목록에 있는 12개만 있다. 직접 입력 목적지는 REGION_BASIS 를 쓴다.
 */
export const DESTINATION_BASIS: Record<DestinationCode, DestinationBasis> = {
  tokyo: {
    AIRFARE: '인천–나리타/하네다 왕복 25~30만원대예요.',
    LODGING: '신주쿠·시부야권 3~4성급 2인 1실 1박 16만원을 1인으로 나눴어요.',
    FOOD: '라멘·정식 1,500엔대 2회에 저녁 3,000엔대 1회, 카페를 더했어요.',
    TRANSPORT: '도쿄메트로 1일권과 JR 단거리 기준이에요. 공항철도는 별도예요.',
    ACTIVITY: '디즈니랜드 1일권 약 8만원을 여행 일수로 나누고 관람료를 더했어요.',
    SHOPPING: '드럭스토어·기념품 중심이에요. 면세 한도를 채우는 쇼핑은 아니에요.',
    INSURANCE: '일본 4일 여행자보험 1인 약 15,000원을 일수로 나눴어요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  osaka: {
    AIRFARE: '인천–간사이 왕복이에요. 도쿄보다 조금 저렴해요.',
    LODGING: '난바·우메다권 숙소가 도쿄보다 10%가량 싸요.',
    FOOD: '쿠시카츠·타코야키 등 저단가 비중이 높아 도쿄보다 낮아요.',
    TRANSPORT: '도시 규모가 작아 이동거리가 짧아요.',
    ACTIVITY: 'USJ 1일권이 디즈니랜드와 비슷한 단가예요.',
    SHOPPING: '드럭스토어·기념품 중심이에요.',
    INSURANCE: '일본 4일 여행자보험 1인 약 15,000원을 일수로 나눴어요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  fukuoka: {
    AIRFARE: '비행 1시간 10분으로 일본에서 가장 가까워요. LCC 비중이 높아요.',
    LODGING: '하카타·텐진권 비즈니스호텔 기준이에요.',
    FOOD: '포장마차·모츠나베 등 단가가 낮아요.',
    TRANSPORT: '시내가 좁아 지하철 2~3정거장 생활권이에요.',
    ACTIVITY: '대형 테마파크가 없어 관람·온천 중심이에요.',
    SHOPPING: '드럭스토어·기념품 중심이에요.',
    INSURANCE: '일본 4일 여행자보험 1인 약 15,000원을 일수로 나눴어요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  shanghai: {
    AIRFARE: '비행 2시간이에요. 홍콩보다 가까워요.',
    LODGING: '푸시(황푸강 서안) 4성급 기준이에요.',
    FOOD: '로컬 식당 단가가 낮아요. 관광지 식당과 편차가 커요.',
    TRANSPORT: '지하철 요금이 매우 낮아요. 1회 3~6위안이에요.',
    ACTIVITY: '디즈니랜드가 있지만 그 외 관람료가 낮아요.',
    SHOPPING: '기념품과 생활용품 중심이에요.',
    INSURANCE: '중화권 4일 여행자보험 1인 약 16,000원을 일수로 나눴어요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  taipei: {
    AIRFARE: '비행 2시간 30분이에요. 중화권에서 물가 대비 항공비가 높은 편이에요.',
    LODGING: '시먼딩·중산권 3성급 기준이에요.',
    FOOD: '야시장 중심이라 1식 단가가 낮아요.',
    TRANSPORT: 'MRT 요금이 낮고 시내가 조밀해요.',
    ACTIVITY: '예류·지우펀 근교 투어와 타이베이101 기준이에요.',
    SHOPPING: '기념품·펑리수 등 식품 중심이에요.',
    INSURANCE: '중화권 4일 여행자보험 1인 약 16,000원을 일수로 나눴어요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  hong_kong: {
    AIRFARE: '비행 3시간 40분이에요. 일본보다 한 단계 비싸요.',
    LODGING: '아시아권에서 가장 비싸요. 같은 등급이 도쿄보다 25% 높아요.',
    FOOD: '딤섬·차찬텡은 저렴하지만 저녁 외식 단가가 높아요.',
    TRANSPORT: 'MTR은 싸지만 공항고속·트램·페리가 더해져요.',
    ACTIVITY: '디즈니랜드·오션파크·피크트램 기준이에요.',
    SHOPPING: '면세 지역이라 쇼핑 지출 비중이 높아요.',
    INSURANCE: '중화권 4일 여행자보험 1인 약 16,000원을 일수로 나눴어요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  paris: {
    AIRFARE: '직항 12~14시간이에요. 아시아 노선의 4~5배예요.',
    LODGING: '시내 3성급 2인 1실 1박 24만원을 1인으로 나눴어요.',
    FOOD: '카페·비스트로 기준이에요. 자릿세와 팁이 단가를 올려요.',
    TRANSPORT: '메트로 회수권에 공항 RER을 더했어요.',
    ACTIVITY: '루브르·오르세·베르사유 등 유료 관람이 많아요.',
    SHOPPING: '백화점·브랜드 쇼핑 비중이 아시아보다 높아요.',
    INSURANCE: '유럽은 의료비가 높아 보장금액이 올라가요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  nice: {
    AIRFARE: '직항이 없어 경유가 기본이라 파리보다 비싸요.',
    LODGING: '해안 리조트지만 파리 시내보다는 저렴해요.',
    FOOD: '카페·비스트로 기준이에요.',
    TRANSPORT: '도시가 작고 해안선을 따라 걷는 동선이 많아요.',
    ACTIVITY: '해변과 근교(모나코·칸) 중심이라 유료 관람이 적어요.',
    SHOPPING: '기념품 중심이에요.',
    INSURANCE: '유럽은 의료비가 높아 보장금액이 올라가요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  rome: {
    AIRFARE: '직항 12시간 30분이에요.',
    LODGING: '같은 등급이 파리보다 10~15% 저렴해요.',
    FOOD: '트라토리아 기준이에요. 자릿세가 붙어요.',
    TRANSPORT: '시내 관광지가 도보권에 몰려 있어요.',
    ACTIVITY: '콜로세움·바티칸 등 예약 필수 유료 관람이 많아요.',
    SHOPPING: '가죽제품·기념품 중심이에요.',
    INSURANCE: '유럽은 의료비가 높아 보장금액이 올라가요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  milan: {
    AIRFARE: '직항 12~13시간이에요.',
    LODGING: '비즈니스 도시라 로마보다 숙박비가 높아요.',
    FOOD: '리조토·아페리티보 기준이에요.',
    TRANSPORT: '지하철과 트램 위주예요.',
    ACTIVITY: '두오모 외에는 유료 관람이 적어요.',
    SHOPPING: '12곳 중 가장 높아요. 아울렛·패션 쇼핑이 방문 목적인 경우가 많아요.',
    INSURANCE: '유럽은 의료비가 높아 보장금액이 올라가요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  venice: {
    AIRFARE: '직항이 없어 경유가 기본이에요.',
    LODGING: '12곳 중 가장 높아요. 섬 안 숙소는 공급이 제한적이에요.',
    FOOD: '관광지 물가가 이탈리아 평균보다 높아요.',
    TRANSPORT: '12곳 중 가장 높아요. 수상버스 1회권이 약 12,000원이에요.',
    ACTIVITY: '곤돌라와 부라노·무라노 섬 이동 기준이에요.',
    SHOPPING: '무라노 유리공예 등 기념품 중심이에요.',
    INSURANCE: '유럽은 의료비가 높아 보장금액이 올라가요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
  cebu: {
    AIRFARE: '비행 4시간 30분이에요. 일본보다 비싸고 유럽의 1/3 수준이에요.',
    LODGING: '리조트 숙박 비중이 높아 동남아 평균보다 높아요.',
    FOOD: '12곳 중 가장 낮아요. 리조트 밖 로컬 식당 단가가 매우 낮아요.',
    TRANSPORT: '12곳 중 가장 낮아요. 그랩과 리조트 셔틀 중심이에요.',
    ACTIVITY: '12곳 중 가장 높아요. 호핑투어·다이빙이 방문 목적이에요.',
    SHOPPING: '12곳 중 가장 낮아요. 살 것이 많지 않아요.',
    INSURANCE: '의료·수상레저 특약이 붙어 일본보다 높아요.',
    CONTINGENCY: '항공·숙소를 뺀 지출의 약 5%예요.',
  },
};
