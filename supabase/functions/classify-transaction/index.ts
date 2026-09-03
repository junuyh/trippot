// ============================================================================
// Edge Function · classify-transaction
//
// FUND-01 에서 카테고리를 안 고르고 기록한 지출의 카테고리를 추측한다.
//
//   Expo App → 이 함수 → LLM → 응답 검증 → App
//
// ⚠️ **앱은 LLM 을 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//    키는 이 함수의 Secret 으로만 존재한다. plan-suggestions 와 같은 것을 쓴다.
//
// ⚠️ **추측이지 확정이 아니다.** 결과는 category_method=AUTO 로 저장되고
//    '확인 필요' 로 잡힌다. 사용자가 거래 상세에서 확인해야 확정된다.
//    (CLAUDE.md 3장 — 추천이 사용자 대신 확정하지 않는다)
//
// ⚠️ 못 맞히면 null 을 돌려준다. **틀리게 맞히는 것이 못 맞히는 것보다 나쁘다.**
//    엉뚱한 카테고리가 붙으면 그 카테고리의 실제 사용액이 틀렸다는 것조차
//    사용자가 눈치채기 어렵다.
//
// 응답은 항상 200 이다. { classification: {...} | null }
//
// 배포 (사람이 직접 실행)
//   npx supabase functions deploy classify-transaction
//   시크릿은 plan-suggestions 와 공유한다. 따로 등록할 것이 없다.
//
// 진단
//   요청 본문에 { "debug": true } 를 넣으면 실패 사유가 응답에 함께 온다.
// ============================================================================

/** OpenAI 호환 엔드포인트. 끝의 / 는 붙이지 않는다 */
const BASE_URL = (Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1").replace(
  /\/+$/,
  "",
);
const MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";

/**
 * ⚠️ 앱은 이 호출을 **기다리지 않는다.** 거래를 먼저 저장하고 뒤에서 부른다.
 *    그래서 사용자가 '기록하기' 를 눌렀을 때 이 시간만큼 멈추지 않는다.
 *    실측에서 Gemini 무료 등급이 6초를 넘긴 적이 있어 넉넉히 잡았다.
 */
const TIMEOUT_MS = 20000;
const ATTEMPT_TIMEOUT_MS = 9000;

/** 앱과 같은 목록이어야 한다. lib/constants/status.ts CATEGORY_CODE */
const CATEGORY_CODES = [
  "AIRFARE",
  "LODGING",
  "FOOD",
  "TRANSPORT",
  "ACTIVITY",
  "SHOPPING",
  "INSURANCE",
  "CONTINGENCY",
] as const;

type Body = {
  /** 거래명. 이것만으로 추측한다 */
  name?: string;
  /** 여행지. '오사카' 처럼 지역이 단서가 되는 경우가 있다 */
  destination?: string | null;
  amount?: number;
  debug?: boolean;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ⚠️ 요청마다 새로 만든다. 모듈 전역에 두면 다음 요청에 남은 사유가 섞인다.
  const failures: string[] = [];
  let debugMode = false;

  function fail(reason: string, detail?: unknown): void {
    const line = `${reason} ${detail === undefined ? "" : String(detail).slice(0, 300)}`.trim();
    failures.push(line);
    console.error(`[classify-transaction] ${line}`);
  }

  /** ⚠️ failures 는 debug 요청에만 실어 준다. 상위 서비스 오류 원문을 흘리지 않는다 */
  function ok(classification: unknown): Response {
    const payload = debugMode
      ? { classification, failures }
      : { classification };
    return new Response(JSON.stringify(payload), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("LLM_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return ok(null);
  }
  debugMode = body.debug === true;

  const name = (body.name ?? "").trim();
  if (!name) {
    fail("거래명이 비어 있다");
    return ok(null);
  }

  if (!key) {
    fail("API 키가 없다. LLM_API_KEY 를 등록해야 한다");
    return ok(null);
  }
  // 안내문의 자리표시자를 그대로 등록하는 사고가 실제로 있었다.
  if (key.length < 20 || key.endsWith("...")) {
    fail("API 키가 자리표시자로 보인다", key.slice(0, 6));
    return ok(null);
  }

  const prompt = [
    "너는 해외여행 지출 거래를 예산 카테고리로 분류한다.",
    "",
    `거래명: ${name}`,
    body.destination ? `여행지: ${body.destination}` : "",
    body.amount ? `금액: ${body.amount}원` : "",
    "",
    "카테고리는 아래 중 하나여야 한다.",
    CATEGORY_CODES.join(", "),
    "",
    "규칙",
    "- 확신이 없으면 categoryCode 를 null 로 답한다.",
    "  **틀리게 맞히는 것이 못 맞히는 것보다 나쁘다.**",
    "- confidence 는 0~100 정수로, 얼마나 확신하는지를 적는다.",
    "- 거래명만으로 판단한다. 없는 정보를 지어내지 않는다.",
    "",
    "출력 형식 — 아래 JSON 하나만 출력한다. 설명이나 코드펜스를 붙이지 않는다.",
    '{"categoryCode":"FOOD","confidence":80}',
    '또는 {"categoryCode":null,"confidence":0}',
  ]
    .filter(Boolean)
    .join("\n");

  const requestBody = JSON.stringify({
    model: MODEL,
    temperature: 0,
    // 자유 텍스트를 파싱하지 않는다. (CLAUDE.md 10장)
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  // Gemini 무료 등급은 503("high demand")을 자주 낸다. 429·5xx 는 다시 건다.
  const retryable = (status: number) => status === 429 || status >= 500;
  const deadline = Date.now() + TIMEOUT_MS;

  async function callOnce(): Promise<Response> {
    const remaining = deadline - Date.now();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(1000, Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
    );
    try {
      return await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    let response = await callOnce();

    for (
      let attempt = 1;
      attempt <= 1 &&
      !response.ok &&
      retryable(response.status) &&
      Date.now() < deadline;
      attempt += 1
    ) {
      // ⚠️ 본문은 한 번만 읽을 수 있다. 여기서 읽고 아래에서 또 읽으면 터진다.
      fail(`응답 ${response.status} · 재시도`, await response.text());
      await new Promise((resolve) => setTimeout(resolve, 400));
      response = await callOnce();
    }

    if (!response.ok) {
      fail(`${BASE_URL} 응답 ${response.status}`, await response.text());
      return ok(null);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      fail("응답에 content 가 없다", JSON.stringify(json));
      return ok(null);
    }

    const parsed = JSON.parse(content);
    const code = parsed?.categoryCode;
    if (typeof code !== "string" || !CATEGORY_CODES.includes(code as never)) {
      // 모델이 모르겠다고 답한 정상 경로다. 실패가 아니다.
      return ok(null);
    }

    // 최종 검증은 앱에서 한 번 더 한다 (lib/budget/transactionClassify.ts)
    return ok({
      categoryCode: code,
      confidence:
        typeof parsed?.confidence === "number" ? parsed.confidence : 50,
    });
  } catch (error) {
    fail("호출 실패", error instanceof Error ? error.message : error);
    return ok(null);
  }
});
