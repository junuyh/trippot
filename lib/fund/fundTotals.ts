// ============================================================================
// 여행자금 합계 — 화면이 공유하는 단 하나의 계산식
//
// ⚠️⚠️ 왜 이 파일이 생겼나 (2026-09-21 테스트) ⚠️⚠️
//
//    같은 여행을 두 화면이 서로 다른 숫자로 말하고 있었다.
//
//      여행 홈(TRIP-HOME)  입금합계 > 0 ? 입금합계 : 등록금액
//      여행자금(FUND-01)    등록금액 + 입금합계
//
//    등록금액 80만 · 입금 200만 인 여행에서 홈은 200만, 자금 화면은 280만을
//    띄웠다. 등록금액이 홈에서만 통째로 사라진 것이다. 테스터는 "여행 홈은
//    200만인데 실제 모인 금액은 다르다" 고 적었다.
//
//    금액 판정을 화면마다 쓰면 여섯 번째 화면에서 또 갈린다. 상태 판정을
//    lib/trip/tripStatus.ts 한 곳에 모은 것과 같은 이유다. (CLAUDE.md 7장)
//
// ⚠️ 누적 모금액과 잔액을 혼용하지 않는다. (IA v2 §2-4-1)
//    모은 금액은 결제로 줄지 않는다. 줄어드는 것은 잔액이다.
//    여행 준비 진행률은 **모은 금액** 기준이다. 항공권을 샀다고 준비가
//    뒤로 가면 안 된다.
//
// ⚠️ 정수 원 단위다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
// ============================================================================

export type FundTotalsInput = {
  /**
   * fund_sources.current_amount — 여행을 만들 때 적은 모음 금액(수기) 또는
   * 연결 계좌 잔액. 거래가 쌓여도 이 값은 변하지 않는다.
   */
  registeredAmount: number;
  /** 입금 거래 합계 */
  depositTotal: number;
  /** 출금 거래 합계 */
  withdrawalTotal?: number;
};

/**
 * 누적 모금액 — 지금까지 확보한 총 여행자금.
 *
 * ⚠️ 등록금액과 입금 거래를 **더한다.** 둘 중 하나를 고르지 않는다.
 *    수기 입력 여행의 등록금액은 거래로 남지 않아서, 입금합계만 보면
 *    그 돈이 통째로 사라진다.
 *
 * ⚠️ FUND-02(계좌 연결·재동기화)를 붙이면 이 전제가 깨진다. 계좌 잔액으로
 *    덮어쓰면 지출한 만큼 줄어든 값이 registeredAmount 로 들어온다.
 *    그때는 누적 모금액을 따로 보관해야 한다. (docs/README.md §5)
 */
export function raisedTotal(input: FundTotalsInput): number {
  return input.registeredAmount + input.depositTotal;
}

/** 현재 잔액 = 누적 모금액 − 출금 합계. 결제로 줄어드는 쪽이다. */
export function currentBalance(input: FundTotalsInput): number {
  return raisedTotal(input) - (input.withdrawalTotal ?? 0);
}

/**
 * 목표까지 앞으로 더 모아야 하는 금액. 0 아래로 내려가지 않는다.
 * 목표를 넘겼으면 0이다.
 */
export function remainingToTarget(
  input: FundTotalsInput & { targetAmount: number },
): number {
  return Math.max(0, input.targetAmount - raisedTotal(input));
}

/** 목표 달성률(%). 100을 넘기지 않는다 — 비행기가 도착지를 지나치면 안 된다. */
export function fundProgressPercent(
  input: FundTotalsInput & { targetAmount: number },
): number {
  if (input.targetAmount <= 0) return 0;
  return Math.min(100, (raisedTotal(input) / input.targetAmount) * 100);
}
