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
// 배포 (사람이 직접 실행)
//   npx supabase secrets set OPENAI_API_KEY=sk-...
//   npx supabase functions deploy plan-suggestions
// ============================================================================
const MODEL = "gpt-4o-mini";
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

  const key = Deno.env.get("OPENAI_API_KEY");
  // 키가 없으면 조용히 빈 배열이다. 앱이 카탈로그로 돌아간다.
  if (!key) return ok([]);

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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "plan_suggestions",
            strict: true,
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

    if (!response.ok) return ok([]);

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return ok([]);

    const parsed = JSON.parse(content);
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    // 최종 검증은 앱에서 한 번 더 한다 (lib/budget/planSuggestions.ts)
    return ok(suggestions.slice(0, limit));
  } catch {
    // 타임아웃·네트워크·JSON 실패 전부 여기로 온다. 빈 배열이 정상 응답이다.
    return ok([]);
  } finally {
    clearTimeout(timer);
  }
});
