// ============================================================================
// 여행 초대 받는 화면  ·  /invite/:token   (INV-02 초대 확인 · INV-03 승인 대기)
//
// 기준: docs/10_여행초대정책_v2.md §6 · §11 / docs/12_여행초대_승인_RPC계약_v1.md §3 · §4
//
// 흐름
//   링크 열기 → (미로그인이면 /login?next=/invite/:token → 카카오 → 가드가 정한 곳으로)
//   → 초대 확인(resolve) → INV-02 → [참여 요청] → PENDING → INV-03 승인 대기
//
// 2026-09-16 · 화면 몸통은 components/invite/InviteFlowScreen 으로 옮겼다. 알림센터에서
// inviteId 로 다시 들어오는 /invite/by/:inviteId 가 같은 몸통을 쓴다. (docs/14 §5)
// 이 파일은 token 으로 부를 서버 함수 둘과, 아래 pending invite 동기화만 넘긴다.
//
// ⚠️ 2026-09-15 답하지 않은 초대를 기기에 남긴다. (HOME-01 담당 · 한나 확인)
//    참여 요청할 수 있는 초대(NONE · LEFT)면 token 을 저장하고, 요청을 보냈거나
//    '괜찮아요' 를 눌렀거나 더 이상 답할 수 없는 상태면 지운다.
//    요청하지 않고 뒤로 나가면 홈이 모달과 상시 배너로 다시 알린다. (lib/invite/pendingInvites)
//    화면 흐름 · 문구는 바꾸지 않았다. (PR #111 의 로직을 InviteFlowScreen.onStateChange 로 이식)
//    by-id 판(/invite/by/:inviteId)은 token 을 모르므로 저장하지 않는다.
//
// 서버 연결: resolve_trip_invite(token) · request_trip_join(token)
//   앱은 trip_invites · trip_join_requests 를 직접 읽지 않는다. RPC 한 경로다.
// ⚠️ 개발용 미리보기(isPreview · __DEV__)에서만 preview-* 토큰으로 각 상태를 그린다.
// ⚠️ useScreenView 를 부르지 않는다. (SCREENS 상수 없음 · events.ts 는 공유 파일)
// ============================================================================
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { InviteFlowScreen, type InviteRouteState } from '@/components/invite';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { removePendingInvite, savePendingInvite } from '@/lib/invite/pendingInvites';
import { requestTripJoin, resolveTripInvite } from '@/lib/supabase/queries/tripJoinRequests';

export default function ScreenInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const userId = useCurrentUserId();

  const resolve = useCallback(() => resolveTripInvite(token), [token]);
  const request = useCallback(() => requestTripJoin(token), [token]);

  /**
   * 홈이 다시 알려줄 초대를 기기에 맞춘다. (lib/invite/pendingInvites)
   *   참여 요청할 수 있음(NONE · LEFT)  → 저장
   *   이미 답했거나 답할 수 없음         → 삭제
   *   확인 실패 · 확인 중                → 그대로 둔다. 일시적인 실패로 초대를 잃지 않는다.
   * 저장 실패는 화면에 알리지 않는다. 이 화면의 흐름과 무관한 보조 기능이다.
   */
  const syncPendingInvite = useCallback(
    (next: InviteRouteState) => {
      if (!userId || !token) return;
      if (next.kind === 'LOADING' || next.kind === 'ERROR' || next.kind === 'NOT_CONNECTED') return;
      const answerable =
        next.kind === 'VALID' && (next.myState === 'NONE' || next.myState === 'LEFT');
      const task = answerable
        ? savePendingInvite(userId, token)
        : removePendingInvite(userId, token);
      task.catch(() => undefined);
    },
    [userId, token],
  );

  return (
    <InviteFlowScreen
      resolve={resolve}
      request={request}
      previewToken={token}
      missing={!token}
      onStateChange={syncPendingInvite}
    />
  );
}
