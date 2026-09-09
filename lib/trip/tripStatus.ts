// 여행이 끝났는가. ENDED · SETTLED 면 끝난 여행이다.
//
// 헤더의 여행 홈 버튼(TripHomeButton)이 그림을 고르는 데 쓴다. 준비 중이면
// 비행기, 끝났으면 영수증. 화면마다 status 비교를 따로 쓰면 기준이 갈린다.
import { TRIP_STATUS } from "@/lib/constants/status";

export function isTripEnded(status: string | null | undefined): boolean {
  return status === TRIP_STATUS.ENDED || status === TRIP_STATUS.SETTLED;
}
