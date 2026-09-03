// ============================================================================
// 거래 자동 분류 — 규칙 기반 카탈로그
//
// FUND-01 에서 카테고리를 안 고르고 지출을 기록했을 때 쓰는 **기본 소스**다.
// Edge Function(AI) 이 응답하지 않거나 응답이 형식을 어기면 이 값을 쓴다.
// (lib/supabase/queries/transactionClassify.ts 가 그 판단을 한다)
//
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다.
//
// ⚠️ **추측한 분류는 확정이 아니다.** 여기서 나온 결과는 category_method=AUTO
//    로 저장되고 '확인 필요' 로 잡힌다. 사용자가 거래 상세에서 확인해야
//    비로소 확정된다. (CLAUDE.md 3장 — 추천이 사용자 대신 확정하지 않는다)
//
// ⚠️ 못 맞히는 것보다 **틀리게 맞히는 것이 나쁘다.** 확신이 없으면 null 을
//    돌려 미분류로 둔다. 엉뚱한 카테고리가 붙으면 사용자는 그 카테고리의
//    실제 사용액이 틀렸다는 것조차 눈치채기 어렵다.
// ============================================================================
import { CATEGORY_CODE, type CategoryCode } from "@/lib/constants/status";

export type ClassifyResult = {
  categoryCode: CategoryCode;
  /** 0~100. category_confidence 에 그대로 들어간다 */
  confidence: number;
};

/**
 * 카테고리별 단서 낱말.
 *
 * ⚠️ 소문자로 적는다. 비교 전에 입력도 소문자로 바꾼다.
 * ⚠️ 한글·영문·브랜드를 섞어 둔다. 계좌 거래명이 영문으로 오는 경우가 많고
 *    (BOOKING.COM, KANSAI TRANSIT) 직접 입력은 한글이 많다.
 */
const KEYWORDS: Record<CategoryCode, string[]> = {
  [CATEGORY_CODE.AIRFARE]: [
    "항공",
    "왕복",
    "편도",
    "수하물",
    "기내",
    "좌석",
    "라운지",
    "air",
    "airline",
    "airways",
    "flight",
    "jetstar",
    "peach",
    "제주항공",
    "진에어",
    "티웨이",
    "대한항공",
    "아시아나",
  ],
  [CATEGORY_CODE.LODGING]: [
    "호텔",
    "숙소",
    "숙박",
    "게스트하우스",
    "료칸",
    "민박",
    "리조트",
    "조식",
    "hotel",
    "hostel",
    "inn",
    "booking",
    "agoda",
    "airbnb",
    "expedia",
    "resort",
  ],
  [CATEGORY_CODE.FOOD]: [
    "식당",
    "식비",
    "맛집",
    "카페",
    "커피",
    "베이커리",
    "디저트",
    "술집",
    "이자카야",
    "라멘",
    "스시",
    "초밥",
    "오마카세",
    "편의점",
    "야식",
    "cafe",
    "coffee",
    "restaurant",
    "bar",
    "ramen",
    "sushi",
    "burger",
    "starbucks",
    "mcdonald",
    "lawson",
    "seven",
    "7-eleven",
    "familymart",
  ],
  [CATEGORY_CODE.TRANSPORT]: [
    "교통",
    "지하철",
    "전철",
    "버스",
    "택시",
    "기차",
    "철도",
    "패스",
    "충전",
    "렌터카",
    "주유",
    "metro",
    "subway",
    "transit",
    "railway",
    "train",
    "taxi",
    "uber",
    "grab",
    "suica",
    "pasmo",
    "icoca",
    "jr",
  ],
  [CATEGORY_CODE.ACTIVITY]: [
    "입장",
    "티켓",
    "투어",
    "체험",
    "박물관",
    "미술관",
    "공원",
    "온천",
    "액티비티",
    "전망대",
    "수족관",
    "ticket",
    "tour",
    "museum",
    "park",
    "disney",
    "universal",
    "aquarium",
    "klook",
    "kkday",
  ],
  [CATEGORY_CODE.SHOPPING]: [
    "쇼핑",
    "기념품",
    "면세",
    "드럭스토어",
    "백화점",
    "마트",
    "의류",
    "shopping",
    "store",
    "mart",
    "duty free",
    "donki",
    "don quijote",
    "uniqlo",
    "muji",
    "bic camera",
    "yodobashi",
    "loft",
  ],
  [CATEGORY_CODE.INSURANCE]: ["보험", "여행자보험", "insurance"],
  [CATEGORY_CODE.CONTINGENCY]: [
    "예비비",
    "비상",
    "병원",
    "약국",
    "기타",
    "hospital",
    "pharmacy",
    "clinic",
  ],
};

/** 낱말이 길수록 더 확실한 단서다. 'jr' 이 우연히 걸리는 것보다 '제주항공' 이 낫다 */
function confidenceFor(keyword: string): number {
  if (keyword.length >= 6) return 85;
  if (keyword.length >= 4) return 75;
  return 60;
}

/**
 * 거래명으로 카테고리를 추측한다. 못 맞히면 null.
 *
 * ⚠️ 가장 **긴** 단서를 채택한다. 'air' 와 '제주항공' 이 둘 다 걸리면
 *    긴 쪽이 더 구체적이다.
 */
export function classifyByName(name: string): ClassifyResult | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;

  let best: { code: CategoryCode; keyword: string } | null = null;

  for (const [code, keywords] of Object.entries(KEYWORDS) as [
    CategoryCode,
    string[],
  ][]) {
    for (const keyword of keywords) {
      if (!target.includes(keyword)) continue;
      if (!best || keyword.length > best.keyword.length) {
        best = { code, keyword };
      }
    }
  }

  if (!best) return null;
  return { categoryCode: best.code, confidence: confidenceFor(best.keyword) };
}

/**
 * 바깥(Edge Function)에서 온 분류를 걸러 낸다.
 *
 * ⚠️ AI 응답을 그대로 믿지 않는다. (CLAUDE.md 10장)
 *    우리가 아는 카테고리 코드가 아니거나 확신이 범위를 벗어나면 버린다.
 *    버리면 호출부가 카탈로그로 되돌아간다.
 */
export function sanitizeClassification(raw: unknown): ClassifyResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  const code = candidate.categoryCode;
  if (typeof code !== "string") return null;
  const known = (Object.values(CATEGORY_CODE) as string[]).includes(code);
  if (!known) return null;

  const confidence =
    typeof candidate.confidence === "number"
      ? Math.round(candidate.confidence)
      : 0;
  if (confidence <= 0 || confidence > 100) return null;

  return { categoryCode: code as CategoryCode, confidence };
}
