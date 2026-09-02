// ============================================================================
// MY-02 나의 여행 화면이 그리는 데이터 모양
// 기준 문서: docs/04_화면목록_v3.md MY-02
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import type { TripStatus } from '@/lib/constants/status';

/** 목록에서 어떤 여행을 보여줄지. 홈의 '전체 보기' 는 ongoing 으로 들어온다. */
export type MyTripFilter = 'ongoing' | 'past';

export type MyTripItem = {
  tripId: string;
  /** trips.destination 은 nullable 이다. 없으면 카드가 대체 문구를 쓴다. */
  destination: string | null;
  /** 국기 이모지. 모르는 목적지면 🌍 */
  flag: string;
  /** 'YYYY-MM-DD'. date 타입이라 시간대 변환이 없다. nullable. */
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  /** 개인 여행이면 '개인', 모임 여행이면 모임명. */
  ownerLabel: string;
  /**
   * 진행 중 여행의 현재 여행자금 / 목표 여행비.
   * 지난 여행에서는 쓰지 않는다.
   */
  currentAmount: number | null;
  targetAmount: number | null;
  /**
   * 지난 여행의 최종 여행비. 결산 전(ENDED)이면 null 이고 카드가 '결산 전' 으로 쓴다.
   * (docs/09_IA §1-2 — 최종 여행비)
   */
  finalAmount: number | null;
  /** 왼쪽 색 띠·진행률 색. 목적지 국가 테마의 primary. */
  color: string;
  /** D-Day 배지 배경. 국가 테마의 primarySoft. */
  colorSoft: string;
};
