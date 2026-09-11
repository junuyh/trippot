// ============================================================================
// 여행 초대 받는 화면 (INV-02)  ·  /invite/:token
//
// 기준: docs/10_여행초대정책_v2.md §6 · §11
//
// ⚠️ 지금은 **자리만** 있다. (Sender P0 · 2026-09-11)
//    초대 링크를 실제로 내보내기 시작했으므로, 링크를 눌렀을 때 404 가 나면
//    안 된다. 그래서 라우트를 먼저 만들었다.
//
//    token 검증은 **서버 쪽 경로**(Edge Function · service_role SELECT)에서 해야
//    한다. 수신자는 아직 ACTIVE 멤버가 아니라 trip_invites 를 직접 읽을 수 없고
//    (RLS), 그래야 예산·멤버가 새지 않는다. (§6 · §11)
//    그 Edge Function 이 아직 없어서, 여기서 InviteLandingView 에 넣을 preview
//    (여행지 · 일정 · 인원 · 초대한 사람)를 **만들 방법이 없다.**
//    가짜 데이터로 채우지 않는다. 준비 중이라고만 알린다.
//
// ⚠️ 로그인하지 않은 사람이 열면 app/_layout.tsx 가드가 /login?next=/invite/:token
//    으로 보냈다가 로그인 뒤 여기로 돌려보낸다. token 은 그 왕복에서 보존된다.
//    (usePathname 기준 · 2026-09-11)
//
// 이어질 일 [receiver 담당]
//   resolveTripInvite(token) → InvitePreview → InviteLandingView
//   → 참가 요청 → trip_join_requests PENDING → JoinWaitingView
// ============================================================================
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui';

export default function ScreenInvite() {
  // token 은 지금 쓰지 않지만 라우트 계약의 일부다. receiver 가 이 이름으로 받는다.
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: '여행 초대' }} />
      <EmptyState
        icon="mail-open-outline"
        title="초대 확인은 준비 중이에요"
        description={
          token
            ? '초대 링크는 받았어요. 링크에서 참가를 요청하고 여행장이 수락하는 흐름을 준비하고 있어요. 곧 여기서 바로 이어져요.'
            : '초대 링크가 올바르지 않아요. 초대한 분에게 다시 받아 주세요.'
        }
        actionLabel="홈으로"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
