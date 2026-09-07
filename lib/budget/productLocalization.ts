// ============================================================================
// 근거 상품 여행지 맞춤 — 요청 만들기 · 응답 검증 · 가드레일
//
// TRIP-03 예산 구성에서 카테고리를 펼치면 나오는 근거 상품은 원래
// lib/constants/budgetProducts.ts 의 고정 카탈로그다. 목적지가 파리든
// 다낭이든 '4성급 호텔', '기본 식사' 로 똑같다.
//
// 여기서는 그 칸들을 Edge Function(budget-products)에 보내
// **여행지에서 실제로 고르게 되는 선택지**로 이름과 금액을 함께 받아 온다.
//
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다. (호출은 queries/ 가 한다)
//
// ============================================================================
// 가드레일 — AI 금액을 그대로 믿지 않는다
// ============================================================================
//
//   비율 = AI 가 준 금액 ÷ 카테고리 기준 금액(baseAmount)
//   이 비율이 **카탈로그 비율의 ±40% 를 벗어나면 카탈로그 비율을 쓴다.**
//
//   lib/constants/destinations.ts 의 로드맵에 적어 둔 방식이다.
//     "검색 결과가 아래 기준값 대비 ±30% 를 벗어나면 기준값을 쓴다"
//
//   기준 데이터는 사람이 조사한 값이다. 모델이 자릿수를 틀리거나(파리 숙소
//   9만원) 1인 금액과 총액을 헷갈렸을 때 그걸 잡아 주는 유일한 장치다.
//   가드레일이 없으면 틀린 금액이 그대로 planned_amount 가 되고,
//   결산에서 "예산보다 300만원 아꼈다" 같은 결과가 나온다.
//
//   ±30% 가 아니라 ±40% 인 이유: 여기 비교 대상은 카테고리 총액이 아니라
//   **상품 한 칸**이다. 5성급 호텔 칸처럼 원래 편차가 큰 자리가 있어
//   30% 로 조이면 정상적인 응답까지 되돌려진다.
//
// ============================================================================
// recommended_amount 는 어떻게 되는가
// ============================================================================
//
//   AI 응답은 사용자가 금액을 보기 **전에** 도착한다. (화면이 기다린다)
//   그래서 사용자가 화면에서 본 추천 금액이 곧 저장되는 recommended_amount 다.
//   생성 시점에 한 번 정해지고 그 뒤 바뀌지 않는다는 규칙은 그대로다.
//   (CLAUDE.md 4장)
//
//   ⚠️ 다만 그 값은 이제 목적지 기준 데이터만의 산물이 아니다.
//      "우리 추천이 실제와 얼마나 맞았나" 를 재는 대상이 규칙 기반 추천에서
//      AI 추천으로 바뀐다. applied_source 로 구분할 수 없다면 분석 때
//      두 시기의 여행이 한 통에 섞인다. → 사람에게 알릴 것.
// ============================================================================
import {
  BUDGET_PRODUCTS,
  getProductCategory,
  type ProductCategory,
  type ProductCategoryCode,
} from "@/lib/constants/budgetProducts";
import {
  CATEGORY_CODE_LABEL,
  type CategoryCode,
  type TravelStyle,
} from "@/lib/constants/status";

/** 카탈로그 비율에서 이만큼 벗어난 AI 금액은 받지 않는다 */
const GUARD_BAND = 0.4;

/** AI 가 다시 쓴 상품 하나 */
export type LocalizedProduct = {
  /** 카탈로그의 상품 id. 이 값으로 제자리에 끼워 넣는다 */
  id: string;
  name: string;
  /** 어떤 선택지인지 한 줄. 없을 수 있다 */
  note: string;
  /** 빈 문자열이면 카탈로그 이모지를 그대로 쓴다 */
  emoji: string;
  /**
   * 최종 적용할 비율. AI 금액이 가드레일을 통과했으면 그 금액에서 나온 값이고,
   * 아니면 카탈로그 비율 그대로다.
   */
  ratio: number;
  /** true 면 금액이 가드레일에 걸려 카탈로그 비율로 되돌아갔다 */
  guarded: boolean;
};

/** id → 다시 쓴 상품 */
export type ProductOverrides = Map<string, LocalizedProduct>;

export type LocalizationContext = {
  /** 여행지 한글명. '파리' */
  destination: string | null;
  /**
   * 캐시 열쇠. 목록에서 고른 목적지면 DestinationCode('paris'),
   * 직접 입력이면 지역 열쇠('region:europe') 다.
   *
   * ⚠️ 같은 목적지면 답이 같으므로 Edge Function 이 이 열쇠로 결과를 저장하고
   *    다음부터 모델을 부르지 않는다. 무료 등급이 카테고리 1건에 13~15초
   *    걸려서, 캐시가 이 기능의 전제다.
   */
  destinationKey: string;
  days: number;
  nights: number;
  headcount: number;
  travelStyle: TravelStyle;
};

/** Edge Function 에 보내는 상품 칸 하나 */
export type ProductSlot = {
  id: string;
  generic: string;
  tier: "low" | "mid" | "high";
  /** 카탈로그 비율로 계산한 지금 금액. 모델에게 자릿수 기준점을 준다 */
  currentAmount: number;
};

export type CategorySlots = {
  code: ProductCategoryCode;
  label: string;
  /** 이 카테고리의 기준 금액. 인원·박수·일수를 이미 곱했다 */
  baseAmount: number;
  formula: string;
  slots: ProductSlot[];
};

/** 카테고리별 기준 금액. 화면이 recommendation 에서 뽑아 넘긴다 */
export type CategoryBase = {
  categoryCode: CategoryCode;
  baseAmount: number;
  formula: string;
};

/**
 * 카테고리 안에서 ratio 순위로 가격대를 매긴다.
 *
 * ratio 를 그대로 보내지 않는 이유: ratio 는 우리 계산의 내부 값이라
 * 모델에게 의미가 없다. 필요한 건 "이 칸이 싼 쪽이냐 비싼 쪽이냐" 와
 * "지금 얼마짜리 자리냐" 다. 금액은 currentAmount 로 따로 준다.
 */
function tierOf(ratio: number, sorted: number[]): ProductSlot["tier"] {
  if (sorted.length < 3) return ratio <= sorted[0] ? "low" : "high";
  const index = sorted.indexOf(ratio);
  if (index <= (sorted.length - 1) / 3) return "low";
  if (index >= ((sorted.length - 1) * 2) / 3) return "high";
  return "mid";
}

/**
 * 카탈로그 전체를 요청 형태로 만든다.
 *
 * 기준 금액이 0 인 카테고리는 뺀다. 비율의 분모가 없어 응답을 검증할 수 없다.
 * 예비비는 애초에 상품이 없어 BUDGET_PRODUCTS 에 들어 있지 않다.
 */
export function buildLocalizationRequest(bases: CategoryBase[]): CategorySlots[] {
  const baseByCode = new Map(bases.map((b) => [b.categoryCode, b]));

  return BUDGET_PRODUCTS.map((category) => {
    const base = baseByCode.get(category.categoryCode);
    if (!base || base.baseAmount <= 0) return null;

    const sorted = category.products.map((p) => p.ratio).sort((a, b) => a - b);
    return {
      code: category.categoryCode,
      label: CATEGORY_CODE_LABEL[category.categoryCode],
      baseAmount: base.baseAmount,
      formula: base.formula,
      slots: category.products.map((product) => ({
        id: product.id,
        generic: product.name,
        tier: tierOf(product.ratio, sorted),
        currentAmount: Math.round((base.baseAmount * product.ratio) / 1000) * 1000,
      })),
    };
  }).filter((category): category is CategorySlots => category !== null);
}

/** id → { 카탈로그 비율, 그 카테고리의 기준 금액 } */
function ratioIndex(bases: CategoryBase[]): Map<string, { ratio: number; baseAmount: number }> {
  const baseByCode = new Map(bases.map((b) => [b.categoryCode, b.baseAmount]));
  const index = new Map<string, { ratio: number; baseAmount: number }>();

  for (const category of BUDGET_PRODUCTS) {
    const baseAmount = baseByCode.get(category.categoryCode) ?? 0;
    for (const product of category.products) {
      index.set(product.id, { ratio: product.ratio, baseAmount });
    }
  }
  return index;
}

/**
 * Edge Function 응답을 걸러 내고 가드레일을 건다.
 *
 * ⚠️ AI 응답을 그대로 믿지 않는다. (CLAUDE.md 10장)
 *    - 카탈로그에 없는 id 는 버린다. 모델이 만든 새 상품은 기본 선택 여부가
 *      없어 어느 조합에 들어가야 할지 알 수 없다.
 *    - 같은 id 가 두 번 오면 첫 번째만 쓴다.
 *    - 이름이 비었거나 숫자만 있으면 버린다. 이름에 금액을 적어 보내는 응답이
 *      있는데, 그러면 카드의 이름과 금액이 서로 다른 말을 한다.
 *    - 금액이 가드레일 밖이면 **이름은 살리고 금액만 카탈로그로 되돌린다.**
 *      항목은 멀쩡한데 숫자만 틀린 경우가 대부분이라 통째로 버릴 이유가 없다.
 *
 * @returns 걸러지고 남은 것만. 여기 없는 id 는 화면이 카탈로그 값을 그대로 쓴다.
 */
export function sanitizeLocalizedProducts(
  raw: unknown,
  bases: CategoryBase[],
): ProductOverrides {
  const result: ProductOverrides = new Map();
  if (!Array.isArray(raw)) return result;

  const index = ratioIndex(bases);

  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const candidate = row as Record<string, unknown>;

    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const known = index.get(id);
    if (!known || result.has(id)) continue;

    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    // 이름이 없거나, 숫자와 '원' 만으로 된 이름은 상품 이름이 아니다.
    if (!name || /^[\d,.\s원]+$/.test(name)) continue;

    const note = typeof candidate.note === "string" ? candidate.note.trim() : "";
    const emoji =
      typeof candidate.emoji === "string" && candidate.emoji.trim()
        ? candidate.emoji.trim()
        : "";

    // ── 가드레일 ──────────────────────────────────────────────────────
    const amount =
      typeof candidate.amount === "number" && Number.isFinite(candidate.amount)
        ? Math.round(candidate.amount)
        : 0;
    const proposed = known.baseAmount > 0 ? amount / known.baseAmount : 0;
    const withinBand =
      amount > 0 &&
      proposed >= known.ratio * (1 - GUARD_BAND) &&
      proposed <= known.ratio * (1 + GUARD_BAND);

    result.set(id, {
      id,
      name: name.slice(0, 20),
      note: note.slice(0, 30),
      emoji,
      ratio: withinBand ? proposed : known.ratio,
      guarded: !withinBand,
    });
  }

  return result;
}

// ── 화면이 쓰는 조회 ────────────────────────────────────────────────────────
//
// 화면은 getProductCategory / sumSelectedRatio 대신 아래 둘을 쓴다.
// AI 응답이 없으면(overrides 가 비어 있으면) 결과는 카탈로그와 완전히 같다.

/** 카탈로그 카테고리에 AI 이름·금액을 덮어씌운 것 */
export function resolveProductCategory(
  code: CategoryCode,
  overrides: ProductOverrides,
): ProductCategory | null {
  const catalog = getProductCategory(code);
  if (!catalog || overrides.size === 0) return catalog;

  return {
    ...catalog,
    products: catalog.products.map((product) => {
      const override = overrides.get(product.id);
      if (!override) return product;
      return {
        ...product,
        name: override.name,
        emoji: override.emoji || product.emoji,
        ratio: override.ratio,
      };
    }),
  };
}

/**
 * 고른 상품들의 비율 합.
 *
 * 상품마다 반올림한 뒤 더하지 않는다. 화면은 이 합을 baseAmount 에 곱해
 * **한 번만** 반올림한다. (budgetProducts.ts 의 sumSelectedRatio 와 같은 이유)
 */
export function sumResolvedRatio(
  code: CategoryCode,
  selectedIds: Set<string>,
  overrides: ProductOverrides,
): number {
  const category = resolveProductCategory(code, overrides);
  if (!category) return 0;
  return category.products
    .filter((product) => selectedIds.has(product.id))
    .reduce((sum, product) => sum + product.ratio, 0);
}
