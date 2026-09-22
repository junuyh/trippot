// ============================================================================
// 세부 계획 추천 불러오기 (BUDGET-02)
//
//   앱 → Edge Function(plan-suggestions) → OpenAI → 검증 → 앱
//
// ⚠️ **앱에서 OpenAI 를 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//
// ⚠️ 실패하면 규칙 기반 카탈로그로 되돌린다. (CLAUDE.md 10장 Fallback)
//    함수가 아직 배포되지 않았거나, 키가 없거나, 응답 형식이 어긋나거나,
//    비행기 안이라 네트워크가 없을 수 있다. 그 어떤 경우에도
//    '계획 항목 추가' 를 눌렀을 때 빈 화면이 나오면 안 된다.
//
// ⚠️ 여기서 DB 에 쓰지 않는다. 추천은 후보일 뿐이고,
//    계획으로 저장하는 것은 사용자가 카드를 눌렀을 때 화면이 한다.
// ============================================================================
import {
  buildPlanSuggestions,
  sanitizePlanSuggestions,
  type PlanSuggestion,
  type SuggestionContext,
} from "@/lib/budget/planSuggestions";
import { CATEGORY_CODE_LABEL } from "@/lib/constants/status";
import { supabase } from "@/lib/supabase/client";

/**
 * 이보다 오래 걸리면 기다리지 않는다. 추천 하나 보려고 화면이 멈추면 안 된다.
 *
 * ⚠️ 2026-09-04 · 43초 → 7초로 줄였다.
 *    원래는 "앱이 먼저 끊으면 함수가 왜 실패했는지 로그에 안 남는다" 는 이유로
 *    함수 제한보다 넉넉하게 뒀는데, 그건 개발할 때 이야기다. 사용자는
 *    '계획 항목 추가' 를 누르고 43초를 기다릴 이유가 없다. 모델이 늦으면
 *    규칙 기반 추천이 곧바로 나오는 편이 낫다.
 *
 *    실패 원인은 Edge Function 쪽 로그로 본다. (debug: true 로 호출하면
 *    응답에 failures 가 함께 온다)
 */
/*
  ⚠️⚠️ 2026-09-22 · **7초로는 AI 결과를 한 번도 받지 못했다.**
     함수 실측 9.8초 · 13.8초. 앱이 7초에 포기하고 카탈로그를 띄워서,
     사용자는 도시와 상관없는 같은 추천만 봤다. AI 는 뒤에서 끝까지 돌고
     토큰을 쓴 뒤 결과를 버렸다. 하루 한도에서도 한 번씩 깎였다.
     그래서 **기다리게 하지 않고**, 카탈로그를 먼저 보여 주고 AI 를 따로
     기다린다. 기다리는 시간은 넉넉히 둔다 — 화면은 이미 떠 있다.
*/
const AI_TIMEOUT_MS = 20000;

export type PlanSuggestionResult = {
  suggestions: PlanSuggestion[];
  /** 'ai' 면 Edge Function 응답, 'catalog' 면 규칙 기반 기본값 */
  source: "ai" | "catalog";
};

/** 규칙 기반 추천. 바로 나온다. 화면이 먼저 이것을 보여 준다 */
export function getCatalogPlanSuggestions(
  context: SuggestionContext,
  limit = 4,
): PlanSuggestion[] {
  return buildPlanSuggestions(context, limit);
}

/**
 * AI 추천. **실패·빈 결과·시간 초과면 null.** 호출한 쪽은 카탈로그를 그대로 둔다.
 *
 * ⚠️ throw 하지 않는다. 이 결과는 덤이다. 없다고 화면이 오류가 되면 안 된다.
 */
export async function getAiPlanSuggestions(
  context: SuggestionContext,
  limit = 4,
): Promise<PlanSuggestion[] | null> {
  try {
    const invocation = supabase.functions.invoke("plan-suggestions", {
      body: {
        destination: context.destination,
        days: context.days,
        nights: context.nights,
        headcount: context.headcount,
        categoryLabel: CATEGORY_CODE_LABEL[context.categoryCode],
        existingNames: context.existingNames,
        limit,
      },
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), AI_TIMEOUT_MS),
    );

    const { data, error } = await Promise.race([invocation, timeout]);
    if (error) return null;

    const suggestions = sanitizePlanSuggestions(
      (data as { suggestions?: unknown })?.suggestions,
      context,
      limit,
    );
    // 다 걸러지면 추천이 없는 것과 같다. 카탈로그를 그대로 둔다.
    return suggestions.length > 0 ? suggestions : null;
  } catch {
    return null;
  }
}
