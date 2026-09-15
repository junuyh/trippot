// ============================================================================
// Edge Function · plan-suggestions
//
// BUDGET-02 '계획 항목 추가' 의 AI 추천을 만든다.
//
//   Expo App → 이 함수 → LLM → 응답 검증 → App
//
// ⚠️ **앱은 LLM 을 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//    앱 번들에 키를 넣으면 누구나 꺼내 쓸 수 있다. 키는 이 함수의
//    Secret 으로만 존재한다.
//
// ⚠️ 이 함수는 **후보만** 만든다. planned_amount 를 쓰지 않는다.
//    사용자가 카드를 눌러야 계획에 들어간다. (CLAUDE.md 1장 · 4장)
//
// ⚠️ 응답은 항상 200 이고 { suggestions: [...] } 형태다.
//    실패하면 빈 배열을 돌려준다. 앱이 규칙 기반 카탈로그로 되돌아갈 수
//    있어야 하고, 추천이 없다고 화면이 깨지면 안 된다.
//
// ⚠️ 공급자를 고정하지 않는다. OpenAI 호환 /chat/completions 를 내주는 곳이면
//    주소와 모델명만 바꿔 그대로 쓴다. (Gemini 도 호환 엔드포인트를 제공한다)
//
// 배포 (사람이 직접 실행)
//
//   OpenAI
//     npx supabase secrets set LLM_API_KEY=<진짜 키>
//
//   Gemini (무료 등급)
//     npx supabase secrets set LLM_API_KEY=<Gemini 키>
//     npx supabase secrets set LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
//     npx supabase secrets set LLM_MODEL=gemini-3.6-flash
//
//   ⚠️ 모델명을 반드시 확인할 것. 없는 모델을 넣으면 Gemini 호환
//      엔드포인트가 404 를 바로 주지 않고 **매달린다.** 실제로 그래서
//      "응답이 느리다" 로 오진했다. 쓸 수 있는 목록은 GET {BASE_URL}/models.
//
//   npx supabase functions deploy plan-suggestions
//
// ⚠️ 시크릿만 바꿀 때는 재배포하지 않아도 된다.
//
// 진단
//   요청 본문에 { "debug": true } 를 넣으면 실패 사유가 응답에 함께 온다.
// ============================================================================

/** OpenAI 호환 엔드포인트. 끝의 / 는 붙이지 않는다 */
import { identifyCaller, unauthorized } from "../_shared/auth.ts";

const BASE_URL = (Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1").replace(
  /\/+$/,
  "",
);
const MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";

/** 전체 예산 */
/**
 * 전체 예산.
 *
 * ⚠️ 실측에서 Gemini 무료 등급이 10~21초 걸렸다. 넉넉히 잡지 않으면
 *    성공할 응답을 우리가 먼저 끊는다.
 */
const TIMEOUT_MS = 40000;
/**
 * 한 번의 호출에 줄 시간.
 *
 * ⚠️ 재시도가 전체 예산을 잡아먹지 않게 나눈다. 하나의 AbortController 로
 *    세 번을 묶었더니 마지막 시도가 통째로 잘려
 *    "The signal has been aborted" 만 남고 왜 실패했는지가 사라졌다.
 */
const ATTEMPT_TIMEOUT_MS = 24000;

type Body = {
  destination?: string | null;
  days?: number;
  nights?: number;
  headcount?: number;
  /** 한글 카테고리 라벨. '항공' '숙소' … */
  categoryLabel?: string;
  /** 이미 계획에 있는 항목 이름 */
  existingNames?: string[];
  /** 최대 개수 */
  limit?: number;
  /** 실패 사유를 응답에 함께 받는다. 개발 중 진단용 */
  debug?: boolean;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ⚠️ 로그인한 사용자만 부른다. anon 키만으로는 통과하지 못한다. (_shared/auth.ts)
  const caller = await identifyCaller(request);
  if (!caller) return unauthorized(CORS);

  /**
   * ⚠️ 실패 원인을 반드시 남긴다.
   *    이 함수는 무슨 일이 있어도 200 + 빈 배열을 돌려주고 앱은 조용히
   *    규칙 기반 카탈로그로 되돌아간다. 화면이 멀쩡해 보이기 때문에
   *    진단할 창구가 없으면 "키가 틀렸다" 와 "추천할 게 없다" 를
   *    구분할 수 없다.
   *
   * ⚠️ 요청마다 새로 만든다. 모듈 전역에 두면 다음 요청에 남은 사유가 섞인다.
   */
  const failures: string[] = [];
  let debugMode = false;

  function fail(reason: string, detail?: unknown): void {
    const line = `${reason} ${detail === undefined ? "" : String(detail).slice(0, 300)}`.trim();
    failures.push(line);
    console.error(`[plan-suggestions] ${line}`);
  }

  /** ⚠️ failures 는 debug 요청에만 실어 준다. 상위 서비스 오류 원문을 흘리지 않는다 */
  function ok(suggestions: unknown[]): Response {
    const payload = debugMode ? { suggestions, failures } : { suggestions };
    return new Response(JSON.stringify(payload), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 옛 이름(OPENAI_API_KEY)도 받는다. 이미 등록해 둔 프로젝트를 깨지 않는다.
  const key = Deno.env.get("LLM_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return ok([]);
  }
  debugMode = body.debug === true;

  if (!key) {
    fail("API 키가 없다. LLM_API_KEY 를 등록해야 한다");
    return ok([]);
  }
  /**
   * ⚠️ 안내문의 자리표시자를 그대로 등록하는 사고가 실제로 있었다.
   *    이 경우 401 이 나고 빈 배열이 돌아가 화면은 멀쩡해 보인다.
   *    미리 걸러 사유를 남긴다.
   */
  if (key.length < 20 || key.endsWith("...")) {
    fail("API 키가 자리표시자로 보인다. 진짜 키인지 확인할 것", key.slice(0, 6));
    return ok([]);
  }

  const limit = Math.min(Math.max(body.limit ?? 4, 1), 6);
  const existing = (body.existingNames ?? []).slice(0, 30);

  const prompt = [
    "너는 해외여행 예산 계획을 돕는다.",
    "아래 여행의 특정 카테고리에서, 사용자가 빠뜨리기 쉬운 지출 항목을 추천해라.",
    "",
    `여행지: ${body.destination ?? "미정"}`,
    `일정: ${body.nights ?? 0}박 ${body.days ?? 0}일`,
    `인원: ${body.headcount ?? 1}명`,
    `카테고리: ${body.categoryLabel ?? "기타"}`,
    `이미 계획에 있는 항목: ${existing.length > 0 ? existing.join(", ") : "없음"}`,
    "",
    "규칙",
    `- ${limit}개 이하로 추천한다.`,
    "- 이미 계획에 있는 항목과 같거나 사실상 같은 항목은 절대 추천하지 않는다.",
    "- 해당 카테고리에 속하는 항목만 추천한다.",
    "- amount 는 인원과 일정을 반영한 **총액**이고, 원 단위 정수이며 1000의 배수로 만든다.",
    "- name 은 12자 이내, reason 은 20자 이내의 한국어로 쓴다.",
    "- 실제 상호명이나 특정 업체를 쓰지 않는다.",
    "",
    "출력 형식 — 아래 JSON 하나만 출력한다. 설명이나 코드펜스를 붙이지 않는다.",
    '{"suggestions":[{"name":"항목명","amount":120000,"reason":"권하는 이유","emoji":"☕"}]}',
  ].join("\n");

  const requestBody = JSON.stringify({
    model: MODEL,
    temperature: 0.4,
    /**
     * 구조화 응답으로 받는다. 자유 텍스트를 파싱하지 않는다. (CLAUDE.md 10장)
     *
     * ⚠️ json_schema 를 쓰지 않는다. Gemini 호환 엔드포인트에서 스키마를
     *    붙이면 응답이 20초를 넘겨도 돌아오지 않았다(실측 3회).
     *    json_object + 프롬프트로 형식을 지정하면 같은 결과를 훨씬 빨리 받는다.
     *    어차피 앱에서 sanitizePlanSuggestions 가 한 번 더 검증한다.
     */
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  /**
   * 다시 걸어 볼 만한 실패인가.
   *
   * ⚠️ Gemini 무료 등급은 503 UNAVAILABLE("high demand")을 자주 낸다.
   *    실측에서 세 번 연속 503 이 나왔다. 한 번 실패했다고 카탈로그로
   *    떨어뜨리면 AI 추천이 사실상 안 보인다.
   *    429(과다 요청)와 5xx 도 같은 성격이라 함께 다시 건다.
   *    400·401 은 우리가 잘못 부른 것이라 다시 걸어도 소용없다.
   */
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

    // 짧게 두 번까지 더 걸어 본다. 사용자는 스피너를 보고 있다.
    for (
      let attempt = 1;
      attempt <= 2 &&
      !response.ok &&
      retryable(response.status) &&
      Date.now() < deadline;
      attempt += 1
    ) {
      // ⚠️ 본문은 한 번만 읽을 수 있다. 여기서 읽고 아래에서 또 읽으면 터진다.
      fail(`응답 ${response.status} · ${attempt}번째 재시도`, await response.text());
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      response = await callOnce();
    }

    if (!response.ok) {
      fail(`${BASE_URL} 응답 ${response.status}`, await response.text());
      return ok([]);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      fail("응답에 content 가 없다", JSON.stringify(json));
      return ok([]);
    }

    const parsed = JSON.parse(content);
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    if (suggestions.length === 0) {
      fail("모델이 빈 배열을 돌려줬다", content.slice(0, 200));
    }
    // 최종 검증은 앱에서 한 번 더 한다 (lib/budget/planSuggestions.ts)
    return ok(suggestions.slice(0, limit));
  } catch (error) {
    // 타임아웃·네트워크·JSON 실패 전부 여기로 온다. 빈 배열이 정상 응답이다.
    fail("호출 실패", error instanceof Error ? error.message : error);
    return ok([]);
  }
});
