// ============================================================================
// 영수증 읽기 불러오기 (FUND-01)
//
//   앱 → Edge Function(receipt-scan) → LLM(비전) → 검증 → 앱
//
// ⚠️ 앱에서 LLM 을 직접 부르지 않는다. (CLAUDE.md 1장 / 10장)
// ⚠️ 여기서 DB 에 쓰지 않는다. 폼에 채울 값만 돌려주고 저장은 화면이 한다.
// ⚠️ 실패는 null 이다. 화면이 "못 읽었어요, 직접 입력할래요?" 로 이어 준다.
// ============================================================================
import { sanitizeReceipt, type ReceiptScanResult } from "@/lib/budget/receiptScan";
import { supabase } from "@/lib/supabase/client";

/** 비전 호출은 오래 걸린다. 화면은 이 동안 '읽는 중' 을 보여준다 */
const TIMEOUT_MS = 45000;

export async function scanReceipt(input: {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
  destination: string | null;
  tripStart: string | null;
  tripEnd: string | null;
}): Promise<ReceiptScanResult | null> {
  const invocation = supabase.functions.invoke("receipt-scan", { body: input });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
  );
  const { data, error } = await Promise.race([invocation, timeout]);
  if (error) return null;
  return sanitizeReceipt((data as { receipt?: unknown })?.receipt);
}
