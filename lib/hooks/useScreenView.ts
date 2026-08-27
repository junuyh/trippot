// ============================================================================
// 화면 진입 로깅
// 기준 문서: docs/06_이벤트로그정의서_v1.md §7-0, §11, CLAUDE.md 8장
//
// 모든 주요 화면은 진입 시 이 훅을 호출한다.
//   useScreenView(SCREENS.BUDGET_DETAIL);
//
// useEffect 가 아니라 useFocusEffect 를 쓴다.
// useEffect 는 최초 마운트에서만 돌기 때문에, 탭을 옮겼다가 돌아오거나
// 뒤로가기로 스택 아래 화면이 다시 보일 때 진입이 기록되지 않는다.
// ============================================================================
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { EVENTS, type ScreenName } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';

/**
 * @param screenName SCREENS 상수만 쓴다. 문자열 리터럴 금지.
 * @param params     화면별 추가 파라미터가 필요할 때만 넘긴다. 보통은 생략한다.
 */
export function useScreenView(
  screenName: ScreenName,
  params?: Record<string, string | number | boolean | null | undefined>,
): void {
  // params 를 그대로 deps 에 넣으면 매 렌더마다 새 객체라 무한히 재실행된다.
  const paramsKey = params ? JSON.stringify(params) : '';

  useFocusEffect(
    useCallback(() => {
      track(EVENTS.SCREEN_VIEWED, {
        screen_name: screenName,
        ...(paramsKey ? (JSON.parse(paramsKey) as Record<string, string>) : {}),
      });
      // 이탈 시각은 기록하지 않는다. (docs/06 §10 — 뒤로가기·탭 전환은 미기록)
    }, [screenName, paramsKey]),
  );
}
