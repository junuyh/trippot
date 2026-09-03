// ============================================================================
// 거래 자동 분류 불러오기 (FUND-01)
//
//   앱 → Edge Function(classify-transaction) → LLM → 검증 → 앱
//
// ⚠️ **앱에서 LLM 을 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//
// ⚠️ 실패하면 규칙 기반 카탈로그로 되돌린다. (CLAUDE.md 10장 Fallback)
//    함수 미배포·키 없음·형식 위반·네트워크 없음 어느 경우에도
//    거래 저장 자체가 막히면 안 된다.
//
// ⚠️ 여기서 DB 에 쓰지 않는다. 추측을 돌려줄 뿐이고,
//    저장은 화면이 한다. 저장된 값은 '확인 필요' 로 잡힌다.
// ============================================================================
import {
  classifyByName,
  sanitizeClassification,
  type ClassifyResult,
} from "@/lib/budget/transactionClassify";
import { supabase } from "@/lib/supabase/client";

/** 이보다 오래 걸리면 기다리지 않는다. 뒤에서 도는 작업이라 화면은 안 멈춘다 */
const TIMEOUT_MS = 22000;

export type ClassifySource = "ai" | "catalog";

export type ClassifyTransactionResult = {
  /** 못 맞혔으면 null. 미분류로 두는 것이 틀린 분류보다 낫다 */
  classification: ClassifyResult | null;
  source: ClassifySource;
};

export async function classifyTransaction(input: {
  name: string;
  destination: string | null;
  amount: number;
}): Promise<ClassifyTransactionResult> {
  const fallback: ClassifyTransactionResult = {
    classification: classifyByName(input.name),
    source: "catalog",
  };

  try {
    const invocation = supabase.functions.invoke("classify-transaction", {
      body: {
        name: input.name,
        destination: input.destination,
        amount: input.amount,
      },
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
    );

    const { data, error } = await Promise.race([invocation, timeout]);
    if (error) return fallback;

    const classification = sanitizeClassification(
      (data as { classification?: unknown })?.classification,
    );
    // 모델이 '모르겠다' 고 답한 것과 호출이 실패한 것을 구분한다.
    // 응답은 왔으므로 카탈로그로 되돌리지 않는다 — 카탈로그도 모를 확률이 높다.
    if (!classification) return { classification: null, source: "ai" };

    return { classification, source: "ai" };
  } catch {
    return fallback;
  }
}
