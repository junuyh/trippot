// ============================================================================
// 여행지 상세(DEST-01)의 '여행비 가이드' 계산 (2026-09-11)
//
// ⚠️⚠️ **여행 만들기가 쓰는 계산을 그대로 쓴다.** ⚠️⚠️
//    buildBudgetRecommendation — TRIP-03(예산 만들기)이 부르는 바로 그 함수다.
//    여기서 따로 계산하지 않는다. 따로 계산하면 여행지 상세에서 본 금액과
//    여행을 만들었을 때 나오는 금액이 달라진다. 사용자는 같은 서비스가 두 가지
//    금액을 말하는 것으로 받아들인다.
//
// **범위는 어디서 나오는가 — 지어낸 폭이 아니다.**
//    같은 함수를 여행 스타일만 바꿔 세 번 부른다.
//      아끼는 편(budget)   → 범위의 아래끝
//      보통(standard)      → 그래프 길이의 기준
//      넉넉한 편(comfort)  → 범위의 위끝
//    그래서 사용자가 여행을 만들 때 **어떤 스타일을 고르든 그 결과가 이 범위
//    안에 들어온다.** 범위를 임의로 ±N% 벌리면 이 보장이 깨진다.
//
// ⚠️ 그래도 **확정 금액이 아니다.** 실제 예산은 날짜·인원·상품 선택까지 반영해
//    BUDGET-01/02 에서 정해지고, 사용자가 직접 고친다. 그래서 화면은
//      · 하나의 금액이 아니라 **범위**로 보여주고
//      · '여행 시기, 인원, 여행 스타일에 따라 달라질 수 있어요' 를 함께 쓴다
//    (components/destination/BudgetGuideSection)
//
// ⚠️ 이 함수는 어떤 값도 DB 에 쓰지 않는다. planned_amount 를 만들지 않는다.
//    추천이 사용자 대신 확정하지 않는다. (CLAUDE.md 3장·4장)
//
// ⚠️ 금액은 전부 원 단위 정수다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { addDays, format } from 'date-fns';

import { buildBudgetRecommendation, perPerson } from '@/lib/budget/recommendation';
import type { DestinationCode } from '@/lib/constants/destinations';
import { CATEGORY_CODE, TRAVEL_STYLE, type CategoryCode } from '@/lib/constants/status';

export type BudgetRange = {
  /** 원 단위 정수. */
  min: number;
  max: number;
};

export type BudgetGuideRow = {
  /** 목록 key. 보험·예비비를 한 줄로 합친 행은 'INSURANCE_CONTINGENCY' 다. */
  key: string;
  label: string;
  /** 1인 기준 범위. */
  range: BudgetRange;
  /**
   * 가로 그래프 길이. 보통(standard) 기준으로 가장 큰 항목을 1 로 둔 비율이다.
   * 컴포넌트가 금액을 다시 계산하지 않게 여기서 만든다. (CLAUDE.md 9장)
   */
  ratio: number;
};

export type DestinationBudgetGuide = {
  /** 1인 기준 총액 범위. */
  perPerson: BudgetRange;
  /** 인원까지 반영한 총액 범위. */
  total: BudgetRange;
  /** 항목별 1인 기준 범위. 보통 기준 금액이 큰 항목부터다. */
  rows: BudgetGuideRow[];
  nights: number;
  days: number;
  headcount: number;
  /** 기준 데이터 갱신 시점. '2026년 8월 기준' 으로 표시한다. (NFR-004) */
  updatedAt: string;
};

/**
 * 한 줄로 합쳐 보여줄 카테고리.
 *
 * ⚠️ 보험과 예비비는 둘 다 '여행 자체에 드는 돈' 이 아니라 대비하는 돈이고,
 *    따로 두면 금액이 작아 그래프 두 줄이 다 바닥에 깔린다.
 *    **DB 카테고리는 그대로 둘이다.** 합치는 것은 이 화면의 표시 방식이다.
 */
const MERGED_KEY = 'INSURANCE_CONTINGENCY';

/** 화면에 쓰는 항목 이름. CATEGORY_CODE_LABEL 과 달리 참고 이미지 표기를 따른다. */
const ROW_LABEL: Record<string, string> = {
  [CATEGORY_CODE.AIRFARE]: '항공',
  [CATEGORY_CODE.LODGING]: '숙박',
  [CATEGORY_CODE.FOOD]: '식비',
  [CATEGORY_CODE.TRANSPORT]: '교통',
  [CATEGORY_CODE.ACTIVITY]: '관광·입장권',
  [CATEGORY_CODE.SHOPPING]: '쇼핑',
  [MERGED_KEY]: '여행자보험/예비비',
};

/** 합쳐서 보여줄 카테고리인가. */
function mergedKeyOf(code: CategoryCode): string {
  return code === CATEGORY_CODE.INSURANCE || code === CATEGORY_CODE.CONTINGENCY
    ? MERGED_KEY
    : code;
}

/** 카테고리별 금액을 표시용 key 로 합산한다. */
function sumByRow(categories: { categoryCode: CategoryCode; recommendedAmount: number }[]) {
  const map = new Map<string, number>();
  for (const category of categories) {
    const key = mergedKeyOf(category.categoryCode);
    map.set(key, (map.get(key) ?? 0) + category.recommendedAmount);
  }
  return map;
}

/**
 * 여행지 참고 예산.
 *
 * @param nights   묵는 밤 수. 일수는 밤 + 1 이다.
 * @param headcount 함께 가는 인원.
 */
export function destinationBudgetGuide(
  code: DestinationCode,
  nights: number,
  headcount = 1,
): DestinationBudgetGuide {
  /**
   * 날짜.
   *
   * ⚠️ 여행지 상세에는 날짜가 없다. 그런데 buildBudgetRecommendation 은 날짜로
   *    박수를 센다. 그래서 오늘부터 nights 박을 **계산용으로만** 만든다.
   *    MVP 기준 데이터는 연중 평균 한 벌이라 어떤 날짜를 넣어도 값이 같다.
   *    [Future] 시즌별 기준값이 생기면 이 자리에서 시기를 받아야 한다.
   */
  const today = new Date();
  const startDate = format(today, 'yyyy-MM-dd');
  const endDate = format(addDays(today, nights), 'yyyy-MM-dd');

  const common = {
    destinationCode: code,
    region: null,
    destinationName: '',
    startDate,
    endDate,
    headcount,
  } as const;

  // 같은 함수를 스타일만 바꿔 세 번 부른다. 위 머리말 참조.
  const low = buildBudgetRecommendation({ ...common, travelStyle: TRAVEL_STYLE.BUDGET });
  const mid = buildBudgetRecommendation({ ...common, travelStyle: TRAVEL_STYLE.STANDARD });
  const high = buildBudgetRecommendation({ ...common, travelStyle: TRAVEL_STYLE.COMFORT });

  const lowRows = sumByRow(low.categories);
  const midRows = sumByRow(mid.categories);
  const highRows = sumByRow(high.categories);

  const largest = Math.max(...midRows.values());

  const rows: BudgetGuideRow[] = [...midRows.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, midAmount]) => ({
      key,
      label: ROW_LABEL[key] ?? key,
      // 항목 범위도 1인 기준으로 환산해서 보여준다. 표는 '1인 기준' 이라고 적는다.
      range: {
        min: perPerson(lowRows.get(key) ?? 0, headcount),
        max: perPerson(highRows.get(key) ?? 0, headcount),
      },
      ratio: largest > 0 ? midAmount / largest : 0,
    }));

  return {
    perPerson: {
      min: low.perPersonAmount,
      max: high.perPersonAmount,
    },
    total: {
      min: low.totalAmount,
      max: high.totalAmount,
    },
    rows,
    nights: mid.nights,
    days: mid.days,
    headcount,
    updatedAt: mid.updatedAt,
  };
}

/**
 * 만원 단위로 읽는 금액. '75만', '1,050만'.
 *
 * ⚠️ 아래끝은 내리고 위끝은 올려서 실제 값이 표시 범위 밖으로 나가지 않게 한다.
 *    반올림하면 '약 95만원' 인데 실제 계산이 954,000 이 되는 일이 생긴다.
 */
export function toManwonFloor(amount: number): string {
  return `${Math.floor(amount / 10_000).toLocaleString('ko-KR')}만`;
}

export function toManwonCeil(amount: number): string {
  return `${Math.ceil(amount / 10_000).toLocaleString('ko-KR')}만`;
}

/**
 * '75만~95만원' — 좁은 칸용. '약' 과 공백을 뺀다.
 *
 * ⚠️ 항목별 표와 값 세 칸은 폭이 좁아서 '약 15만 ~ 25만원' 이 들어가지 않는다.
 *    글자가 잘리느니 '약' 을 뺀다. 그 자리 제목이 이미 '평균 예산' 이라고
 *    말하고 있어 '약' 이 없다고 확정 금액으로 읽히지 않는다.
 */
export function formatRangeCompact(range: BudgetRange): string {
  return `${toManwonFloor(range.min)}~${toManwonCeil(range.max)}원`;
}

/** '약 75만 ~ 95만원' 한 덩어리로 만든다. */
export function formatRange(range: BudgetRange): string {
  return `약 ${toManwonFloor(range.min)} ~ ${toManwonCeil(range.max)}원`;
}
