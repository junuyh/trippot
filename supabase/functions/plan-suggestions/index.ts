// ============================================================================
// Edge Function · plan-suggestions
//
// BUDGET-02 '계획 항목 추가' 의 AI 추천을 만든다.
//
//   Expo App → 이 함수 → OpenAI → 응답 검증 → App
//
// ⚠️ **앱은 OpenAI 를 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//    앱 번들에 키를 넣으면 누구나 꺼내 쓸 수 있다. 키는 이 함수의
//    Secret(OPENAI_API_KEY) 으로만 존재한다.
//
// ⚠️ 이 함수는 **후보만** 만든다. planned_amount 를 쓰지 않는다.
//    사용자가 카드를 눌러야 계획에 들어간다. (CLAUDE.md 1장 · 4장)
//
// ⚠️ 응답은 항상 200 이고 { suggestions: [...] } 형태다.
//    OpenAI 가 실패하면 빈 배열을 돌려준다. 앱이 규칙 기반 카탈로그로
//    되돌아갈 수 있어야 하고, 추천이 없다고 화면이 깨지면 안 된다.
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
//     npx supabase secrets set LLM_MODEL=gemini-3.7-flash
//
//   npx supabase functions deploy plan-suggestions
//
// ⚠️ 시크릿만 바꿀 때는 재배포하지 않아도 된다.
// ============================================================================

/**
 * ⚠️ 실패 원인을 반드시 로그로 남긴다.
 *    이 함수는 무슨 일이 있어도 200 + 빈 배열을 돌려주고 앱은 조용히
 *    규칙 기반 카탈로그로 되돌아간다. 화면이 멀쩡해 보이기 때문에
 *    로그가 없으면 "키가 틀렸다" 와 "추천할 게 없다" 를 구분할 수 없다.
 *
 *    확인:  npx supabase functions logs plan-suggestions
 */
function fail(reason: string, detail?: unknown): void {
  console.error(`[plan-suggestions] ${reason}`, detail ?? "");
}

/** OpenAI 호환 엔드포인트. 끝의 / 는 붙이지 않는다 */
const BASE_URL = (Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";
const TIMEOUT_MS = 8000;

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
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(suggestions: unknown[]): Response {
  return new Response(JSON.stringify({ suggestions }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // 옛 이름(OPENAI_API_KEY)도 받는다. 이미 등록해 둔 프로젝트를 깨지 않는다.
  const key = Deno.env.get("LLM_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    fail("API 키가 없다. LLM_API_KEY 를 등록해야 한다");
    return ok([]);
  }
  /**
   * ⚠️ 안내문의 자리표시자를 그대로 등록하는 사고가 실제로 있었다.
   *    이 경우 401 이 나고 빈 배열이 돌아가 화면은 멀쩡해 보인다.
   *    미리 걸러 로그에 남긴다.
   */
  if (key.length < 20 || key.endsWith("...")) {
    fail("API 키가 자리표시자로 보인다. 진짜 키인지 확인할 것", key.slice(0, 6));
    return ok([]);
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
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
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        // 구조화 응답으로 받는다. 자유 텍스트를 파싱하지 않는다. (CLAUDE.md 10장)
        /**
         * 구조화 응답으로 받는다. 자유 텍스트를 파싱하지 않는다. (CLAUDE.md 10장)
         *
         * ⚠️ OpenAI 확장인 strict 는 쓰지 않는다. 다른 공급자가 모르는 필드로
         *    400 을 낼 수 있고, 어차피 앱에서 한 번 더 검증한다.
         *    (lib/budget/planSuggestions.ts sanitizePlanSuggestions)
         */
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "plan_suggestions",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["suggestions"],
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "amount", "reason", "emoji"],
                    properties: {
                      name: { type: "string" },
                      amount: { type: "integer" },
                      reason: { type: "string" },
                      emoji: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      fail(`${BASE_URL} 응답 ${response.status}`, await response.text());
      return ok([]);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      fail("응답에 content 가 없다", json);
      return ok([]);
    }

    const parsed = JSON.parse(content);
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    if (suggestions.length === 0) fail("모델이 빈 배열을 돌려줬다", content.slice(0, 200));
    // 최종 검증은 앱에서 한 번 더 한다 (lib/budget/planSuggestions.ts)
    return ok(suggestions.slice(0, limit));
  } catch (error) {
    // 타임아웃·네트워크·JSON 실패 전부 여기로 온다. 빈 배열이 정상 응답이다.
    fail("호출 실패", error instanceof Error ? error.message : error);
    return ok([]);
  } finally {
    clearTimeout(timer);
  }
});
