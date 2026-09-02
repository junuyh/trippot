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
 * ⚠️ Edge Function 쪽 제한(25초)보다 넉넉해야 한다. 앱이 먼저 끊으면
 *    함수가 무엇 때문에 실패했는지 로그에도 남지 않는다.
 */
const TIMEOUT_MS = 28000;

export type PlanSuggestionResult = {
  suggestions: PlanSuggestion[];
  /** 'ai' 면 Edge Function 응답, 'catalog' 면 규칙 기반 기본값 */
  source: "ai" | "catalog";
};

export async function getPlanSuggestions(
  context: SuggestionContext,
  limit = 4,
): Promise<PlanSuggestionResult> {
  const fallback: PlanSuggestionResult = {
    suggestions: buildPlanSuggestions(context, limit),
    source: "catalog",
  };

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
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
    );

    const { data, error } = await Promise.race([invocation, timeout]);
    if (error) return fallback;

    const suggestions = sanitizePlanSuggestions(
      (data as { suggestions?: unknown })?.suggestions,
      context,
      limit,
    );
    // 다 걸러지면 추천이 없는 것과 같다. 카탈로그가 낫다.
    if (suggestions.length === 0) return fallback;

    return { suggestions, source: "ai" };
  } catch {
    return fallback;
  }
}
