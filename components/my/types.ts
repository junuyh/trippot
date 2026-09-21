// ============================================================================
// MY-02 나의 여행 화면이 그리는 데이터 모양
// 기준 문서: docs/04_화면목록_v3.md MY-02
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import type { TripStatus } from '@/lib/constants/status';
import type { TripStage } from '@/lib/trip/stage';

/**
 * 목록에서 어떤 여행을 보여줄지.
 *
 *   planning   준비 중 (PLANNING)
 *   traveling  여행 중 (TRAVELING)
 *   past       지난 여행 (ENDED · SETTLED)
 *   canceled   취소된 여행 (CANCELED) — 되돌릴 수 있다
 *   left       나간 여행 (trip_members.status = LEFT) — 여행 자체는 살아 있다
 *
 * ⚠️ 예전에는 준비 중과 여행 중을 'ongoing' 하나로 묶어 두었다.
 *    묶어 놓으면 지금 떠나 있는 여행이 아직 출발도 안 한 여행 사이에 섞여서,
 *    가장 급한 여행을 목록에서 찾아야 했다. 상태가 다르면 할 일도 다르다 —
 *    준비 중은 자금을 모으는 화면으로, 여행 중은 지출을 적는 화면으로 간다.
 */
export type MyTripFilter = 'planning' | 'traveling' | 'past' | 'canceled' | 'left';

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
   * 지난 여행의 최종 여행비. 결산 전(ENDED)이면 null 이고 카드는 그 자리를 비운다.
   * (상태는 위 배지가 말한다. MyTripCard 의 금액 줄 주석 · 2026-09-21)
   * (docs/09_IA §1-2 — 최종 여행비)
   */
  finalAmount: number | null;
  /** 왼쪽 색 띠·진행률 색. 목적지 국가 테마의 primary. */
  color: string;
  /** D-Day 배지 배경. 국가 테마의 primarySoft. */
  colorSoft: string;
  /**
   * 내가 나간 여행인가. (trip_members.status = LEFT)
   *
   * ⚠️ trips.status 로는 알 수 없다. 여행 자체는 남아 있고 **나만** 빠진
   *    것이라, 멤버 행을 봐야 한다. 카드가 색을 뺄지 정하는 데 쓴다.
   */
  left?: boolean;
  /**
   * 취소된 여행을 지금 되돌릴 수 있는가. (POL-CXL-030 · 72시간) 2026-09-16
   *
   * ⚠️ 취소된 여행 탭에서만 채운다. 다른 탭 · GROUP-02 에서는 undefined 라 버튼이 없다.
   * ⚠️ 72시간이 지나면 false. 되돌리기 수단이 없다. (POL-CXL-031)
   */
  restorable?: boolean;
  /** 되돌리기 남은 시간. '2일 7시간'. restorable 일 때만 값이 있다. */
  restoreRemainingLabel?: string | null;
  /**
   * 되돌리기 마감 시각. '9월 18일 15:40'. restorable 일 때만 값이 있다.
   * ⚠️ 남은 시간('2일 7시간')보다 마감 시각이 낫다. 목록을 띄워 둔 채 시간이 흘러도
   *    틀린 말이 되지 않는다. (2026-09-16)
   */
  restoreDeadlineLabel?: string | null;
  /**
   * 여행 단계. 지난 여행 배지에 '정산 대기 중' · '지출 입력 전' 처럼 쓴다.
   *
   * ⚠️ 여행 홈(TRIP-HOME-02) 배지와 같은 값이다. status 만으로는 ENDED 가
   *    '결산 전' 하나로 뭉쳐서, 지출이 없는 여행에도 결산을 하라는 말이 된다.
   *    (lib/trip/stage.ts) 값이 없으면 카드가 예전처럼 status 로 쓴다.
   */
  stage?: TripStage;
};
