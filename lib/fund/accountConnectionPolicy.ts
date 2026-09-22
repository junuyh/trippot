// ============================================================================
// 계좌 연결을 언제 끊는가 — 한 곳에서만 정한다
//
//   결산 확정          → 그 자리에서 해제
//   결산을 안 하면      → 여행 종료 후 14일에 자동 해제
//
// ⚠️ 왜 이렇게 정했나 (2026-09-22)
//    계좌 연결의 목적은 여행 중 지출을 받아 **결산까지** 맞추는 것이다.
//    여행이 끝나도 목적은 안 끝난다. 해외 카드 결제는 승인 뒤 실제 매입이
//    며칠 늦게 들어오고, 결산 중에도 지출 기록을 열어 뒀다. 그래서 "종료 후
//    3일" 은 짧다.
//
//    실서비스 기준(오픈뱅킹 조회 동의·마이데이터 전송요구)은 최대 1년이지만,
//    개인정보보호법·신용정보법은 **목적을 이루면 지체 없이** 끊고 지우라고
//    한다. 결산 확정이 곧 목적 달성이라 그때 끊는다. 결산을 안 하는 사람을
//    위해 14일 뒤 자동 해제를 받침으로 둔다.
//
// ⚠️ 해제는 "새로 가져오지 않는다" 는 뜻이다. **이미 받아 온 거래는 지우지
//    않는다.** 사용자의 여행 기록이고 결산 스냅샷의 근거다.
//
// ⚠️ 이 파일은 날짜 계산만 한다. DB 는 lib/supabase/queries/funds.ts 가 한다.
// ============================================================================
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import { TRIP_STATUS } from "@/lib/constants/status";

/** 결산을 안 했을 때 여행 종료일로부터 며칠 뒤에 끊는가 */
export const ACCOUNT_AUTO_DISCONNECT_DAYS = 14;

/** 자동 해제일. 이 날부터 끊긴다. 종료일이 없으면 null */
export function autoDisconnectDate(endDate: string | null): Date | null {
  if (!endDate) return null;
  return addDays(parseISO(endDate), ACCOUNT_AUTO_DISCONNECT_DAYS);
}

/** 화면에 적을 해제일. 'M월 d일' */
export function autoDisconnectLabel(endDate: string | null): string | null {
  const date = autoDisconnectDate(endDate);
  return date ? format(date, "M월 d일") : null;
}

/**
 * 지금 자동 해제해야 하는가.
 *
 * ⚠️ 결산 중(ENDED)일 때만 본다. 확정(SETTLED)은 확정하는 순간 이미 끊었고,
 *    준비 중·여행 중은 당연히 유지한다.
 */
export function shouldAutoDisconnect(
  status: string | null | undefined,
  endDate: string | null,
  today: Date = new Date(),
): boolean {
  if (status !== TRIP_STATUS.ENDED) return false;
  const date = autoDisconnectDate(endDate);
  if (!date) return false;
  return differenceInCalendarDays(today, date) >= 0;
}
