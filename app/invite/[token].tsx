// ============================================================================
// 여행 초대 받는 화면  ·  /invite/:token   (INV-02 초대 확인 · INV-03 승인 대기)
//
// 기준: docs/10_여행초대정책_v2.md §6 · §11 / docs/12_여행초대_승인_RPC계약_v1.md §3 · §4
//
// 흐름
//   링크 열기 → (미로그인이면 /login?next=/invite/:token → 카카오 → 여기로 복귀)
//   → 초대 확인(resolve) → INV-02 → [참여 요청] → PENDING → INV-03 승인 대기
//
// 2026-09-16 · 화면 몸통은 components/invite/InviteFlowScreen 으로 옮겼다. 알림센터에서
// inviteId 로 다시 들어오는 /invite/by/:inviteId 가 같은 몸통을 쓴다. (docs/13 §5)
// 이 파일은 token 으로 부를 서버 함수 둘을 넘길 뿐이다.
//
// 서버 연결: resolve_trip_invite(token) · request_trip_join(token)
//   앱은 trip_invites · trip_join_requests 를 직접 읽지 않는다. RPC 한 경로다.
// ⚠️ 개발용 미리보기(isPreview · __DEV__)에서만 preview-* 토큰으로 각 상태를 그린다.
// ⚠️ useScreenView 를 부르지 않는다. (SCREENS 상수 없음 · events.ts 는 공유 파일)
// ============================================================================
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { InviteFlowScreen } from '@/components/invite';
import { requestTripJoin, resolveTripInvite } from '@/lib/supabase/queries/tripJoinRequests';

export default function ScreenInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const resolve = useCallback(() => resolveTripInvite(token), [token]);
  const request = useCallback(() => requestTripJoin(token), [token]);

  return (
    <InviteFlowScreen resolve={resolve} request={request} previewToken={token} missing={!token} />
  );
}
