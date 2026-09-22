// ============================================================================
// 지출 ↔ 세부 계획 이름 맞대보기
//
// ⚠️ 왜 필요한가 (2026-09-21 테스트)
//    예산 계획에 '편의점' 이라 적어 두고, 지출은 '세븐일레븐' 으로 들어온다.
//    사람 눈에는 같은 것인데 목록은 그냥 이름순이라 매번 찾아 눌러야 했다.
//    "예산 항목이 편의점일 경우 지출 내역이 세븐일레븐이면 자동으로
//    매칭되었으면 좋겠음" 으로 올라왔다.
//
// ⚠️ 자동 연결은 **이름이 사실상 같을 때만** 한다. (2026-09-22 결정)
//    "지출 이름이 세부 계획 이름과 95% 이상 동일하면 자동 연결(해제 가능),
//     그 외는 추천 표시" — isNearIdenticalPlanName / findNearIdenticalPlan.
//    동의어('편의점' ↔ '세븐일레븐')나 포함('편의점' ↔ '편의점 간식')은
//    여전히 점수만 매겨 목록 맨 위에 '추천' 으로 올린다. 연결은 사용자가 누른다.
//    잘못 붙은 연결은 그 계획의 실제 금액을 통째로 틀리게 만드는데, 사용자는
//    틀렸다는 것조차 알기 어렵다. (CLAUDE.md 3장 — 추천이 사용자 대신 확정하지 않는다)
//    자동으로 붙은 연결도 사용자가 언제든 풀 수 있어야 한다.
//
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다.
// ============================================================================

/**
 * 같은 것을 가리키는 말 묶음.
 *
 * 한 줄 안의 낱말은 서로 통한다. 계획 이름과 지출 이름이 **같은 줄**에
 * 걸리면 이어진 것으로 본다.
 *
 * ⚠️ 브랜드를 일반명사 쪽으로 모은다. 계획에는 일반명사('편의점'), 지출에는
 *    브랜드('세븐일레븐')가 들어오는 것이 보통이다.
 * ⚠️ 넓히지 않는다. '카페' 와 '식당' 을 한 줄에 두면 아침 커피가 저녁 예약
 *    식사 계획에 붙는다. 애매하면 줄을 나눈다.
 */
const SYNONYMS: string[][] = [
  ["편의점", "세븐일레븐", "세븐", "7-eleven", "seven eleven", "cu", "gs25", "이마트24", "패밀리마트", "family mart", "lawson", "로손", "미니스톱"],
  ["카페", "커피", "스타벅스", "starbucks", "블루보틀", "투썸", "이디야", "도토루", "커피빈", "cafe", "coffee"],
  ["마트", "슈퍼", "마켓", "이마트", "홈플러스", "코스트코", "돈키호테", "donki", "supermarket", "mart"],
  ["약국", "드럭스토어", "올리브영", "마쓰모토", "matsumoto", "pharmacy", "drug"],
  ["지하철", "전철", "메트로", "metro", "subway", "교통카드", "티머니", "옥토퍼스", "suica", "pasmo"],
  ["택시", "taxi", "우버", "uber", "그랩", "grab", "디디", "didi"],
  ["숙소", "호텔", "hotel", "게스트하우스", "hostel", "에어비앤비", "airbnb", "료칸", "민박"],
  ["항공", "비행기", "항공권", "flight", "air", "airline", "airways"],
  ["기념품", "선물", "souvenir", "gift"],
  ["입장료", "티켓", "입장권", "ticket", "admission", "패스", "pass"],
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/**
 * 계획 이름과 지출 이름이 얼마나 맞는가. 0이면 단서 없음, 클수록 확실하다.
 *
 *   3  한쪽 이름이 다른 쪽에 통째로 들어 있다 ('편의점' vs '편의점 간식')
 *   2  같은 뜻 묶음에 둘 다 걸렸다 ('편의점' vs '세븐일레븐')
 *   0  아무 단서도 없다
 */
export function planNameMatchScore(
  planName: string,
  expenseName: string | null,
): number {
  if (!expenseName) return 0;
  const plan = normalize(planName);
  const spend = normalize(expenseName);
  if (plan === "" || spend === "") return 0;

  if (plan.includes(spend) || spend.includes(plan)) return 3;

  for (const group of SYNONYMS) {
    const inPlan = group.some((word) => plan.includes(normalize(word)));
    const inSpend = group.some((word) => spend.includes(normalize(word)));
    if (inPlan && inSpend) return 2;
  }

  return 0;
}

/**
 * 연결 시트에 낼 순서. 맞을 법한 것을 위로 올린다.
 *
 * ⚠️ 원래 순서(sort_order)를 잃지 않는다. 점수가 같으면 받은 순서 그대로다.
 *    사용자가 예산 화면에서 본 차례와 어긋나면 찾기가 더 어려워진다.
 */
export function sortPlansByMatch<T extends { name: string }>(
  plans: T[],
  expenseName: string | null,
): { plan: T; score: number }[] {
  return plans
    .map((plan, index) => ({
      plan,
      score: planNameMatchScore(plan.name, expenseName),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ plan, score }) => ({ plan, score }));
}

// ── 사실상 같은 이름 ─────────────────────────────────────────────────────────

/** 자동 연결 기준. 이 비율 이상 같으면 '사실상 같은 이름' 으로 본다 */
export const NEAR_IDENTICAL_RATIO = 0.95;

/**
 * 자동 연결용 정규화. 대소문자·공백에 더해 **문장부호까지** 지운다.
 * '스타벅스(신주쿠)' 와 '스타벅스 신주쿠' 는 같은 이름이다.
 *
 * ⚠️ planNameMatchScore 의 normalize 와 따로 둔다. 그쪽은 부분 포함을 보는
 *    자리라 부호를 남겨도 되지만, 여기는 글자 단위로 비교하므로 부호 하나가
 *    비율을 깎아 95% 아래로 떨어뜨린다.
 */
function normalizeStrict(value: string): string {
  // 공백 · ASCII 부호 · 자주 쓰는 한중일 부호(·、。「」『』（）)
  return value
    .toLowerCase()
    .replace(/[\s!-\/:-@\[-`{-~·・、。「」『』（）〈〉《》]/g, "");
}

/** 편집 거리. 짧은 이름끼리라 O(n·m) 이면 충분하다 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * 두 이름이 얼마나 같은가. 1이면 완전히 같고 0이면 전혀 다르다.
 * 비율 = 1 − 편집거리 / 긴 쪽 길이.
 */
export function planNameSimilarity(a: string, b: string): number {
  const x = normalizeStrict(a);
  const y = normalizeStrict(b);
  if (x === "" || y === "") return 0;
  if (x === y) return 1;
  const maxLen = Math.max(x.length, y.length);
  return 1 - levenshtein(x, y) / maxLen;
}

/**
 * 자동으로 붙여도 되는가. 정규화하면 같거나, 비율이 95% 이상이다.
 *
 * ⚠️ 두 글자짜리 이름은 한 글자만 달라도 50% 라 자동 연결되지 않는다.
 *    짧은 이름은 사실상 **완전히 같을 때만** 붙는다. 의도한 보수성이다.
 */
export function isNearIdenticalPlanName(
  planName: string,
  expenseName: string | null,
): boolean {
  if (!expenseName) return false;
  return planNameSimilarity(planName, expenseName) >= NEAR_IDENTICAL_RATIO;
}

/**
 * 자동 연결할 계획 하나를 고른다. 없거나 **여럿이 같은 비율로 맞으면 null.**
 *
 * ⚠️ 동점이면 붙이지 않는다. '편의점' 계획이 두 개인데 하나를 골라 붙이면
 *    사용자는 왜 저기 붙었는지 알 수 없다. 그때는 추천만 하고 사람이 고른다.
 */
export function findNearIdenticalPlan<T extends { name: string }>(
  plans: T[],
  expenseName: string | null,
): T | null {
  if (!expenseName) return null;
  let best: T | null = null;
  let bestRatio = 0;
  let tie = false;
  for (const plan of plans) {
    const ratio = planNameSimilarity(plan.name, expenseName);
    if (ratio < NEAR_IDENTICAL_RATIO) continue;
    if (ratio > bestRatio) {
      best = plan;
      bestRatio = ratio;
      tie = false;
    } else if (ratio === bestRatio) {
      tie = true;
    }
  }
  return tie ? null : best;
}
