// ============================================================================
// 근거 상품 여행지 맞춤 불러오기 (TRIP-03)
//
//   앱 → Edge Function(budget-products) → LLM → 가드레일 → 앱
//
// ⚠️ **앱에서 LLM 을 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//
// ⚠️ 실패하면 고정 카탈로그로 되돌린다. (CLAUDE.md 10장 Fallback)
//    함수가 아직 배포되지 않았거나, 키가 없거나, 응답 형식이 어긋나거나,
//    네트워크가 없을 수 있다. 그 어떤 경우에도 예산 구성 화면이
//    빈 채로 멈추면 안 된다. 빈 Map 이 정상적인 결과다.
//
// ⚠️ 여기서 DB 에 쓰지 않는다. 사용자가 '이 예산으로 여행 만들기' 를 눌렀을 때
//    화면이 createTripBundle 로 저장한다.
// ============================================================================
import {
  buildLocalizationRequest,
  sanitizeLocalizedProducts,
  type CategoryBase,
  type LocalizationContext,
  type ProductOverrides,
} from "@/lib/budget/productLocalization";
import { TRAVEL_STYLE_LABEL } from "@/lib/constants/status";
import { supabase } from "@/lib/supabase/client";

/**
 * 이보다 오래 걸리면 기다리지 않는다.
 *
 * ⚠️ 이 기능의 정상 경로는 **캐시**다. Edge Function 이 목적지별 결과를
 *    저장해 두고 다음부터는 모델을 부르지 않는다. 캐시가 차 있으면 응답은
 *    1초 안쪽이다.
 *
 *    캐시에 없는 칸이 있으면 함수가 8초까지만 모델을 시도하고 포기한다.
 *    그래서 여기 10초면 충분하다. 이보다 늘리면 캐시가 빈 목적지에서
 *    여행 생성 마지막 단계가 그만큼 멈춘다.
 *
 * ⚠️ 캐시를 채우는 것은 사용자 트래픽의 일이 아니다.
 *    .demo/warm-products.py 가 미리 돌면서 채운다.
 */
const TIMEOUT_MS = 10000;

export type LocalizedProductResult = {
  overrides: ProductOverrides;
  /** 'ai' 면 Edge Function 응답, 'catalog' 면 고정 카탈로그 그대로 */
  source: "ai" | "catalog";
  /** 금액이 가드레일에 걸려 카탈로그로 되돌아간 상품 수 */
  guardedCount: number;
};

const EMPTY: LocalizedProductResult = {
  overrides: new Map(),
  source: "catalog",
  guardedCount: 0,
};

export async function getLocalizedBudgetProducts(
  context: LocalizationContext,
  bases: CategoryBase[],
): Promise<LocalizedProductResult> {
  if (!context.destination) return EMPTY;

  const categories = buildLocalizationRequest(bases);
  if (categories.length === 0) return EMPTY;

  try {
    const invocation = supabase.functions.invoke("budget-products", {
      body: {
        destination: context.destination,
        destinationKey: context.destinationKey,
        days: context.days,
        nights: context.nights,
        headcount: context.headcount,
        styleLabel: TRAVEL_STYLE_LABEL[context.travelStyle],
        categories,
      },
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
    );

    const { data, error } = await Promise.race([invocation, timeout]);
    if (error) return EMPTY;

    const overrides = sanitizeLocalizedProducts(
      (data as { products?: unknown })?.products,
      bases,
    );
    // 다 걸러지면 바꾼 게 없는 것과 같다.
    if (overrides.size === 0) return EMPTY;

    let guardedCount = 0;
    for (const value of overrides.values()) if (value.guarded) guardedCount += 1;

    return { overrides, source: "ai", guardedCount };
  } catch {
    return EMPTY;
  }
}
