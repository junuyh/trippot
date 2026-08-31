// 여행 생성 3단계 공통 레이아웃.
// TripDraftProvider 가 여기 있어서 TRIP-01~03 이 입력값을 공유한다.
// 이 스택을 벗어나면 draft 가 사라진다. (lib/hooks/useTripDraft.tsx)
import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/ui';
import { TripDraftProvider } from '@/lib/hooks/useTripDraft';

export default function TripCreateLayout() {
  return (
    <TripDraftProvider>
      <Stack
        screenOptions={{
          headerBackTitle: '뒤로',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          // 생성 흐름에서 히스토리가 없으면 첫 단계로 되돌린다.
          // 홈으로 보내면 입력하던 여행이 통째로 사라진 것처럼 보인다.
          headerLeft: () => <HeaderBackButton fallbackHref="/trips/new/owner" />,
        }}
      />
    </TripDraftProvider>
  );
}
