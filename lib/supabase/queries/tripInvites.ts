// ============================================================================
// 여행 초대 링크 (INV) — 발급
//
// 기준: docs/10_여행초대정책_v2.md §4 · §5 · §12
//       supabase/migrations/20260911000001_trip_invite_rpc.sql (PR #86)
//
// ⚠️ 앱은 trip_invites 에 직접 INSERT / UPDATE 하지 않는다. GRANT 가 회수돼 있다.
//    발급은 get_or_create_trip_invite() RPC 한 경로다. token · expires_at ·
//    created_by 전부 DB 가 정한다. 앱은 tripId 하나만 넘긴다.
//
// ⚠️ 이 RPC 는 "발급" 이 아니라 **get-or-create** 다.
//    유효한 링크가 있으면 같은 token 을 돌려주고, 만료된 뒤에만 새로 만든다.
//    누가 눌러도 같다 — 처음 만든 사람이 아니어도, 여행장이 아니어도.
//    그래서 화면은 "새 링크를 만들었다" 고 말하지 않는다.
//
// ⚠️ 권한은 RPC 안에서 본다. ACTIVE 여행 멤버가 아니면 42501 로 막힌다.
//    화면에서 여행장 여부로 미리 막지 않는다. (§3 권한표)
// ============================================================================
import { supabase } from '@/lib/supabase/client';

export type TripInvite = {
  inviteId: string;
  /** 링크에 싣는 값. 앱이 만들지 않는다 */
  token: string;
  /** ISO timestamp. DB 서버 시각 기준 발급 + 7일 */
  expiresAt: string;
};

/**
 * 여행 초대 링크를 받는다. 유효한 링크가 있으면 그것을, 없으면 새 것을.
 *
 * ⚠️ 이름이 create 가 아니라 getOrCreate 인 이유가 곧 정책이다. (§4-1)
 *
 * 실패는 그대로 throw 한다. 화면이 안내 문구를 띄운다.
 *   42501  로그인 안 됨 / ACTIVE 멤버 아님
 *   P0002  여행 없음
 */
export async function getOrCreateTripInvite(tripId: string): Promise<TripInvite> {
  const { data, error } = await supabase.rpc('get_or_create_trip_invite', {
    p_trip_id: tripId,
  });
  if (error) throw error;

  // RETURNS TABLE 이라 배열로 온다. 함수는 항상 정확히 한 행을 돌려준다.
  const row = data?.[0];
  if (!row) throw new Error('초대 링크를 받지 못했습니다.');

  return {
    inviteId: row.invite_id,
    token: row.token,
    expiresAt: row.expires_at,
  };
}
