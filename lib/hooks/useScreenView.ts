// ============================================================================
// 화면 진입 로깅
// 기준 문서: docs/06_이벤트로그정의서_v2.md §7-0, §11, CLAUDE.md 8장
//
// 모든 주요 화면은 진입 시 이 훅을 호출한다.
//   useScreenView(SCREENS.BUDGET_DETAIL);
//   useScreenView(SCREENS.TRIP_HOME, trip?.status);   // trip_home 만 두 번째 인자
//
// useEffect 가 아니라 useFocusEffect 를 쓴다.
// useEffect 는 최초 마운트에서만 돌기 때문에, 탭을 옮겼다가 돌아오거나
// 뒤로가기로 스택 아래 화면이 다시 보일 때 진입이 기록되지 않는다.
// ============================================================================
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { EVENTS, type ScreenName } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import type { TripStatus } from '@/lib/constants/status';

/**
 * @param screenName SCREENS 상수만 쓴다. 문자열 리터럴 금지.
 * @param tripStatus **`SCREENS.TRIP_HOME` 에서만** 넘긴다. 그 외 화면은 생략한다.
 *
 * TRIP-HOME-01(진행)과 TRIP-HOME-02(종료)는 `/trips/:tripId` 라는 같은 라우트를
 * `trip.status` 로 분기한다. 이 값이 없으면 "종료된 여행 홈에 들어온 사람 중
 * 몇 명이 결산을 확정했는가"를 잴 수 없다 — 결산 도달률의 분모가 사라진다.
 *
 * 값은 `lib/constants/status.ts` 의 `TRIP_STATUS` 상수를 쓴다. 리터럴 금지.
 * 넘기지 않으면 `null` 로 기록된다.
 */
export function useScreenView(screenName: ScreenName, tripStatus?: TripStatus | null): void {
  useFocusEffect(
    useCallback(() => {
      track(EVENTS.SCREEN_VIEWED, {
        screen_name: screenName,
        trip_status: tripStatus ?? null,
      });
      // 이탈 시각은 기록하지 않는다. (docs/06 §10 — 뒤로가기·탭 전환은 미기록)
    }, [screenName, tripStatus]),
  );
}
