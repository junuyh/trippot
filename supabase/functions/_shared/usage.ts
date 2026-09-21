// ============================================================================
// Edge Function 공용 · AI 기능 하루 한도
//
// ⚠️ **한도보다 기록이 먼저다.** 지금 정한 숫자는 근거가 없다. 정상 사용자가
//    하루에 몇 번 부르는지 우리가 모르기 때문이다. 기록이 쌓이면 실제 분포를
//    보고 다시 정한다. 그전까지는 "정상 사용자는 절대 안 닿고, 폭주는 잡히는"
//    선에 둔다.
//
// ⚠️ service_role 호출(캐시 채우기 같은 관리 작업)은 세지 않는다. 사람이 누른
//    것이 아니다.
//
// ⚠️ 기록에 실패해도 **요청은 통과시킨다.** 기록은 비용을 보려고 두는 것이지
//    기능의 조건이 아니다. 로그 표가 잠깐 말썽이라고 AI 기능이 멈추면
//    사용자는 이유를 알 수 없다. 대신 콘솔에 남긴다.
//
// ⚠️ 날짜는 KST 로 끊는다. UTC 면 한국 사용자에게 한도가 오전 9시에 초기화된다.
// ============================================================================
import type { Caller } from "./auth.ts";

export const DAILY_LIMIT = {
  /** 계획 추천. 닫았다 다시 여는 일이 잦아 넉넉히 둔다 */
  plan_suggestions: 20,
  /** 영수증 스캔. 이미지를 실어 보내 건당 비용이 가장 크다 */
  receipt_scan: 20,
  /** 거래 자동 분류. 지출을 적을 때마다 한 번이라 한도가 높아야 한다 */
  classify_transaction: 100,
} as const;

export type AiFeature = keyof typeof DAILY_LIMIT;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** 오늘(KST) 날짜. 'yyyy-MM-dd' */
function todayKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

export type UsageVerdict =
  | { allowed: true }
  | { allowed: false; limit: number; used: number };

/**
 * 오늘 한도가 남았는지 보고, 남았으면 한 번 쓴 것으로 적는다.
 *
 * ⚠️ 세고 나서 넣는다. 사이에 동시 요청이 끼면 한두 번 더 통과할 수 있다.
 *    그 정도는 받아들인다. 막으려는 것은 '수백 번' 이지 '한 번 더' 가 아니다.
 */
export async function checkAndRecordUsage(
  caller: Caller,
  feature: AiFeature,
): Promise<UsageVerdict> {
  // 관리 호출은 사람이 누른 것이 아니다
  if (caller.kind === "service") return { allowed: true };
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[usage] SUPABASE_URL 또는 SERVICE_ROLE_KEY 가 없다");
    return { allowed: true };
  }

  const limit = DAILY_LIMIT[feature];
  const day = todayKst();
  const base = `${SUPABASE_URL}/rest/v1/ai_usage_log`;
  const query =
    `user_id=eq.${caller.userId}&feature=eq.${feature}&used_on=eq.${day}`;

  try {
    const counted = await fetch(`${base}?${query}&select=id`, {
      headers: { ...headers(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!counted.ok) {
      console.error("[usage] 세지 못했다", counted.status);
      return { allowed: true };
    }
    // content-range 는 '0-0/12' 꼴이다
    const used = Number(
      (counted.headers.get("content-range") ?? "").split("/")[1] ?? "0",
    );
    if (Number.isFinite(used) && used >= limit) {
      console.warn(`[usage] 한도 초과 ${feature} ${used}/${limit}`);
      return { allowed: false, limit, used };
    }

    const written = await fetch(base, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        user_id: caller.userId,
        feature,
        used_on: day,
      }),
    });
    if (!written.ok) console.error("[usage] 적지 못했다", written.status);
  } catch (error) {
    console.error(
      "[usage] 기록 실패",
      error instanceof Error ? error.message : error,
    );
  }
  return { allowed: true };
}

/**
 * 한도를 넘은 호출에 돌려줄 응답.
 *
 * ⚠️ 429 를 쓴다. 앱은 2xx 가 아니면 조용히 기본값으로 돌아가므로 화면은
 *    깨지지 않는다. 사유는 body 에 담아 두고, 화면 문구는 앱이 정한다.
 */
export function limitExceeded(
  cors: Record<string, string>,
  verdict: { limit: number; used: number },
): Response {
  return new Response(
    JSON.stringify({
      error: "DAILY_LIMIT_EXCEEDED",
      limit: verdict.limit,
      used: verdict.used,
    }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
