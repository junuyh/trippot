// ============================================================================
// MY-02 나의 여행 · /me/trips · MVP
// 기준 문서: docs/04_화면목록_v3.md MY-02, docs/09_IA_v2.md §1-1 / §1-2
//
// 홈(HOME-01)의 '준비 중인 여행 — 전체 보기' 가 여기로 들어온다.
// 홈은 지금 챙길 것만 추려 보여주고, 이 화면이 전부 훑는 자리다.
//
// 탭은 준비 중 / 여행 중 / 지난 여행 / 취소된 여행 / 나간 여행 다섯이다. (components/my/types.ts)
//
// ⚠️ 화면목록에서 MY-02 담당은 아직 `[미확정]` B 또는 C 다. HOME-01 과 같은 묶음이라
//    홈 담당자가 이어서 만들었다. 담당이 갈리면 사람에게 알린다. (CLAUDE.md 13장)
//
// 2026-09-21 목록의 데이터·상태·되돌리기 로직을 lib/hooks/useMyTrips 로 옮겼다. 하단 모임 탭의 [여행]
//   (/groups?tab=trips)이 같은 목록을 쓰기 때문이다. 이 화면의 동작(?filter= · 되돌리기 팝업 · 여행 홈 '<' 복귀)은
//   그대로다. 이 파일은 진입 로그와 헤더만 책임진다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams } from 'expo-router';

import { MyTripsSection } from '@/components/my';
import { SCREENS } from '@/lib/analytics/events';
import { MY_TRIPS_ORIGIN, useMyTrips } from '@/lib/hooks/useMyTrips';
import { useScreenView } from '@/lib/hooks/useScreenView';

export default function ScreenMY02() {
  useScreenView(SCREENS.MY_TRIPS);

  // 홈에서 ?filter=past 로도 들어올 수 있게 열어 둔다. 기본은 준비 중이다.
  const params = useLocalSearchParams<{ filter?: string }>();
  const section = useMyTrips({ origin: MY_TRIPS_ORIGIN.MY, paramFilter: params.filter });

  return (
    <>
      <Stack.Screen options={{ title: '내 여행', headerTitleAlign: 'center' }} />
      <MyTripsSection {...section} />
    </>
  );
}
