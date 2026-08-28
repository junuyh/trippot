// 여행 생성 3단계 공통 레이아웃.
// TripDraftProvider 가 여기 있어서 TRIP-01~03 이 입력값을 공유한다.
// 이 스택을 벗어나면 draft 가 사라진다. (lib/hooks/useTripDraft.tsx)
import { Stack } from 'expo-router';

import { TripDraftProvider } from '@/lib/hooks/useTripDraft';

export default function TripCreateLayout() {
  return (
    <TripDraftProvider>
      <Stack screenOptions={{ headerBackTitle: '뒤로' }} />
    </TripDraftProvider>
  );
}
