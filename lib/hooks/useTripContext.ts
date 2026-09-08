// ============================================================================
// 여행 컨텍스트 설정
// 기준 문서: docs/06_이벤트로그정의서_v4.md §5, CLAUDE.md 8장
//
// `/trips/:tripId` 아래 모든 화면이 진입 시 부른다.
//   useTripContext(tripId);
//
// 이 훅이 도는 동안 그 화면에서 나가는 **모든 이벤트에 trip_id 가 붙는다.**
//
// ============================================================================
// 왜 필요한가 — v3 까지 trip_id 가 전부 null 이었다
// ============================================================================
//
//   track.ts 에 setTripContext() 가 있었지만 **부르는 곳이 하나도 없었다.**
//   정의서는 "여행 컨텍스트가 있으면 자동으로 붙는다" 고만 적어 두어
//   아무도 비어 있다는 걸 몰랐다.
//
//   trip_id 가 없으면 **여행 단위 분해가 통째로 불가능하다.**
//     "오사카 여행에서 예산을 몇 번 고쳤나"
//     "유럽 여행의 보험 견적 확인률이 더 높은가"
//   개인화(가설 4)와 BM 1 이 둘 다 여행 단위 비교를 전제로 한다.
//
// ⚠️ useEffect 가 아니라 useFocusEffect 다. useScreenView 와 같은 이유다.
//    뒤로가기로 스택 아래 화면이 다시 보일 때도 컨텍스트가 돌아와야 한다.
//    useEffect 로 하면 여행 A → 여행 B → 뒤로 했을 때 A 화면인데
//    컨텍스트는 B 인 상태가 된다. 그 화면의 이벤트가 남의 여행에 붙는다.
//
// ⚠️ 화면을 벗어나면 **반드시 해제한다.** 안 하면 여행에서 빠져나와
//    홈이나 커뮤니티로 간 뒤에도 마지막 여행 id 가 계속 붙는다.
//    "이 여행에서 커뮤니티 글을 봤다" 는 사실이 아니다.
// ============================================================================
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { setTripContext } from '@/lib/analytics/track';

/**
 * @param tripId Expo Router param. 아직 없거나 배열이면 설정하지 않는다.
 */
export function useTripContext(tripId: string | string[] | undefined): void {
  const id = Array.isArray(tripId) ? tripId[0] : tripId;

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setTripContext(id);
      return () => setTripContext(null);
    }, [id]),
  );
}
