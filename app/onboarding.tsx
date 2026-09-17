// ============================================================================
// 온보딩 · /onboarding · MVP (2026-09-17)
//
// 신규 사용자 홈의 '둘러보기' 카드(OnboardingEntryCard)를 누르면 들어온다.
// 홈에 캐러셀을 바로 펼치던 것을 궁금한 사람만 들어와 보는 페이지로 옮겼다.
//
// ⚠️ [검토 필요] docs/04_화면목록_v3.md 에 없는 화면이다. 홈(HOME-01)에서만 들어오는
//    하위 페이지라 홈 담당 범위로 만들었다. 화면목록 반영은 팀 확인이 필요하다.
// ⚠️ [검토 필요] useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 추가하지 않는다. (CLAUDE.md 8장)
//    "몇 명이 열고, 몇 장까지 보고, 마지막 장에서 여행을 만드는지" 를 보려면 이벤트 요청이 필요하다.
//
// '첫 여행 만들기' 는 홈의 신규 사용자 버튼과 같은 entryPoint(EMPTY_STATE)로 보낸다.
// 이벤트는 TRIP-01 이 entryPoint 를 읽어 기록하므로 퍼널이 바뀌지 않는다.
//
// 이 파일은 이동만 한다. 보이는 UI 는 components/home/onboarding/OnboardingView 다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useRouter } from 'expo-router';
import { useRef } from 'react';

import { OnboardingView } from '@/components/home';
import { ENTRY_POINT } from '@/lib/constants/status';

export default function ScreenOnboarding() {
  const router = useRouter();
  /** 여행 만들기로 두 번 보내지 않게 막는다. */
  const leaving = useRef(false);

  function handleClose() {
    if (leaving.current) return;
    leaving.current = true;
    // 딥링크로 바로 들어와 돌아갈 곳이 없으면 홈으로 간다.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function handleCreateTrip() {
    if (leaving.current) return;
    leaving.current = true;
    // replace — 여행 만들기에서 뒤로 가면 온보딩이 아니라 홈으로 돌아간다.
    router.replace(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`);
  }

  return (
    <>
      {/* 진행 표시 · 건너뛰기를 페이지가 직접 그린다. */}
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingView onCreateTrip={handleCreateTrip} onClose={handleClose} />
    </>
  );
}
