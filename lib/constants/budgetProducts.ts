// ============================================================================
// 예산 근거 상품 카탈로그
//
// "근거를 보고 예산을 정해요" — 카테고리 금액이 어디서 나왔는지를 상품 단위로
// 보여주고, 사용자가 상품을 빼고 더해서 금액을 조정한다.
//
// ⚠️ MVP 한정으로 DB 가 아니라 코드 상수다. destinations.ts 와 같은 이유다.
//    지금 테이블을 추가하면 마이그레이션 → 타입 재생성 → 팀원 pull 이 연쇄된다.
//    실서비스에서는 budget_products 테이블로 옮긴다.
//    사용자가 **고른 결과**는 지금도 DB 에 들어간다. budget_plan_items 다.
//
// ⚠️ 상품 가격을 원 단위로 박지 않는다. **기준 금액에 대한 비율(ratio)로 둔다.**
//
//    금액을 박으면 목적지 12개 × 상품 24개 = 288개 숫자를 따로 관리해야 하고,
//    destinations.ts 의 기준 금액과 따로 놀기 시작한다. 도쿄 항공권을 고쳤는데
//    상품 가격은 그대로인 상태가 조용히 생긴다.
//    비율로 두면 목적지가 무엇이든 기준 금액 하나에서 파생된다.
//
// ============================================================================
// 가장 중요한 규칙 — 기본 선택 조합은 지금의 추천 금액과 정확히 일치해야 한다
// ============================================================================
//
//   카테고리 추천액 = roundToThousand(baseAmount × BUDGET_STYLE_MULTIPLIER[style][code])
//   상품 합계       = roundToThousand(baseAmount × Σ(기본 선택 상품의 ratio))
//
//   따라서 **스타일 S 에서 기본 선택되는 상품들의 ratio 합 = 그 스타일의 배수** 여야 한다.
//
//   이 등식이 깨지면 recommended_amount(불변 원본)의 의미가 바뀐다. 그 값은
//   기본 추천 정확도와 개인화 효과를 재는 기준선이라, 조용히 움직이면 프로젝트의
//   핵심 가설 검증이 통째로 흔들린다. (CLAUDE.md 4장)
//
//   → assertDefaultRatiosMatchMultiplier() 로 검증한다. 상품을 고칠 때 반드시 돌린다.
//
// ⚠️ CONTINGENCY(예비비)에는 상품이 없다. 다른 항목 합계의 비율로 정하는 값이라
//    상품으로 쪼갤 것이 없다. 화면에서 비율 선택으로 다룬다.
// ============================================================================
import { BUDGET_STYLE_MULTIPLIER } from './budgetMultiplier';
import { CATEGORY_CODE, TRAVEL_STYLE, type CategoryCode, type TravelStyle } from './status';

/** 상품이 붙는 카테고리. 예비비는 빠진다. */
export type ProductCategoryCode = Exclude<CategoryCode, 'CONTINGENCY'>;

export type BudgetProduct = {
  id: string;
  /** 화면에 보이는 상품명 */
  name: string;
  /** 카드 썸네일 자리의 이모지 */
  emoji: string;
  /**
   * 카테고리 기준 금액에 대한 비율.
   *
   *   AIRFARE   airfarePerPerson × ratio  (1인 왕복)
   *   LODGING   lodgingPerNight  × ratio  (1인 1박)
   *   나머지     perPersonPerDay  × ratio  (1인 1일)
   *
   * 인원·박수·일수는 화면이 곱한다. 여기서는 단가 비율만 갖는다.
   */
  ratio: number;
  /** 이 상품이 **기본으로 선택되는** 스타일. 비어 있으면 사용자가 직접 골라야 한다. */
  defaultFor: TravelStyle[];
};

export type ProductCategory = {
  categoryCode: ProductCategoryCode;
  /**
   * true 면 하나만 고를 수 있다. 항공·숙소·보험이 그렇다.
   * 왕복 항공권을 두 개 사지는 않는다.
   */
  single: boolean;
  /** 카테고리를 펼쳤을 때 맨 위에 나오는 한 줄 */
  hint: string;
  products: BudgetProduct[];
};

const { BUDGET, STANDARD, COMFORT } = TRAVEL_STYLE;

// ── 카탈로그 ────────────────────────────────────────────────────────────────
//
// ratio 는 "보통(standard) 기준값의 몇 배인가" 다.
// 각 카테고리 주석에 스타일별 기본 조합의 합을 적어 둔다. 배수와 같아야 한다.

export const BUDGET_PRODUCTS: ProductCategory[] = [
  // 배수 — budget 0.95 / standard 1.00 / comfort 1.10
  {
    categoryCode: CATEGORY_CODE.AIRFARE,
    single: true,
    hint: '왕복 항공권 기준이에요. 하나만 고를 수 있어요.',
    products: [
      { id: 'air-lcc', name: '저비용 항공 직항', emoji: '🛫', ratio: 0.95, defaultFor: [BUDGET] },
      { id: 'air-fsc', name: '대형항공사 직항', emoji: '✈️', ratio: 1.0, defaultFor: [STANDARD] },
      { id: 'air-premium', name: '프리미엄 이코노미', emoji: '🛩️', ratio: 1.1, defaultFor: [COMFORT] },
      { id: 'air-transit', name: '경유편', emoji: '🧳', ratio: 0.8, defaultFor: [] },
    ],
  },

  // 배수 — budget 0.55 / standard 1.00 / comfort 1.60
  {
    categoryCode: CATEGORY_CODE.LODGING,
    single: true,
    hint: '1박 숙박비 기준이에요. 하나만 고를 수 있어요.',
    products: [
      { id: 'stay-guesthouse', name: '게스트하우스·도미토리', emoji: '🛏️', ratio: 0.55, defaultFor: [BUDGET] },
      { id: 'stay-hotel4', name: '4성급 호텔', emoji: '🏨', ratio: 1.0, defaultFor: [STANDARD] },
      { id: 'stay-hotel5', name: '5성급 호텔', emoji: '🏩', ratio: 1.6, defaultFor: [COMFORT] },
      { id: 'stay-apartment', name: '아파트 렌탈', emoji: '🏡', ratio: 0.85, defaultFor: [] },
    ],
  },

  // 배수 — budget 0.70 / standard 1.00 / comfort 1.40
  //   budget   0.55 + 0.15                      = 0.70
  //   standard 0.55 + 0.15 + 0.30               = 1.00
  //   comfort  0.55 + 0.15 + 0.30 + 0.40        = 1.40
  {
    categoryCode: CATEGORY_CODE.FOOD,
    single: false,
    hint: '식사 횟수가 아니라 어떤 식당에 가는지로 계산해요.',
    products: [
      { id: 'food-base', name: '기본 식사', emoji: '🍚', ratio: 0.55, defaultFor: [BUDGET, STANDARD, COMFORT] },
      { id: 'food-local', name: '현지 식당·편의점', emoji: '🍜', ratio: 0.15, defaultFor: [BUDGET] },
      { id: 'food-cafe', name: '카페·디저트', emoji: '☕', ratio: 0.15, defaultFor: [STANDARD, COMFORT] },
      { id: 'food-popular', name: '인기 맛집', emoji: '🍲', ratio: 0.3, defaultFor: [STANDARD, COMFORT] },
      { id: 'food-fine', name: '파인다이닝 1회', emoji: '🍷', ratio: 0.4, defaultFor: [COMFORT] },
    ],
  },

  // 배수 — budget 0.80 / standard 1.00 / comfort 1.20
  //   budget   0.55 + 0.25                      = 0.80
  //   standard 0.55 + 0.25 + 0.20               = 1.00
  //   comfort  0.55 + 0.25 + 0.20 + 0.20        = 1.20
  {
    categoryCode: CATEGORY_CODE.TRANSPORT,
    single: false,
    hint: '이동 수단을 골라 예산에 반영해요.',
    products: [
      { id: 'tr-pass', name: '시내 교통 패스', emoji: '🚇', ratio: 0.55, defaultFor: [BUDGET, STANDARD, COMFORT] },
      { id: 'tr-airport', name: '공항 왕복 교통', emoji: '🚆', ratio: 0.25, defaultFor: [BUDGET, STANDARD, COMFORT] },
      { id: 'tr-taxi', name: '야간 택시', emoji: '🚕', ratio: 0.2, defaultFor: [STANDARD, COMFORT] },
      { id: 'tr-private', name: '전용 차량 1일', emoji: '🚘', ratio: 0.2, defaultFor: [COMFORT] },
    ],
  },

  // 배수 — budget 0.70 / standard 1.00 / comfort 1.30
  //   budget   0.70                             = 0.70
  //   standard 0.70 + 0.30                      = 1.00
  //   comfort  0.70 + 0.30 + 0.30               = 1.30
  {
    categoryCode: CATEGORY_CODE.ACTIVITY,
    single: false,
    hint: '대표 명소를 상품 단위로 담았어요.',
    products: [
      { id: 'ac-main', name: '대표 명소 3곳', emoji: '🎫', ratio: 0.7, defaultFor: [BUDGET, STANDARD, COMFORT] },
      { id: 'ac-tour', name: '근교 투어 1일', emoji: '🏰', ratio: 0.3, defaultFor: [STANDARD, COMFORT] },
      { id: 'ac-guide', name: '소그룹 가이드 투어', emoji: '🧑‍🏫', ratio: 0.3, defaultFor: [COMFORT] },
      { id: 'ac-cruise', name: '야경 크루즈', emoji: '🛥️', ratio: 0.2, defaultFor: [] },
    ],
  },

  // 배수 — budget 0.60 / standard 1.00 / comfort 1.40
  //   budget   0.60                             = 0.60
  //   standard 0.60 + 0.40                      = 1.00
  //   comfort  0.60 + 0.40 + 0.40               = 1.40
  {
    categoryCode: CATEGORY_CODE.SHOPPING,
    single: false,
    hint: '기념품과 현지 쇼핑 예산이에요.',
    products: [
      { id: 'sh-souvenir', name: '기념품·선물', emoji: '🎁', ratio: 0.6, defaultFor: [BUDGET, STANDARD, COMFORT] },
      { id: 'sh-local', name: '현지 브랜드 쇼핑', emoji: '🛍️', ratio: 0.4, defaultFor: [STANDARD, COMFORT] },
      { id: 'sh-duty', name: '면세점 쇼핑', emoji: '💄', ratio: 0.4, defaultFor: [COMFORT] },
    ],
  },

  // 배수 — 세 스타일 모두 1.00
  //
  // 보험료는 목적지·일수·연령으로 정해지고 숙소 등급과 무관하다.
  // (budgetMultiplier.ts 의 INSURANCE 주석) 그래서 기본 선택은 스타일과 상관없이
  // '표준 보장' 하나다. 보장을 바꾸면 그건 사용자 수정이다.
  {
    categoryCode: CATEGORY_CODE.INSURANCE,
    single: true,
    hint: '보장 범위에 따라 보험료가 달라져요. 하나만 고를 수 있어요.',
    products: [
      { id: 'in-basic', name: '기본 보장', emoji: '🛡️', ratio: 0.7, defaultFor: [] },
      { id: 'in-standard', name: '표준 보장', emoji: '🩺', ratio: 1.0, defaultFor: [BUDGET, STANDARD, COMFORT] },
      { id: 'in-plus', name: '고액 보장', emoji: '💠', ratio: 1.8, defaultFor: [] },
    ],
  },
];

// ── 조회 ────────────────────────────────────────────────────────────────────

const BY_CODE = new Map<ProductCategoryCode, ProductCategory>(
  BUDGET_PRODUCTS.map((category) => [category.categoryCode, category]),
);

export function getProductCategory(code: CategoryCode): ProductCategory | null {
  return BY_CODE.get(code as ProductCategoryCode) ?? null;
}

/** 스타일의 기본 선택 상품 id 집합. 화면이 처음 그릴 때 쓴다. */
export function getDefaultProductIds(style: TravelStyle): Set<string> {
  const selected = new Set<string>();
  for (const category of BUDGET_PRODUCTS) {
    for (const product of category.products) {
      if (product.defaultFor.includes(style)) selected.add(product.id);
    }
  }
  return selected;
}

/**
 * 고른 상품들의 ratio 합.
 *
 * 화면은 이 값을 baseAmount 에 곱해 카테고리 금액을 낸다.
 * 상품마다 반올림한 뒤 더하지 않는다. 반올림 오차가 상품 수만큼 쌓인다.
 */
export function sumSelectedRatio(code: CategoryCode, selectedIds: Set<string>): number {
  const category = getProductCategory(code);
  if (!category) return 0;
  return category.products
    .filter((product) => selectedIds.has(product.id))
    .reduce((sum, product) => sum + product.ratio, 0);
}

// ── 검증 ────────────────────────────────────────────────────────────────────

export type RatioMismatch = {
  categoryCode: ProductCategoryCode;
  style: TravelStyle;
  expected: number;
  actual: number;
};

/**
 * 기본 선택 조합의 ratio 합이 스타일 배수와 같은지 검사한다.
 *
 * 상품을 추가·삭제하거나 ratio 를 고쳤으면 반드시 돌린다.
 * 빈 배열이면 통과다. 어긋난 것이 있으면 그 목록을 돌려준다.
 *
 * 부동소수점 비교라 1e-9 오차를 허용한다. 0.55 + 0.15 + 0.3 은 정확히 1 이 아니다.
 */
export function assertDefaultRatiosMatchMultiplier(): RatioMismatch[] {
  const mismatches: RatioMismatch[] = [];
  const styles = Object.values(TRAVEL_STYLE);

  for (const category of BUDGET_PRODUCTS) {
    for (const style of styles) {
      const actual = category.products
        .filter((product) => product.defaultFor.includes(style))
        .reduce((sum, product) => sum + product.ratio, 0);
      const expected = BUDGET_STYLE_MULTIPLIER[style][category.categoryCode];

      if (Math.abs(actual - expected) > 1e-9) {
        mismatches.push({ categoryCode: category.categoryCode, style, expected, actual });
      }
    }
  }

  return mismatches;
}
