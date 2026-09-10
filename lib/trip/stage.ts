// ============================================================================
// 여행 단계 — 화면이 무엇을 보여줄지 정하는 단 하나의 기준
//
// ⚠️ 왜 필요한가.
//    지금까지는 "기간이 끝났으면 ENDED, 확정했으면 SETTLED" 두 갈래뿐이라,
//    계획도 지출도 없는 여행과 지출 27건을 다 정리한 여행이 **같은 화면**을
//    봤다. 그래서 실제 지출이 0원인 여행에 정산을 들이밀고, 절약했다고
//    말하는 일이 생겼다.
//
// ⚠️ DB status 를 늘리지 않는다. trips.status 는 시간의 흐름(PLANNING →
//    TRAVELING → ENDED → SETTLED)만 담고, "계획이 있는가 · 지출이 있는가"
//    같은 **내용**은 여기서 판정한다. 내용은 사용자가 언제든 바꾸는 값이라
//    상태로 굳히면 매번 UPDATE 를 쏴야 하고, 그 UPDATE 가 실패하면 화면이
//    실제 데이터와 어긋난다.
//
// ⚠️ 순수 함수다. DB 도 네트워크도 타지 않는다.
// ============================================================================
import { TRIP_STATUS, type TripStatus } from "@/lib/constants/status";

export const TRIP_STAGE = {
  /** 1. 여행만 만들고 예산·계획이 아직 없다 */
  PREPARING: "PREPARING",
  /** 2. 예산이나 계획을 세우는 중 */
  PLANNING: "PLANNING",
  /** 3. 여행 기간 안 */
  TRAVELING: "TRAVELING",
  /** 4. 기간이 끝났는데 계획도 지출도 없다 */
  NO_RECORD: "NO_RECORD",
  /** 5. 계획은 있는데 지출이 하나도 없다 */
  NO_EXPENSE: "NO_EXPENSE",
  /** 6. 지출은 있는데 아직 확정하지 않았다 */
  SETTLING: "SETTLING",
  /** 7. 정산까지 끝났다 */
  DONE: "DONE",
  /**
   * 8. 전원 동의로 취소됐다. 기간·내용과 무관하게 이 단계다.
   *    여행 홈은 '취소된 여행 · 되돌리기' 만 보여준다. [팀원 개발 예정]
   */
  CANCELED: "CANCELED",
} as const;
export type TripStage = (typeof TRIP_STAGE)[keyof typeof TRIP_STAGE];

export type StageInput = {
  status: TripStatus;
  /** 예산을 정했거나 세부 계획을 하나라도 만들었는가 */
  hasPlan: boolean;
  /** 기록된 거래가 하나라도 있는가 */
  hasExpense: boolean;
};

/**
 * 화면 라벨. **사용자에게 보이는 말**이라 도메인 용어를 그대로 쓰지 않는다.
 * (`ENDED` 를 '종료' 라고만 하면 무엇을 해야 하는지 알 수 없다)
 */
export const TRIP_STAGE_LABEL: Record<TripStage, string> = {
  [TRIP_STAGE.PREPARING]: "여행 준비 중",
  [TRIP_STAGE.PLANNING]: "여행 계획 중",
  [TRIP_STAGE.TRAVELING]: "여행 중",
  [TRIP_STAGE.NO_RECORD]: "기록 없이 종료",
  [TRIP_STAGE.NO_EXPENSE]: "지출 입력 전",
  [TRIP_STAGE.SETTLING]: "정산 대기 중",
  [TRIP_STAGE.DONE]: "여행 종료",
  [TRIP_STAGE.CANCELED]: "취소된 여행",
};

/**
 * 단계를 정한다.
 *
 * ⚠️ 순서가 곧 규칙이다. 확정이 가장 세고, 그다음이 기간, 마지막이 내용이다.
 *    확정한 여행은 지출을 지워도 DONE 이어야 한다 — 확정은 그 시점의
 *    기록이고, 뒤에서 내용이 바뀌어도 되돌아가지 않는다.
 */
export function tripStage({
  status,
  hasPlan,
  hasExpense,
}: StageInput): TripStage {
  // 취소가 가장 세다. 확정된 여행은 취소할 수 없으니 SETTLED 와는 겹치지 않는다.
  if (status === TRIP_STATUS.CANCELED) return TRIP_STAGE.CANCELED;
  if (status === TRIP_STATUS.SETTLED) return TRIP_STAGE.DONE;

  if (status === TRIP_STATUS.ENDED) {
    if (hasExpense) return TRIP_STAGE.SETTLING;
    return hasPlan ? TRIP_STAGE.NO_EXPENSE : TRIP_STAGE.NO_RECORD;
  }

  if (status === TRIP_STATUS.TRAVELING) return TRIP_STAGE.TRAVELING;

  // 출발 전
  return hasPlan ? TRIP_STAGE.PLANNING : TRIP_STAGE.PREPARING;
}

/**
 * 준비가 끝난 뒤의 단계인가. TRIP-HOME-02 를 그릴지 정한다.
 *
 * ⚠️ CANCELED 를 포함한다. 빼면 취소된 여행이 **'준비 중' 화면(TRIP-HOME-01)**
 *    을 그린다. 취소했는데 예산을 계속 세우라고 권하는 화면이 나온다.
 *    (2026-09-10 · TRIP-HOME-03 을 붙이면서 확인)
 */
export function isAfterTrip(stage: TripStage): boolean {
  return (
    stage === TRIP_STAGE.NO_RECORD ||
    stage === TRIP_STAGE.NO_EXPENSE ||
    stage === TRIP_STAGE.SETTLING ||
    stage === TRIP_STAGE.DONE ||
    stage === TRIP_STAGE.CANCELED
  );
}
