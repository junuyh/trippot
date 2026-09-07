// ============================================================================
// 여행자보험 제휴사 (INSURANCE-01 · BM 1)
//
// ⚠️ **여기 회사들은 전부 가상이다.** 실제 보험사가 아니다.
//
//    실존 보험사 이름·상품명·요율을 쓰지 않는다. 우리는 그 회사와 제휴한 적이
//    없고, 여기 적힌 보험료를 보장할 근거도 없다. 실명을 쓰면 그 회사가 우리
//    화면에서 이 조건으로 판다는 뜻이 되어 사실과 다른 표시가 된다.
//    제휴가 성사되면 그때 실제 상품 정보로 바꾼다.
//
// ⚠️ MVP 한정으로 DB 가 아니라 코드 상수다. destinations.ts 와 같은 이유다.
//    실서비스에서는 insurance_partners 테이블 + 제휴사 API 로 옮긴다.
//
// ============================================================================
// 이 화면이 프로젝트에서 갖는 의미
// ============================================================================
//
//   BM 1(여행자보험 제휴 수수료)에서 **우리가 볼 수 있는 마지막 지점이
//   제휴사로 넘어가는 클릭**이다. 그 뒤 가입 여부는 제휴사만 안다.
//   (docs/06_이벤트로그정의서_v3.md §7-7)
//
//   그래서 이 화면의 목표는 '많이 넘기기' 가 아니라
//   **"보험 CTA 를 누른 사람이 실제로 견적까지 봤는가" 를 재는 것**이다.
//   그 숫자가 이 프로젝트가 제시할 수 있는 유일한 수익화 근거다.
//
// ⚠️ 수수료율(commissionBp)은 **화면에 그대로 노출하지 않는다.**
//    제휴 조건은 대외비이고, 사용자에게 필요한 정보도 아니다.
//    다만 우리가 수수료를 받는다는 **사실 자체는 화면에 밝힌다.**
//    광고성 표시 의무이기도 하고, 숨기면 신뢰를 잃는다.
// ============================================================================
import { INSURANCE_COVERAGE, type InsuranceCoverage } from './status';

export type InsurancePartner = {
  id: string;
  /** 가상 브랜드명 */
  name: string;
  emoji: string;
  /** 한 줄 소개 */
  tagline: string;
  /**
   * 같은 보장 등급에서 이 회사의 보험료 배수.
   * 1.0 이 기준가다. 회사마다 요율이 다른 상황을 만든다.
   */
  priceFactor: number;
  /** 강점 3개. 카드에 그대로 나열한다 */
  features: string[];
  /**
   * 우리가 받는 제휴 수수료율(basis point). 10000 = 100%.
   *
   * ⚠️ 화면에 숫자로 노출하지 않는다. 전환 1건의 기대 수익을 계산해
   *    BM 1 의 규모를 가늠하는 데만 쓴다.
   */
  commissionBp: number;
  /** 카드 상단 배지. 없으면 표시하지 않는다 */
  badge: string | null;
};

export const INSURANCE_PARTNERS: InsurancePartner[] = [
  {
    id: 'partner-blueshield',
    name: '블루실드 여행보험',
    emoji: '🛟',
    tagline: '가격을 가장 먼저 보는 분께',
    priceFactor: 0.88,
    features: ['가입 3분', '출발 당일 가입 가능', '휴대폰 본인인증만'],
    commissionBp: 900,
    badge: '최저가',
  },
  {
    id: 'partner-onroad',
    name: '온로드 트래블케어',
    emoji: '🧭',
    tagline: '보장과 가격의 균형',
    priceFactor: 1.0,
    features: ['24시간 한국어 상담', '현지 병원 직불', '항공 지연 보상'],
    commissionBp: 1200,
    badge: '가장 많이 선택',
  },
  {
    id: 'partner-atlas',
    name: '아틀라스 글로벌',
    emoji: '🌐',
    tagline: '장기·유럽 일정에 강한 보장',
    priceFactor: 1.24,
    features: ['의료비 한도 2배', '휴대품 도난 보장', '레저 활동 포함'],
    commissionBp: 1500,
    badge: null,
  },
];

/** 보장 등급별 배수와 설명. budgetProducts.ts 의 보험 상품 3개와 짝이 맞는다 */
export const COVERAGE_TIER: Record<
  InsuranceCoverage,
  { label: string; ratio: number; summary: string; productId: string }
> = {
  [INSURANCE_COVERAGE.BASIC]: {
    label: '기본 보장',
    ratio: 0.7,
    summary: '의료비 중심의 최소 보장이에요.',
    productId: 'in-basic',
  },
  [INSURANCE_COVERAGE.STANDARD]: {
    label: '표준 보장',
    ratio: 1.0,
    summary: '의료비에 휴대품·지연까지 더했어요.',
    productId: 'in-standard',
  },
  [INSURANCE_COVERAGE.PLUS]: {
    label: '고액 보장',
    ratio: 1.8,
    summary: '한도를 크게 올린 보장이에요.',
    productId: 'in-plus',
  },
};

export const COVERAGE_ORDER: InsuranceCoverage[] = [
  INSURANCE_COVERAGE.BASIC,
  INSURANCE_COVERAGE.STANDARD,
  INSURANCE_COVERAGE.PLUS,
];
