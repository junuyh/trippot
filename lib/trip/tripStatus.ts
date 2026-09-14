// 여행이 끝났는가. ENDED · SETTLED 면 끝난 여행이다.
//
// 헤더의 여행 홈 버튼(TripHomeButton)이 그림을 고르는 데 쓴다. 준비 중이면
// 비행기, 끝났으면 영수증. 화면마다 status 비교를 따로 쓰면 기준이 갈린다.
import { TRIP_STATUS } from "@/lib/constants/status";

export function isTripEnded(status: string | null | undefined): boolean {
  return status === TRIP_STATUS.ENDED || status === TRIP_STATUS.SETTLED;
}

/**
 * 아직 떠나기 전인가. **`CANCEL_PENDING` 을 포함한다.**
 *
 * ⚠️⚠️ 취소 요청 중인 여행은 **준비 중인 여행이다.** (POL-CXL-006)
 *    한 명이 취소를 요청했다고 여행이 멈추지 않는다. 예산도 계획도 그대로
 *    고칠 수 있고, 목록에도 그대로 보여야 한다.
 *
 * ⚠️ 왜 이 함수가 생겼나 — 목록 화면들이 저마다 `status === PLANNING` 으로
 *    갈라 놓고 있었다. 그래서 CANCEL_PENDING 이 **어느 탭에도 들어가지 못하고
 *    사라졌다.** 홈에서도, 모임 상세에서도, 내 여행 목록에서도 안 보였다.
 *    그 결과 취소 요청을 받은 사람이 여행에 들어갈 길이 없어 **동의를 누를
 *    수가 없었다.** 취소 동의 기능 전체가 도달 불가능이었다.
 *    (2026-09-14 · 시뮬레이터 두 대로 확인)
 *
 * ⚠️ 그래서 화면마다 `|| CANCEL_PENDING` 을 덧붙이지 않고 이 함수 하나로
 *    모은다. 다섯 군데에 흩어 두면 여섯 번째가 또 빠진다.
 */
export function isTripBeforeDeparture(status: string | null | undefined): boolean {
  return (
    status === TRIP_STATUS.PLANNING || status === TRIP_STATUS.CANCEL_PENDING
  );
}

/**
 * 지금 준비하거나 다니고 있는 여행인가. (준비 중 · 취소 요청 중 · 여행 중)
 *
 * 연결 계좌의 'N개 여행에서 사용 중' 처럼 **끝나지 않은 여행 전부**를 셀 때 쓴다.
 */
export function isTripOngoing(status: string | null | undefined): boolean {
  return isTripBeforeDeparture(status) || status === TRIP_STATUS.TRAVELING;
}
