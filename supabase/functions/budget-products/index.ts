// ============================================================================
// Edge Function · budget-products
//
// TRIP-03 예산 구성에서 카테고리를 펼쳤을 때 나오는 **근거 상품**을
// 여행지에 맞게 다시 쓴다.
//
//   Expo App → 이 함수 → LLM → 응답 검증 → App
//
// ⚠️ **앱은 LLM 을 직접 부르지 않는다.** (CLAUDE.md 1장 / 10장)
//    키는 이 함수의 Secret 으로만 존재한다.
//
// ============================================================================
// 가장 중요한 규칙 — 금액에는 **가드레일**이 있다
// ============================================================================
//
//   AI 는 항목의 이름과 **그 항목의 총액**을 함께 만든다.
//   항목만 바꾸고 금액을 고정하면 "파리 시내 3성 호텔" 이라는 이름 밑에
//   목적지 카탈로그의 일반 배수로 계산된 숫자가 붙는다. 이름과 금액이
//   서로 다른 말을 한다.
//
//   대신 앱이 받은 금액을 그대로 쓰지 않는다.
//
//     비율 = AI 가 준 금액 ÷ 그 카테고리의 기준 금액
//     이 비율이 카탈로그 비율의 ±40% 를 벗어나면 **카탈로그 값을 쓴다**
//
//   destinations.ts 의 로드맵에 적어 둔 방식이다.
//     "검색 결과가 기준값 대비 ±30% 를 벗어나면 기준값을 쓴다"
//   기준 금액(lib/constants/destinations.ts)은 사람이 조사한 값이라
//   모델이 자릿수를 틀렸을 때 그것을 잡아 주는 유일한 안전장치다.
//
//   판정은 앱에서 한다. (lib/budget/productLocalization.ts)
//   이 함수는 후보를 만들 뿐이고, 무엇을 받아들일지는 앱이 정한다.
//
// ⚠️ 그래도 recommended_amount 는 여전히 **여행 생성 시점에 한 번 정해지고
//    그 뒤 바뀌지 않는다.** (CLAUDE.md 4장) 이 함수의 응답은 그 값이 정해지기
//    전에 도착한다. 사용자가 화면에서 본 금액이 곧 저장되는 추천 원본이다.
//
// ⚠️ 응답은 항상 200 이고 { products: [...] } 형태다.
//    실패하면 빈 배열을 준다. 앱은 원래 카탈로그 이름을 그대로 쓰면 되고,
//    추천이 없다고 예산 구성 화면이 멈추면 안 된다.
//
// ⚠️ 공급자를 고정하지 않는다. OpenAI 호환 /chat/completions 를 내주는 곳이면
//    주소와 모델명만 바꿔 그대로 쓴다. (plan-suggestions 와 같은 규약)
//
// 배포 (사람이 직접 실행)
//   npx supabase functions deploy budget-products
//   시크릿은 plan-suggestions 와 공유한다. 따로 등록하지 않아도 된다.
//
// 진단
//   요청 본문에 { "debug": true } 를 넣으면 실패 사유가 응답에 함께 온다.
// ============================================================================

/** OpenAI 호환 엔드포인트. 끝의 / 는 붙이지 않는다 */
import { identifyCaller, unauthorized } from "../_shared/auth.ts";
import {
  CATEGORY_LABEL,
  DESTINATION_NAME,
  PRODUCT,
  formulaFor,
  toCount,
  toPromptText,
  toTier,
  toWon,
} from "./reference.ts";

const BASE_URL = (Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1").replace(
  /\/+$/,
  "",
);
const MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";

/**
 * 사용자 요청의 전체 예산.
 *
 * ⚠️ **사용자는 모델을 기다리지 않는다.** 이 기능의 정상 경로는 캐시다.
 *    캐시가 차 있으면 응답은 1초 안쪽이고, 빈 칸이 있으면 그 칸만 짧게
 *    시도해 보고 안 되면 그냥 포기한다. 앱은 빠진 id 를 카탈로그 이름으로
 *    채우므로 화면은 멀쩡하다.
 *
 *    캐시를 채우는 것은 사용자 트래픽의 일이 아니다. .demo/warm-products.py
 *    가 미리 돌면서 채운다. 그쪽은 warm:true 로 부르고 예산을 넉넉히 쓴다.
 */
const TIMEOUT_MS = 8000;
/** 워밍업(warm:true)의 예산. 사람이 기다리는 자리가 아니라 넉넉하게 준다 */
const WARM_TIMEOUT_MS = 45000;
/**
 * 한 번의 호출에 줄 시간.
 *
 * ⚠️ 카테고리를 **하나씩 나눠 병렬로** 부르기 때문에 이 값이 곧 체감 시간이다.
 *
 *    처음에는 8개 카테고리 32개 슬롯을 한 프롬프트에 넣었는데 24초를 넘겨도
 *    응답이 오지 않았다("The signal has been aborted"). 같은 요청을 슬롯 1개로
 *    줄이니 몇 초 만에 왔다. 프롬프트 길이가 문제였다.
 *
 *    나눠 부르면 하나가 늦어도 나머지는 도착한다. 앱은 빠진 id 를 카탈로그
 *    값으로 채우므로 부분 성공이 그대로 쓸모 있다.
 */
const ATTEMPT_TIMEOUT_MS = 16000;

/** 요청에 실어 보내는 상품 한 칸 */
type SlotInput = {
  id?: string;
  /** 지금 카탈로그의 일반적인 이름. 어떤 성격의 자리인지 알려 준다 */
  generic?: string;
  /** 'low' | 'mid' | 'high' — 같은 카테고리 안에서의 가격대 */
  tier?: string;
  /** 카탈로그 비율로 계산한 지금 금액. 자릿수의 기준점이다 */
  currentAmount?: number;
};

type CategoryInput = {
  /** 'AIRFARE' | 'LODGING' | … */
  code?: string;
  /** '항공' '숙소' … */
  label?: string;
  /** 이 카테고리의 기준 금액. 인원·박수·일수를 이미 곱한 총액이다 */
  baseAmount?: number;
  /** '1인 왕복 × 2명' 처럼 기준 금액이 어떻게 나왔는지 */
  formula?: string;
  slots?: SlotInput[];
};

type Body = {
  destination?: string | null;
  /**
   * 캐시 열쇠. lib/constants/destinations.ts 의 DestinationCode 이거나,
   * 목록에 없는 목적지면 'region:europe' 처럼 지역 열쇠다.
   * 없으면 캐시를 쓰지 않는다(항상 새로 만든다).
   */
  destinationKey?: string | null;
  days?: number;
  nights?: number;
  headcount?: number;
  /** '아끼는 편' | '보통' | '아낌없이' */
  styleLabel?: string;
  categories?: CategoryInput[];
  debug?: boolean;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** 한 번에 다룰 수 있는 상품 칸 수. 프롬프트가 너무 길어지면 응답이 느려진다 */
const MAX_SLOTS = 40;

// ── 캐시 ────────────────────────────────────────────────────────────────────
//
// public.destination_budget_products (20260907000001)
//
// ⚠️ **금액이 아니라 비율을 저장한다.** 금액은 인원·박수·일수에 따라 달라져서
//    저장하면 캐시가 사실상 안 맞는다. 비율은 셋과 무관하다.
//      비율 = 금액 ÷ 카테고리 기준 금액,  금액 = 기준 금액 × 비율
//
// ⚠️ 쓰기는 service_role 로 한다. 앱(anon)은 이 표를 직접 건드리지 않는다.
//    두 값 모두 Supabase 가 Edge Function 에 자동으로 넣어 준다.
//
// ⚠️ 캐시가 실패해도 기능은 돌아간다. 읽기 실패 → 그냥 새로 만든다.
//    쓰기 실패 → 이번 응답은 정상이고 다음 번에 다시 만든다.
//    캐시 때문에 추천이 안 나오는 일은 없어야 한다.

const REST_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CACHE_TABLE = "destination_budget_products";

type CachedProduct = {
  product_id: string;
  name: string;
  note: string;
  emoji: string;
  ratio: number;
};

async function readCache(destinationKey: string): Promise<Map<string, CachedProduct>> {
  const result = new Map<string, CachedProduct>();
  if (!REST_URL || !SERVICE_KEY || !destinationKey) return result;

  const url =
    `${REST_URL}/rest/v1/${CACHE_TABLE}` +
    `?destination_key=eq.${encodeURIComponent(destinationKey)}` +
    `&select=product_id,name,note,emoji,ratio`;

  const response = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`캐시 조회 ${response.status}`);

  const rows = (await response.json()) as CachedProduct[];
  for (const row of rows) {
    // numeric 은 문자열로 온다. 숫자로 못 바꾸면 그 줄은 버린다.
    const ratio = Number(row.ratio);
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    result.set(row.product_id, { ...row, ratio });
  }
  return result;
}

async function writeCache(
  destinationKey: string,
  rows: { product_id: string; name: string; note: string; emoji: string; ratio: number }[],
): Promise<void> {
  if (!REST_URL || !SERVICE_KEY || !destinationKey || rows.length === 0) return;

  const response = await fetch(`${REST_URL}/rest/v1/${CACHE_TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      // 같은 (목적지, 상품) 이 이미 있으면 덮어쓴다. 다시 만든 값이 최신이다.
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(
      rows.map((row) => ({ ...row, destination_key: destinationKey, generated_at: new Date().toISOString() })),
    ),
  });
  if (!response.ok) throw new Error(`캐시 저장 ${response.status} ${await response.text()}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ⚠️ 로그인한 사용자만 부른다. anon 키만으로는 통과하지 못한다. (_shared/auth.ts)
  const caller = await identifyCaller(request);
  if (!caller) return unauthorized(CORS);

  /**
   * ⚠️ 실패 원인을 반드시 남긴다.
   *    이 함수는 무슨 일이 있어도 200 + 빈 배열을 돌려주고 앱은 조용히
   *    카탈로그 이름으로 되돌아간다. 화면이 멀쩡해 보이기 때문에 진단할
   *    창구가 없으면 "키가 틀렸다" 와 "바꿀 게 없었다" 를 구분할 수 없다.
   *
   * ⚠️ 요청마다 새로 만든다. 모듈 전역에 두면 다음 요청에 사유가 섞인다.
   */
  const failures: string[] = [];
  let debugMode = false;

  function fail(reason: string, detail?: unknown): void {
    const line = `${reason} ${detail === undefined ? "" : String(detail).slice(0, 300)}`.trim();
    failures.push(line);
    console.error(`[budget-products] ${line}`);
  }

  /** ⚠️ failures 는 debug 요청에만 실어 준다. 상위 서비스 오류 원문을 흘리지 않는다 */
  function ok(products: unknown[]): Response {
    const payload = debugMode ? { products, failures } : { products };
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
  // ⚠️ 키는 절대 싣지 않는다. 주소와 모델명만 남긴다. 없는 모델을 부르면
  //    Gemini 호환 엔드포인트가 404 를 주지 않고 매달려서, 이게 없으면
  //    "느리다" 와 "모델명이 틀렸다" 를 구분할 수 없다.
  if (debugMode) fail(`설정 BASE_URL=${BASE_URL} MODEL=${MODEL}`);

  if (!key) {
    fail("API 키가 없다. LLM_API_KEY 를 등록해야 한다");
    return ok([]);
  }
  /** ⚠️ 안내문의 자리표시자를 그대로 등록하는 사고가 실제로 있었다 */
  if (key.length < 20 || key.endsWith("...")) {
    fail("API 키가 자리표시자로 보인다. 진짜 키인지 확인할 것", key.slice(0, 6));
    return ok([]);
  }

  /*
    ⚠️ 진단용. { "debug": true, "listModels": true } 로 부르면 이 엔드포인트가
       내주는 모델 목록을 그대로 돌려준다. 없는 모델명을 넣으면 Gemini 호환
       엔드포인트가 404 를 주지 않고 매달리기 때문에, 모델을 바꿀 때마다
       이걸로 먼저 확인한다. 키는 절대 싣지 않는다.
  */
  // ⚠️ 관리 호출(service_role)만. 로그인 사용자도 부를 때마다 상위 서비스 호출이 한 번 더 나간다.
  if (caller.kind === "service" && debugMode && (body as { listModels?: boolean }).listModels === true) {
    try {
      const response = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await response.text();
      fail(`models ${response.status}`, text.slice(0, 4000));
    } catch (error) {
      fail("models 조회 실패", error instanceof Error ? error.message : error);
    }
    return ok([]);
  }

  // ── 목적지 ─────────────────────────────────────────────────────────────
  //
  // ⚠️ **목록에 있는 목적지만 캐시를 쓴다.** 그리고 그때는 앱이 보낸 이름이 아니라
  //    서버가 가진 이름으로 묻는다. (reference.ts)
  //
  // ⚠️ 목록에 없는 목적지('region:europe' 열쇠)는 캐시를 읽지도 쓰지도 않는다.
  //    지역 열쇠 하나에 여러 도시가 섞이기 때문이다. '프라하' 로 만든 결과가
  //    region:europe 에 들어가면 다음에 '리스본' 을 입력한 사람이 프라하 상품을 본다.
  //    직접 입력 목적지는 매번 새로 묻고, 시간 안에 못 오면 카탈로그 이름이 보인다.
  const requestedKey = typeof body.destinationKey === "string" ? body.destinationKey.trim() : "";
  const knownName = Object.hasOwn(DESTINATION_NAME, requestedKey)
    ? DESTINATION_NAME[requestedKey]
    : null;
  /** 캐시 열쇠. 목록에 없는 목적지면 빈 문자열이고, 그러면 캐시를 건너뛴다 */
  const destinationKey = knownName ? requestedKey : "";
  const destination = knownName ?? toPromptText(body.destination, 30);
  if (!destination) {
    fail("여행지가 없다. 여행지 없이는 다시 쓸 이유가 없다");
    return ok([]);
  }

  const headcount = toCount(body.headcount, 1, 20);
  const nights = toCount(body.nights, 0, 60);
  const days = toCount(body.days, 1, 61);

  // ── 요청 정리 ──────────────────────────────────────────────────────────
  //
  // ⚠️ 카테고리 이름·상품 이름·계산식은 앱이 보낸 글자를 버리고 서버 값으로 채운다.
  //    앱이 보내는 것 중 믿는 것은 **어느 칸인가(id)** 와 **숫자** 뿐이다.
  //    카탈로그에 없는 id, 다른 카테고리의 id, 중복 id 는 버린다.
  let slotCount = 0;
  const categories = (Array.isArray(body.categories) ? body.categories : [])
    .map((category) => {
      const code = typeof category.code === "string" ? category.code : "";
      if (!Object.hasOwn(CATEGORY_LABEL, code)) return null;
      const seen = new Set<string>();
      const slots = (Array.isArray(category.slots) ? category.slots : [])
        .filter((slot) => {
          const id = slot.id;
          if (typeof id !== "string" || seen.has(id)) return false;
          if (!Object.hasOwn(PRODUCT, id) || PRODUCT[id].category !== code) return false;
          seen.add(id);
          return true;
        })
        .map((slot) => ({
          id: slot.id as string,
          generic: PRODUCT[slot.id as string].name,
          tier: toTier(slot.tier),
          currentAmount: toWon(slot.currentAmount),
        }));
      return {
        code,
        label: CATEGORY_LABEL[code],
        baseAmount: toWon(category.baseAmount),
        formula: formulaFor(code, headcount, nights, days),
        slots,
      };
    })
    .filter((category): category is NonNullable<typeof category> =>
      category !== null && category.slots.length > 0
    )
    .map((category) => {
      const room = Math.max(0, MAX_SLOTS - slotCount);
      const slots = category.slots.slice(0, room);
      slotCount += slots.length;
      return { ...category, slots };
    })
    .filter((category) => category.slots.length > 0);

  if (categories.length === 0) {
    fail("다시 쓸 상품 칸이 없다");
    return ok([]);
  }

  // ── 캐시 먼저 ──────────────────────────────────────────────────────────
  //
  // 같은 목적지면 답이 같다. 한 번 만들어 둔 것이 있으면 모델을 부르지 않는다.
  // 무료 등급이 카테고리 1건에 13~15초 걸리므로, 캐시가 이 기능의 전제다.

  let cached = new Map<string, CachedProduct>();
  try {
    cached = await readCache(destinationKey);
  } catch (error) {
    // 캐시를 못 읽어도 기능은 돌아간다. 그냥 새로 만든다.
    fail("캐시 조회 실패", error instanceof Error ? error.message : error);
  }

  /** 기준 금액 × 비율 → 응답에 실을 금액. 1,000원 단위로 끊는다 */
  function toAmount(baseAmount: number, ratio: number): number {
    return Math.round((baseAmount * ratio) / 1000) * 1000;
  }

  const fromCache: unknown[] = [];
  /** 캐시에 없는 칸이 하나라도 있는 카테고리만 모델에게 묻는다 */
  const pending: typeof categories = [];

  for (const category of categories) {
    const hits = category.slots.filter((slot) => cached.has(slot.id!));
    if (hits.length === category.slots.length) {
      for (const slot of hits) {
        const row = cached.get(slot.id!)!;
        fromCache.push({
          id: row.product_id,
          name: row.name,
          note: row.note,
          emoji: row.emoji,
          amount: toAmount(category.baseAmount ?? 0, row.ratio),
        });
      }
    } else {
      pending.push(category);
    }
  }

  if (pending.length === 0) {
    fail(`전부 캐시에서 나왔다 (${fromCache.length}칸)`);
    return ok(fromCache.slice(0, MAX_SLOTS));
  }

  // ── 캐시에 없는 카테고리만 모델 호출 ──────────────────────────────────

  /**
   * 워밍업 호출인가.
   *
   * ⚠️ 이 값 하나로 "사람이 기다리는 요청" 과 "캐시를 채우는 배치" 를 가른다.
   *    둘을 같은 예산으로 다루면, 캐시를 채우려고 45초를 주는 순간 여행
   *    생성 화면도 45초를 기다리게 된다.
   */
  //
  // ⚠️ 관리 호출(service_role)만 워밍업으로 인정한다. 로그인 사용자가 warm:true 를
  //    보내면 요청 하나로 45초 동안 무료 한도를 태울 수 있다.
  const warming = caller.kind === "service" && (body as { warm?: boolean }).warm === true;
  const deadline = Date.now() + (warming ? WARM_TIMEOUT_MS : TIMEOUT_MS);

  /** 다시 걸어 볼 만한 실패인가. 429·5xx 는 Gemini 무료 등급에서 흔하다 */
  const retryable = (status: number) => status === 429 || status >= 500;

  function buildPrompt(category: (typeof categories)[number]): string {
    const rows = category.slots
      .map(
        (slot) =>
          `- id: ${slot.id} / 가격대: ${slot.tier ?? "mid"} / 지금 이름: ${slot.generic ?? ""} / 지금 금액: ${slot.currentAmount ?? 0}원`,
      )
      .join("\n");

    return [
      "너는 해외여행 예산을 짜는 사람에게 선택지를 만들어 준다.",
      `아래 '${category.label ?? category.code}' 칸을 **${destination} 에서 실제로 고르게 되는 선택지**로`,
      "다시 쓰고, 이 일정·인원에 맞는 **총액**을 함께 매겨라.",
      "",
      `여행지: ${destination}`,
      `일정: ${nights}박 ${days}일`,
      `인원: ${headcount}명`,
      `이 카테고리의 기준 금액: ${category.baseAmount ?? 0}원 (${category.formula ?? ""})`,
      "",
      "칸 목록",
      rows,
      "",
      "규칙",
      "- **id 는 절대 바꾸지 않는다.** 받은 id 를 그대로 돌려준다.",
      "- 받은 칸 전부에 대해 하나씩 돌려준다. 칸을 늘리거나 빼지 않는다.",
      "- amount 는 이 여행 전체에 대한 **총액**이다. 1인 금액이 아니다.",
      "  '기준 금액' 은 인원·박수·일수가 이미 곱해진 값이다. 같은 자릿수로 매겨라.",
      "- amount 는 원 단위 정수이고 1000의 배수로 만든다.",
      "- 가격대(low/mid/high) 순서를 지킨다. low 칸이 high 칸보다 비싸면 안 된다.",
      "- 그 도시에서만 통하는 구체적인 선택지로 쓴다.",
      "  예) 파리 숙소 → '파리 시내 3성 호텔', 파리 교통 → '나비고 위클리 패스'",
      "- **특정 회사·브랜드·상호명을 쓰지 않는다.** 종류로 쓴다.",
      "  단 그 도시의 공공 교통패스·관광패스처럼 고유명사가 곧 상품인 것은 써도 된다.",
      "- name 은 공백 포함 16자 이내의 한국어. 이름 안에 금액을 쓰지 않는다.",
      "- note 는 어떤 선택지인지 20자 이내 한 줄. 없으면 빈 문자열.",
      "- emoji 는 1개.",
      "",
      "출력 형식 — 아래 JSON 하나만 출력한다. 설명이나 코드펜스를 붙이지 않는다.",
      '{"products":[{"id":"stay-hotel4","name":"파리 시내 3성 호텔","amount":960000,"note":"중심가 도보권","emoji":"🏨"}]}',
    ].join("\n");
  }

  async function callOnce(prompt: string): Promise<Response> {
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
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.5,
          /**
           * ⚠️ json_schema 를 쓰지 않는다. Gemini 호환 엔드포인트에서 스키마를
           *    붙이면 응답이 20초를 넘겨도 돌아오지 않았다. json_object +
           *    프롬프트가 같은 결과를 훨씬 빨리 준다. 최종 검증은 앱에서
           *    한 번 더 한다. (plan-suggestions 와 같은 판단)
           */
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** 카테고리 하나. 실패하면 빈 배열이다. 그 카테고리만 카탈로그로 남는다 */
  async function askCategory(
    category: (typeof categories)[number],
  ): Promise<unknown[]> {
    const label = category.label ?? category.code ?? "?";
    const prompt = buildPrompt(category);

    try {
      let response = await callOnce(prompt);

      // ⚠️ 재시도는 워밍업에서만 한다. 사용자 요청은 예산이 8초라
      //    재시도 한 번이 그 예산을 통째로 먹는다.
      if (warming && !response.ok && retryable(response.status) && Date.now() < deadline) {
        // ⚠️ 본문은 한 번만 읽을 수 있다. 여기서 읽고 아래에서 또 읽으면 터진다.
        fail(`${label} 응답 ${response.status} · 재시도`, await response.text());
        response = await callOnce(prompt);
      }

      if (!response.ok) {
        fail(`${label} 응답 ${response.status}`, await response.text());
        return [];
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        fail(`${label} 응답에 content 가 없다`, JSON.stringify(json));
        return [];
      }

      const parsed = JSON.parse(content);
      const products = Array.isArray(parsed?.products) ? parsed.products : [];
      if (products.length === 0) fail(`${label} 빈 배열`, content.slice(0, 150));

      // ── 캐시에 넣을 형태로 바꾼다 ──────────────────────────────────────
      //
      // ⚠️ 여기서 비율로 되돌린다. 저장은 비율로만 한다.
      //    가드레일(카탈로그 비율 ±40%)은 앱이 건다. 캐시에 들어가는 값은
      //    아직 검증 전이라, 앱은 캐시에서 온 값에도 똑같이 가드레일을 건다.
      //
      // ⚠️ 이번에 물어본 칸만 저장한다. 모델이 다른 id 를 섞어 돌려줘도 공용 캐시에
      //    들어가지 않는다. 비율이 터무니없는 줄(0 이하 · 20배 초과)도 버린다.
      const baseAmount = category.baseAmount ?? 0;
      const askedIds = new Set(category.slots.map((slot) => slot.id));
      if (baseAmount > 0) {
        const rows = products
          .map((row: Record<string, unknown>) => {
            const id = typeof row?.id === "string" ? row.id : "";
            const name = typeof row?.name === "string" ? row.name.trim() : "";
            const amount = typeof row?.amount === "number" ? row.amount : 0;
            if (!id || !askedIds.has(id) || !name || !(amount > 0)) return null;
            if (amount / baseAmount > 20) return null;
            return {
              product_id: id,
              name: name.slice(0, 20),
              note: typeof row?.note === "string" ? row.note.trim().slice(0, 30) : "",
              emoji: typeof row?.emoji === "string" ? row.emoji.trim().slice(0, 8) : "",
              ratio: amount / baseAmount,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        try {
          await writeCache(destinationKey, rows);
        } catch (error) {
          // 저장에 실패해도 이번 응답은 정상이다. 다음 번에 다시 만든다.
          fail(`${label} 캐시 저장 실패`, error instanceof Error ? error.message : error);
        }
      }

      return products;
    } catch (error) {
      // 타임아웃·네트워크·JSON 실패 전부 여기로 온다. 이 카테고리만 포기한다.
      fail(`${label} 호출 실패`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  /*
    ⚠️ 전부 동시에 부르지 않는다. 무료 등급은 동시 요청 7건에 **429** 를 낸다.
       실측에서 7개를 한꺼번에 던지니 두 개만 오고 나머지가 429·시간 초과였다.
       동시 2건으로 제한하고 사이를 벌린다. 어차피 캐시가 차면 여기까지 안 온다.

    ⚠️ allSettled 가 아니라 all 이어도 되는 이유: askCategory 는 스스로 절대
       reject 하지 않는다. 실패를 빈 배열로 바꿔 돌려준다. 하나가 죽어서
       나머지까지 버리는 일이 없어야 한다.
  */
  // ⚠️ 워밍업은 한 번에 하나씩 간다. 무료 등급은 동시 요청에 429 를 내는데,
  //    배치는 급할 이유가 없으므로 확실하게 채우는 쪽이 낫다.
  const CONCURRENCY = warming ? 1 : 2;
  const queue = [...pending];
  const results: unknown[][] = [];

  async function worker(index: number): Promise<void> {
    // 워커마다 출발을 늦춘다. 같은 순간에 겹치면 429 가 난다.
    await new Promise((resolve) => setTimeout(resolve, index * 500));
    for (;;) {
      const category = queue.shift();
      if (!category || Date.now() >= deadline) return;
      results.push(await askCategory(category));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, (_, i) => worker(i)),
  );

  // 캐시에서 나온 것과 방금 만든 것을 합친다.
  // 최종 검증과 가드레일은 앱에서 한다 (lib/budget/productLocalization.ts)
  const merged = [...fromCache, ...results.flat()];
  return ok(merged.slice(0, MAX_SLOTS));
});
