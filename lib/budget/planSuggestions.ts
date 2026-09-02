// ============================================================================
// 세부 계획 추천 — 규칙 기반 카탈로그
//
// BUDGET-02 '계획 항목 추가' 를 누르면 나오는 추천의 **기본 소스**다.
// Edge Function(AI) 이 응답하지 않거나 응답이 형식을 어기면 이 값을 쓴다.
// (lib/supabase/queries/planSuggestions.ts 가 그 판단을 한다)
//
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다.
//
// ⚠️ **추천이 사용자 대신 확정하지 않는다.** (CLAUDE.md 3장)
//    여기서 만드는 건 후보일 뿐이고, 세부 계획에 들어가는 건
//    사용자가 카드를 눌렀을 때다.
//
// ⚠️ 금액은 **정수 원 단위**다. 1인당 단가 × 인원, 1박 단가 × 박수로 만든다.
//    실제 시세를 맞히려는 값이 아니라 "이 항목을 빠뜨렸다" 를 알리는 자리다.
//    그래서 사용자가 카드를 누른 뒤 바로 고칠 수 있어야 한다.
// ============================================================================
import { CATEGORY_CODE, type CategoryCode } from "@/lib/constants/status";

export type PlanSuggestion = {
  /** 같은 항목을 두 번 추천하지 않기 위한 키 */
  key: string;
  name: string;
  /** 총액. 원 단위 정수 */
  amount: number;
  /** 왜 이걸 권하는가. 한 줄 */
  reason: string;
  emoji: string;
};

export type SuggestionContext = {
  /** 여행지 한글명. '오사카' */
  destination: string | null;
  /** 여행 일수 (시작·종료일 포함). 3박 4일이면 4 */
  days: number;
  /** 숙박 일수. 3박 4일이면 3 */
  nights: number;
  headcount: number;
  categoryCode: CategoryCode;
  /** 이미 계획에 있는 항목 이름들. 여기 있는 건 추천하지 않는다 */
  existingNames: string[];
};

/** 카탈로그 한 줄. amount 는 문맥으로 계산한다 */
type CatalogEntry = {
  key: string;
  name: string;
  emoji: string;
  reason: string;
  /** 문맥을 받아 총액을 낸다 */
  amount: (context: SuggestionContext) => number;
};

/** 1,000원 단위로 끊는다. 927,340원 같은 추천 금액은 사람이 못 읽는다 */
function round1k(value: number): number {
  return Math.max(0, Math.round(value / 1000) * 1000);
}

const CATALOG: Record<CategoryCode, CatalogEntry[]> = {
  [CATEGORY_CODE.AIRFARE]: [
    {
      key: "airfare-baggage",
      name: "수하물 추가",
      emoji: "🧳",
      reason: "돌아올 때 짐이 늘어나요",
      amount: (c) => round1k(35000 * c.headcount),
    },
    {
      key: "airfare-seat",
      name: "좌석 지정",
      emoji: "💺",
      reason: "일행이 떨어져 앉지 않게 미리 잡아요",
      amount: (c) => round1k(15000 * c.headcount),
    },
    {
      key: "airfare-lounge",
      name: "공항 라운지",
      emoji: "☕",
      reason: "긴 대기 시간에 대비해요",
      amount: (c) => round1k(35000 * c.headcount),
    },
    {
      key: "airfare-transfer",
      name: "공항 이동 비용",
      emoji: "🚆",
      reason: "출발·도착 교통을 놓치기 쉬워요",
      amount: (c) => round1k(20000 * c.headcount * 2),
    },
  ],
  [CATEGORY_CODE.LODGING]: [
    {
      key: "lodging-breakfast",
      name: "조식 추가",
      emoji: "🥐",
      reason: "첫 끼를 챙기면 아침이 편해요",
      amount: (c) => round1k(18000 * c.headcount * c.nights),
    },
    {
      key: "lodging-tax",
      name: "숙박세·리조트비",
      emoji: "🧾",
      reason: "현장에서 따로 받는 곳이 많아요",
      amount: (c) => round1k(3000 * c.headcount * c.nights),
    },
    {
      key: "lodging-luggage",
      name: "짐 보관료",
      emoji: "🛅",
      reason: "체크아웃 후 마지막 날에 필요해요",
      amount: () => 10000,
    },
  ],
  [CATEGORY_CODE.FOOD]: [
    {
      key: "food-reservation",
      name: "예약 필요한 한 끼",
      emoji: "🍣",
      reason: "가고 싶은 곳은 미리 잡아 둬야 해요",
      amount: (c) => round1k(45000 * c.headcount),
    },
    {
      key: "food-cafe",
      name: "카페·디저트",
      emoji: "🍰",
      reason: "하루 한 번은 들르게 돼요",
      amount: (c) => round1k(8000 * c.headcount * c.days),
    },
    {
      key: "food-convenience",
      name: "편의점·야식",
      emoji: "🍙",
      reason: "숙소에서 먹는 밤 비용이에요",
      amount: (c) => round1k(6000 * c.headcount * c.nights),
    },
  ],
  [CATEGORY_CODE.TRANSPORT]: [
    {
      key: "transport-pass",
      name: "교통 패스",
      emoji: "🎫",
      reason: "며칠 이상이면 낱장보다 싸요",
      amount: (c) => round1k(12000 * c.headcount * c.days),
    },
    {
      key: "transport-taxi",
      name: "심야 택시",
      emoji: "🚕",
      reason: "막차를 놓치는 날이 하루쯤 생겨요",
      amount: (c) => round1k(20000 * Math.max(1, Math.ceil(c.headcount / 4))),
    },
    {
      key: "transport-intercity",
      name: "도시 간 이동",
      emoji: "🚄",
      reason: "근교를 다녀올 계획이면 필요해요",
      amount: (c) => round1k(30000 * c.headcount),
    },
  ],
  [CATEGORY_CODE.ACTIVITY]: [
    {
      key: "activity-ticket",
      name: "입장권 예약",
      emoji: "🎟️",
      reason: "현장 구매보다 싸고 줄도 짧아요",
      amount: (c) => round1k(35000 * c.headcount),
    },
    {
      key: "activity-onsite",
      name: "현장 체험",
      emoji: "🎨",
      reason: "거기서만 할 수 있는 걸로 하나쯤",
      amount: (c) => round1k(30000 * c.headcount),
    },
    {
      key: "activity-photo",
      name: "사진·기념 촬영",
      emoji: "📸",
      reason: "넷이 함께 찍은 사진이 남아요",
      amount: (c) => round1k(25000 * Math.max(1, Math.ceil(c.headcount / 4))),
    },
  ],
  [CATEGORY_CODE.SHOPPING]: [
    {
      key: "shopping-souvenir",
      name: "기념품·선물",
      emoji: "🎁",
      reason: "돌아와서 나눠 줄 몫이에요",
      amount: (c) => round1k(20000 * c.headcount),
    },
    {
      key: "shopping-drugstore",
      name: "드럭스토어",
      emoji: "💊",
      reason: "가면 꼭 사 오게 되는 항목이에요",
      amount: (c) => round1k(30000 * c.headcount),
    },
    {
      key: "shopping-extra-bag",
      name: "추가 캐리어·가방",
      emoji: "🧳",
      reason: "짐이 늘어나면 담을 곳이 필요해요",
      amount: () => 50000,
    },
  ],
  [CATEGORY_CODE.INSURANCE]: [
    {
      key: "insurance-basic",
      name: "여행자보험 가입",
      emoji: "🛡️",
      reason: "출발 전날까지 가입할 수 있어요",
      amount: (c) => round1k(9000 * c.headcount),
    },
    {
      key: "insurance-device",
      name: "휴대품 보장 특약",
      emoji: "📱",
      reason: "카메라·노트북을 들고 간다면요",
      amount: (c) => round1k(4000 * c.headcount),
    },
  ],
  [CATEGORY_CODE.CONTINGENCY]: [
    {
      key: "contingency-medical",
      name: "비상 의료비",
      emoji: "🏥",
      reason: "현지 병원비는 먼저 내고 나중에 청구해요",
      amount: (c) => round1k(50000 * Math.max(1, Math.ceil(c.headcount / 2))),
    },
    {
      key: "contingency-cash",
      name: "현금 여유분",
      emoji: "💵",
      reason: "카드가 안 되는 가게가 아직 있어요",
      amount: (c) => round1k(30000 * c.headcount),
    },
  ],
};

/** 비교용으로 이름을 정규화한다. 공백과 대소문자 차이로 중복을 놓치지 않게 */
function normalize(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/**
 * 문맥에 맞는 추천 후보를 만든다.
 *
 * ⚠️ **이미 계획에 있는 항목은 뺀다.** 이름이 같은 걸 또 권하면
 *    추천이 화면을 안 읽고 만들어졌다는 게 바로 드러난다.
 *
 * @param limit 최대 개수. 가로 카드라 넷을 넘기면 아무도 끝까지 안 넘긴다
 */
export function buildPlanSuggestions(
  context: SuggestionContext,
  limit = 4,
): PlanSuggestion[] {
  const taken = new Set(context.existingNames.map(normalize));

  return (CATALOG[context.categoryCode] ?? [])
    .filter((entry) => !taken.has(normalize(entry.name)))
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      amount: entry.amount(context),
      reason: entry.reason,
      emoji: entry.emoji,
    }))
    .filter((suggestion) => suggestion.amount > 0)
    .slice(0, limit);
}

/**
 * 바깥(Edge Function)에서 온 추천을 걸러 낸다.
 *
 * ⚠️ AI 응답을 그대로 믿지 않는다. (CLAUDE.md 10장)
 *    타입이 맞지 않거나, 금액이 0 이하이거나, 이미 계획에 있는 이름이면 버린다.
 *    하나도 남지 않으면 호출부가 카탈로그로 되돌린다.
 */
export function sanitizePlanSuggestions(
  raw: unknown,
  context: SuggestionContext,
  limit = 4,
): PlanSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const taken = new Set(context.existingNames.map(normalize));
  const seen = new Set<string>();

  const result: PlanSuggestion[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const candidate = row as Record<string, unknown>;
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";
    const amount =
      typeof candidate.amount === "number" ? Math.round(candidate.amount) : 0;
    const reason =
      typeof candidate.reason === "string" ? candidate.reason.trim() : "";
    if (!name || amount <= 0) continue;

    const normalized = normalize(name);
    if (taken.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);

    result.push({
      key: `ai-${normalized}`,
      name: name.slice(0, 30),
      amount,
      reason: reason.slice(0, 40) || "함께 준비하면 좋아요",
      emoji:
        typeof candidate.emoji === "string" && candidate.emoji
          ? candidate.emoji
          : "📌",
    });
    if (result.length >= limit) break;
  }
  return result;
}
