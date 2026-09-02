// ============================================================================
// 이번 여행의 한 줄 기록 — 결산 결과를 문장으로 부른다 (TRIP-HOME-02)
//
// ⚠️ 순수 계산이다. DB 도 네트워크도 타지 않는다.
//
// ⚠️ AI 를 쓰지 않는다. 결산 화면의 문장은 숫자와 어긋나면 안 되는데,
//    같은 데이터로 매번 다른 문장이 나오면 사용자가 어느 쪽을 믿어야 할지
//    모른다. 유형 산출(travelType.ts)과 같은 이유다.
//
// ⚠️ 문구를 고정하지 않는다. 하드코딩하면 모든 여행이 같은 말을 한다.
//    가장 크게 초과·절약한 카테고리에서 만든다.
// ============================================================================
import {
  CATEGORY_CODE,
  CATEGORY_CODE_LABEL,
  type CategoryCode,
} from "@/lib/constants/status";

export type RecordInput = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
};

export type TripRecord = {
  /** 두 줄로 끊어 쓰는 제목 */
  headline: string;
  description: string;
  /** 가장 많이 쓴 카테고리 이름. 없으면 null */
  topSpentLabel: string | null;
  /** 가장 많이 아낀 카테고리 이름. 없으면 null */
  topSavedLabel: string | null;
  hashtags: string[];
};

/** 카테고리별로 '더 썼을 때' 를 부르는 말. 초과가 곧 취향인 카테고리들이다 */
const OVER_PHRASE: Partial<Record<CategoryCode, string>> = {
  [CATEGORY_CODE.FOOD]: "맛있게 즐기고",
  [CATEGORY_CODE.LODGING]: "잘 쉬고",
  [CATEGORY_CODE.ACTIVITY]: "실컷 놀고",
  [CATEGORY_CODE.SHOPPING]: "살 건 사고",
  [CATEGORY_CODE.TRANSPORT]: "편하게 다니고",
  [CATEGORY_CODE.AIRFARE]: "가는 길은 넉넉하게",
};

/** '아꼈을 때' 를 부르는 말 */
const SAVE_PHRASE: Partial<Record<CategoryCode, string>> = {
  [CATEGORY_CODE.FOOD]: "식비는 야무지게",
  [CATEGORY_CODE.LODGING]: "숙소는 알뜰하게",
  [CATEGORY_CODE.ACTIVITY]: "놀거리는 골라서",
  [CATEGORY_CODE.SHOPPING]: "쇼핑은 야무지게",
  [CATEGORY_CODE.TRANSPORT]: "이동은 알뜰하게",
  [CATEGORY_CODE.AIRFARE]: "항공은 아껴서",
};

const HASHTAG: Partial<Record<CategoryCode, string>> = {
  [CATEGORY_CODE.FOOD]: "#먹는데진심",
  [CATEGORY_CODE.LODGING]: "#숙소가반",
  [CATEGORY_CODE.ACTIVITY]: "#경험에투자",
  [CATEGORY_CODE.SHOPPING]: "#캐리어무게",
  [CATEGORY_CODE.TRANSPORT]: "#교통절약",
  [CATEGORY_CODE.AIRFARE]: "#항공권득템",
};

/**
 * 결산 결과에서 한 줄 기록을 만든다.
 *
 * ⚠️ 보험·예비비는 문장에 쓰지 않는다. 보험은 고정비고, 예비비를 많이 쓴 건
 *    취향이 아니라 사고에 가깝다. (travelType.ts 와 같은 기준)
 */
export function buildTripRecord(inputs: RecordInput[]): TripRecord {
  const usable = inputs.filter(
    (row) =>
      row.plannedAmount > 0 &&
      row.categoryCode !== CATEGORY_CODE.INSURANCE &&
      row.categoryCode !== CATEGORY_CODE.CONTINGENCY,
  );

  const plannedTotal = usable.reduce((sum, row) => sum + row.plannedAmount, 0);
  const actualTotal = usable.reduce((sum, row) => sum + row.actualAmount, 0);

  const diffs = usable.map((row) => ({
    categoryCode: row.categoryCode,
    diff: row.actualAmount - row.plannedAmount,
    actual: row.actualAmount,
  }));

  // ⚠️ 금액 기준이다. 비율로 고르면 작은 카테고리의 큰 퍼센트가 이긴다.
  const over = [...diffs].sort((a, b) => b.diff - a.diff)[0];
  const saved = [...diffs].sort((a, b) => a.diff - b.diff)[0];
  const spent = [...diffs].sort((a, b) => b.actual - a.actual)[0];

  const overPart =
    over && over.diff > 0 ? OVER_PHRASE[over.categoryCode] : null;
  const savePart =
    saved && saved.diff < 0 ? SAVE_PHRASE[saved.categoryCode] : null;

  // 초과도 절약도 뚜렷하지 않으면 계획대로 다녀온 여행이다.
  const headline =
    overPart && savePart
      ? `${overPart},\n${savePart}`
      : overPart
        ? `${overPart}\n계획은 지키고`
        : savePart
          ? `${savePart}\n남는 건 챙기고`
          : "계획한 대로\n다녀왔어요";

  const description =
    overPart && savePart
      ? `${CATEGORY_CODE_LABEL[over.categoryCode]}에는 아낌없이 썼지만 ${CATEGORY_CODE_LABEL[saved.categoryCode]}에서 균형 있게 절약했어요.`
      : plannedTotal > 0 && actualTotal <= plannedTotal
        ? "큰 초과 없이 계획한 예산 안에서 다녀왔어요."
        : "계획과 크게 다르지 않게 다녀왔어요.";

  const hashtags = [
    overPart ? HASHTAG[over.categoryCode] : null,
    savePart ? HASHTAG[saved.categoryCode] : null,
    plannedTotal > 0 && actualTotal <= plannedTotal
      ? "#예산초과없음"
      : "#다음엔조금더",
  ].filter((tag): tag is string => Boolean(tag));

  return {
    headline,
    description,
    topSpentLabel: spent ? CATEGORY_CODE_LABEL[spent.categoryCode] : null,
    topSavedLabel:
      saved && saved.diff < 0 ? CATEGORY_CODE_LABEL[saved.categoryCode] : null,
    hashtags,
  };
}
