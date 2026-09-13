// ============================================================================
// 여행 취소(CXL) 화면이 화면 파일에서 받는 데이터 모양.
//
// ⚠️ 이 폴더의 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md §9)
//
// ⚠️ 여행장은 **Leader** 로 쓴다. owner 는 이미 세 뜻으로 쓰이고 있다.
//    (trips.owner_user_id 개인 여행 주인 / group_members.role 모임장 / 여행장)
//    다만 취소는 **여행장 전용이 아니다.** ACTIVE 멤버 누구나 요청한다.
//    (POL-CXL-060) 화면에도 여행장 여부로 가르는 곳이 거의 없다.
// ============================================================================

/**
 * 취소 사유 4개. (POL-CXL-026 ~ 029)
 *
 * ⚠️ **DB CHECK 를 걸지 않는다.** 앱 상수라 문구가 바뀔 수 있고, DB 에 박으면
 *    문구 하나 고칠 때마다 마이그레이션이 필요해진다. 실제로 마이그레이션
 *    20260910000002 의 cancel_reason 주석도 같은 이유를 적어 뒀다.
 *
 * ⚠️ **항목을 늘리지 않는다.** 넣을 기준은 "우리가 그 신호를 받아 개선할 수
 *    있는가" 다. 개인 사정·일정 문제처럼 손댈 수 없는 사유는 OTHER 로 흡수한다.
 *    PLAN_CHANGED 는 BUDGET-02 가 지원하는 기능과 겹쳐 스펙에서 삭제됐다.
 *
 * ⚠️ [옮길 것] 원칙대로면 lib/constants/status.ts 에 있어야 한다. (CLAUDE.md §6)
 *    그 파일은 **공유 파일**이라 임의로 못 고친다. 서비스 함수를 붙일 때
 *    사람에게 요청해 옮긴다. 그때까지 이 폴더 밖에서 이 값을 쓰지 않는다.
 */
export const CANCEL_REASON = {
  DESTINATION_CHANGED: "DESTINATION_CHANGED",
  COMPANION_FELL_THROUGH: "COMPANION_FELL_THROUGH",
  FUND_SHORTAGE: "FUND_SHORTAGE",
  OTHER: "OTHER",
} as const;
export type CancelReasonCode = (typeof CANCEL_REASON)[keyof typeof CANCEL_REASON];

/** 화면에 보이는 말. 순서가 곧 목록 순서다 */
export const CANCEL_REASON_LABEL: Record<CancelReasonCode, string> = {
  [CANCEL_REASON.DESTINATION_CHANGED]: "여행지를 바꿨어요",
  [CANCEL_REASON.COMPANION_FELL_THROUGH]: "함께 가기로 한 사람과 무산됐어요",
  [CANCEL_REASON.FUND_SHORTAGE]: "여행 자금이 부족해요",
  [CANCEL_REASON.OTHER]: "기타",
};

export const CANCEL_REASON_ORDER: CancelReasonCode[] = [
  CANCEL_REASON.DESTINATION_CHANGED,
  CANCEL_REASON.COMPANION_FELL_THROUGH,
  CANCEL_REASON.FUND_SHORTAGE,
  CANCEL_REASON.OTHER,
];

/**
 * 자금 관리 방식. 남은 금액 계산식이 방식마다 다르다. (POL-CXL-015)
 *
 *   ACCOUNT   현재 잔액을 그대로 쓴다. 이미 지출이 빠진 값이라 또 빼면 이중 차감
 *   MANUAL    누적 모금액 − 실제 지출
 *   ZERO      표시하지 않는다
 */
export type CancelFundType = "ACCOUNT" | "MANUAL" | "ZERO";

/**
 * CXL-03 · TRIP-HOME-03 이 쓰는 자금 요약.
 *
 * ⚠️ 화면이 계산하지 않는다. **화면 파일이 계산해서 넘긴다.**
 *    같은 값을 두 화면이 각자 계산하면 기준이 갈라진다.
 *
 * ⚠️ 환불 예정액은 없다. 취소 시점에 관측할 수 없는 값이다. (POL-CXL-016)
 *    대신 화면이 "지금 기준 금액이에요" 를 붙인다.
 */
export type CancelFundSummary = {
  fundType: CancelFundType;
  /** 남은 금액. 표시용 문자열로 넘긴다 (금액 포맷은 화면 파일이 정한다) */
  remainingLabel: string;
  /** 금액 위에 붙는 설명. 예) "카카오뱅크 ****1234에 남은 돈" */
  label: string;
  /**
   * 1인당 분배 금액. headcount <= 1 이면 null 이라 분배 줄을 그리지 않는다.
   * (POL-CXL-017)
   */
  perPersonLabel: string | null;
  headcount: number;
};

/** 동의 현황의 멤버 한 명 (CXL-07) */
export type VoteItem = {
  userId: string;
  name: string;
  /** null 이면 아직 안 골랐다 */
  vote: "AGREE" | "DISAGREE" | null;
  /** 표시용 일시. 아직 안 골랐으면 null */
  votedAtLabel: string | null;
};

/** CXL-05 되돌리기 확인에 붙는 계좌 변동 한 건 */
export type CancelChangeItem = {
  id: string;
  /** 표시용 날짜. 예) "9월 8일" */
  dateLabel: string;
  name: string;
  /** 부호 있는 원 단위 정수. 입금 +, 출금 − */
  amount: number;
};
