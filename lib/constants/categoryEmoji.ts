// 카테고리 아이콘.
//
// TRIP-HOME 금고 · BUDGET-01 목록 · BUDGET-02 분석 시트가 같은 그림을 쓴다.
// 화면마다 따로 두면 하나만 고쳤을 때 같은 카테고리가 다른 아이콘으로 보인다.
//
// ⚠️ 아이콘 뒤에 카테고리별 컬러 배경을 깔지 않는다. (BUDGET-01/02 스펙)
//    포인트 컬러는 국가 테마 하나만 쓴다.
import { CATEGORY_CODE, type CategoryCode } from '@/lib/constants/status';

export const CATEGORY_EMOJI: Record<CategoryCode, string> = {
  [CATEGORY_CODE.AIRFARE]: '✈️',
  [CATEGORY_CODE.LODGING]: '🏨',
  [CATEGORY_CODE.FOOD]: '🍽️',
  [CATEGORY_CODE.TRANSPORT]: '🚇',
  [CATEGORY_CODE.ACTIVITY]: '🎡',
  [CATEGORY_CODE.SHOPPING]: '🛍️',
  [CATEGORY_CODE.INSURANCE]: '🛡️',
  [CATEGORY_CODE.CONTINGENCY]: '💰',
};
