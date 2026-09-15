// ============================================================================
// Edge Function · receipt-scan
//
// 영수증 사진 한 장에서 지출 기록에 필요한 값을 뽑는다.
//
//   Expo App → 이 함수 → LLM(비전) → 응답 검증 → App → 사용자가 확인 후 저장
//
// ⚠️ **앱은 LLM 을 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//    키·주소·모델은 plan-suggestions 와 같은 시크릿(LLM_API_KEY · LLM_BASE_URL ·
//    LLM_MODEL)을 쓴다. 따로 등록할 것이 없다.
//
// ⚠️ **읽은 값은 제안이지 확정이 아니다.** 앱은 이 값을 지출 입력 폼에 채워
//    보여줄 뿐이고, 저장은 사용자가 '기록하기' 를 눌러야 된다. 카테고리는
//    category_method=AUTO 로 저장돼 '확인 필요' 에 잡힌다. (CLAUDE.md 3장)
//
// ⚠️ 사진은 저장하지 않는다. 요청 본문으로 받아 모델에 넘기고 버린다.
//    영수증에는 카드 번호 일부·주소가 찍혀 있을 수 있다. (NFR-002)
//
// ⚠️ 금액은 **영수증에 찍힌 통화 그대로** 돌려준다. 원화 환산(totalKrwEstimate)은
//    모델의 대략적인 추정이라 앱이 "환산 확인" 을 붙여 사용자에게 보인다.
//    환율 변환은 [Future] 다. (CLAUDE.md 3장)
//
// 응답은 항상 200 이다. { receipt: {...} | null }
//
// 배포 (사람이 직접 실행)
//   npx supabase functions deploy receipt-scan
//
// 진단
//   요청 본문에 { "debug": true } 를 넣으면 실패 사유가 응답에 함께 온다.
// ============================================================================
import { identifyCaller, unauthorized } from "../_shared/auth.ts";

const BASE_URL = (Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1").replace(
  /\/+$/,
  "",
);
const MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";
/** 비전 호출은 텍스트보다 오래 걸린다. 앱은 이 동안 '읽는 중' 을 보여준다 */
const TIMEOUT_MS = 40000;
const ATTEMPT_TIMEOUT_MS = 25000;
/** 요청 본문 상한. 1280px JPEG 는 보통 300KB 안팎이다 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
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
  /** data: 접두어 없는 base64 */
  imageBase64?: string;
  /** image/jpeg · image/png */
  mimeType?: string;
  destination?: string | null;
  /** 'YYYY-MM-DD'. 날짜가 안 읽힐 때 참고 */
  tripStart?: string | null;
  tripEnd?: string | null;
  debug?: boolean;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ⚠️ 로그인한 사용자만 부른다. anon 키만으로는 통과하지 못한다. (_shared/auth.ts)
  const caller = await identifyCaller(request);
  if (!caller) return unauthorized(CORS);

  const failures: string[] = [];
  let debugMode = false;

  function fail(reason: string, detail?: unknown): void {
    const line = `${reason} ${detail === undefined ? "" : String(detail).slice(0, 300)}`.trim();
    failures.push(line);
    console.error(`[receipt-scan] ${line}`);
  }

  function ok(receipt: unknown): Response {
    const payload = debugMode ? { receipt, failures } : { receipt };
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

  const image = (body.imageBase64 ?? "").trim();
  if (!image) {
    fail("이미지가 비어 있다");
    return ok(null);
  }
  if (image.length > MAX_IMAGE_BYTES * 1.4) {
    fail("이미지가 너무 크다", image.length);
    return ok(null);
  }
  const mime = body.mimeType === "image/png" ? "image/png" : "image/jpeg";

  if (!key) {
    fail("API 키가 없다. LLM_API_KEY 를 등록해야 한다");
    return ok(null);
  }
  if (key.length < 20 || key.endsWith("...")) {
    fail("API 키가 자리표시자로 보인다", key.slice(0, 6));
    return ok(null);
  }

  const prompt = [
    "너는 해외여행 영수증 사진에서 지출 기록에 필요한 값을 읽는다.",
    body.destination ? `여행지: ${body.destination}` : "",
    body.tripStart && body.tripEnd ? `여행 기간: ${body.tripStart} ~ ${body.tripEnd}` : "",
    "",
    "읽을 것",
    "- merchant: 가맹점 이름. 한국어 사용자가 알아볼 수 있게 짧게 (예: '이치란 라멘 도톤보리점'). 원문이 영문이면 그대로",
    "- total: 최종 결제 금액. 숫자만. 소계가 아니라 합계(TOTAL)",
    "- currency: ISO 4217 (KRW, JPY, USD, EUR, VND, TWD, HKD, CNY, PHP …)",
    "- totalKrwEstimate: currency 가 KRW 가 아니면 대략의 원화 환산액(정수). KRW 면 null",
    "- date: 결제 날짜 'YYYY-MM-DD'. 안 보이면 null. 연도가 없으면 여행 기간을 참고",
    `- categoryCode: 아래 중 하나 또는 null. ${CATEGORY_CODES.join(", ")}`,
    "- confidence: 0~100 정수. total 과 merchant 를 얼마나 확신하는지",
    "- items: 품목 최대 5개 [{name, nameKo, amount}]. name 은 영수증 원문 그대로, nameKo 는 한국어 번역(짧게). 없으면 빈 배열",
    "",
    "규칙",
    "- 사진이 영수증이 아니거나 금액을 읽을 수 없으면 total 을 null 로 답한다.",
    "- 없는 값을 지어내지 않는다. 모르면 null.",
    "- 확신이 없는 카테고리는 null. 틀리게 맞히는 것이 못 맞히는 것보다 나쁘다.",
    "",
    "출력 형식 — 아래 JSON 하나만 출력한다. 설명이나 코드펜스를 붙이지 않는다.",
    '{"merchant":"이치란 라멘","total":2380,"currency":"JPY","totalKrwEstimate":21500,"date":"2026-09-19","categoryCode":"FOOD","confidence":90,"items":[{"name":"天然とんこつラーメン","nameKo":"돈코츠 라멘","amount":980}]}',
  ]
    .filter(Boolean)
    .join("\n");

  const requestBody = JSON.stringify({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime};base64,${image}` } },
        ],
      },
    ],
  });

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
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: requestBody,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    let response = await callOnce();
    if (!response.ok && retryable(response.status) && Date.now() < deadline) {
      fail(`응답 ${response.status} · 재시도`, await response.text());
      await new Promise((resolve) => setTimeout(resolve, 600));
      response = await callOnce();
    }
    if (!response.ok) {
      fail(`${BASE_URL} 응답 ${response.status}`, await response.text());
      return ok(null);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      fail("응답에 content 가 없다", JSON.stringify(json).slice(0, 300));
      return ok(null);
    }

    const parsed = JSON.parse(content);
    const total = Number(parsed?.total);
    if (!Number.isFinite(total) || total <= 0) {
      // 영수증이 아니거나 금액을 못 읽었다. 실패가 아니라 '모르겠다' 다.
      return ok(null);
    }

    const code = parsed?.categoryCode;
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .filter((it: unknown) => it && typeof (it as { name?: unknown }).name === "string")
          .slice(0, 5)
          .map((it: { name: string; nameKo?: unknown; amount?: unknown }) => ({
            name: String(it.name).slice(0, 40),
            nameKo: typeof it.nameKo === "string" && it.nameKo.trim() ? it.nameKo.trim().slice(0, 40) : null,
            amount: Number.isFinite(Number(it.amount)) ? Number(it.amount) : null,
          }))
      : [];

    // 최종 검증은 앱에서 한 번 더 한다 (lib/budget/receiptScan.ts)
    return ok({
      merchant: typeof parsed?.merchant === "string" ? parsed.merchant.slice(0, 60) : null,
      total,
      currency:
        typeof parsed?.currency === "string" ? parsed.currency.toUpperCase().slice(0, 3) : "KRW",
      totalKrwEstimate: Number.isFinite(Number(parsed?.totalKrwEstimate))
        ? Number(parsed.totalKrwEstimate)
        : null,
      date: typeof parsed?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : null,
      categoryCode:
        typeof code === "string" && CATEGORY_CODES.includes(code as never) ? code : null,
      confidence: typeof parsed?.confidence === "number" ? parsed.confidence : 50,
      items,
    });
  } catch (error) {
    fail("호출 실패", error instanceof Error ? error.message : error);
    return ok(null);
  }
});
