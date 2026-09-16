// ============================================================================
// 여행 초대 다시 열기  ·  /invite/by/:inviteId        (docs/14_알림센터_v1.md §5)
//
// 알림센터 → INVITE_RECEIVED 상세 → [여행 초대 확인하기] 로 온다. 앱은 raw invite token 을
// 저장하지 않으므로 inviteId(uuid)만 안다. 서버(resolve_trip_invite_by_id ·
// request_trip_join_by_invite)가 "그 초대의 알림을 받은 사람 · 요청한 적 있는 사람 · 그 여행
// ACTIVE 멤버" 인지 확인한 뒤 token 판과 똑같은 결과를 돌려준다. token 은 내려오지 않는다.
//
// 화면은 /invite/:token 과 같은 몸통(InviteFlowScreen)이다. 미리보기 토큰은 없다.
// ⚠️ useScreenView 를 부르지 않는다. (SCREENS 상수 없음 · events.ts 는 공유 파일)
// ============================================================================
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { InviteFlowScreen } from '@/components/invite';
import {
  requestTripJoinByInvite,
  resolveTripInviteById,
} from '@/lib/supabase/queries/tripJoinRequests';

export default function ScreenInviteById() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();

  const resolve = useCallback(() => resolveTripInviteById(inviteId), [inviteId]);
  const request = useCallback(() => requestTripJoinByInvite(inviteId), [inviteId]);

  return <InviteFlowScreen resolve={resolve} request={request} missing={!inviteId} />;
}
